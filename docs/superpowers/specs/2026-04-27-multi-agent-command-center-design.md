# Multi-Agent Command Center Design

## Overview

Build a Windows-first desktop command center for coordinating AI agents around software-building work. The app helps a user define a larger mission, break it into tasks, launch approval-gated agents, track progress, inspect logs and artifacts, and monitor usage and estimated cost per agent.

The first version is a real local desktop app, not only a mock dashboard. It should launch local agent tasks through a pluggable runner system, store state locally, and provide a dashboard optimized for supervising multiple active agents.

## Confirmed Product Decisions

- App shape: Windows-first desktop app.
- Technology direction: Electron desktop shell with a React dashboard and local Node orchestration backend.
- Primary workflow: software-building missions.
- Work model: mission-first, with standalone one-click tasks also supported.
- Agent behavior: approval-gated builders.
- Runner model: pluggable runner architecture.
- V1 runner: configurable local command runner.
- Future runners: Codex-specific sessions, OpenAI API agents, and custom workers.
- Approval duration: session-scoped grants by default. Once approved for a run, matching actions do not ask again during that session.
- Persistence: local-first SQLite plus per-run log files.

## Goals

- Let the user create a mission with one larger software-building goal.
- Let the user create, approve, assign, and track mission tasks.
- Launch multiple local agent runs from the dashboard.
- Support one-click software-building tasks.
- Gate risky actions through clear approval cards.
- Reuse approved permissions for the rest of a run when future actions match the approved scope.
- Track task progress, agent status, usage, estimated cost, approvals, significant events, logs, and artifacts.
- Keep the runner system replaceable so future agent backends can be added without redesigning the dashboard.

## Non-Goals For V1

- Hosted team collaboration.
- User accounts and cloud sync.
- macOS or Linux packaging.
- Full billing integration.
- Autonomous high-risk actions without user approval.
- Deep Codex-specific session integration beyond what the generic runner can support.
- Production-grade multi-tenant security.

## Product Design

The app opens directly into Mission Control. The active mission appears at the top with its goal, status, cost so far, active agents, blocked tasks, pending approvals, and recent significant events. Under that, the user sees a task board and live activity.

The dashboard includes a one-click task section for common software workflows:

- Review this repo.
- Plan a feature.
- Fix failing tests.
- Generate an implementation plan.
- Summarize changes.
- Run code review.
- Draft PR notes.

Each one-click task uses a prompt template, recommended agent profile, expected permission set, risk level, and estimated cost. Clicking a launcher opens a small confirmation panel before starting the run.

Agents are approval-gated builders. They can analyze, plan, and summarize freely. File edits, command execution, dependency installs, git actions, and network access require approval unless already covered by a session-scoped grant.

## Core Screens

### Mission Control

Shows the active mission, mission status, task board, live agents, pending approvals, cost so far, and recent significant events. This is the primary command center.

### Agents

Shows agent profiles and live runs. Each agent displays role, runner type, current task, status, uptime, usage, estimated cost, success rate, and recent outputs.

### Tasks

Shows mission and standalone tasks with status, assignee, priority, dependencies, approvals, logs, artifacts, and final result.

### One-Click Tasks

Shows launcher buttons for predefined software-building workflows. Each launcher is backed by a configurable prompt template, recommended agent profile, expected permissions, risk level, and cost estimate.

### Settings

Manages runner profiles, command templates, model and API configuration for future runners, cost rates, workspace defaults, approval policies, and data export controls.

## Architecture

The app has three main parts:

1. Electron desktop shell.
2. React renderer dashboard.
3. Local orchestration backend.

The Electron shell owns the Windows desktop app lifecycle, native window behavior, menus, notifications, secure local file access, and background process launching.

The React renderer owns the user interface: missions, tasks, agents, approvals, logs, usage charts, cost charts, one-click launchers, and settings.

The local orchestration backend runs inside Electron's main process or as a companion Node service. It owns mission state, task state, runner plugins, process supervision, log streaming, approval handling, persistence, usage events, and artifact indexing.

## Runner System

The runner system exposes a common interface:

- Create run.
- Start run.
- Pause run for approval.
- Resume run with approval grant.
- Stop run.
- Stream events and logs.
- Report usage.
- Report artifacts.
- Finalize run.

V1 ships with a configurable command runner. A runner profile defines:

- Command executable.
- Arguments.
- Prompt injection format.
- Workspace path.
- Environment variables.
- Allowed default capabilities.
- Approval policy.
- Usage and cost estimation rules.

Future runners can implement the same interface for Codex-specific local sessions, OpenAI API agents, or custom automation workers.

## Data Model

SQLite stores structured app data:

- Missions.
- Tasks.
- Agent profiles.
- Runs.
- Runner profiles.
- Usage events.
- Cost estimates.
- Approval requests.
- Approval grants.
- Significant events.
- Artifacts.

Per-run logs are also written to disk so long sessions remain inspectable after app restart.

## Data Flow

A mission starts with a user-defined goal. The user can manually create tasks or launch a planning agent to propose a task breakdown. Proposed tasks enter the dashboard as drafts until approved.

When a task is launched, the orchestration backend creates a run, selects the runner profile, starts the process, and streams events back to the renderer. Events update the task board, agent roster, activity timeline, logs, usage metrics, and cost estimates.

When a runner requests a risky action, the backend pauses the run and creates an approval request. The dashboard shows an approval card with the action, context, risk level, requested scope, duration, and expected impact. The user can approve as requested, narrow the scope, reject the request, or stop the run.

If approved, the backend creates a session-scoped approval grant. Matching actions during the same run proceed without another prompt, while every use is still logged. Actions outside the approved scope create new approval requests.

## Approval Model

Approvals have scope, duration, risk level, and run ownership.

Default duration is session-scoped. A grant applies only to the current run unless the user explicitly changes policy settings later.

Example approval scopes:

- Read workspace files.
- Edit selected files.
- Edit files under selected folders.
- Run a specific command.
- Run commands in a category, such as tests or linting.
- Install dependencies.
- Use network.
- Use git status, diff, or log.
- Create a git commit.
- Push to a remote.

High-risk actions always require explicit approval in V1 unless already covered by a matching session grant. High-risk actions include broad file edits, deletes, dependency installs, network access, commits, pushes, and commands outside a configured safe category.

## Usage And Cost Tracking

Usage data is captured per run and rolled up by agent, task, mission, and time window.

V1 tracks:

- Elapsed time.
- Command count.
- Approval count.
- Log size and output volume.
- Estimated token usage when available.
- Configured model rate estimates when available.
- API-reported usage for future API runners.

The dashboard should clearly label estimated cost separately from API-reported cost.

## Significant Data

The activity timeline and mission report highlight:

- Mission milestones.
- Task creation, assignment, start, pause, completion, and failure.
- Blocked tasks.
- Approval requests and grant use.
- Errors.
- Artifacts.
- Changed file summaries.
- Test results.
- Agent final summaries.

## Error Handling And Recovery

Runs are treated as resumable sessions at the dashboard level. If a runner crashes, the app records the last event, marks the task as interrupted, and offers retry, clone task, or mark blocked.

If the desktop app closes, runner behavior depends on the runner profile. V1 should default to stopping active child processes safely, with an option to support detached runs later.

All run errors become structured events. The dashboard should show a concise explanation first, with raw logs available for deeper inspection.

## Security And Safety Defaults

New runner profiles start with limited permissions. Risky actions need explicit approval. Approval denials are sent back into the run context so agents can adapt rather than silently fail.

The app should make scopes visible and understandable. It should never ask for vague permission such as "full access" unless the user is editing settings intentionally.

## Testing Strategy

Testing should cover:

- Runner lifecycle.
- Task state transitions.
- Mission state transitions.
- Approval request creation.
- Session-scoped approval grant matching.
- Approval rejection handling.
- One-click task template creation and launch.
- Usage and cost rollups.
- SQLite persistence.
- Log persistence and replay.
- Dashboard empty states, error states, and active run states.

Manual UI verification should cover the Windows desktop layout, approval cards, log streaming, multi-agent activity, and dashboard readability at common desktop sizes.

## V1 Success Criteria

V1 is successful when the user can:

- Open a Windows desktop app.
- Create a software-building mission.
- Create or approve a task breakdown.
- Launch multiple local approval-gated agent tasks.
- Approve a permission once and have matching actions proceed for the rest of that session.
- Track tasks, agents, usage, estimated cost, approvals, significant events, logs, and artifacts.
- Launch useful one-click software-building tasks.
- Inspect what happened after a run completes or fails.

