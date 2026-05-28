# dev-work GitHub Action

Report CI/CD pipeline results to the [dev-work](https://github.com/RYSESEO/dev-work) dashboard.

## Usage

### Auto-track a command

```yaml
- name: Run tests with dev-work tracking
  uses: RYSESEO/dev-work/packages/github-action@main
  with:
    api-key: ${{ secrets.DEVWORK_API_KEY }}
    host: ${{ secrets.DEVWORK_HOST }}
    port: '9400'
    run-command: 'npm test'
```

This sends `run.started` before the command and `run.completed`/`run.failed` after.

### Report pipeline completion

```yaml
- name: Report to dev-work
  if: always()
  uses: RYSESEO/dev-work/packages/github-action@main
  with:
    api-key: ${{ secrets.DEVWORK_API_KEY }}
    host: ${{ secrets.DEVWORK_HOST }}
    event-type: ${{ job.status == 'success' && 'run.completed' || 'run.failed' }}
    agent-name: 'ci-pipeline'
```

### Full pipeline example

```yaml
name: CI with dev-work
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Test (tracked)
        uses: RYSESEO/dev-work/packages/github-action@main
        with:
          api-key: ${{ secrets.DEVWORK_API_KEY }}
          host: ${{ secrets.DEVWORK_HOST }}
          agent-name: 'ci-build'
          run-command: 'npm ci && npm test'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | dev-work API key |
| `host` | No | `127.0.0.1` | Webhook server host |
| `port` | No | `9400` | Webhook server port |
| `agent-name` | No | `github-actions` | Agent name |
| `event-type` | No | `auto` | Event type or `auto` to track a command |
| `run-command` | No | — | Command to run (when event-type is `auto`) |

## Outputs

| Output | Description |
|--------|-------------|
| `run-id` | Generated run ID |
| `event-id` | API-returned event ID |
| `duration-ms` | Command duration in ms |
| `exit-code` | Command exit code |

## License

MIT
