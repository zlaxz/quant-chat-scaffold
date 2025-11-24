/**
 * CommandSuggestions component
 * Displays contextual command suggestions based on user's recent actions
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

interface Suggestion {
  command: string;
  label: string;
  description: string;
}

interface CommandSuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (command: string) => void;
  onDismiss: () => void;
}

export const CommandSuggestions: React.FC<CommandSuggestionsProps> = ({
  suggestions,
  onSelect,
  onDismiss,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-accent/30 rounded-lg mb-2">
      <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">What next?</span>
      <div className="flex gap-1 flex-wrap">
        {suggestions.map((s) => (
          <Button
            key={s.command}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelect(s.command)}
            title={s.description}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs ml-auto"
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </div>
  );
};

export default CommandSuggestions;
