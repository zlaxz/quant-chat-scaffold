/**
 * Stage Visualization Mapper
 * Maps research stages to their default visualization sets
 * Phase 4: Auto-display appropriate visualizations based on stage
 */

import { ResearchStage, VisualizationType } from '@/types/journey';

export interface StageVisualizationConfig {
  defaultVisualizations: VisualizationType[];
  emptyStateTitle: string;
  emptyStateMessage: string;
  emptyStateIcon: string;
  educationalContext?: string;
}

export const STAGE_VISUALIZATION_MAP: Record<ResearchStage, StageVisualizationConfig> = {
  idle: {
    defaultVisualizations: [],
    emptyStateTitle: 'Ready to Begin',
    emptyStateMessage: 'Ask Chief Quant to start your research journey. Try "Map market regimes from 2020-2024" or "What should we discover today?"',
    emptyStateIcon: '🚀',
    educationalContext: 'QuantOS helps you discover trading strategies through guided research. Chief Quant will lead you step-by-step through regime mapping, strategy discovery, backtesting, and portfolio optimization.'
  },
  
  regime_mapping: {
    defaultVisualizations: ['regime_timeline', 'regime_distribution', 'data_coverage'],
    emptyStateTitle: 'Classifying Market Regimes',
    emptyStateMessage: 'Chief Quant is analyzing market conditions to identify distinct regimes. Watch the timeline populate as each period is classified.',
    emptyStateIcon: '🗺️',
    educationalContext: 'Market regimes are distinct "climates" like calm weather vs storms. Different strategies work better in different regimes. We classify historical data so we know which strategies to test where.'
  },
  
  strategy_discovery: {
    defaultVisualizations: ['discovery_matrix', 'discovery_funnel'],
    emptyStateTitle: 'Discovering Strategies',
    emptyStateMessage: 'Chief Quant is generating and testing strategy candidates across identified regimes. Promising strategies will appear in the matrix.',
    emptyStateIcon: '🔍',
    educationalContext: 'Strategy discovery tests many potential trading approaches to find which ones show promise in each regime. Not all ideas work - that\'s the point of systematic discovery.'
  },
  
  backtesting: {
    defaultVisualizations: ['equity_curve_overlay', 'performance_heatmap'],
    emptyStateTitle: 'Running Backtests',
    emptyStateMessage: 'Chief Quant is testing strategies with historical data. Equity curves show how each strategy would have performed.',
    emptyStateIcon: '🧪',
    educationalContext: 'Backtesting runs strategies on historical data to see if they would have been profitable. It\'s not perfect (past ≠ future) but it\'s our best tool for validation before risking real money.'
  },
  
  tuning: {
    defaultVisualizations: ['parameter_sensitivity', 'scenario_simulator'],
    emptyStateTitle: 'Optimizing Parameters',
    emptyStateMessage: 'Chief Quant is refining strategy parameters and checking robustness. This ensures strategies aren\'t overfitted to historical quirks.',
    emptyStateIcon: '⚙️',
    educationalContext: 'Tuning optimizes parameters but must avoid overfitting - memorizing test answers instead of learning. We test across multiple scenarios to ensure robustness.'
  },
  
  portfolio: {
    defaultVisualizations: ['symphony', 'greeks_dashboard', 'allocation_sankey'],
    emptyStateTitle: 'Building Portfolio',
    emptyStateMessage: 'Chief Quant is combining validated strategies into a balanced portfolio. Greeks show total risk exposure.',
    emptyStateIcon: '📊',
    educationalContext: 'Portfolio construction combines multiple strategies to balance risk and return. Like diversifying crops - if one fails, others may thrive. Greeks measure sensitivity to market moves.'
  },
  
  analysis: {
    defaultVisualizations: ['scenario_simulator'],
    emptyStateTitle: 'Analyzing Risk',
    emptyStateMessage: 'Chief Quant is examining failure modes and vulnerabilities. Understanding what can go wrong is as important as knowing what can go right.',
    emptyStateIcon: '⚠️',
    educationalContext: 'Risk analysis identifies failure scenarios before they happen. Every strategy has weaknesses - the goal is to know them in advance and manage appropriately.'
  },
  
  conclusion: {
    defaultVisualizations: ['performance_heatmap'],
    emptyStateTitle: 'Research Complete',
    emptyStateMessage: 'Chief Quant has synthesized findings and recommendations. Review the strategy cards and key insights.',
    emptyStateIcon: '✅',
    educationalContext: 'Research is never truly "done" - it\'s cyclical. But this milestone represents a complete pass through the discovery workflow with actionable results.'
  }
};

export function getStageVisualizationConfig(stage: ResearchStage): StageVisualizationConfig {
  return STAGE_VISUALIZATION_MAP[stage] || STAGE_VISUALIZATION_MAP.idle;
}

export function getDefaultVisualizationsForStage(stage: ResearchStage): VisualizationType[] {
  return getStageVisualizationConfig(stage).defaultVisualizations;
}
