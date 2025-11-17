import os
import json
import logging
import copy
import random
import string
import threading
import time
import io
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests
from dotenv import load_dotenv
import qrcode

from logger import log_event, log_error

# Load environment variables from .env if present
load_dotenv()


def _normalize_external_url(value: str, default_scheme: str = "http") -> str:
    """
    Ensure that the provided value includes an HTTP/HTTPS scheme. Returns an
    empty string when the input is empty or only whitespace.
    """
    if not value:
        return ""
    cleaned = value.strip()
    if not cleaned:
        return ""
    if cleaned.startswith(("http://", "https://")):
        return cleaned
    if cleaned.startswith("//"):
        return f"{default_scheme}:{cleaned}"
    return f"{default_scheme}://{cleaned}"


DEFAULT_OPENAI_MODEL_IDS: List[str] = [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-3.5-turbo",
    "o3-mini",
]

DEFAULT_CLOUD_STORAGE_PATH = Settings().cloud_storage_path


def _build_tailscale_health_url(value: str) -> str:
    """
    Accepts either a raw IP/hostname or a fully-qualified URL. Automatically
    appends /health and default port 8088 when omitted.
    """
    if not value:
        return ""
    target = value.strip()
    if not target:
        return ""
    if "://" in target:
        return target
    path = "/health"
    host_port = target
    if "/" in target:
        host_port, remainder = target.split("/", 1)
        path = f"/{remainder.lstrip('/')}" or "/health"
    if ":" in host_port:
        host, port = host_port.split(":", 1)
    else:
        host, port = host_port, "8088"
    host = host.strip()
    port = port.strip() or "8088"
    if not host:
        return ""
    if not path.startswith("/"):
        path = f"/{path}"
    return f"http://{host}:{port}{path}"


def _normalize_cloud_path(path_str: str) -> str:
    if not path_str:
        return DEFAULT_CLOUD_STORAGE_PATH
    cleaned = path_str.strip().strip('"')
    return cleaned or DEFAULT_CLOUD_STORAGE_PATH


def _compute_cloud_storage_status(path_str: str) -> Dict[str, Any]:
    status: Dict[str, Any] = {
        "path": path_str,
        "resolved_path": "",
        "available": False,
        "detail": "",
        "free_gb": None,
        "total_gb": None,
    }
    try:
        path = Path(path_str).expanduser()
        path.mkdir(parents=True, exist_ok=True)
        total, used, free = shutil.disk_usage(path)
        status.update(
            {
                "resolved_path": str(path.resolve()),
                "available": True,
                "free_gb": round(free / (1024 ** 3), 2),
                "total_gb": round(total / (1024 ** 3), 2),
            }
        )
    except Exception as exc:
        status["detail"] = str(exc)
    return status


cloud_storage_status: Dict[str, Any] = {}


def _update_cloud_storage_status(path: Optional[str] = None) -> Dict[str, Any]:
    target_path = _normalize_cloud_path(
        path or runtime_settings.get("cloud_storage_path", DEFAULT_CLOUD_STORAGE_PATH)
    )
    status = _compute_cloud_storage_status(target_path)
    cloud_storage_status.clear()
    cloud_storage_status.update(status)
    runtime_settings["cloud_storage_path"] = target_path
    return cloud_storage_status


class Settings(BaseModel):
    """Model for updating and returning runtime settings."""
    openai_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1")
    remote_url: str = os.getenv("REMOTE_URL", "")
    # Tailscale home hub IP, used for admin panel configuration
    tailscale_ip: str = os.getenv("TAILSCALE_IP", "")
    system_instructions: str = os.getenv("SYSTEM_INSTRUCTIONS", "")
    cloud_storage_path: str = os.getenv("CLOUD_STORAGE_PATH", str(Path("D:/TheCloud")))


app = FastAPI()

# ----- Dashboard data models and helpers -----


class UserCreate(BaseModel):
    """Payload required to create a new user entry."""
    name: str
    handle: str
    email: str
    role: str = "user"


class UserUpdate(BaseModel):
    """Fields that can be updated for an existing user."""
    name: Optional[str] = None
    handle: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    lastSeen: Optional[str] = None
    devices: Optional[int] = None
    aiUsage: Optional[int] = None
    storageUsed: Optional[float] = None


class InviteCreate(BaseModel):
    """Payload for generating a new invite."""
    maxUses: int = 5
    expiresDays: int = 45


class SystemSettingsUpdate(BaseModel):
    """System settings that the admin UI can update."""
    allowRegistration: Optional[bool] = None
    requireEmailVerification: Optional[bool] = None
    aiRateLimit: Optional[int] = None
    storagePerUser: Optional[int] = None
    maxDevicesPerUser: Optional[int] = None
    sessionTimeout: Optional[int] = None
    enableBackups: Optional[bool] = None
    backupFrequency: Optional[str] = None
    maintenanceMode: Optional[bool] = None
    debugMode: Optional[bool] = None


class ApiPingRequest(BaseModel):
    """Payload for testing connectivity to an arbitrary HTTP endpoint."""
    url: str
    method: str = "GET"
    timeout: int = 10


DEFAULT_SYSTEM_SETTINGS: Dict[str, Any] = {
    "allowRegistration": False,
    "requireEmailVerification": False,
    "aiRateLimit": 0,
    "storagePerUser": 0,
    "maxDevicesPerUser": 0,
    "sessionTimeout": 0,
    "enableBackups": False,
    "backupFrequency": "manual",
    "maintenanceMode": False,
    "debugMode": False,
}

SETTINGS_FILE = Path(__file__).parent / "settings.json"
DATA_FILE = Path(__file__).parent / "dashboard_data.json"
DATA_LOCK = threading.Lock()
SETTINGS_LOCK = threading.Lock()


def _load_runtime_settings() -> Dict[str, str]:
    settings = Settings().model_dump()
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                stored = json.load(f)
            for key, value in stored.items():
                if isinstance(value, str):
                    settings[key] = value
        except Exception as exc:
            logging.warning("Failed to load settings.json: %s", exc)
    return settings


def _save_runtime_settings() -> None:
    with SETTINGS_LOCK:
        SETTINGS_FILE.write_text(json.dumps(runtime_settings, indent=2), encoding="utf-8")


DEFAULT_DASHBOARD_DATA: Dict[str, Any] = {
    "profile": {
        "name": "",
        "handle": "",
        "email": "",
        "deviceId": "",
        "role": "",
    },
    "users": [],
    "systemSettings": copy.deepcopy(DEFAULT_SYSTEM_SETTINGS),
    "invites": [],
    "logs": [],
}


def _deepcopy_default() -> Dict[str, Any]:
    return copy.deepcopy(DEFAULT_DASHBOARD_DATA)


def _looks_like_demo_data(data: Dict[str, Any]) -> bool:
    profile = data.get("profile", {})
    if profile.get("name") == "Alex Rivera":
        return True
    demo_handles = {"@alex", "@sofia", "@marcus", "@emily", "@david", "@rachel"}
    handles = {user.get("handle") for user in data.get("users", [])}
    return bool(handles.intersection(demo_handles))


def _load_dashboard_data() -> Dict[str, Any]:
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if _looks_like_demo_data(data):
                logging.info("Demo dashboard data detected; resetting to empty state.")
                return _deepcopy_default()
            merged = _deepcopy_default()
            for key, value in data.items():
                if isinstance(value, dict) and isinstance(merged.get(key), dict):
                    merged[key].update(value)
                else:
                    merged[key] = value
            return merged
        except Exception as exc:
            logging.warning("Failed to load dashboard data: %s", exc)
    return _deepcopy_default()


runtime_settings = _load_runtime_settings()
if runtime_settings.get("ollama_url"):
    runtime_settings["ollama_url"] = _normalize_external_url(runtime_settings["ollama_url"], "http")
if runtime_settings.get("remote_url"):
    runtime_settings["remote_url"] = _normalize_external_url(runtime_settings["remote_url"], "https")
runtime_settings["cloud_storage_path"] = _normalize_cloud_path(
    runtime_settings.get("cloud_storage_path", DEFAULT_CLOUD_STORAGE_PATH)
)
_update_cloud_storage_status(runtime_settings["cloud_storage_path"])
dashboard_state: Dict[str, Any] = _load_dashboard_data()


def _save_dashboard_locked() -> None:
    """Persist the dashboard_state to disk. Assumes DATA_LOCK is held."""
    DATA_FILE.write_text(json.dumps(dashboard_state, indent=2), encoding="utf-8")


def _next_id(items: List[Dict[str, Any]]) -> int:
    return max((item.get("id", 0) for item in items), default=0) + 1


def _add_log_entry(action: str, user: str = "system", status: str = "success") -> None:
    timestamp = datetime.now(timezone.utc)
    entry = {
        "id": _next_id(dashboard_state.get("logs", [])),
        "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "user": user,
        "action": action,
        "ip": "localhost",
        "status": status,
    }

    dashboard_state.setdefault("logs", [])
    dashboard_state["logs"].insert(0, entry)
    dashboard_state["logs"] = dashboard_state["logs"][:200]


def _generate_invite_code() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"INV-{datetime.now(timezone.utc).year}-{suffix}"


def _ensure_dashboard_defaults() -> None:
    """Make sure the dashboard_state always has the expected keys."""
    for key, value in DEFAULT_DASHBOARD_DATA.items():
        dashboard_state.setdefault(key, copy.deepcopy(value))
    dashboard_state.setdefault("systemSettings", {})
    for key, val in DEFAULT_SYSTEM_SETTINGS.items():
        dashboard_state["systemSettings"].setdefault(key, val)


_ensure_dashboard_defaults()
tailscale_status: Dict[str, Any] = {
    "reachable": False,
    "latency_ms": None,
    "last_checked": None,
    "detail": "Not verified yet",
}


def _check_tailscale_connectivity(ip: str) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    status = {
        "reachable": False,
        "latency_ms": None,
        "last_checked": now,
        "detail": "No Tailscale address configured" if not ip else "",
    }
    if not ip:
        return status
    url = _build_tailscale_health_url(ip)
    if not url:
        status["detail"] = "Invalid Tailscale address"
        return status
    start = time.perf_counter()
    try:
        response = requests.get(url, timeout=5)
        latency = int((time.perf_counter() - start) * 1000)
        status["latency_ms"] = latency
        status["last_checked"] = datetime.now(timezone.utc).isoformat()
        if response.status_code == 200:
            try:
                payload = response.json()
                detail = payload.get("status", "ok")
            except Exception:
                detail = "reachable"
            status["reachable"] = True
            status["detail"] = detail
        else:
            status["detail"] = f"HTTP {response.status_code}"
    except Exception as exc:
        status["detail"] = str(exc)
    status["tested_url"] = url
    return status


def _update_tailscale_status(ip: Optional[str] = None) -> Dict[str, Any]:
    selected_ip = ip or runtime_settings.get("tailscale_ip", "")
    status = _check_tailscale_connectivity(selected_ip)
    tailscale_status.update(status)
    return tailscale_status


if runtime_settings.get("tailscale_ip"):
    _update_tailscale_status()
# Allow CORS for local development and Tailscale clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def serve_index_html():
    """
    Serve the main HTML file for the web UI. This page contains
    the React-based admin panel which also includes chat and settings
    management. It replaces the older chat-only interface.
    """
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    if not os.path.exists(index_path):
        log_error("index.html not found")
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path, media_type="text/html")


@app.get("/health")
def health() -> Dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}


@app.get("/api/settings")
def get_settings() -> Dict[str, Any]:
    """Return current runtime settings."""
    return runtime_settings


@app.post("/api/settings")
async def update_settings(request: Request) -> Dict[str, Any]:
    """
    Update runtime settings. Any provided fields in the request body will
    override the current settings.
    """
    try:
        data = await request.json()
    except Exception as exc:
        log_error(f"Invalid JSON in settings update: {exc}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    updated: Dict[str, Any] = {}
    for key in runtime_settings:
        if key in data and isinstance(data[key], str):
            value = data[key]
            if key == "ollama_url":
                value = _normalize_external_url(value, "http")
            elif key == "remote_url":
                value = _normalize_external_url(value, "https")
            elif key == "cloud_storage_path":
                value = _normalize_cloud_path(value)
            runtime_settings[key] = value
            updated[key] = value
            log_event(f"Setting {key} updated to: {value}")

    if updated:
        _save_runtime_settings()
    if "cloud_storage_path" in updated:
        _update_cloud_storage_status(updated["cloud_storage_path"])

    return {"status": "updated", "updated": updated}


# ================== Dashboard Data Endpoints ======================
@app.get("/api/dashboard")
def get_dashboard() -> Dict[str, Any]:
    """Return the current dashboard data (users, invites, logs, etc.)."""
    return dashboard_state


@app.post("/api/users")
def create_user(user: UserCreate) -> Dict[str, Any]:
    """Create a new user entry and persist it."""
    with DATA_LOCK:
        users = dashboard_state.setdefault("users", [])
        new_id = _next_id(users)
        entry = {
            "id": new_id,
            "name": user.name,
            "handle": user.handle,
            "email": user.email,
            "role": user.role or "user",
            "status": "online",
            "lastSeen": "Just now",
            "joined": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "devices": 0,
            "aiUsage": 0,
            "storageUsed": 0.0,
        }
        users.append(entry)
        _add_log_entry(f"User created: {user.handle}", user.handle)
        _save_dashboard_locked()
    log_event(f"User created via API: {user.handle}")
    return entry


@app.patch("/api/users/{user_id}")
def modify_user(user_id: int, user_update: UserUpdate) -> Dict[str, Any]:
    """Update an existing user record."""
    updates = user_update.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")

    with DATA_LOCK:
        users = dashboard_state.setdefault("users", [])
        user = next((u for u in users if u["id"] == user_id), None)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.update(updates)
        _add_log_entry(f"User updated: {user.get('handle')}", user.get("handle", "system"))
        _save_dashboard_locked()

    log_event(f"User {user_id} updated: {updates}")
    return user


@app.delete("/api/users/{user_id}")
def remove_user(user_id: int) -> Dict[str, Any]:
    """Remove a user from the dashboard."""
    with DATA_LOCK:
        users = dashboard_state.setdefault("users", [])
        for index, user in enumerate(users):
            if user["id"] == user_id:
                deleted_user = users.pop(index)
                _add_log_entry(f"User deleted: {deleted_user.get('handle')}")
                _save_dashboard_locked()
                log_event(f"User deleted: {deleted_user.get('handle')}")
                return {"status": "deleted", "user": deleted_user}
    raise HTTPException(status_code=404, detail="User not found")


@app.post("/api/invites")
def create_invite(invite: InviteCreate) -> Dict[str, Any]:
    """Create a new invite code."""
    expires_days = max(1, invite.expiresDays)
    expiration = (datetime.now(timezone.utc) + timedelta(days=expires_days)).strftime("%Y-%m-%d")
    with DATA_LOCK:
        invites = dashboard_state.setdefault("invites", [])
        new_id = _next_id(invites)
        code = _generate_invite_code()
        entry = {
            "id": new_id,
            "code": code,
            "createdBy": dashboard_state.get("profile", {}).get("handle", "system"),
            "uses": 0,
            "maxUses": invite.maxUses,
            "expiresAt": expiration,
            "status": "active",
        }
        invites.append(entry)
        _add_log_entry(f"Invite created: {code}")
        _save_dashboard_locked()
    log_event(f"Invite created: {entry['code']}")
    return entry


@app.delete("/api/invites/{invite_id}")
def delete_invite(invite_id: int) -> Dict[str, Any]:
    """Delete an invite."""
    with DATA_LOCK:
        invites = dashboard_state.setdefault("invites", [])
        for index, inv in enumerate(invites):
            if inv["id"] == invite_id:
                removed = invites.pop(index)
                _add_log_entry(f"Invite deleted: {removed.get('code')}")
                _save_dashboard_locked()
                log_event(f"Invite deleted: {removed.get('code')}")
                return {"status": "deleted", "invite": removed}
    raise HTTPException(status_code=404, detail="Invite not found")


@app.patch("/api/system-settings")
def update_system_settings(settings: SystemSettingsUpdate) -> Dict[str, Any]:
    """Update the system settings block."""
    updates = settings.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No settings provided")

    with DATA_LOCK:
        dashboard_state.setdefault("systemSettings", {})
        dashboard_state["systemSettings"].update(updates)
        _add_log_entry("System settings updated")
        _save_dashboard_locked()

    log_event("System settings updated via API")
    return {"systemSettings": dashboard_state["systemSettings"]}


# ================== Tailscale Endpoints ======================
@app.get("/api/tailscale")
def get_tailscale_settings() -> Dict[str, Any]:
    """Return current Tailscale configuration."""
    return {
        "tailscale_ip": runtime_settings.get("tailscale_ip", ""),
        "status": tailscale_status,
    }


@app.post("/api/tailscale")
async def update_tailscale_settings(request: Request) -> Dict[str, Any]:
    """Update Tailscale configuration."""
    try:
        data = await request.json()
    except Exception as exc:
        log_error(f"Invalid JSON in tailscale update: {exc}")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    updated = {}
    if 'tailscale_ip' in data and isinstance(data['tailscale_ip'], str):
        runtime_settings['tailscale_ip'] = data['tailscale_ip']
        updated['tailscale_ip'] = data['tailscale_ip']
        log_event(f"Tailscale IP updated to: {data['tailscale_ip']}")
    if updated:
        _save_runtime_settings()
        _update_tailscale_status(runtime_settings.get("tailscale_ip", ""))
    return {"status": "updated", "updated": updated, "tailscale_status": tailscale_status}


@app.post("/api/tailscale/verify")
async def verify_tailscale(request: Request) -> Dict[str, Any]:
    """Verify connectivity to the configured or provided Tailscale IP."""
    ip_override = None
    try:
        data = await request.json()
        if isinstance(data, dict):
            ip_override = data.get("ip")
    except Exception:
        ip_override = None
    status = _update_tailscale_status(ip_override)
    return status


@app.get("/api/tailscale/peers")
def get_tailscale_peers() -> Dict[str, Any]:
    """Return list of Tailscale peers. Placeholder implementation."""
    # In a real implementation, this would call Tailscale CLI or API to get peer info.
    return {"peers": []}


@app.get("/api/storage")
def get_storage_status() -> Dict[str, Any]:
    """Return the health of the configured cloud storage path."""
    status = _update_cloud_storage_status()
    return status


@app.post("/api/tools/ping")
def ping_http_endpoint(payload: ApiPingRequest) -> Dict[str, Any]:
    """Perform a lightweight HTTP(S) request to verify connectivity."""
    normalized_url = _normalize_external_url(payload.url, "https")
    if not normalized_url:
        raise HTTPException(status_code=400, detail="URL is required")
    parsed = urlparse(normalized_url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only HTTP and HTTPS URLs are allowed")
    method = payload.method.upper()
    if method not in {"GET", "HEAD"}:
        raise HTTPException(status_code=400, detail="Only GET or HEAD methods are supported")
    timeout = max(1, min(payload.timeout, 30))
    start = time.perf_counter()
    try:
        response = requests.request(method, normalized_url, timeout=timeout)
    except requests.RequestException as exc:
        log_error(f"API ping failed for {normalized_url}: {exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    latency = int((time.perf_counter() - start) * 1000)
    preview = response.text[:400] if response.text else ""
    log_event(f"API ping {method} {normalized_url} -> {response.status_code} ({latency} ms)")
    return {
        "status": "ok",
        "url": normalized_url,
        "method": method,
        "status_code": response.status_code,
        "latency_ms": latency,
        "body_preview": preview,
        "headers": dict(response.headers),
    }


@app.get("/api/tools/qr")
def generate_qr_image(data: str) -> Response:
    """Generate a QR code PNG for the provided text."""
    if not data:
        raise HTTPException(status_code=400, detail="QR data is required")
    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="image/png")


def _fallback_openai_models(reason: str) -> Dict[str, Any]:
    """Return a canned list of models when the live call fails."""
    return {
        "data": [{"id": model_id} for model_id in DEFAULT_OPENAI_MODEL_IDS],
        "source": "local-cache",
        "warning": reason,
    }


def fetch_openai_models(api_key: str) -> Any:
    """
    Fetch list of available models from OpenAI.
    Returns the JSON response or raises an error.
    """
    url = "https://api.openai.com/v1/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.get(url, headers=headers, timeout=10)
    if response.status_code != 200:
        log_error(f"Failed to fetch OpenAI models: {response.status_code} {response.text}")
        raise HTTPException(status_code=response.status_code, detail="Error fetching OpenAI models")
    return response.json()


def fetch_ollama_models(base_url: str) -> Any:
    """
    Fetch list of available models from Ollama. Ollama exposes models via
    `/api/tags` endpoint which returns installed models and their tags.
    """
    normalized = _normalize_external_url(base_url, "http")
    if not normalized:
        raise HTTPException(status_code=400, detail="OLLAMA_URL is not configured")
    url = f"{normalized.rstrip('/')}/api/tags"
    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException as exc:
        log_error(f"Failed to reach Ollama host {url}: {exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if response.status_code != 200:
        log_error(f"Failed to fetch Ollama models: {response.status_code} {response.text}")
        raise HTTPException(status_code=response.status_code, detail="Error fetching Ollama models")
    return response.json()


@app.get("/api/models/openai")
def list_openai_models() -> Any:
    """List all available OpenAI models using the current API key."""
    api_key = runtime_settings.get("openai_key", "").strip()
    if not api_key:
        warning = "OpenAI API key is not configured; showing cached models"
        log_event(warning)
        return _fallback_openai_models(warning)
    try:
        models_json = fetch_openai_models(api_key)
    except HTTPException as exc:
        reason = f"OpenAI API error: {exc.detail}"
        log_error(reason)
        return _fallback_openai_models(reason)
    except Exception as exc:
        reason = f"Unexpected error while fetching OpenAI models: {exc}"
        log_error(reason)
        return _fallback_openai_models("Unexpected error while fetching OpenAI models")
    models_json["source"] = "openai"
    return models_json


@app.get("/api/models/ollama")
def list_ollama_models() -> Any:
    """List all available Ollama models using the current base URL."""
    url = runtime_settings.get("ollama_url", "")
    if not url:
        raise HTTPException(status_code=400, detail="OLLAMA_URL is not set")
    models_json = fetch_ollama_models(url)
    return models_json


@app.post("/api/openai")
async def chat_openai(request: Request) -> Dict[str, Any]:
    """
    Proxy a chat request to OpenAI's chat completion endpoint.
    Accepts JSON: {"message": "..."}
    Uses runtime settings for API key, model, and system instructions.
    """
    data = await request.json()
    msg = data.get("message", "")
    if not msg:
        raise HTTPException(status_code=400, detail="Message is required")

    api_key = runtime_settings.get("openai_key", "")
    model = runtime_settings.get("openai_model", "gpt-4o-mini")
    instructions = runtime_settings.get("system_instructions", "")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": []
    }
    if instructions:
        payload["messages"].append({"role": "system", "content": instructions})
    payload["messages"].append({"role": "user", "content": msg})

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30,
        )
    except Exception as exc:
        log_error(f"OpenAI request error: {exc}")
        raise HTTPException(status_code=500, detail="Error communicating with OpenAI")

    if response.status_code != 200:
        log_error(f"OpenAI API error: {response.status_code} {response.text}")
        raise HTTPException(status_code=response.status_code, detail="OpenAI API error")

    try:
        result = response.json()
        reply = result["choices"][0]["message"]["content"]
    except Exception as exc:
        log_error(f"OpenAI response parsing error: {exc}")
        raise HTTPException(status_code=500, detail="Error parsing OpenAI response")

    log_event(f"OpenAI reply: {reply[:60]}")
    return {"reply": reply}


@app.post("/api/ollama")
async def chat_ollama(request: Request) -> Dict[str, Any]:
    """
    Proxy a chat request to an Ollama model.
    Accepts JSON: {"message": "..."}
    Uses runtime settings for base URL, model, and system instructions.
    """
    data = await request.json()
    msg = data.get("message", "")
    if not msg:
        raise HTTPException(status_code=400, detail="Message is required")

    configured_url = runtime_settings.get("ollama_url", "") or "http://localhost:11434"
    base_url = _normalize_external_url(configured_url, "http").rstrip("/")
    model = runtime_settings.get("ollama_model", "llama3.1")
    instructions = runtime_settings.get("system_instructions", "")

    payload = {
        "model": model,
        "prompt": msg,
        "stream": False,
    }
    if instructions:
        # Prepend instructions to the prompt separated by two newlines
        payload["prompt"] = f"{instructions}\n\n{msg}"

    url = f"{base_url}/api/generate"
    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as exc:
        log_error(f"Ollama request error: {exc}")
        raise HTTPException(status_code=500, detail="Error communicating with Ollama")

    if response.status_code != 200:
        log_error(f"Ollama API error: {response.status_code} {response.text}")
        raise HTTPException(status_code=response.status_code, detail="Ollama API error")

    try:
        result = response.json()
        reply = result.get("response", "")
    except Exception as exc:
        log_error(f"Ollama response parsing error: {exc}")
        raise HTTPException(status_code=500, detail="Error parsing Ollama response")

    if not reply:
        raise HTTPException(status_code=502, detail="Ollama returned an empty response")

    log_event(f"Ollama reply: {reply[:60]}")
    return {"reply": reply}

STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
else:
    logging.warning("Static directory '%s' not found; skipping mount.", STATIC_DIR)
