/**
 * Audit Summary Helpers
 * 
 * Build compact, readable summaries of backtest runs and memory notes
 * for the Strategy Auditor mode.
 */

import type { BacktestRun } from '@/types/backtest';

export interface MemoryNote {
  id: string;
  content: string;
  memory_type: string | null;
  importance: string | null;
  tags: string[] | null;
  run_id: string | null;
  created_at: string | null;
  source: string;
}

/**
 * Build a concise summary of a backtest run
 */
export function buildRunSummary(run: BacktestRun): string {
  const params = run.params;
  const metrics = run.metrics;
  
  let summary = `**Strategy**: ${run.strategy_key}\n`;
  summary += `**Period**: ${params.startDate} to ${params.endDate}\n`;
  summary += `**Capital**: $${params.capital.toLocaleString()}\n`;
  summary += `**Engine Source**: ${run.engine_source || 'unknown'}\n`;
  
  if (run.label) {
    summary += `**Label**: ${run.label}\n`;
  }
  
  if (run.notes) {
    summary += `**Notes**: ${run.notes}\n`;
  }
  
  if (run.tags && run.tags.length > 0) {
    summary += `**Tags**: ${run.tags.join(', ')}\n`;
  }
  
  summary += '\n**Metrics**:\n';
  
  if (metrics) {
    summary += `- CAGR: ${(metrics.cagr * 100).toFixed(2)}%\n`;
    summary += `- Sharpe Ratio: ${metrics.sharpe.toFixed(2)}\n`;
    summary += `- Max Drawdown: ${(metrics.max_drawdown * 100).toFixed(2)}%\n`;
    summary += `- Win Rate: ${(metrics.win_rate * 100).toFixed(2)}%\n`;
    summary += `- Total Trades: ${metrics.total_trades}\n`;
    
    if (metrics.avg_trade_duration_days !== undefined) {
      summary += `- Avg Trade Duration: ${metrics.avg_trade_duration_days.toFixed(1)} days\n`;
    }
    
    // Include any additional metrics
    const standardKeys = ['cagr', 'sharpe', 'max_drawdown', 'win_rate', 'total_trades', 'avg_trade_duration_days'];
    const extraMetrics = Object.entries(metrics)
      .filter(([key]) => !standardKeys.includes(key))
      .map(([key, value]) => `- ${key}: ${value}`);
    
    if (extraMetrics.length > 0) {
      summary += extraMetrics.join('\n') + '\n';
    }
  } else {
    summary += '(No metrics available)\n';
  }
  
  if (run.equity_curve && run.equity_curve.length > 0) {
    const startValue = run.equity_curve[0].value;
    const endValue = run.equity_curve[run.equity_curve.length - 1].value;
    const totalReturn = ((endValue - startValue) / startValue) * 100;
    summary += `\n**Equity Curve**: ${run.equity_curve.length} data points, ${totalReturn.toFixed(2)}% total return\n`;
  }
  
  return summary;
}

/**
 * Build a concise summary of relevant memory notes
 */
export function buildMemorySummary(notes: MemoryNote[]): string {
  if (notes.length === 0) {
    return 'No relevant memory found for this run or strategy.';
  }
  
  // Group by type and importance
  const rules = notes.filter(n => 
    n.memory_type === 'rule' && (n.importance === 'high' || n.importance === 'critical')
  );
  
  const warnings = notes.filter(n => 
    n.memory_type === 'warning' && (n.importance === 'high' || n.importance === 'critical')
  );
  
  const insights = notes.filter(n => 
    !rules.includes(n) && !warnings.includes(n)
  );
  
  let summary = '';
  
  // Rules section
  if (rules.length > 0) {
    summary += '**Rules (High/Critical)**:\n';
    rules.slice(0, 5).forEach(note => {
      summary += `- [${note.importance?.toUpperCase()}] ${note.content.slice(0, 200)}${note.content.length > 200 ? '...' : ''}\n`;
      if (note.tags && note.tags.length > 0) {
        summary += `  Tags: ${note.tags.join(', ')}\n`;
      }
    });
    summary += '\n';
  }
  
  // Warnings section
  if (warnings.length > 0) {
    summary += '**Warnings (High/Critical)**:\n';
    warnings.slice(0, 5).forEach(note => {
      summary += `- [${note.importance?.toUpperCase()}] ${note.content.slice(0, 200)}${note.content.length > 200 ? '...' : ''}\n`;
      if (note.tags && note.tags.length > 0) {
        summary += `  Tags: ${note.tags.join(', ')}\n`;
      }
    });
    summary += '\n';
  }
  
  // Insights section
  if (insights.length > 0) {
    summary += '**Other Relevant Insights**:\n';
    insights.slice(0, 5).forEach(note => {
      const typeLabel = note.memory_type ? `[${note.memory_type}]` : '';
      const importanceLabel = note.importance ? `[${note.importance}]` : '';
      summary += `- ${typeLabel} ${importanceLabel} ${note.content.slice(0, 200)}${note.content.length > 200 ? '...' : ''}\n`;
      if (note.tags && note.tags.length > 0) {
        summary += `  Tags: ${note.tags.join(', ')}\n`;
      }
    });
  }
  
  if (notes.length > 10) {
    summary += `\n(${notes.length - 10} additional notes not shown)\n`;
  }
  
  return summary;
}
