/**
 * DigitalTwinController 单元测试
 */
import { DigitalTwinController } from '../DigitalTwinController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('DigitalTwinController', () => {
  let controller: DigitalTwinController;

  beforeEach(() => {
    controller = new DigitalTwinController();
  });

  describe('registerTwin', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.registerTwin(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.registerTwin(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('listTwins', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.listTwins(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.listTwins(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('getTwinState', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.getTwinState(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.getTwinState(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('createSnapshot', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.createSnapshot(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.createSnapshot(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('createSandbox', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.createSandbox(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.createSandbox(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('listSandboxes', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.listSandboxes(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.listSandboxes(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('stopSandbox', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.stopSandbox(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.stopSandbox(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('destroySandbox', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.destroySandbox(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.destroySandbox(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('getSandboxHealth', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.getSandboxHealth(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.getSandboxHealth(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('startRecording', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.startRecording(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.startRecording(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('stopRecording', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.stopRecording(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.stopRecording(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('pauseRecording', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.pauseRecording(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.pauseRecording(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('listRecordings', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.listRecordings(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.listRecordings(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('getRecordingDetail', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.getRecordingDetail(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.getRecordingDetail(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('getRecordingRecords', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.getRecordingRecords(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.getRecordingRecords(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('startReplay', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.startReplay(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.startReplay(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('getReplayStatus', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.getReplayStatus(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.getReplayStatus(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('listReplays', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.listReplays(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.listReplays(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('cancelReplay', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.cancelReplay(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.cancelReplay(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('getReplayReport', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.getReplayReport(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.getReplayReport(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('recordTraffic', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.recordTraffic(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.recordTraffic(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });

  describe('replayTraffic', () => {
    it('should handle request and send response', async () => {
      const request = {
        body: { name: 'test', value: 'test-value' },
        params: { id: 'test-id', tenantId: 't-1', userId: 'u-1' },
        query: {},
        headers: { 'x-tenant-id': 't-1', 'x-user-id': 'u-1' },
        user: { userId: 'u-1', username: 'testuser', role: 'admin', tenantId: 't-1' },
      } as any;
      const reply = createMockReply();

      await controller.replayTraffic(request, reply);

      // Should have called send or status (handler always responds)
      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });

    it('should handle missing body/params gracefully', async () => {
      const request = {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: undefined,
      } as any;
      const reply = createMockReply();

      await controller.replayTraffic(request, reply);

      const responded = reply.send.mock.calls.length > 0 ||
                        reply.status.mock.calls.length > 0 ||
                        reply.code.mock.calls.length > 0;
      expect(responded).toBe(true);
    });
  });
});
