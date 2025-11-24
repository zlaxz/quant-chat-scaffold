/**
 * Natural language intent detection for Quant Chat Workbench
 * Detects user intent and suggests appropriate slash commands
 */

export interface DetectedIntent {
  command: string;
  args: string[];
  confidence: number;
  suggestion: string;
  explanation?: string;
}

interface IntentPattern {
  patterns: RegExp[];
  command: string;
  extractArgs: (match: RegExpMatchArray, text: string) => string[];
  confidence: number;
  explanation: string;
}

// Pattern definitions for common intents
const INTENT_PATTERNS: IntentPattern[] = [
  // Compare runs
  {
    patterns: [
      /compare\s+(?:runs?\s+)?#?(\d+)\s+(?:and|with|to|vs\.?)\s+#?(\d+)/i,
      /(?:runs?\s+)?#?(\d+)\s+vs\.?\s+#?(\d+)/i,
      /(?:what(?:'s|\s+is)\s+)?(?:the\s+)?difference\s+between\s+(?:runs?\s+)?#?(\d+)\s+(?:and|vs\.?)\s+#?(\d+)/i,
    ],
    command: 'compare',
    extractArgs: (match) => [match[1], match[2]],
    confidence: 0.9,
    explanation: 'Compare two backtest runs'
  },

  // Run backtest
  {
    patterns: [
      /(?:run|execute|test|backtest)\s+(?:the\s+)?(\w+)\s+(?:strategy|strat)/i,
      /backtest\s+(\w+)/i,
      /test\s+(\w+)\s+(?:from|on)/i,
    ],
    command: 'backtest',
    extractArgs: (match, text) => {
      const args = [match[1]];
      // Try to extract date range
      const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\s+(?:to|through|-)\s+(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        args.push(dateMatch[1], dateMatch[2]);
      }
      return args;
    },
    confidence: 0.85,
    explanation: 'Run a backtest'
  },

  // Audit run
  {
    patterns: [
      /audit\s+(?:run\s+)?#?(\d+)/i,
      /analyze\s+(?:run\s+)?#?(\d+)/i,
      /(?:what|how)\s+(?:happened|went wrong)\s+(?:with\s+)?(?:run\s+)?#?(\d+)/i,
      /(?:deep\s+)?dive\s+(?:into|on)\s+(?:run\s+)?#?(\d+)/i,
      /review\s+(?:run\s+)?#?(\d+)/i,
    ],
    command: 'audit_run',
    extractArgs: (match) => [match[1]],
    confidence: 0.85,
    explanation: 'Deep dive analysis of a specific run'
  },

  // List runs
  {
    patterns: [
      /(?:show|list|get)\s+(?:my\s+)?(?:recent\s+)?runs/i,
      /what\s+(?:runs|backtests)\s+(?:have\s+)?(?:i|we)\s+(?:done|run)/i,
      /(?:show|see)\s+(?:backtest\s+)?history/i,
    ],
    command: 'runs',
    extractArgs: () => [],
    confidence: 0.8,
    explanation: 'List recent backtest runs'
  },

  // Save insight
  {
    patterns: [
      /(?:save|remember|note)\s+(?:that\s+)?(.+)/i,
      /(?:this|that)\s+(?:is\s+)?(?:important|worth\s+remembering)/i,
      /(?:add|make)\s+(?:a\s+)?note\s+(?:that\s+)?(.+)/i,
    ],
    command: 'insight',
    extractArgs: (match) => match[1] ? [match[1]] : [],
    confidence: 0.7,
    explanation: 'Save an insight to memory'
  },

  // Suggest experiments
  {
    patterns: [
      /what\s+(?:should\s+)?(?:i|we)\s+(?:try|test|do)\s+next/i,
      /(?:suggest|recommend)\s+(?:an?\s+)?experiment/i,
      /next\s+steps?/i,
      /what\s+(?:should|can)\s+(?:i|we)\s+test\s+next/i,
    ],
    command: 'suggest_experiments',
    extractArgs: () => [],
    confidence: 0.75,
    explanation: 'Get experiment suggestions'
  },

  // Mine patterns
  {
    patterns: [
      /(?:find|look\s+for|identify|discover)\s+patterns/i,
      /what\s+patterns\s+(?:are\s+there|can\s+you\s+find|exist)/i,
      /pattern\s+(?:analysis|mining)/i,
    ],
    command: 'mine_patterns',
    extractArgs: () => [],
    confidence: 0.8,
    explanation: 'Mine patterns from backtest history'
  },

  // Risk review
  {
    patterns: [
      /(?:check|review|assess)\s+(?:the\s+)?risk/i,
      /(?:is|are)\s+(?:there\s+)?(?:any\s+)?risks?/i,
      /risk\s+(?:analysis|review|assessment)/i,
      /what\s+(?:are\s+)?(?:the\s+)?risks?/i,
    ],
    command: 'risk_review',
    extractArgs: () => [],
    confidence: 0.8,
    explanation: 'Review portfolio risk'
  },

  // Iterate
  {
    patterns: [
      /(?:try|run)\s+(?:it\s+)?(?:again\s+)?with\s+(.+)/i,
      /iterate\s+(?:with\s+)?(.+)/i,
      /change\s+(\w+)\s+to\s+(\d+)/i,
      /rerun\s+with\s+(.+)/i,
    ],
    command: 'iterate',
    extractArgs: (match) => {
      if (match[2]) {
        return [`${match[1]}=${match[2]}`];
      }
      return match[1] ? match[1].split(/\s+and\s+|\s*,\s*/) : [];
    },
    confidence: 0.75,
    explanation: 'Iterate on previous backtest with new parameters'
  },

  // Auto-analyze
  {
    patterns: [
      /(?:auto\s+)?analyze\s+(?:everything|all|the\s+results?)/i,
      /run\s+(?:full\s+)?analysis/i,
      /comprehensive\s+analysis/i,
    ],
    command: 'auto_analyze',
    extractArgs: () => [],
    confidence: 0.8,
    explanation: 'Run comprehensive auto-analysis'
  },

  // Red team audit
  {
    patterns: [
      /red\s+team\s+(.+)/i,
      /(?:audit|review|check)\s+(.+\.py)/i,
      /(?:security|vulnerability)\s+(?:audit|check|scan)/i,
    ],
    command: 'red_team',
    extractArgs: (match) => match[1] ? [match[1]] : [],
    confidence: 0.85,
    explanation: 'Run security/robustness audit'
  },

  // Research agents
  {
    patterns: [
      /research\s+(.+)/i,
      /investigate\s+(.+)/i,
      /(?:deep\s+)?dive\s+(?:into|on)\s+(.+)/i,
    ],
    command: 'research',
    extractArgs: (match) => match[1] ? [match[1]] : [],
    confidence: 0.7,
    explanation: 'Run research agents'
  },
];

/**
 * Detect user intent from natural language input
 * @param text User input text
 * @returns Detected intent or null if no clear intent found
 */
export function detectIntent(text: string): DetectedIntent | null {
  // Skip if already a slash command
  if (text.startsWith('/')) return null;

  // Skip very short inputs
  if (text.length < 5) return null;

  const normalizedText = text.toLowerCase().trim();

  for (const { patterns, command, extractArgs, confidence, explanation } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const args = extractArgs(match, text);
        const suggestion = `/${command}${args.length ? ' ' + args.join(' ') : ''}`;

        return {
          command,
          args,
          confidence,
          suggestion,
          explanation
        };
      }
    }
  }

  return null;
}

/**
 * Format intent suggestion for display
 * @param intent Detected intent
 * @returns Formatted suggestion string
 */
export function formatIntentSuggestion(intent: DetectedIntent): string {
  return `💡 Did you mean: \`${intent.suggestion}\`?`;
}

/**
 * Check if text contains pattern keywords (for low-confidence hints)
 * @param text User input text
 * @returns Array of potentially relevant commands
 */
export function suggestCommands(text: string): string[] {
  const suggestions: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes('compare') || lower.includes('difference')) {
    suggestions.push('/compare <run1> <run2>');
  }
  if (lower.includes('backtest') || lower.includes('test strategy')) {
    suggestions.push('/backtest <strategy>');
  }
  if (lower.includes('audit') || lower.includes('analyze')) {
    suggestions.push('/audit_run <run_id>');
  }
  if (lower.includes('pattern') || lower.includes('trend')) {
    suggestions.push('/mine_patterns');
  }
  if (lower.includes('risk') || lower.includes('exposure')) {
    suggestions.push('/risk_review');
  }
  if (lower.includes('experiment') || lower.includes('suggest')) {
    suggestions.push('/suggest_experiments');
  }

  return suggestions;
}
