import { WorkflowTimerRepository } from '../WorkflowTimerRepository';

describe('WorkflowTimerRepository', () => {
  it('should instantiate', () => {
    const repo = new WorkflowTimerRepository();
    expect(repo).toBeDefined();
  });
});
