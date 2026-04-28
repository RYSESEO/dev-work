# Manual Verification

Run from `app/`:

```powershell
.\tools\npm.cmd run dev
```

Verify:

- The desktop app opens on Windows.
- Creating a mission updates Mission Control.
- Clicking "Review this repo" creates a task and starts a run.
- The run pauses on an approval card.
- Approving the request resumes the run.
- The run completes and records a session-scoped grant.
- Metrics show active runs, pending approvals, estimated tokens, and estimated cost.
- Agents view shows status and cost detail.
- Tasks view shows task state.
- Usage view rolls up cost per agent.
- Settings view shows the demo runner profile.
