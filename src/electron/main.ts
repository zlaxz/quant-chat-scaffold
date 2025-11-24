import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import Store from 'electron-store';
import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { registerFileOperationHandlers } from './ipc-handlers/fileOperations';
import { registerPythonExecutionHandlers } from './ipc-handlers/pythonExecution';
import { registerLlmHandlers } from './ipc-handlers/llmClient';
import { registerMemoryHandlers, setMemoryServices, registerAnalysisHandlers } from './ipc-handlers/memoryHandlers';
import { setFileSystemRoot } from './services/FileSystemService';
import { MemoryDaemon } from './memory/MemoryDaemon';
import { RecallEngine } from './memory/RecallEngine';
import { OverfittingDetector } from './analysis/overfittingDetector';
import { RegimeTagger } from './analysis/regimeTagger';
import { WarningSystem } from './analysis/warningSystem';
import { PatternDetector } from './analysis/patternDetector';
import { StaleMemoryInjector } from './memory/staleMemoryInjector';
import { TriggerRecall } from './memory/triggerRecall';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize electron-store for persistent settings
const store = new Store<{
  projectDirectory?: string;
  'apiKeys.gemini'?: string;
  'apiKeys.openai'?: string;
  'apiKeys.deepseek'?: string;
}>();

let mainWindow: BrowserWindow | null = null;
let memoryDaemon: MemoryDaemon | null = null;
let localDb: Database.Database | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize project directory from store or environment variable
  const savedDirectory = store.get('projectDirectory');
  if (savedDirectory) {
    process.env.ROTATION_ENGINE_ROOT = savedDirectory;
    // Initialize FileSystemService with root path
    setFileSystemRoot(savedDirectory);
  }

  // Initialize API keys from store
  const savedGemini = store.get('apiKeys.gemini');
  const savedOpenai = store.get('apiKeys.openai');
  const savedDeepseek = store.get('apiKeys.deepseek');
  if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
  if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  if (savedDeepseek) process.env.DEEPSEEK_API_KEY = savedDeepseek;

  // Initialize Supabase credentials (public anon key - safe to embed)
  process.env.SUPABASE_URL = 'https://ynaqtawyynqikfyranda.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluYXF0YXd5eW5xaWtmeXJhbmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NzM5NjMsImV4cCI6MjA3OTE0OTk2M30.VegcJvLluy8toSYqnR7Ufc5jx5XAl1-XeDRl8KbsIIw';

  // Register project directory IPC handlers
  ipcMain.handle('get-project-directory', () => {
    return store.get('projectDirectory') || process.env.ROTATION_ENGINE_ROOT || null;
  });

  ipcMain.handle('set-project-directory', async (_event, dirPath: string) => {
    // Validate directory exists
    if (!fs.existsSync(dirPath)) {
      throw new Error('Directory does not exist');
    }

    // Validate it's a directory
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    store.set('projectDirectory', dirPath);
    process.env.ROTATION_ENGINE_ROOT = dirPath;
    // Update FileSystemService root
    setFileSystemRoot(dirPath);
    return { success: true };
  });

  ipcMain.handle('pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Directory',
      message: 'Choose your rotation-engine repository directory',
    });
    return result.filePaths[0] || null;
  });

  ipcMain.handle('create-default-project-directory', async () => {
    try {
      const homeDir = os.homedir();
      const defaultPath = path.join(homeDir, 'quant-projects');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
      }

      return { success: true, path: defaultPath };
    } catch (error: any) {
      throw new Error(`Failed to create default directory: ${error.message}`);
    }
  });

  // API Keys handlers
  ipcMain.handle('get-api-keys', () => {
    return {
      gemini: store.get('apiKeys.gemini') || '',
      openai: store.get('apiKeys.openai') || '',
      deepseek: store.get('apiKeys.deepseek') || '',
    };
  });

  ipcMain.handle('set-api-keys', (_event, keys: { gemini: string; openai: string; deepseek: string }) => {
    store.set('apiKeys.gemini', keys.gemini);
    store.set('apiKeys.openai', keys.openai);
    store.set('apiKeys.deepseek', keys.deepseek);
    
    // Update environment variables for edge functions
    if (keys.gemini) process.env.GEMINI_API_KEY = keys.gemini;
    if (keys.openai) process.env.OPENAI_API_KEY = keys.openai;
    if (keys.deepseek) process.env.DEEPSEEK_API_KEY = keys.deepseek;
    
    return { success: true };
  });

  // Initialize memory system
  const memoryDbPath = path.join(app.getPath('userData'), 'memory.db');
  localDb = new Database(memoryDbPath);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const recallEngine = new RecallEngine(localDb, supabase);
  memoryDaemon = new MemoryDaemon(localDb, supabase, {
    intervalMs: 30000, // 30 seconds
    minImportance: 0.3,
  });

  // Initialize analysis modules
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

  const overfittingDetector = new OverfittingDetector(supabase, openaiClient);
  const regimeTagger = new RegimeTagger(supabase);
  const warningSystem = new WarningSystem(supabase, openaiClient);
  const patternDetector = new PatternDetector(supabase);
  const staleInjector = new StaleMemoryInjector(supabase);
  const triggerRecall = new TriggerRecall(recallEngine);

  // Register all IPC handlers
  registerFileOperationHandlers();
  registerPythonExecutionHandlers();
  registerLlmHandlers();

  // Connect memory services to handlers BEFORE registering handlers
  setMemoryServices(memoryDaemon, recallEngine);

  // THEN register memory handlers so they have access to services
  registerMemoryHandlers();

  // Register analysis handlers
  registerAnalysisHandlers(
    overfittingDetector,
    regimeTagger,
    warningSystem,
    patternDetector,
    staleInjector,
    triggerRecall
  );

  // Start memory daemon and wait for it before creating window
  memoryDaemon.start().then(() => {
    console.log('[Main] Memory daemon started successfully');
    createWindow();
  }).catch(err => {
    console.error('[Main] Failed to start memory daemon:', err);
    // Fall back to creating window even if daemon fails
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async () => {
  // Stop memory daemon gracefully
  if (memoryDaemon) {
    await memoryDaemon.stop();
  }
  if (localDb) {
    localDb.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
