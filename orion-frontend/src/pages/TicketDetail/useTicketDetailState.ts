/**
 * useTicketDetailState.ts - TicketDetail 状态 Hook
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
 * 全 state + loadTicket/loadEngineers/loadRelatedData + 5 handlers + action flags + SLA memo
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  getTicket,
  assignTicket,
  resolveTicket,
  closeTicket,
  getTicketRelations,
  getTransferHistory,
  getWorkflowHistory,
} from '@/api/ticketing';
import { listUsers, type User } from '@/api/users';
import type { Ticket, AssignValues, ResolveValues, TransferValues, EscalateValues } from './types';
import { calculateSLA } from './helpers';

export const useTicketDetailState = (id?: string) => {
  // --- State ---
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [_loading, setLoading] = useState(false);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // --- Loaders ---

  const loadTicket = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTicket(id!);
      setTicket((response as { data?: { data?: Ticket } })?.data?.data ?? null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载工单详情失败：${err.message}`);
      } else {
        message.error('加载工单详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load engineers for assign/transfer modals
  useEffect(() => {
    const loadEngineers = async () => {
      try {
        const res = await listUsers({ limit: 200 });
        setEngineers(res.data?.data || []);
      } catch {
        message.error('加载工程师列表失败');
        setEngineers([]);
      }
    };
    loadEngineers();
  }, []);

  // Load ticket from API
  useEffect(() => {
    if (id) loadTicket();
  }, [id, loadTicket]);

  // Load relations and transfer history
  useEffect(() => {
    const loadRelatedData = async () => {
      if (!id) return;
      try {
        const [relationsRes, transfersRes, historyRes] = await Promise.all([
          getTicketRelations(id),
          getTransferHistory(id),
          getWorkflowHistory(id),
        ]);
        setRelations(relationsRes.data?.items || []);
        setTransfers(transfersRes.data?.items || []);
        const historyData = historyRes.data?.items;
        setHistory(Array.isArray(historyData) ? historyData : []);
      } catch {
        // Relations/transfer history are non-critical; silently fail
      }
    };
    loadRelatedData();
  }, [id]);

  // --- Memos ---
  const sla = useMemo(() => (ticket ? calculateSLA(ticket) : null), [ticket]);

  // --- Action flags ---
  const canAssign = ticket?.status === 'open';
  const canEscalate = ticket ? ticket.status !== 'closed' && ticket.status !== 'resolved' : false;
  const canResolve = ticket ? ticket.status === 'in-progress' || ticket.status === 'assigned' : false;
  const canClose = ticket?.status === 'resolved';
  const canTransfer = ticket ? ticket.status === 'assigned' || ticket.status === 'in-progress' : false;

  // --- Handlers ---

  const handleAssign = useCallback(
    async (values: AssignValues) => {
      if (!ticket) return;
      try {
        await assignTicket(ticket.id, {
          assignee: values.assignee,
          assignedBy: 'current-user',
          reason: values.reason,
        });
        message.success(`工单已分配给 ${values.assignee}`);
        setAssignModalOpen(false);
        loadTicket();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`分配失败：${error.message}`);
        } else {
          message.error('分配失败，请稍后重试');
        }
      }
    },
    [ticket, loadTicket],
  );

  const handleEscalate = useCallback(async (_values: EscalateValues) => {
    message.success(`工单已升级`);
    setEscalateModalOpen(false);
  }, []);

  const handleResolve = useCallback(
    async (values: ResolveValues) => {
      if (!ticket) return;
      try {
        await resolveTicket(ticket.id, {
          performedBy: 'current-user',
          resolutionNote: values.resolutionNote,
        });
        message.success('工单已标记为已解决');
        setResolveModalOpen(false);
        loadTicket();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`解决失败：${error.message}`);
        } else {
          message.error('解决失败，请稍后重试');
        }
      }
    },
    [ticket, loadTicket],
  );

  const handleTransfer = useCallback(
    async (values: TransferValues) => {
      if (!ticket) return;
      try {
        await assignTicket(ticket.id, {
          assignee: values.toEngineer,
          assignedBy: 'current-user',
          reason: values.reason,
        });
        message.success(`工单已转交给 ${values.toEngineer}`);
        setTransferModalOpen(false);
        loadTicket();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`转交失败：${error.message}`);
        } else {
          message.error('转交失败，请稍后重试');
        }
      }
    },
    [ticket, loadTicket],
  );

  const handleClose = useCallback(async () => {
    if (!ticket) return;
    try {
      await closeTicket(ticket.id, { performedBy: 'current-user' });
      message.success('工单已关闭');
      loadTicket();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`关闭失败：${error.message}`);
      } else {
        message.error('关闭失败，请稍后重试');
      }
    }
  }, [ticket, loadTicket]);

  // --- Returns ---
  return {
    ticket,
    engineers,
    relations,
    transfers,
    history,
    sla,
    assignModalOpen, setAssignModalOpen,
    escalateModalOpen, setEscalateModalOpen,
    resolveModalOpen, setResolveModalOpen,
    transferModalOpen, setTransferModalOpen,
    canAssign, canEscalate, canResolve, canClose, canTransfer,
    loadTicket,
    handleAssign,
    handleEscalate,
    handleResolve,
    handleTransfer,
    handleClose,
  };
};
