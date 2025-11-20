/**
 * Multi-Provider LLM Client with MCP Tool Support
 * 
 * Supports tiered routing to different LLM providers:
 * - PRIMARY: Gemini 3 Pro (Google API) - for code writing, complex analysis
 * - SECONDARY: GPT-5.1 (OpenAI API) - for general tasks
 * - SWARM: DeepSeek-Reasoner (DeepSeek API) - for parallel agent modes
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";
import { getMcpToolsForLlm, executeMcpToolCalls, type McpToolInvocation } from './mcpClient.ts';

export type LlmTier = 'primary' | 'secondary' | 'swarm';
export type ProviderName = 'openai' | 'google' | 'anthropic' | 'deepseek' | 'custom';

export interface LlmConfig {
  model: string;
  provider: ProviderName;
}

export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Get model configuration for a specific tier
 */
export function getConfigForTier(tier: LlmTier): LlmConfig {
  const primaryModel = Deno.env.get('PRIMARY_MODEL') ?? 'gemini-3-pro-preview';
  const primaryProvider = (Deno.env.get('PRIMARY_PROVIDER') ?? 'google') as ProviderName;

  const secondaryModel = Deno.env.get('SECONDARY_MODEL') ?? 'gpt-4o';
  const secondaryProvider = (Deno.env.get('SECONDARY_PROVIDER') ?? 'openai') as ProviderName;

  const swarmModel = Deno.env.get('SWARM_MODEL') ?? 'deepseek-reasoner';
  const swarmProvider = (Deno.env.get('SWARM_PROVIDER') ?? 'deepseek') as ProviderName;

  if (tier === 'primary') {
    return { model: primaryModel, provider: primaryProvider };
  } else if (tier === 'secondary') {
    return { model: secondaryModel, provider: secondaryProvider };
  } else {
    return { model: swarmModel, provider: swarmProvider };
  }
}

/**
 * Main LLM client - routes to appropriate provider based on tier
 * @param tier - LLM tier (primary/secondary/swarm)
 * @param messages - Chat messages
 * @param enableTools - Enable MCP tool calling
 */
export async function callLlm(
  tier: LlmTier, 
  messages: ChatMessage[], 
  enableTools: boolean = false
): Promise<string> {
  const { model, provider } = getConfigForTier(tier);
  
  console.log(`[LLM Client] Tier: ${tier.toUpperCase()}, Provider: ${provider}, Model: ${model}${enableTools ? ' (MCP enabled)' : ''}`);

  switch (provider) {
    case 'google':
      return await callGemini(model, messages, enableTools);
    case 'openai':
      return await callOpenAI(model, messages, enableTools);
    case 'deepseek':
      return await callDeepSeek(model, messages, enableTools);
    case 'anthropic':
      throw new Error('Anthropic provider not yet implemented');
    case 'custom':
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Google Gemini API client with MCP tool support
 */
async function callGemini(model: string, messages: ChatMessage[], enableTools: boolean = false): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  // Convert messages to Gemini format
  const contents = messages.slice(1).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const systemInstruction = messages[0]?.role === 'system' ? messages[0].content : undefined;

  // Add MCP tools if enabled
  const tools = enableTools ? getMcpToolsForLlm() : undefined;
  const engineRoot = Deno.env.get('ROTATION_ENGINE_ROOT') || '/Users/zstoc/rotation-engine';

  // If no tools, simple generation
  if (!tools) {
    const result = await geminiModel.generateContent({
      contents,
      systemInstruction
    });
    return result.response.text();
  }

  // Tool-enabled loop
  let currentMessages = contents;
  let maxToolIterations = 5;
  let iteration = 0;

  while (iteration < maxToolIterations) {
    const result = await geminiModel.generateContent({
      contents: currentMessages,
      systemInstruction,
      tools: tools as any
    });

    const response = result.response;
    
    // Check for tool calls
    const functionCalls = response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) {
      return response.text();
    }

    // Execute tool calls
    console.log(`[Gemini MCP] Executing ${functionCalls.length} tool calls`);
    const toolResults = await executeMcpToolCalls(
      functionCalls.map((fc: any, idx: number) => ({
        id: `call_${iteration}_${idx}`,
        type: 'function' as const,
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args)
        }
      })),
      engineRoot
    );

    // Add assistant message with tool calls
    currentMessages.push({
      role: 'model',
      parts: [{ functionCall: functionCalls[0] }]
    });

    // Add tool results
    currentMessages.push({
      role: 'user',
      parts: toolResults.map(tr => ({
        functionResponse: {
          name: tr.name,
          response: { content: tr.content }
        }
      }))
    });

    iteration++;
  }

  throw new Error('Max tool iterations reached');
}

/**
 * OpenAI API client with MCP tool support
 */
async function callOpenAI(model: string, messages: ChatMessage[], enableTools: boolean = false): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const tools = enableTools ? getMcpToolsForLlm() : undefined;
  const engineRoot = Deno.env.get('ROTATION_ENGINE_ROOT') || '/Users/zstoc/rotation-engine';

  // If no tools, simple completion
  if (!tools) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Tool-enabled loop
  let currentMessages = messages;
  let maxToolIterations = 5;
  let iteration = 0;

  while (iteration < maxToolIterations) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: currentMessages,
        tools: tools,
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Check for tool calls
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || '';
    }

    // Execute tool calls
    console.log(`[OpenAI MCP] Executing ${message.tool_calls.length} tool calls`);
    const toolResults = await executeMcpToolCalls(message.tool_calls, engineRoot);

    // Add assistant message and tool results
    currentMessages = [
      ...currentMessages,
      message,
      ...toolResults
    ];

    iteration++;
  }

  throw new Error('Max tool iterations reached');
}

/**
 * DeepSeek API client with MCP tool support
 */
async function callDeepSeek(model: string, messages: ChatMessage[], enableTools: boolean = false): Promise<string> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set');
  }

  const tools = enableTools ? getMcpToolsForLlm() : undefined;
  const engineRoot = Deno.env.get('ROTATION_ENGINE_ROOT') || '/Users/zstoc/rotation-engine';

  // If no tools, simple completion
  if (!tools) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Tool-enabled loop
  let currentMessages = messages;
  let maxToolIterations = 5;
  let iteration = 0;

  while (iteration < maxToolIterations) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: currentMessages,
        tools: tools,
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Check for tool calls
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || '';
    }

    // Execute tool calls
    console.log(`[DeepSeek MCP] Executing ${message.tool_calls.length} tool calls`);
    const toolResults = await executeMcpToolCalls(message.tool_calls, engineRoot);

    // Add assistant message and tool results
    currentMessages = [
      ...currentMessages,
      message,
      ...toolResults
    ];

    iteration++;
  }

  throw new Error('Max tool iterations reached');
}
