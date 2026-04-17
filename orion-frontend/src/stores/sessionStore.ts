import { create } from 'zustand';

export interface SessionProgress {
  id: string;
  type: 'agent' | 'pipeline' | 'deployment' | 'build';
  name: string;
  progress: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: string;
  message?: string;
}

export interface SessionState {
  sessions: SessionProgress[];
  addSession: (session: Omit<SessionProgress, 'id'>) => void;
  updateSession: (id: string, updates: Partial<SessionProgress>) => void;
  removeSession: (id: string) => void;
  clearCompleted: () => void;
  getActiveSessions: () => SessionProgress[];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],

  addSession: (session) => {
    const id = generateId();
    set({
      sessions: [...get().sessions, { ...session, id }],
    });
  },

  updateSession: (id, updates) => {
    set({
      sessions: get().sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    });
  },

  removeSession: (id) => {
    set({
      sessions: get().sessions.filter((s) => s.id !== id),
    });
  },

  clearCompleted: () => {
    set({
      sessions: get().sessions.filter(
        (s) => s.status !== 'completed' && s.status !== 'failed',
      ),
    });
  },

  getActiveSessions: () => {
    return get().sessions.filter(
      (s) => s.status === 'running' || s.status === 'paused',
    );
  },
}));
