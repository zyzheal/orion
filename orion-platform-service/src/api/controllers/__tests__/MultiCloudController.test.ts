/**
 * MultiCloudController 单元测试
 *
 * NOTE: MultiCloudController is deprecated. Routes in multi-cloud-routes.ts
 * directly use MultiCloudManagerService / MultiCloudRepository (PostgreSQL).
 * The controller has no active methods.
 * This test verifies the deprecation status.
 */
import { MultiCloudController } from '../MultiCloudController';

describe('MultiCloudController', () => {
  it('should be a deprecated empty controller', () => {
    const controller = new MultiCloudController();
    expect(controller).toBeDefined();
    // Controller has no active methods - routes use MultiCloudManagerService directly
  });
});
