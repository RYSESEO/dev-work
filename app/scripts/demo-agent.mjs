import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
const waiters = new Map();

input.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.type === 'approval_result') {
    const resolve = waiters.get(message.requestId);
    if (resolve) {
      waiters.delete(message.requestId);
      resolve(message);
    }
  }
  if (message.type === 'stop') {
    emit({ type: 'failed', message: `Stopped: ${message.reason}` });
    process.exit(1);
  }
});

function emit(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForApproval(requestId) {
  return new Promise((resolve) => waiters.set(requestId, resolve));
}

emit({ type: 'log', level: 'info', message: `Starting demo agent for ${process.env.COMMAND_CENTER_RUN_ID}` });
await delay(100);
emit({ type: 'usage', estimatedTokens: 420, commandCount: 0, outputBytes: 1200 });
await delay(100);

const requestId = 'approval_demo_test_command';
emit({
  type: 'approval_request',
  requestId,
  title: 'Run test command',
  description: 'Demo agent wants permission to run the test command category for this session.',
  riskLevel: 'medium',
  scope: { kind: 'command_category', category: 'test' }
});

const approval = await waitForApproval(requestId);
if (!approval.approved) {
  emit({ type: 'failed', message: 'Approval rejected by user.' });
  process.exit(1);
}

emit({ type: 'log', level: 'info', message: `Approval granted: ${approval.grantId}` });
await delay(100);
emit({ type: 'usage', estimatedTokens: 900, commandCount: 1, outputBytes: 2400 });
emit({ type: 'artifact', title: 'Demo Run Summary', path: 'artifacts/demo-summary.md', kind: 'summary' });
emit({ type: 'complete', summary: 'Demo agent completed after receiving a session-scoped approval grant.' });
process.exit(0);
