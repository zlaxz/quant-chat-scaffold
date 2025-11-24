import { z } from 'zod';

/**
 * IPC Validation Schemas
 *
 * Validates all data crossing IPC boundaries to prevent:
 * - Type confusion crashes
 * - Path traversal attacks
 * - Memory exhaustion from oversized payloads
 * - Invalid enum values causing undefined behavior
 */

// ============================================================================
// Chat Message Validation
// ============================================================================

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(500000), // 500k char limit
});

export const ChatMessagesSchema = z.array(ChatMessageSchema).min(1).max(200);

// ============================================================================
// File Operation Validation
// ============================================================================

export const FilePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .max(1000, 'File path too long')
  .refine(
    (path) => !path.includes('..'),
    { message: 'Path traversal not allowed' }
  );

export const FileContentSchema = z.string().max(10 * 1024 * 1024); // 10MB limit

export const DirectoryPathSchema = z.string()
  .max(1000)
  .refine(
    (path) => !path.includes('..'),
    { message: 'Path traversal not allowed' }
  )
  .optional();

// ============================================================================
// Memory System Validation
// ============================================================================

export const MemoryQuerySchema = z.string().min(1).max(2000);

export const MemoryOptionsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  minImportance: z.number().min(0).max(1).optional(),
  useCache: z.boolean().optional(),
  rerank: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  symbols: z.array(z.string()).optional(),
}).optional();

export const WorkspaceIdSchema = z.string().uuid();

export const MemoryIdsSchema = z.array(z.string().uuid()).min(1).max(100);

// ============================================================================
// Python Execution Validation
// ============================================================================

export const BacktestParamsSchema = z.object({
  strategyKey: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  capital: z.number().positive().max(1e12), // $1 trillion max
  profileConfig: z.record(z.any()).optional(),
});

// ============================================================================
// Swarm Chat Validation
// ============================================================================

export const SwarmPromptSchema = z.object({
  agentId: z.string().min(1).max(100),
  messages: ChatMessagesSchema,
});

export const SwarmPromptsSchema = z.array(SwarmPromptSchema).min(1).max(50); // Max 50 parallel agents

// ============================================================================
// Analysis Validation
// ============================================================================

export const RunIdSchema = z.string().min(1).max(100);

export const StrategyKeySchema = z.string().min(1).max(100);

export const RegimeIdSchema = z.number().int().nullable();

export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format');

// ============================================================================
// Search Validation
// ============================================================================

export const SearchQuerySchema = z.string().min(1).max(1000);

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validates data against a Zod schema and throws descriptive errors
 *
 * @param schema - Zod schema to validate against
 * @param data - Unknown data from IPC call
 * @param context - Description for error messages (e.g., "chat messages")
 * @returns Validated and typed data
 * @throws Error with detailed validation failure information
 */
export function validateIPC<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new Error(`Invalid ${context}: ${errors}`);
  }
  return result.data;
}
