#!/usr/bin/env node

import { parseArgs } from './args.js';
import { runCommand } from './commands/run.js';
import { heartbeatCommand } from './commands/heartbeat.js';
import { reportCommand } from './commands/report.js';
import { statusCommand } from './commands/status.js';

const HELP = `
dw-agent — Track AI agent activity in the dev-work dashboard

USAGE
  dw-agent run <command> [args...]    Wrap a command and auto-report to dev-work
  dw-agent heartbeat                  Send a heartbeat event
  dw-agent report <tokens> <cost>     Report token/cost usage
  dw-agent status                     Check webhook server health

OPTIONS
  --api-key <key>     API key (or set DEVWORK_API_KEY)
  --host <host>       Webhook host (default: 127.0.0.1)
  --port <port>       Webhook port (default: 9400)
  --agent <name>      Agent name (default: cli-agent)
  --model <model>     Model name for usage reports
  --provider <name>   Provider name for usage reports
  --help              Show this help
  --version           Show version

EXAMPLES
  dw-agent run -- cursor-agent --task "Fix bug"
  dw-agent run -- npm test
  dw-agent heartbeat --agent my-bot
  dw-agent report 1500 0.045 --model gpt-4o --provider openai
  dw-agent status

ENVIRONMENT
  DEVWORK_API_KEY     API key (required unless --api-key is set)
  DEVWORK_HOST        Webhook host override
  DEVWORK_PORT        Webhook port override
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.subcommand === null) {
    console.log(HELP.trim());
    process.exit(args.help ? 0 : 1);
  }

  if (args.version) {
    console.log('0.1.0');
    process.exit(0);
  }

  const apiKey = args.apiKey ?? process.env['DEVWORK_API_KEY'];
  if (!apiKey) {
    console.error('Error: API key required. Use --api-key <key> or set DEVWORK_API_KEY.');
    process.exit(1);
  }

  const config = {
    apiKey,
    host: args.host ?? process.env['DEVWORK_HOST'] ?? '127.0.0.1',
    port: parseInt(args.port ?? process.env['DEVWORK_PORT'] ?? '9400', 10),
    agentName: args.agent ?? process.env['DEVWORK_AGENT_NAME'] ?? 'cli-agent'
  };

  try {
    switch (args.subcommand) {
      case 'run':
        await runCommand(config, args.rest);
        break;
      case 'heartbeat':
        await heartbeatCommand(config);
        break;
      case 'report':
        await reportCommand(config, args.rest, args.model, args.provider);
        break;
      case 'status':
        await statusCommand(config);
        break;
      default:
        console.error(`Unknown command: ${args.subcommand}\n`);
        console.log(HELP.trim());
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
