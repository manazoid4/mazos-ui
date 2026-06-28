import { create } from 'zustand';

export type FocusStatus = 'pending' | 'in_progress' | 'done' | 'partial' | 'abandoned';

export interface FocusSession {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  project: string;
  task: string;
  mode: string;
  status: FocusStatus;
  output: string;
  distractions: string[];
}

interface FocusState {
  currentSession: FocusSession | null;
  sessions: FocusSession[];
  isLoading: boolean;
  
  startSession: (project: string, task: string, mode: string) => Promise<void>;
  endSession: (status: FocusStatus, output: string) => Promise<void>;
  addDistraction: (distraction: string) => void;
  fetchSessions: () => Promise<void>;
}

export const useFocusStore = create<FocusState>((set, get) => ({
  currentSession: null,
  sessions: [],
  isLoading: false,

  fetchSessions: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/mazos/focus');
      if (res.ok) {
        const data = await res.json();
        set({ sessions: data });
      }
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    } finally {
      set({ isLoading: false });
    }
  },

  startSession: async (project, task, mode) => {
    const newSession: FocusSession = {
      id: `focus-${new Date().toISOString().split('T')[0]}-${Date.now().toString().slice(-4)}`,
      startedAt: new Date().toISOString(),
      endedAt: null,
      project,
      task,
      mode,
      status: 'in_progress',
      output: '',
      distractions: []
    };

    set({ currentSession: newSession });

    try {
      await fetch('/api/mazos/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
      });
      get().fetchSessions();
    } catch (e) {
      console.error('Failed to save session', e);
    }
  },

  endSession: async (status, output) => {
    const session = get().currentSession;
    if (!session) return;

    const updatedSession = {
      ...session,
      endedAt: new Date().toISOString(),
      status,
      output
    };

    set({ currentSession: null });

    try {
      await fetch('/api/mazos/focus', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSession)
      });
      get().fetchSessions();
    } catch (e) {
      console.error('Failed to update session', e);
    }
  },

  addDistraction: (distraction) => {
    const session = get().currentSession;
    if (!session) return;
    
    // update local state only for now; will save on end
    set({
      currentSession: {
        ...session,
        distractions: [...session.distractions, distraction]
      }
    });
  }
}));
