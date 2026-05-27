# Getting Started

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **Git**

## Installation

```bash
git clone https://github.com/RYSESEO/dev-work.git
cd dev-work/app
npm install
```

## Development Mode

```bash
npm run dev
```

This starts the Electron app with hot-reload enabled. The main window opens with the Mission Control dashboard.

## First Launch

On first launch, you'll see a **Welcome to Command Center** onboarding modal with three steps:

1. **Create a Mission** — Define your first objective
2. **Register an Agent** — Set up an AI agent with a runner profile
3. **Launch a Run** — Execute a task and watch it work

### Setting Up Admin (Optional)

If auth is enabled, you'll be prompted to create an admin account:

1. Navigate to the **Settings** tab
2. Under **License & Auth**, set up your admin credentials
3. Log in to access mutation operations

## Creating Your First Mission

1. Click **"Create a Mission"** on the Mission Control tab
2. Enter a title (e.g., "Build Landing Page") and goal
3. Click **Create**

## Adding Tasks

1. From Mission Control, click **"Add Task"** on your mission
2. Enter a task title, description, and priority
3. The task appears in the task list with "draft" status

## Registering an Agent

1. Go to the **Agents** tab
2. An agent requires a **runner profile** — set one up in **Settings → Runner Profiles**
3. Choose a runner type:
   - **Command** — Executes shell commands locally
   - **OpenAI** — Connects to OpenAI's API (requires API key)

## Launching a Run

1. From the **Agents** tab, click **Launch** on an agent
2. Select a task to assign
3. The agent begins executing and you can monitor progress in real-time
4. If the agent requests approval for a risky operation, you'll see an **Approval Request** in Mission Control

## Key Features

### Dark Mode
Toggle between light, dark, and system themes via **Settings → Appearance**.

### Notifications
Enable desktop notifications for approval requests, run completions, and failures in **Settings → Notifications**.

### Search & Filter
Use the search bar and status filters in Mission Control and Agents views to find specific items.

### Keyboard Shortcuts
- `Ctrl+1` through `Ctrl+0` — Switch between tabs
- Standard accessibility: Tab navigation, Enter to activate

## Building for Distribution

```bash
# All platforms
npm run dist

# Platform-specific
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Built artifacts appear in the `release/` directory.

## Running Tests

```bash
npm test              # Run all tests
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run format:check  # Prettier formatting check
```

## Next Steps

- [Architecture Guide](./architecture.md) — Understand how the app works
- [Runner Protocol](./runner-protocol.md) — Build a custom runner
- [Plugin Development](./plugin-development.md) — Extend with plugins
