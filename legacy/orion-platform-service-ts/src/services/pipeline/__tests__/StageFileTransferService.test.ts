/**
 * StageFileTransferService 单元测试
 */

import { StageFileTransferService } from '../StageFileTransferService';
import { StageFileTransferRepository } from '../../repositories/StageFileTransferRepository';

describe('StageFileTransferService', () => {
  let service: StageFileTransferService;
  let mockRepo: jest.Mocked<StageFileTransferRepository>;

  beforeEach(() => {
    const files = new Map<string, any>();
    mockRepo = {
      insert: jest.fn(async (entity) => { files.set(entity.id, entity); return entity; }),
      findByStageId: jest.fn(async (stageId) => Array.from(files.values()).filter(f => f.stageId === stageId)),
      findByStageIdAndName: jest.fn(async (stageId, fileName) => Array.from(files.values()).find(f => f.stageId === stageId && f.fileName === fileName)),
      transfer: jest.fn(async (transferId) => {
        const entry = files.get(transferId);
        if (entry) { entry.transferredAt = new Date(); entry.transferred = true; }
        return entry;
      }),
      findTransfersBetweenStages: jest.fn(async (fromStageId, toStageId) =>
        Array.from(files.values()).filter(f => f.fromStageId === fromStageId && f.toStageId === toStageId)
      ),
    } as any;
    service = new StageFileTransferService(mockRepo);
  });

  describe('register', () => {
    it('应该注册文件到stage', async () => {
      await service.register('stage-1', 'artifact.tar.gz', Buffer.from('binary-data'));
      expect(mockRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ stageId: 'stage-1', fileName: 'artifact.tar.gz' })
      );
    });

    it('应该生成唯一的transfer ID', async () => {
      const result = await service.register('stage-1', 'report.pdf', Buffer.from('data'));
      expect(result.id).toBeDefined();
      expect(result.fileName).toBe('report.pdf');
    });
  });

  describe('resolve', () => {
    it('应该根据stageId和fileName查找文件', async () => {
      await service.register('stage-1', 'config.yaml', Buffer.from('yaml-content'));
      const result = await service.resolve('stage-1', 'config.yaml');
      expect(result).toBeDefined();
      expect(result!.content.toString()).toBe('yaml-content');
    });

    it('未找到文件应该返回null', async () => {
      const result = await service.resolve('stage-1', 'nonexistent.txt');
      expect(result).toBeNull();
    });
  });

  describe('transfer', () => {
    it('应该将文件从源stage转移到目标stage', async () => {
      await service.register('stage-1', 'artifact.zip', Buffer.from('zip-data'));
      const files = await service.resolve('stage-1', 'artifact.zip')!;

      await service.transfer(files!.id, 'stage-2');
      expect(mockRepo.transfer).toHaveBeenCalledWith(files!.id, 'stage-2');
    });
  });
});
