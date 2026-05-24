import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';
import { createId } from '../../src/shared/domain.js';
import type { WorkflowStep } from '../../src/shared/domain.js';

describe('workflows', () => {
  it('creates a workflow template', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const steps: WorkflowStep[] = [
      {
        id: createId('workflow'),
        name: 'Plan',
        agentRole: 'Planner',
        promptTemplate: 'Create a plan for {{workspacePath}}',
        dependsOn: [],
        onFailure: 'stop',
        maxRetries: 0
      },
      {
        id: createId('workflow'),
        name: 'Build',
        agentRole: 'Builder',
        promptTemplate: 'Build the feature at {{workspacePath}}',
        dependsOn: [],
        onFailure: 'stop',
        maxRetries: 0
      }
    ];

    const workflow = orchestrator.createWorkflow('Feature pipeline', 'Plan then build.', steps);

    expect(workflow.name).toBe('Feature pipeline');
    expect(workflow.steps).toHaveLength(2);
    expect(orchestrator.getSnapshot().workflows).toHaveLength(1);
  });

  it('throws for empty workflow name', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    expect(() => orchestrator.createWorkflow('', 'desc', [])).toThrow('Workflow name is required');
  });
});
