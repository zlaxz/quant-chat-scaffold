/**
 * MCP Client for invoking tools
 * Handles tool execution and result formatting
 */

import { MCP_TOOLS, executeMcpTool, type McpToolCall, type McpToolResult } from './mcpTools.ts';

export interface McpToolInvocation {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface McpToolResponse {
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}

/**
 * Get list of available MCP tools formatted for LLM
 */
export function getMcpToolsForLlm() {
  return MCP_TOOLS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

/**
 * Execute MCP tool calls and return formatted responses
 */
export async function executeMcpToolCalls(
  toolCalls: McpToolInvocation[],
  engineRoot: string
): Promise<McpToolResponse[]> {
  const results: McpToolResponse[] = [];

  for (const toolCall of toolCalls) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      
      const mcpCall: McpToolCall = {
        name: toolCall.function.name,
        arguments: args
      };

      const result = await executeMcpTool(mcpCall, engineRoot);
      
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: toolCall.function.name,
        content: result.content[0].text
      });
    } catch (error) {
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: toolCall.function.name,
        content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  return results;
}

/**
 * Format MCP tool results for display in chat
 */
export function formatToolResultsForChat(results: McpToolResponse[]): string {
  if (results.length === 0) return '';
  
  const formatted = results.map(result => {
    return `**Tool: ${result.name}**\n\`\`\`\n${result.content}\n\`\`\``;
  }).join('\n\n');

  return `**Tool Execution Results:**\n\n${formatted}`;
}
