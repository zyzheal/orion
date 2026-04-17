import { useCallback, useEffect, useRef } from 'react';
import { useSessionStore, SessionProgress } from '../stores/sessionStore';

const SESSION_TYPES: SessionProgress['type'][] = [
  'agent',
  'pipeline',
  'deployment',
  'build',
];

const SESSION_NAMES: Record<SessionProgress['type'], string[]> = {
  agent: ['Code Review Agent', 'Test Generator', 'Bug Analyzer'],
  pipeline: ['CI Pipeline #142', 'Release Pipeline #38', 'Nightly Build #901'],
  deployment: ['Staging Deploy', 'Production Deploy', 'Canary Rollout'],
  build: ['Frontend Build', 'Backend Build', 'Docker Image Build'],
};

interface UseSessionProgressResult {
  sessions: SessionProgress[];
  totalActive: number;
  simulateSession: () => void;
}

export function useSessionProgress(): UseSessionProgressResult {
  const sessions = useSessionStore((s) => s.getActiveSessions());
  const totalActive = sessions.length;
  const addSession = useSessionStore((s) => s.addSession);
  const updateSession = useSessionStore((s) => s.updateSession);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulateSession = useCallback(() => {
    const type =
      SESSION_TYPES[Math.floor(Math.random() * SESSION_TYPES.length)];
    const names = SESSION_NAMES[type];
    const name = names[Math.floor(Math.random() * names.length)];

    addSession({
      type,
      name,
      progress: 0,
      status: 'running',
      startedAt: new Date().toISOString(),
      message: 'Starting...',
    });
  }, [addSession]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const active = useSessionStore.getState().getActiveSessions();
      for (const session of active) {
        const increment = Math.floor(Math.random() * 15) + 5;
        const newProgress = Math.min(session.progress + increment, 100);

        if (newProgress >= 100) {
          const success = Math.random() > 0.1;
          updateSession(session.id, {
            progress: 100,
            status: success ? 'completed' : 'failed',
            message: success ? 'Completed successfully' : 'Execution failed',
          });
        } else {
          updateSession(session.id, {
            progress: newProgress,
            message: `Processing... ${newProgress}%`,
          });
        }
      }
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateSession]);

  return { sessions, totalActive, simulateSession };
}
