import { PromotionService, PromotionStage } from '../PromotionService';

describe('PromotionService', () => {
  let service: PromotionService;

  beforeEach(() => {
    service = new PromotionService();
  });

  test('should start at development stage', async () => {
    service.setStage('artifact1', PromotionStage.DEVELOPMENT);
    expect(await service.getCurrentStage('artifact1')).toBe(PromotionStage.DEVELOPMENT);
  });

  test('should promote to next stage', async () => {
    service.setStage('artifact1', PromotionStage.DEVELOPMENT);
    const record = await service.promote('artifact1', 'user1');
    expect(record.fromStage).toBe(PromotionStage.DEVELOPMENT);
    expect(record.toStage).toBe(PromotionStage.TESTING);
    expect(await service.getCurrentStage('artifact1')).toBe(PromotionStage.TESTING);
  });

  test('should only allow step-by-step promotion', async () => {
    service.setStage('artifact1', PromotionStage.DEVELOPMENT);
    expect(await service.canPromote('artifact1', PromotionStage.TESTING)).toBe(true);
    expect(await service.canPromote('artifact1', PromotionStage.STAGING)).toBe(false);
  });

  test('should reject promotion at final stage', async () => {
    service.setStage('artifact1', PromotionStage.RELEASED);
    await expect(service.promote('artifact1', 'user1')).rejects.toThrow('Already at final stage');
  });

  test('should track promotion history', async () => {
    service.setStage('artifact1', PromotionStage.DEVELOPMENT);
    await service.promote('artifact1', 'user1');
    await service.promote('artifact1', 'user1');
    const history = await service.getHistory('artifact1');
    expect(history.length).toBe(2);
  });

  test('should support approval workflow', async () => {
    service.setStage('artifact1', PromotionStage.TESTING);
    const record = await service.promoteWithApproval('artifact1', 'user1', 'manager1', 'Ready for staging');
    expect(record.approvedBy).toBe('manager1');
    expect(record.approvedAt).toBeTruthy();
  });
});
