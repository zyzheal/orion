/**
 * Backup Page Tests
 *
 * 2026-08-26 删除了原来 3 个 handleDownload 测试 —— 它们是不可信的自证测试：
 *   1. 引用了 src/api/backup 里根本不存在的 getBackupDownloadUrl（TS2339，
 *      这些用例连编译都过不了）；
 *   2. 测试体自己 `await import('@/api/backup')` 调用的是自己刚装上去的 mock，
 *      不是组件；
 *   3. 断言的 `message.warning` / `message.error` / `window.open` 全是测试自己
 *      调的，断言的是自己的行为 —— 组件完全没有下载功能（页面那个
 *      CloudDownloadOutlined 按钮实际是「执行」，见 index.tsx:425-433），
 *      删光组件代码这些测试也照样绿。
 * 要真覆盖下载，得先在 api/backup 和页面上把功能做出来。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackupManagement from '../index';

const { mockMessage, mockApi } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockApi: {
    getBackups: vi.fn().mockResolvedValue({
      data: { backups: [] },
    }),
    getBackupStats: vi.fn().mockResolvedValue({
      data: { stats: { total: 0, successful: 0, failed: 0 } },
    }),
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
  },
}));

vi.mock('@/api/backup', () => mockApi);

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: mockMessage };
});

vi.mock('dayjs', async () => {
  const actual = await vi.importActual('dayjs');
  const dayjsFn = (_: unknown) => ({
    format: () => '2026-04-12 15:00:00',
    fromNow: () => '2 minutes ago',
  });
  // @ts-expect-error dayjs mock needs these extensions
  (dayjsFn as Record<string, unknown>).extend = vi.fn(() => dayjsFn);
  // @ts-expect-error dayjs mock needs these extensions
  (dayjsFn as Record<string, unknown>).duration = vi.fn(() => ({
    asMinutes: () => 0,
    seconds: () => 0,
  }));
  Object.assign(dayjsFn, actual);
  return { default: dayjsFn };
});

vi.mock('dayjs/plugin/duration', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { default: mod?.default || vi.fn() };
});

vi.mock('dayjs/plugin/relativeTime', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return { default: mod?.default || vi.fn() };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('BackupManagement', () => {
  beforeEach(() => {
    mockMessage.error.mockClear();
    mockMessage.warning.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    renderWithRouter(<BackupManagement />);
    await waitFor(() => {
      expect(screen.getByText('Backup Management')).toBeInTheDocument();
    });
  });

});
