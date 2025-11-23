/**
 * Memory IPC Handlers
 * Connects renderer process to memory daemon and recall engine
 */

import { ipcMain, BrowserWindow } from 'electron';
import { MemoryDaemon } from '../memory/MemoryDaemon';
import { RecallEngine } from '../memory/RecallEngine';

let memoryDaemon: MemoryDaemon | null = null;
let recallEngine: RecallEngine | null = null;
let extractionListener: ((data: { count: number; sessionId: string }) => void) | null = null;
let errorListener: ((error: Error) => void) | null = null;

export function setMemoryServices(daemon: MemoryDaemon, recall: RecallEngine): void {
  memoryDaemon = daemon;
  recallEngine = recall;
}

export function registerMemoryHandlers(): void {
  // Memory recall - the KEY handler for automatic injection
  ipcMain.handle(
    'memory:recall',
    async (
      _event,
      query: string,
      workspaceId: string,
      options?: {
        limit?: number;
        minImportance?: number;
        useCache?: boolean;
        rerank?: boolean;
        categories?: string[];
        symbols?: string[];
      }
    ) => {
      if (!recallEngine) {
        console.error('[MemoryHandlers] RecallEngine not initialized');
        return { memories: [], totalFound: 0, searchTimeMs: 0, usedCache: false, query };
      }

      try {
        return await recallEngine.recall(query, workspaceId, options);
      } catch (error: any) {
        console.error('[MemoryHandlers] Recall error:', error);
        return { memories: [], totalFound: 0, searchTimeMs: 0, usedCache: false, query, error: error.message };
      }
    }
  );

  // Format memories for prompt injection
  ipcMain.handle('memory:formatForPrompt', async (_event, memories: any[]) => {
    if (!recallEngine) return '';
    return recallEngine.formatForPrompt(memories);
  });

  // Warm cache on session start
  ipcMain.handle('memory:warmCache', async (_event, workspaceId: string) => {
    if (!recallEngine) return { success: false, error: 'RecallEngine not initialized' };

    try {
      await recallEngine.warmCache(workspaceId);
      return { success: true };
    } catch (error: any) {
      console.error('[MemoryHandlers] Cache warming error:', error);
      return { success: false, error: error.message };
    }
  });

  // Daemon control
  ipcMain.handle('memory:daemon:start', async () => {
    if (!memoryDaemon) {
      return { success: false, error: 'MemoryDaemon not initialized' };
    }

    try {
      await memoryDaemon.start();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('memory:daemon:stop', async () => {
    if (!memoryDaemon) {
      return { success: false, error: 'MemoryDaemon not initialized' };
    }

    try {
      await memoryDaemon.stop();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Daemon status
  ipcMain.handle('memory:daemon:status', async () => {
    if (!memoryDaemon || !recallEngine) {
      return {
        daemonRunning: false,
        cacheSize: 0,
        totalMemories: 0,
      };
    }

    return {
      daemonRunning: true,
      cacheSize: recallEngine.getCacheSize(),
      totalMemories: memoryDaemon.getMemoryCount(),
    };
  });

  // Setup event forwarding to renderer with cleanup
  if (memoryDaemon) {
    // Remove old listeners before registering new ones to prevent leaks
    if (extractionListener) {
      memoryDaemon.off('memories-extracted', extractionListener);
    }
    if (errorListener) {
      memoryDaemon.off('error', errorListener);
    }

    // Register new listeners
    extractionListener = (data: { count: number; sessionId: string }) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        // Safe null check for BrowserWindow
        if (win && win.webContents) {
          win.webContents.send('memory:extracted', data);
        }
      });
    };

    errorListener = (error: Error) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        // Safe null check for BrowserWindow
        if (win && win.webContents) {
          win.webContents.send('memory:error', { message: error.message });
        }
      });
    };

    memoryDaemon.on('memories-extracted', extractionListener);
    memoryDaemon.on('error', errorListener);
  }
}
