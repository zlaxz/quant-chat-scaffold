/**
 * Chart Explainer Component
 * Educational explanations for visualizations
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartExplainerProps {
  title: string;
  explanation: string;
  whatToLookFor?: string[];
  example?: string;
  className?: string;
}

export const ChartExplainer = ({ 
  title, 
  explanation, 
  whatToLookFor, 
  example,
  className 
}: ChartExplainerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn("gap-2", className)}
      >
        <HelpCircle className="h-4 w-4" />
        Explain this chart
      </Button>
    );
  }

  return (
    <Card className={cn("p-4 bg-primary/5 border-primary/20 animate-in fade-in-0 slide-in-from-top-2", className)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold text-primary">{title}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="space-y-3 text-sm">
        <p className="text-foreground leading-relaxed">{explanation}</p>
        
        {whatToLookFor && whatToLookFor.length > 0 && (
          <div>
            <div className="font-medium text-primary mb-1">What to look for:</div>
            <ul className="space-y-1 ml-4">
              {whatToLookFor.map((item, idx) => (
                <li key={idx} className="text-muted-foreground list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {example && (
          <div className="pt-2 border-t border-primary/20">
            <div className="font-medium text-primary mb-1">Example:</div>
            <p className="text-muted-foreground italic">{example}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
