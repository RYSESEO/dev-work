---
name: testing-dev-work
description: How to set up, build, test, and run end-to-end tests for the dev-work Electron app. Use when verifying UI or backend changes.
---

## Project Overview

dev-work is an Electron desktop app (React renderer + Node.js main process) for orchestrating autonomous agent workflows. It uses electron-vite for dev/build.

## Quick Commands

```bash
cd /home/ubuntu/repos/dev-work/app

# Install dependencies
npm install

# Dev server (launches Electron window)
DISPLAY=:0 npm run dev

# Run tests (Vitest)
npm test

# Typecheck
npm run typecheck
# or: npx tsc -b

# Lint
npm run lint
# or: npx eslint src/ tests/

# Build for distribution
npm run build
```

## Environment Requirements

- Node.js (deps already in node_modules)
- X11 display for Electron GUI: `DISPLAY=:0` must be set
- Electron v41.x is installed locally in node_modules
- `wmctrl` is useful for maximizing the Electron window for recordings:
  ```bash
  sudo apt-get install -y wmctrl
  DISPLAY=:0 wmctrl -r "Multi-Agent Command Center" -b add,maximized_vert,maximized_horz
  ```

## Running the Electron App

1. `cd /home/ubuntu/repos/dev-work/app && DISPLAY=:0 npm run dev`
2. The app window title is "Multi-Agent Command Center"
3. Dev server runs on http://localhost:5173/ (renderer only — full app requires Electron)
4. DBus errors in console are expected and harmless in headless environments
5. GPU errors (`ContextResult::kTransientFailure`) are expected and don't affect functionality
6. On launch a 3-step welcome modal appears — click Next/Get started a couple times to dismiss it before testing.

## App Architecture for Testing

- Nav is a grouped left sidebar (Core / Automation / Insights / Admin). Tabs include: Mission Control, Agents, Tasks, Workflows, Collaborate, Marketplace, Analytics, Cost Intel, Usage, Team, Security, Integrations, Enterprise, Settings.
- Tab navigation is via the sidebar — clicking a tab sets `activeTab` state in `App.tsx`. Keyboard shortcuts Ctrl+1..0 also navigate.
- Each tab renders a different component conditionally
- Data flows through `DashboardSnapshot` (polled every 3s) except Analytics (loaded on-demand via IPC)
- Backend state is persisted in SQLite via `appStore.ts`
- IPC handlers are registered in `ipc.ts`, bridged through `preload/index.ts`

## Seeded Default Data

On first run, the orchestrator seeds:
- 1 runner profile (Demo Local Agent)
- 3 agents (Planner, Builder, Reviewer)
- 6 marketplace entries (3 runners: OpenAI=installed, Anthropic, Ollama; 3 plugins: Slack, GitHub, Metrics)
- 1 admin user (Admin, admin@localhost)
- Sandbox config defaults: enabled=false, runtime=none, memory=512MB, CPU=1, timeout=300s

## Testing Approach

- **Unit tests**: `npm test` runs Vitest (125+ tests across main process and renderer)
- **E2E GUI testing**: Launch app with `npm run dev`, use computer tool to click through tabs
- **Key things to verify per tab**:
  - Marketplace: 6 entries render, install/uninstall toggles badge
  - Team: default admin user, add member form, role change dropdown
  - Workflows: create workflow with steps, verify card appears with step count
  - Analytics: async-loaded, check zero-state values (0 runs, 0%, $0)
  - Security: config grid shows defaults, edit form saves and persists
- **Regression**: Always check Mission Control and Agents tabs still render

## License & Signed-Key Testing

The license system (`app/src/main/services/license.ts`) gates Pro/Team features. UI path: **Settings tab → License section** (key + email inputs, Activate button). Two key formats are accepted:

- **Legacy** checksum keys: `DEVWORK-TIER-YEAR-SERIAL-CHECKSUM`. Generate with `generateLicenseKey('pro'|'team', year)` exported from `license.ts`. Input is uppercased on activation.
- **Signed** keys (Ed25519): `DEVWORK.<base64url payload>.<base64url sig>`, verified offline against `DEFAULT_LICENSE_PUBLIC_KEY` embedded in `license.ts`. Case-sensitive (base64url) — the renderer passes the key verbatim, do NOT uppercase.

### Issuing a signed key for testing
Use the keygen CLI (`app/scripts/license-keygen.mjs`). It needs the PRIVATE key matching the embedded public key:
```bash
# Generate a fresh keypair (only if you also update DEFAULT_LICENSE_PUBLIC_KEY in license.ts):
node scripts/license-keygen.mjs genkey
# Sign a key (private key via --key <pem file> or DEVWORK_LICENSE_PRIVATE_KEY env):
node scripts/license-keygen.mjs sign --tier team --year 2027 --key /path/to/private.pem
# Verify a key against a public-key PEM file:
node scripts/license-keygen.mjs verify "DEVWORK.<payload>.<sig>" --pub /path/to/public.pem
```
The private key is NOT in the repo (intentionally). If you generated one in a prior session, it may be at `/home/ubuntu/devwork-license-private-key.pem`; otherwise generate a new keypair AND update the embedded public key, or ask the user for the private key.

### Adversarial check that proves signatures are enforced
Take a valid signed key, base64url-decode the payload, change `tier` to `team`, re-encode it, and keep the original signature → activation MUST fail with toast "Invalid or tampered license key." and tier stays Free. If it activates, signature verification is broken.

### Verifying feature unlock
After activating a Team key: Settings → License shows tier=Team, Unlimited limits, ~15 feature chips. The **Enterprise** tab switches from a "Team License Required" paywall to its 5 sub-sections (Cloud Sync, SSO/SAML, Sandbox, Compliance, REST API). The **Collaborate** tab is similarly gated behind Pro/Team (`multi_agent_collaboration`).

## Common Issues

- If the app window doesn't appear, verify `DISPLAY=:0` is set and X11 is running (`xdpyinfo`)
- Electron may log DBus and GPU errors to stderr — these are cosmetic
- Analytics tab loads data asynchronously via `commandCenterClient.getAnalytics()` — if it shows "Loading analytics data..." indefinitely, the IPC handler may be broken
- **Persistent state gotcha**: app data is stored in a local SQLite file, so a license activated in a prior session persists. Before testing free→activate transitions, click **Deactivate License** in Settings → License to reset to Free tier first.

## CI

GitHub Actions CI runs lint + typecheck + test on PRs (`.github/workflows/ci.yml`); a release workflow builds installers on version tags. Always run typecheck + test + lint locally before pushing; use git pr_checks to confirm CI is green on the PR.
