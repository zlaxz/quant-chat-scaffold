import { contextBridge, ipcRenderer } from 'electron';

// Expose safe IPC methods to renderer
contextBridge.exposeInMainWorld('electron', {
  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  listDir: (dirPath: string) => ipcRenderer.invoke('list-dir', dirPath),
  searchCode: (query: string, dirPath?: string) => ipcRenderer.invoke('search-code', query, dirPath),

  // Python execution
  runBacktest: (params: {
    strategyKey: string;
    startDate: string;
    endDate: string;
    capital: number;
    profileConfig?: Record<string, unknown>;
  }) => ipcRenderer.invoke('run-backtest', params),

  // LLM operations
  chatPrimary: (messages: Array<{ role: string; content: string }>) => ipcRenderer.invoke('chat-primary', messages),
  chatSwarm: (messages: Array<{ role: string; content: string }>) => ipcRenderer.invoke('chat-swarm', messages),
  chatSwarmParallel: (prompts: Array<{ agentId: string; messages: Array<{ role: string; content: string }> }>) => ipcRenderer.invoke('chat-swarm-parallel', prompts),
  helperChat: (messages: Array<{ role: string; content: string }>) => ipcRenderer.invoke('helper-chat', messages),

  // Environment
  getRotationEngineRoot: () => ipcRenderer.invoke('get-rotation-engine-root'),
  
  // Project directory settings
  getProjectDirectory: () => ipcRenderer.invoke('get-project-directory'),
  setProjectDirectory: (dirPath: string) => ipcRenderer.invoke('set-project-directory', dirPath),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  createDefaultProjectDirectory: () => ipcRenderer.invoke('create-default-project-directory'),
  
  // API Keys
  getAPIKeys: () => ipcRenderer.invoke('get-api-keys'),
  setAPIKeys: (keys: { gemini: string; openai: string; deepseek: string }) => ipcRenderer.invoke('set-api-keys', keys),

  // Memory System
  memoryRecall: (query: string, workspaceId: string, options?: any) =>
    ipcRenderer.invoke('memory:recall', query, workspaceId, options),
  memoryFormatForPrompt: (memories: any[]) =>
    ipcRenderer.invoke('memory:formatForPrompt', memories),
  memoryWarmCache: (workspaceId: string) =>
    ipcRenderer.invoke('memory:warmCache', workspaceId),
  memoryDaemonStatus: () =>
    ipcRenderer.invoke('memory:daemon:status'),
  checkMemoryTriggers: (message: string, workspaceId: string) =>
    ipcRenderer.invoke('memory:check-triggers', message, workspaceId),
  getStaleMemories: (workspaceId: string) =>
    ipcRenderer.invoke('memory:get-stale', workspaceId),
  markMemoriesRecalled: (memoryIds: string[]) =>
    ipcRenderer.invoke('memory:mark-recalled', memoryIds),

  // Tool progress events (for real-time tool execution visibility)
  onToolProgress: (callback: (data: {
    type: 'thinking' | 'tools-starting' | 'executing' | 'completed';
    tool?: string;
    args?: Record<string, any>;
    success?: boolean;
    preview?: string;
    count?: number;
    iteration?: number;
    message?: string;
    timestamp: number;
  }) => void) => {
    ipcRenderer.on('tool-progress', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('tool-progress');
  },

  // LLM streaming events (for real-time text streaming)
  onLLMStream: (callback: (data: {
    type: 'chunk' | 'done' | 'error';
    content?: string;
    error?: string;
    timestamp: number;
  }) => void) => {
    ipcRenderer.on('llm-stream', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('llm-stream');
  },

  // Remove listeners (cleanup)
  removeToolProgressListener: () => ipcRenderer.removeAllListeners('tool-progress'),
  removeLLMStreamListener: () => ipcRenderer.removeAllListeners('llm-stream'),
});

// The ElectronAPI type is defined in src/types/electron.d.ts as a global type
// This ensures all components can see window.electron types without imports
