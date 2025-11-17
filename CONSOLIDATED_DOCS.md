# AI Control Center – Comprehensive Guide

## Table of Contents

- [Overview](#overview)
- [Key Components](#key-components)
- [Setup and Deployment](#setup-and-deployment)
  - [Environment Auto-Detection](#environment-auto-detection)
  - [Codespace Deployment (No Authentication)](#codespace-deployment-no-authentication)
  - [Home PC Deployment (Linux/Mac)](#home-pc-deployment-linuxmac)
  - [Windows Deployment](#windows-deployment)
  - [Transferring Between Machines](#transferring-between-machines)
- [Authentication & User Management](#authentication--user-management)
  - [Backend Authentication (Phase 2)](#backend-authentication-phase-2)
  - [Frontend Authentication (Phase 3A)](#frontend-authentication-phase-3a)
  - [Roles, Statuses and Limits](#roles-statuses-and-limits)
  - [Invitation System and Demo Data](#invitation-system-and-demo-data)
- [Logging and Analytics](#logging-and-analytics)
- [Tailscale Management](#tailscale-management)
  - [Devices & Network](#devices--network)
  - [User Profiles](#user-profiles)
  - [System Control](#system-control)
- [API Summary](#api-summary)
- [Cloud Storage & File Browser](#cloud-storage--file-browser)
- [Common Problems & Fixes](#common-problems--fixes)
- [Invitation & Activity Logging Enhancements (Phase 3B)](#invitation--activity-logging-enhancements-phase-3b)
- [Hybrid AI Routing – “The Local”](#hybrid-ai-routing--the-local)
  - [Setup](#setup)
  - [Usage Indicators](#usage-indicators)
- [Phase Overview & Roadmap](#phase-overview--roadmap)
- [Next Actions](#next-actions)
- [Conclusion](#conclusion)

## Overview

The AI Control Center is a self-hosted management tool that combines AI chat, file management, network control, and user administration into a single interface. It can run in a GitHub Codespace or on a personal computer (Linux or Windows). The UI adapts to desktop and mobile devices, while the backend provides optional token-based authentication, robust logging, and Tailscale integration for secure remote access.

## Key Components

- **Chat interface:** Real-time AI chat that supports Ollama, OpenAI, and OpenRouter with WebSocket streaming and responsive layouts.
- **Cloud storage:** An in-app browser for the `TheCloud` directory that appends auth tokens to download URLs.
- **Tailscale management:** Admin-only controls for pinging, inviting, disconnecting devices, broadcasting messages, and managing services.
- **Settings:** Configuration panels for AI providers, models, and prompts; mobile adds appearance, data usage, and bug reporting tabs.
- **User management:** Profiles with roles (admin, user, guest), statuses (pending, active, suspended), and per-user limits on AI requests, storage, and bandwidth.
- **Authentication system:** Optional JWT-based auth introduced in phase 2 with login/registration screens and stored privileges.
- **Logging system:** JSONL logging on external storage with privacy controls plus Python helpers for profiles, sessions, and retention.
- **Environment detection:** Automatically determines if running in Codespaces or on a home PC and applies defaults.
- **Hybrid AI router (“The Local”):** Routes queries to local Ollama or paid OpenRouter models based on complexity, with cost tracking and failover.

## Setup and Deployment

### Environment Auto-Detection

At startup the server inspects `CODESPACES` or `GITHUB_CODESPACE_TOKEN` to determine whether it runs in a codespace or on a home PC, then applies per-environment defaults:

| Environment | Authentication                 | AI provider    | Storage path                    |
|-------------|--------------------------------|----------------|---------------------------------|
| Codespace   | Optional (disabled by default) | OpenAI (cloud) | `/workspaces/.../TheCloud`      |
| Home PC     | Recommended (warn if disabled) | Ollama (local) | `D:\TheCloud` or `~/TheCloud`   |

The same `.env` file works everywhere. On startup the server logs the detected mode and warns if home deployments lack authentication. Override any default via `.env`. To inspect the detected environment:

```bash
curl http://localhost:3001/api/environment | jq
```

The response reports environment (`codespace` or `home`), authentication status, and AI/security recommendations. `/api/stats` also includes the environment.

### Codespace Deployment (No Authentication)

For rapid development:

```bash
git clone https://github.com/your-repo/ai-control-center.git
cd ai-control-center
cp .env.example .env     # leave ACC_TOKEN commented out
npm install
npm start
```

Access the app through the VS Code *Ports* tab or the forwarded URL. Re-enable authentication later by setting `ACC_TOKEN` in `.env` and restarting the server.

### Home PC Deployment (Linux/Mac)

1. Install Ollama: `curl https://ollama.ai/install.sh | sh && ollama pull llama3.2:3b` (adjust as needed).
2. Clone the repo: `git clone … && cd ai-control-center`.
3. Create or edit `.env`.
4. Set `ACC_TOKEN` to a secure random value (e.g., via `crypto.randomBytes`).
5. Optionally set `OPENROUTER_API_KEY` for cloud routing.
6. Start the server: `npm install && npm start` or use PM2 (`pm2 start ecosystem.config.js`).

The server auto-detects the environment, warns if authentication is disabled, and recommends Ollama for cost-free usage.

### Windows Deployment

1. Download or clone the repo to `C:\Ai-Control-Tower`.
2. Run `start-windows.bat` or `deploy-windows.ps1` in an elevated prompt.
3. The script checks for Node and Tailscale, configures the firewall on port 3001, installs dependencies, writes `.env` with Windows paths, and starts the server.
4. Access the app via `http://localhost:3001?token=...`, `http://100.88.23.90:3001?token=...`, or `http://desktopu3ilor2.taimen-godzilla.ts.net:3001?token=...`.

Stop any Codespace deployment before running locally to avoid conflicts.

### Transferring Between Machines

- Download the repo as a ZIP or clone it on the destination machine.
- Copy the entire `Ai-Control-Tower/` directory (including `TheCloud/`) via file sharing or Tailscale.
- Run the relevant setup script for the target OS (Windows script or Linux/Mac steps).

## Authentication & User Management

### Backend Authentication (Phase 2)

The backend uses JWTs for authentication:

- `POST /api/auth/register` — Create a user with pending status.
- `POST /api/auth/login` — Authenticate and receive a JWT.
- `GET /api/auth/me` — Return the user associated with the token.
- `PUT /api/auth/password` — Change the password.
- `POST /api/auth/logout` — Invalidate the session.

Passwords are hashed with bcrypt. Tokens embed the role (`admin`, `user`, `guest`). When `ACC_TOKEN` is absent the middleware bypasses auth for Codespace development.

### Frontend Authentication (Phase 3A)

The frontend ships dark-themed login/registration views, an `AuthProvider` context, and a `useAuth` hook. Tokens persist in `localStorage` and are attached to fetch/WebSocket calls. Profile cards display name, email, role, and status. Refreshing the page preserves authentication, and a logout button clears credentials.

### Roles, Statuses and Limits

User profiles define roles (`admin`, `user`, `guest`) and statuses (`pending`, `active`, `suspended`). Admins can approve/suspend users, reset passwords, and delete profiles. Per-profile limits track AI requests, storage, and bandwidth; all values appear in lists and modals.

### Invitation System and Demo Data

Phase 3B introduces invitations with messages and expiration dates. Admins can create, send, and monitor invitation codes while activity logging records every action. Test data lives in `config/user-profiles.json`; demo users no longer ship by default.

## Logging and Analytics

Logging writes chat and usage events to JSONL files on an external drive or configured directory. Implemented in Python (`user_store.py`) with PowerShell helpers for environment variables and server launch. Features include:

- User profiles with IDs, roles, device IDs, preferences, and privacy settings; analytics IDs are generated via HMAC.
- Chat logs containing timestamps, token counts, session IDs, and optional PII redaction.
- Usage logs tracking provider, latency, token consumption, and success status.
- Retention policies with per-user periods, daily rotation, and optional gzip compression.

Run `generate_salt.ps1` to create a salt, update `launch_assistant.ps1` with the storage path and salt, and execute `test_user_store.py` to verify before launching the assistant script.

## Tailscale Management

### Devices & Network

Admin controls include:

- Ping all devices to verify connectivity (shows success/failure and latency).
- Broadcast a message to every connected user (currently logs server-side; push notifications planned).
- Invite users with ready-made links plus expiration info.
- View connected devices with IPs, status badges, and actions to ping or disconnect.

### User Profiles

Admins can create, edit, approve, suspend, or delete profiles. Each profile surfaces usage stats and limits. Double-click opens editable modals. Bulk approval and password resets use dedicated endpoints.

### System Control

The system control section shows the status of AI assistant, file browser, Tailscale, and control center services. Operators can pause, resume, or stop services. A reset button restarts the Node server (disconnects all users).

## API Summary

| Category      | Endpoint                           | Description                    |
|---------------|------------------------------------|--------------------------------|
| User profiles | `GET /api/users/profiles`          | List all profiles              |
|               | `GET /api/users/profiles/:id`      | Retrieve a single profile      |
|               | `POST /api/users/profiles`         | Create or update a profile     |
|               | `DELETE /api/users/profiles/:id`   | Delete a profile               |
|               | `POST /api/users/approve/:id`      | Approve a pending user         |
|               | `POST /api/users/suspend/:id`      | Suspend an active user         |
| Services      | `GET /api/services/status`         | List service status            |
|               | `POST /api/services/pause`         | Pause a service                |
|               | `POST /api/services/resume`        | Resume a paused service        |
|               | `POST /api/services/kill`          | Stop a service                 |
|               | `POST /api/system/reset`           | Restart the server             |
| Network       | `GET /api/tailscale/devices`       | List tailnet devices           |
|               | `POST /api/tailscale/ping`         | Ping a device by IP            |
|               | `POST /api/tailscale/broadcast`    | Send a message to all devices  |
|               | `POST /api/tailscale/disconnect`   | Disconnect a device            |

Include the admin key in headers for network operations and a valid JWT for authenticated sessions.

## Cloud Storage & File Browser

The Cloud Storage tab exposes the `TheCloud` directory with navigation (including “Up”), size display, and tokenized downloads. Ensure `.env` and `settings.json` point to the same storage path (e.g., `/workspaces/Ai-Control-Tower/TheCloud`). Sample files ship for testing.

## Common Problems & Fixes

- **Unauthorized downloads:** Ensure `downloadCloudFile()` appends `?token=<token>` to URLs.
- **Wrong path:** Align `CLOUD_STORAGE_PATH` in `.env` with `cloudStoragePath` in `settings.json` (case-sensitive on Linux).
- **Empty directory:** Add sample files or verify directory existence.

## Invitation & Activity Logging Enhancements (Phase 3B)

Invitations now have unique codes, seven-day expiration, and revocation controls. Admins can copy links, revoke invitations, and monitor expiry. Activity logging captures admin actions (login, logout, invitations, user management) with statistics, filtering, and export endpoints. Remaining work includes aligning admin checks between frontend/backend and adding QR codes for invitations. Phase 4 will integrate real data.

## Hybrid AI Routing – “The Local”

“The Local” lives in `server.js` and routes queries based on complexity indicators (deep reasoning, code analysis, multi-step requests, large context, technical terms). Scores below 0.7 go to Ollama; higher scores use OpenRouter. Failures on local models fall back to the cloud automatically.

### Setup

1. Install Ollama and pull a model (e.g., `ollama pull llama3.2:3b`).
2. Obtain an OpenRouter key and set `OPENROUTER_API_KEY=sk-or-...` in `.env` (optional).
3. Restart the server; logs show `[Router] Hybrid AI Router initialized`.

### Usage Indicators

Chat responses include badges:

- `🏠 Local AI • Free` — Served by Ollama.
- `☁ Cloud AI • $X` — Served by OpenRouter with estimated cost.
- `OpenAI` — Served by OpenAI (if configured).

The Stats dashboard (Settings → *The Local Stats*) shows monthly free vs. paid counts, total cost, and savings. Typical light usage pushes 85–90% of queries locally, keeping costs under $10/month. Adjust the threshold in `server.js` to tune routing.

## Phase Overview & Roadmap

| Phase      | Highlights |
|------------|------------|
| Phase 1    | Redesigned PC interface, added navigation/sidebar, metrics bar, and in-app file browser. |
| Phase 2    | Implemented JWT backend authentication and role-based user management. |
| Phase 3A   | Added frontend auth (login/register, `AuthProvider`, token storage, profile display). |
| Phase 3B   | Built invitations and activity logging, enhanced user management, added frontend components; integration/testing underway. |
| Phase 4 (planned) | Integrate SQLite for real data, implement robust auth with password reset/API tokens, redesign mobile drawer (metrics, files, tailnet, AI, appearance, data, bug report), and add chat history, multi-user rooms, file sharing, notifications, and audit logs (≈140–200 hours remaining). |

## Next Actions

1. Fix admin access checks by validating both `user.role` and `isAdmin` state across components.
2. Add QR code invitations (e.g., with `QRCode.js`) to invitation modals.
3. Create demo users with varied roles, statuses, and usage stats.
4. Perform end-to-end tests on invitations, activity logs, user management, tailnet controls, mobile responsiveness, and dark mode.
5. Begin database integration by setting up SQLite tables for users, sessions, tokens, chat history, etc., and migrating JSON data.

## Conclusion

The AI Control Center is evolving into a production-ready management system featuring authentication, logging, Tailscale integration, file browsing, and hybrid AI routing. Upcoming work focuses on database storage, mobile enhancements, and advanced collaboration features. Follow the environment-specific setup instructions (Codespace, Linux home PC, or Windows) to deploy securely and manage users, devices, and AI providers from a single interface.
