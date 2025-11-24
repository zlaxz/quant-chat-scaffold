/**
 * Chat message type extensions for special inline cards
 */

export interface BacktestResultMessage {
  type: 'backtest_result';
  runId: string;
  strategyName: string;
  dateRange: string;
  metrics: {
    sharpe?: number;
    cagr?: number;
    maxDrawdown?: number;
    winRate?: number;
    totalTrades?: number;
    profitFactor?: number;
  };
  regime?: string;
  profile?: string;
  status: 'success' | 'warning' | 'error';
}

export type SpecialMessage = BacktestResultMessage;

/**
 * Check if a message content string is a backtest result
 * @param content - The message content to check
 * @returns BacktestResultMessage if valid, null otherwise
 */
export function isBacktestResult(content: string): BacktestResultMessage | null {
  try {
    // Check if message content is JSON with backtest result structure
    if (content.startsWith('{"type":"backtest_result"')) {
      return JSON.parse(content) as BacktestResultMessage;
    }
  } catch {
    // Not a special message
  }
  return null;
}
