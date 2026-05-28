export interface ParsedArgs {
  subcommand: string | null;
  apiKey: string | undefined;
  host: string | undefined;
  port: string | undefined;
  agent: string | undefined;
  model: string | undefined;
  provider: string | undefined;
  help: boolean;
  version: boolean;
  rest: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    subcommand: null,
    apiKey: undefined,
    host: undefined,
    port: undefined,
    agent: undefined,
    model: undefined,
    provider: undefined,
    help: false,
    version: false,
    rest: []
  };

  let i = 0;

  // Skip flags before subcommand
  while (i < argv.length && argv[i]!.startsWith('-')) {
    const flag = argv[i]!;
    switch (flag) {
      case '--api-key':
        result.apiKey = argv[++i];
        break;
      case '--host':
        result.host = argv[++i];
        break;
      case '--port':
        result.port = argv[++i];
        break;
      case '--agent':
        result.agent = argv[++i];
        break;
      case '--model':
        result.model = argv[++i];
        break;
      case '--provider':
        result.provider = argv[++i];
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      case '--version':
      case '-v':
        result.version = true;
        break;
      default:
        break;
    }
    i++;
  }

  if (i < argv.length) {
    result.subcommand = argv[i]!;
    i++;
  }

  // Collect everything after subcommand (or after --)
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === '--') {
      i++;
      result.rest.push(...argv.slice(i));
      break;
    }

    // Parse trailing flags
    switch (arg) {
      case '--api-key':
        result.apiKey = argv[++i];
        break;
      case '--host':
        result.host = argv[++i];
        break;
      case '--port':
        result.port = argv[++i];
        break;
      case '--agent':
        result.agent = argv[++i];
        break;
      case '--model':
        result.model = argv[++i];
        break;
      case '--provider':
        result.provider = argv[++i];
        break;
      default:
        result.rest.push(arg);
        break;
    }
    i++;
  }

  return result;
}
