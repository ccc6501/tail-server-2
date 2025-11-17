import os
import sys
import subprocess
import threading
import time
import webbrowser
from pathlib import Path
from typing import Optional, Any

import requests
import uvicorn
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem as item

import server  # Import the FastAPI app from server.py


class ServerTrayApp:
    """
    System tray application that runs the FastAPI server in the background
    and provides a tray icon with menu options.
    """
    def __init__(self) -> None:
        self.icon: Optional[Any] = None
        self.server_thread: Optional[threading.Thread] = None
        self.project_root = Path(__file__).resolve().parent
        self.codespace = os.getenv("CODESPACE_MODE", "false").lower() in ("true", "1", "yes")
        self.host = "0.0.0.0" if self.codespace else "127.0.0.1"
        self.port = int(os.getenv("PORT", "8000" if self.codespace else "8088"))
        self.url = f"http://{self.host if self.host != '0.0.0.0' else 'localhost'}:{self.port}"

    def create_icon_image(self) -> Image.Image:
        """Create a simple icon image for the system tray."""
        # Create a 64x64 image with a purple circle
        width = 64
        height = 64
        image = Image.new('RGB', (width, height), (15, 15, 15))  # type: ignore[arg-type]
        draw = ImageDraw.Draw(image)
        # Draw a purple circle
        draw.ellipse([8, 8, 56, 56], fill=(147, 51, 234), outline=(186, 85, 211))
        # Draw a smaller inner circle
        draw.ellipse([20, 20, 44, 44], fill=(109, 40, 217))
        return image

    def run_server(self) -> None:
        """Run the FastAPI server in the current thread."""
        uvicorn.run(server.app, host=self.host, port=self.port, log_level="info")

    def build_frontend(self) -> bool:
        """Run npm build to ensure the latest React bundle is available."""
        package_json = self.project_root / "package.json"
        if not package_json.exists():
            print("Warning: package.json not found. Skipping frontend build.")
            return False
        print("Building admin panel bundle with npm...")
        try:
            # Check if npm is installed
            subprocess.run(["npm", "--version"], check=True, capture_output=True)
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=str(self.project_root),
                check=False,
            )
        except FileNotFoundError:
            print("npm command not found; install Node.js and npm. Skipping frontend build.")
            return False
        except subprocess.CalledProcessError:
            print("npm version check failed. Skipping frontend build.")
            return False
        if result.returncode != 0:
            print("npm run build failed. Using the previous bundle.")
            return False
        return True

    def start_server_thread(self) -> None:
        """Start the FastAPI server in a background thread."""
        self.server_thread = threading.Thread(target=self.run_server, daemon=True)
        self.server_thread.start()
        print(f"Server starting at {self.url}")
        # Kick off watcher thread to open browser when server is ready
        threading.Thread(target=self._wait_and_open_admin, daemon=True).start()

    def _wait_and_open_admin(self) -> None:
        """Poll the /health endpoint before opening the admin panel."""
        if self.wait_for_server():
            self.verify_tailscale()
            self.open_admin_panel()
        else:
            print("Server did not become ready in time. Use the tray menu to retry once it is up.")

    def wait_for_server(self, timeout: float = 15.0) -> bool:
        """
        Wait until the FastAPI /health endpoint responds or a timeout occurs.
        Returns True if the server is reachable, False otherwise.
        """
        end_time = time.time() + timeout
        health_url = f"{self.url.rstrip('/')}/health"
        while time.time() < end_time:
            try:
                response = requests.get(health_url, timeout=1.0)
                if response.ok:
                    return True
            except Exception:
                pass
            time.sleep(0.5)
        return False

    def open_admin_panel(self, icon=None, item=None) -> None:
        """Open the admin panel in the default web browser."""
        print(f"Opening browser at {self.url}")
        webbrowser.open(self.url)

    def verify_tailscale(self) -> None:
        """Call the API to verify Tailscale connectivity."""
        ip = os.getenv("TAILSCALE_VERIFY_IP", "100.88.23.90")
        if not ip:
            return
        try:
            resp = requests.post(
                f"{self.url.rstrip('/')}/api/tailscale/verify",
                json={"ip": ip},
                timeout=10,
            )
            if resp.ok:
                data = resp.json()
                detail = data.get("detail", "reachable")
                latency = data.get("latency_ms")
                latency_text = f", {latency} ms" if latency is not None else ""
                print(f"Tailscale {ip} reachable ({detail}{latency_text}).")
            else:
                print(f"Tailscale verification failed ({resp.status_code}): {resp.text}")
        except Exception as exc:
            print(f"Tailscale verification error: {exc}")

    def quit_app(self, icon, item) -> None:
        """Stop the tray icon and exit the application."""
        icon.stop()
        sys.exit(0)

    def setup_tray_icon(self) -> None:
        """Set up the system tray icon with menu."""
        icon_image = self.create_icon_image()
        menu = pystray.Menu(
            item('Open Admin Panel', self.open_admin_panel),
            item('Quit', self.quit_app)
        )
        self.icon = pystray.Icon("the_local", icon_image, "The Local - AI Server", menu)

    def run(self) -> None:
        """Start the server and run the tray icon."""
        self.build_frontend()
        self.start_server_thread()
        self.setup_tray_icon()
        # Run the tray icon (this blocks until quit)
        if self.icon:
            self.icon.run()


def main() -> None:
    """
    Start the FastAPI server in headless mode with a system tray icon.
    The admin panel will automatically open in the default browser.
    """
    try:
        app = ServerTrayApp()
        app.run()
    except KeyboardInterrupt:
        print("\nShutting down...")
        sys.exit(0)


if __name__ == "__main__":
    main()
