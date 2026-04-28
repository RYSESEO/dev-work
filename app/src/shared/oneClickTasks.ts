import type { ApprovalScope, RiskLevel } from './domain.js';

export interface OneClickTaskTemplate {
  id: string;
  title: string;
  description: string;
  recommendedAgentRole: string;
  riskLevel: RiskLevel;
  expectedScopes: ApprovalScope[];
  promptTemplate: string;
}

export const oneClickTasks: OneClickTaskTemplate[] = [
  {
    id: 'review-repo',
    title: 'Review this repo',
    description: 'Inspect the workspace and produce prioritized findings.',
    recommendedAgentRole: 'Reviewer',
    riskLevel: 'low',
    expectedScopes: [{ kind: 'read_workspace' }],
    promptTemplate:
      'Review the repository at {{workspacePath}}. Focus on bugs, regressions, missing tests, and risky architecture. Return prioritized findings.'
  },
  {
    id: 'plan-feature',
    title: 'Plan a feature',
    description: 'Turn a feature request into a buildable task plan.',
    recommendedAgentRole: 'Planner',
    riskLevel: 'low',
    expectedScopes: [{ kind: 'read_workspace' }],
    promptTemplate: 'Read the workspace at {{workspacePath}} and create an implementation plan for this feature: {{userInput}}.'
  },
  {
    id: 'fix-failing-tests',
    title: 'Fix failing tests',
    description: 'Run the test suite, diagnose failures, and propose or apply approved fixes.',
    recommendedAgentRole: 'Builder',
    riskLevel: 'high',
    expectedScopes: [{ kind: 'command_category', category: 'test' }, { kind: 'edit_folder', path: '{{workspacePath}}' }],
    promptTemplate:
      'In {{workspacePath}}, find failing tests, request permission before commands or edits, and fix the smallest safe set of issues.'
  },
  {
    id: 'implementation-plan',
    title: 'Generate implementation plan',
    description: 'Create a step-by-step plan from the current mission goal.',
    recommendedAgentRole: 'Planner',
    riskLevel: 'low',
    expectedScopes: [{ kind: 'read_workspace' }],
    promptTemplate: 'Use the mission context and workspace at {{workspacePath}} to write a task-by-task implementation plan.'
  },
  {
    id: 'summarize-changes',
    title: 'Summarize changes',
    description: 'Summarize current workspace changes for handoff.',
    recommendedAgentRole: 'Reporter',
    riskLevel: 'medium',
    expectedScopes: [{ kind: 'command_category', category: 'git-read' }],
    promptTemplate: 'Summarize current changes in {{workspacePath}} using git status and diff. Do not commit.'
  },
  {
    id: 'code-review',
    title: 'Run code review',
    description: 'Review the active changes and produce actionable findings.',
    recommendedAgentRole: 'Reviewer',
    riskLevel: 'medium',
    expectedScopes: [{ kind: 'read_workspace' }, { kind: 'command_category', category: 'git-read' }],
    promptTemplate:
      'Review the current changes in {{workspacePath}}. Lead with findings, include file references, and mention test gaps.'
  },
  {
    id: 'draft-pr-notes',
    title: 'Draft PR notes',
    description: 'Draft a concise change summary and verification notes.',
    recommendedAgentRole: 'Reporter',
    riskLevel: 'medium',
    expectedScopes: [{ kind: 'command_category', category: 'git-read' }],
    promptTemplate: 'Draft PR notes for the current changes in {{workspacePath}}. Include summary, tests, and risks.'
  }
];
