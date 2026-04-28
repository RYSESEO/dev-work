export const commandCenterClient = {
  getSnapshot: () => window.commandCenter.getSnapshot(),
  createMission: (title: string, goal: string) => window.commandCenter.createMission(title, goal),
  createTask: (missionId: string | null, title: string, description: string, priority?: 'low' | 'normal' | 'high') =>
    window.commandCenter.createTask(missionId, title, description, priority),
  launchRun: (taskId: string, agentProfileId: string, prompt: string) =>
    window.commandCenter.launchRun(taskId, agentProfileId, prompt),
  approveRequest: (approvalRequestId: string) => window.commandCenter.approveRequest(approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string) => window.commandCenter.rejectRequest(approvalRequestId, reason)
};
