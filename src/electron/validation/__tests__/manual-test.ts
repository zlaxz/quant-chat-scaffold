/**
 * Manual validation tests - run with: npx tsx src/electron/validation/__tests__/manual-test.ts
 */

import {
  validateIPC,
  ChatMessageSchema,
  ChatMessagesSchema,
  FilePathSchema,
  BacktestParamsSchema,
  WorkspaceIdSchema,
} from '../schemas';

console.log('Testing IPC Validation Schemas...\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

// Test valid inputs
test('Valid chat message', () => {
  validateIPC(ChatMessageSchema, { role: 'user', content: 'Hello!' }, 'chat message');
});

test('Valid chat messages array', () => {
  validateIPC(
    ChatMessagesSchema,
    [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi!' },
    ],
    'chat messages'
  );
});

test('Valid file path', () => {
  validateIPC(FilePathSchema, 'src/main.ts', 'file path');
});

test('Valid workspace ID', () => {
  validateIPC(WorkspaceIdSchema, '550e8400-e29b-41d4-a716-446655440000', 'workspace ID');
});

test('Valid backtest params', () => {
  validateIPC(
    BacktestParamsSchema,
    {
      strategyKey: 'spy_rotation',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      capital: 100000,
    },
    'backtest parameters'
  );
});

// Test invalid inputs (should throw)
test('Invalid role rejected', () => {
  try {
    validateIPC(ChatMessageSchema, { role: 'invalid', content: 'Hello!' }, 'chat message');
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid chat message')) {
      return; // Expected error
    }
    throw error;
  }
});

test('Path traversal rejected', () => {
  try {
    validateIPC(FilePathSchema, '../../../etc/passwd', 'file path');
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('traversal')) {
      return; // Expected error
    }
    throw error;
  }
});

test('Empty messages array rejected', () => {
  try {
    validateIPC(ChatMessagesSchema, [], 'chat messages');
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid chat messages')) {
      return; // Expected error
    }
    throw error;
  }
});

test('Invalid UUID rejected', () => {
  try {
    validateIPC(WorkspaceIdSchema, 'not-a-uuid', 'workspace ID');
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid workspace ID')) {
      return; // Expected error
    }
    throw error;
  }
});

test('Invalid date format rejected', () => {
  try {
    validateIPC(
      BacktestParamsSchema,
      {
        strategyKey: 'spy_rotation',
        startDate: '01/01/2023', // Wrong format
        endDate: '2023-12-31',
        capital: 100000,
      },
      'backtest parameters'
    );
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid backtest parameters')) {
      return; // Expected error
    }
    throw error;
  }
});

test('Negative capital rejected', () => {
  try {
    validateIPC(
      BacktestParamsSchema,
      {
        strategyKey: 'spy_rotation',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        capital: -100,
      },
      'backtest parameters'
    );
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid backtest parameters')) {
      return; // Expected error
    }
    throw error;
  }
});

test('Oversized messages array rejected', () => {
  try {
    const oversized = Array(201).fill({ role: 'user', content: 'test' });
    validateIPC(ChatMessagesSchema, oversized, 'chat messages');
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid chat messages')) {
      return; // Expected error
    }
    throw error;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
