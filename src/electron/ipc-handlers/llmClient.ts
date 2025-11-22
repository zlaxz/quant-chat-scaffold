import { ipcMain } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// LLM routing config
const PRIMARY_MODEL = 'gemini-3-pro-preview';
const PRIMARY_PROVIDER = 'gemini';
const SWARM_MODEL = 'deepseek-reasoner';
const SWARM_PROVIDER = 'deepseek';

// Lazy client getters - read API keys at call time, not module load time
// This allows keys set via Settings to take effect without app restart
function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function getDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
}

export function registerLlmHandlers() {
  // Primary tier - routes to Supabase edge function for database + memory integration
  ipcMain.handle('chat-primary', async (_event, sessionId: string, workspaceId: string, content: string) => {
    try {
      // Import supabase client dynamically to avoid circular dependencies
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Call edge function which handles memory, database, and LLM
      const { data, error } = await supabase.functions.invoke('chat-primary', {
        body: { sessionId, workspaceId, content },
      });
      
      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      console.error('Error in chat-primary:', error);
      throw error;
    }
  });

  // Swarm tier (DeepSeek)
  ipcMain.handle('chat-swarm', async (_event, messages: any[]) => {
    try {
      const deepseekClient = getDeepSeekClient();
      if (!deepseekClient) {
        throw new Error('DEEPSEEK_API_KEY not configured. Go to Settings to add your API key.');
      }

      const completion = await deepseekClient.chat.completions.create({
        model: SWARM_MODEL,
        messages,
      });

      return {
        content: completion.choices[0].message.content || '',
        provider: SWARM_PROVIDER,
        model: SWARM_MODEL,
      };
    } catch (error) {
      console.error('Error in chat-swarm:', error);
      throw error;
    }
  });

  // Swarm parallel (DeepSeek)
  ipcMain.handle('chat-swarm-parallel', async (_event, prompts: any[]) => {
    try {
      const deepseekClient = getDeepSeekClient();
      if (!deepseekClient) {
        throw new Error('DEEPSEEK_API_KEY not configured. Go to Settings to add your API key.');
      }

      const promises = prompts.map(async (prompt) => {
        const completion = await deepseekClient.chat.completions.create({
          model: SWARM_MODEL,
          messages: prompt.messages,
        });

        return {
          agentId: prompt.agentId,
          content: completion.choices[0].message.content || '',
        };
      });

      return await Promise.all(promises);
    } catch (error) {
      console.error('Error in chat-swarm-parallel:', error);
      throw error;
    }
  });

  // Helper chat (OpenAI mini)
  ipcMain.handle('helper-chat', async (_event, messages: any[]) => {
    try {
      const openaiClient = getOpenAIClient();
      if (!openaiClient) {
        throw new Error('OPENAI_API_KEY not configured. Go to Settings to add your API key.');
      }

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-5-mini',
        messages,
      });

      return {
        content: completion.choices[0].message.content || '',
      };
    } catch (error) {
      console.error('Error in helper-chat:', error);
      throw error;
    }
  });
}
