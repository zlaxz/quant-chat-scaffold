import { createContext, useContext, useState, ReactNode } from 'react';

export interface ActiveExperiment {
  id: string;
  name: string;
  strategy: string;
  lastRunId?: string;
  lastRunTime?: string;
  status: 'active' | 'paused' | 'completed';
}

interface ChatContextType {
  selectedSessionId: string | null;
  selectedWorkspaceId: string | null;
  setSelectedSession: (sessionId: string | null, workspaceId: string | null) => void;
  activeExperiment: ActiveExperiment | null;
  setActiveExperiment: (experiment: ActiveExperiment | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [activeExperiment, setActiveExperiment] = useState<ActiveExperiment | null>(null);

  const setSelectedSession = (sessionId: string | null, workspaceId: string | null) => {
    setSelectedSessionId(sessionId);
    setSelectedWorkspaceId(workspaceId);
  };

  return (
    <ChatContext.Provider value={{
      selectedSessionId,
      selectedWorkspaceId,
      setSelectedSession,
      activeExperiment,
      setActiveExperiment
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};
