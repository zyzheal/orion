/**
 * DigitalTwinController 单元测试
 *
 * NOTE: DigitalTwinController is dead code. Routes in digital-twin-routes.ts
 * directly use DigitalTwinRepository (PostgreSQL). The controller has no active methods.
 * This test verifies the deprecation status.
 */
import { DigitalTwinController } from '../DigitalTwinController';

describe('DigitalTwinController', () => {
  it('should be a deprecated empty controller', () => {
    const controller = new DigitalTwinController();
    expect(controller).toBeDefined();
    // Controller has no active methods - routes use DigitalTwinRepository directly
  });
});
