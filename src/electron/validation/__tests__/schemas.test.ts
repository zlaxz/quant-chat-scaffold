import { describe, it, expect } from 'vitest';
import {
  validateIPC,
  ChatMessageSchema,
  ChatMessagesSchema,
  FilePathSchema,
  FileContentSchema,
  MemoryQuerySchema,
  MemoryOptionsSchema,
  BacktestParamsSchema,
  SwarmPromptsSchema,
  WorkspaceIdSchema,
  MemoryIdsSchema,
} from '../schemas';

describe('IPC Validation Schemas', () => {
  describe('ChatMessageSchema', () => {
    it('should accept valid chat messages', () => {
      const valid = { role: 'user', content: 'Hello!' };
      expect(() => validateIPC(ChatMessageSchema, valid, 'chat message')).not.toThrow();
    });

    it('should reject invalid role', () => {
      const invalid = { role: 'invalid', content: 'Hello!' };
      expect(() => validateIPC(ChatMessageSchema, invalid, 'chat message')).toThrow(/Invalid chat message/);
    });

    it('should reject empty content', () => {
      const invalid = { role: 'user', content: '' };
      expect(() => validateIPC(ChatMessageSchema, invalid, 'chat message')).toThrow();
    });

    it('should reject oversized content', () => {
      const invalid = { role: 'user', content: 'x'.repeat(500001) };
      expect(() => validateIPC(ChatMessageSchema, invalid, 'chat message')).toThrow();
    });
  });

  describe('ChatMessagesSchema', () => {
    it('should accept valid message array', () => {
      const valid = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      expect(() => validateIPC(ChatMessagesSchema, valid, 'chat messages')).not.toThrow();
    });

    it('should reject empty array', () => {
      expect(() => validateIPC(ChatMessagesSchema, [], 'chat messages')).toThrow();
    });

    it('should reject oversized array', () => {
      const oversized = Array(201).fill({ role: 'user', content: 'test' });
      expect(() => validateIPC(ChatMessagesSchema, oversized, 'chat messages')).toThrow();
    });
  });

  describe('FilePathSchema', () => {
    it('should accept valid file path', () => {
      const valid = 'src/main.ts';
      expect(() => validateIPC(FilePathSchema, valid, 'file path')).not.toThrow();
    });

    it('should reject path traversal', () => {
      const invalid = '../../../etc/passwd';
      expect(() => validateIPC(FilePathSchema, invalid, 'file path')).toThrow(/traversal/);
    });

    it('should reject empty path', () => {
      expect(() => validateIPC(FilePathSchema, '', 'file path')).toThrow();
    });

    it('should reject oversized path', () => {
      const oversized = 'x'.repeat(1001);
      expect(() => validateIPC(FilePathSchema, oversized, 'file path')).toThrow();
    });
  });

  describe('FileContentSchema', () => {
    it('should accept valid content', () => {
      const valid = 'console.log("hello");';
      expect(() => validateIPC(FileContentSchema, valid, 'file content')).not.toThrow();
    });

    it('should reject oversized content (>10MB)', () => {
      const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);
      expect(() => validateIPC(FileContentSchema, oversized, 'file content')).toThrow();
    });
  });

  describe('MemoryQuerySchema', () => {
    it('should accept valid query', () => {
      const valid = 'search for previous backtest results';
      expect(() => validateIPC(MemoryQuerySchema, valid, 'memory query')).not.toThrow();
    });

    it('should reject empty query', () => {
      expect(() => validateIPC(MemoryQuerySchema, '', 'memory query')).toThrow();
    });

    it('should reject oversized query', () => {
      const oversized = 'x'.repeat(2001);
      expect(() => validateIPC(MemoryQuerySchema, oversized, 'memory query')).toThrow();
    });
  });

  describe('MemoryOptionsSchema', () => {
    it('should accept valid options', () => {
      const valid = {
        limit: 10,
        minImportance: 0.5,
        useCache: true,
        rerank: false,
        categories: ['backtest', 'strategy'],
        symbols: ['SPY', 'QQQ'],
      };
      expect(() => validateIPC(MemoryOptionsSchema, valid, 'memory options')).not.toThrow();
    });

    it('should reject invalid limit', () => {
      const invalid = { limit: 101 };
      expect(() => validateIPC(MemoryOptionsSchema, invalid, 'memory options')).toThrow();
    });

    it('should reject invalid importance', () => {
      const invalid = { minImportance: 1.5 };
      expect(() => validateIPC(MemoryOptionsSchema, invalid, 'memory options')).toThrow();
    });
  });

  describe('BacktestParamsSchema', () => {
    it('should accept valid backtest params', () => {
      const valid = {
        strategyKey: 'spy_rotation',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        capital: 100000,
        profileConfig: { param1: 'value1' },
      };
      expect(() => validateIPC(BacktestParamsSchema, valid, 'backtest parameters')).not.toThrow();
    });

    it('should reject invalid date format', () => {
      const invalid = {
        strategyKey: 'spy_rotation',
        startDate: '01/01/2023',
        endDate: '2023-12-31',
        capital: 100000,
      };
      expect(() => validateIPC(BacktestParamsSchema, invalid, 'backtest parameters')).toThrow(/date format/);
    });

    it('should reject negative capital', () => {
      const invalid = {
        strategyKey: 'spy_rotation',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        capital: -100,
      };
      expect(() => validateIPC(BacktestParamsSchema, invalid, 'backtest parameters')).toThrow();
    });

    it('should reject excessive capital', () => {
      const invalid = {
        strategyKey: 'spy_rotation',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        capital: 2e12, // > $1 trillion
      };
      expect(() => validateIPC(BacktestParamsSchema, invalid, 'backtest parameters')).toThrow();
    });
  });

  describe('SwarmPromptsSchema', () => {
    it('should accept valid swarm prompts', () => {
      const valid = [
        {
          agentId: 'agent1',
          messages: [{ role: 'user', content: 'Task 1' }],
        },
        {
          agentId: 'agent2',
          messages: [{ role: 'user', content: 'Task 2' }],
        },
      ];
      expect(() => validateIPC(SwarmPromptsSchema, valid, 'swarm prompts')).not.toThrow();
    });

    it('should reject empty array', () => {
      expect(() => validateIPC(SwarmPromptsSchema, [], 'swarm prompts')).toThrow();
    });

    it('should reject too many agents', () => {
      const oversized = Array(51).fill({
        agentId: 'agent',
        messages: [{ role: 'user', content: 'test' }],
      });
      expect(() => validateIPC(SwarmPromptsSchema, oversized, 'swarm prompts')).toThrow();
    });
  });

  describe('WorkspaceIdSchema', () => {
    it('should accept valid UUID', () => {
      const valid = '550e8400-e29b-41d4-a716-446655440000';
      expect(() => validateIPC(WorkspaceIdSchema, valid, 'workspace ID')).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      const invalid = 'not-a-uuid';
      expect(() => validateIPC(WorkspaceIdSchema, invalid, 'workspace ID')).toThrow();
    });
  });

  describe('MemoryIdsSchema', () => {
    it('should accept valid UUID array', () => {
      const valid = [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ];
      expect(() => validateIPC(MemoryIdsSchema, valid, 'memory IDs')).not.toThrow();
    });

    it('should reject empty array', () => {
      expect(() => validateIPC(MemoryIdsSchema, [], 'memory IDs')).toThrow();
    });

    it('should reject oversized array', () => {
      const oversized = Array(101).fill('550e8400-e29b-41d4-a716-446655440000');
      expect(() => validateIPC(MemoryIdsSchema, oversized, 'memory IDs')).toThrow();
    });

    it('should reject invalid UUIDs', () => {
      const invalid = ['not-a-uuid'];
      expect(() => validateIPC(MemoryIdsSchema, invalid, 'memory IDs')).toThrow();
    });
  });

  describe('Type Safety Edge Cases', () => {
    it('should reject null', () => {
      expect(() => validateIPC(ChatMessageSchema, null, 'chat message')).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => validateIPC(ChatMessageSchema, undefined, 'chat message')).toThrow();
    });

    it('should reject wrong type', () => {
      expect(() => validateIPC(ChatMessageSchema, 'string', 'chat message')).toThrow();
    });

    it('should reject number when expecting object', () => {
      expect(() => validateIPC(ChatMessageSchema, 123, 'chat message')).toThrow();
    });
  });
});
