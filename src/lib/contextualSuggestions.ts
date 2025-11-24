/**
 * Contextual command suggestions for Quant Chat Workbench
 * Provides smart next-step recommendations based on current app state
 */

export interface Suggestion {
  command: string;
  label: string;
  description: string;
  priority: number;
}

export interface AppState {
  lastAction?: 'backtest' | 'audit' | 'compare' | 'experiment' | 'insight' | null;
  lastRunId?: string;
  activeExperiment?: boolean;
  runCount?: number;
  hasWarnings?: boolean;
}

/**
 * Get contextual command suggestions based on current app state
 * Returns up to 4 suggestions sorted by priority (lower number = higher priority)
 */
export function getSuggestions(state: AppState): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // After backtest
  if (state.lastAction === 'backtest' && state.lastRunId) {
    suggestions.push({
      command: `/audit_run ${state.lastRunId}`,
      label: '🔍 Audit',
      description: 'Deep quality check on this run',
      priority: 1
    });

    suggestions.push({
      command: '/iterate',
      label: '🔄 Iterate',
      description: 'Modify and re-run',
      priority: 2
    });

    if (state.runCount && state.runCount >= 2) {
      suggestions.push({
        command: '/compare',
        label: '📊 Compare',
        description: 'Compare with previous runs',
        priority: 3
      });
    }

    suggestions.push({
      command: '/note',
      label: '💡 Save Insight',
      description: 'Record what you learned',
      priority: 4
    });

    if (state.hasWarnings) {
      suggestions.push({
        command: '/risk_review',
        label: '⚠️ Risk Review',
        description: 'Investigate warnings',
        priority: 0
      });
    }
  }

  // After audit
  if (state.lastAction === 'audit') {
    suggestions.push({
      command: '/iterate',
      label: '🔄 Iterate',
      description: 'Apply fixes and re-run',
      priority: 1
    });

    suggestions.push({
      command: '/mine_patterns',
      label: '🔎 Mine Patterns',
      description: 'Find patterns across runs',
      priority: 2
    });

    suggestions.push({
      command: '/suggest_experiments',
      label: '🧪 Next Steps',
      description: 'Get experiment suggestions',
      priority: 3
    });
  }

  // After compare
  if (state.lastAction === 'compare') {
    suggestions.push({
      command: '/note',
      label: '💡 Save Insight',
      description: 'Record comparison findings',
      priority: 1
    });

    suggestions.push({
      command: '/checkpoint',
      label: '✅ Checkpoint',
      description: 'Save progress and notes',
      priority: 2
    });
  }

  // With active experiment
  if (state.activeExperiment) {
    suggestions.push({
      command: '/checkpoint',
      label: '✅ Checkpoint',
      description: 'Save experiment progress',
      priority: 5
    });
  }

  // No recent action - suggest starting points
  if (!state.lastAction) {
    suggestions.push({
      command: '/experiment',
      label: '🧪 New Experiment',
      description: 'Start a named experiment',
      priority: 1
    });

    suggestions.push({
      command: '/backtest',
      label: '▶️ Run Backtest',
      description: 'Test a strategy',
      priority: 2
    });

    suggestions.push({
      command: '/runs',
      label: '📋 View Runs',
      description: 'See recent backtests',
      priority: 3
    });

    suggestions.push({
      command: '/resume',
      label: '↩️ Resume',
      description: 'Continue previous experiment',
      priority: 4
    });
  }

  // Sort by priority and return top 4
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
}
