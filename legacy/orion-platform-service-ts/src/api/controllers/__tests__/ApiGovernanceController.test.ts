/**
 * ApiGovernanceController 单元测试
 *
 * NOTE: ApiGovernanceController is dead code. Routes in api-governance-routes.ts
 * directly use ApiGovernanceRepository (PostgreSQL). The controller has no active methods.
 * This test verifies the deprecation status.
 */
import { ApiGovernanceController } from '../ApiGovernanceController';

describe('ApiGovernanceController', () => {
  it('should be a deprecated empty controller', () => {
    const controller = new ApiGovernanceController();
    expect(controller).toBeDefined();
    // Controller has no active methods - routes use ApiGovernanceRepository directly
  });
});
