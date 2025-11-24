import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, FlaskConical, BarChart3, Clock, Play, RefreshCw } from 'lucide-react';

interface ActiveExperiment {
  id: string;
  name: string;
  strategy: string;
  lastRunId?: string;
  lastRunTime?: string;
  status: 'active' | 'paused' | 'completed';
}

interface ActiveExperimentBarProps {
  experiment: ActiveExperiment | null;
  onClear: () => void;
  onViewResults: () => void;
  onIterate: () => void;
  onNewRun: () => void;
}

export const ActiveExperimentBar: React.FC<ActiveExperimentBarProps> = ({
  experiment,
  onClear,
  onViewResults,
  onIterate,
  onNewRun,
}) => {
  if (!experiment) return null;

  const getStatusColor = () => {
    switch (experiment.status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-4 w-4 text-primary" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{experiment.name}</span>
            <Badge variant="outline" className="text-xs">
              {experiment.strategy}
            </Badge>
            <span className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
          </div>
          {experiment.lastRunId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              <span>Last run: #{experiment.lastRunId.slice(-6)}</span>
              {experiment.lastRunTime && (
                <>
                  <Clock className="h-3 w-3 ml-2" />
                  <span>{experiment.lastRunTime}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onViewResults}>
          <BarChart3 className="h-4 w-4 mr-1" />
          Results
        </Button>
        <Button variant="ghost" size="sm" onClick={onIterate}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Iterate
        </Button>
        <Button variant="ghost" size="sm" onClick={onNewRun}>
          <Play className="h-4 w-4 mr-1" />
          New Run
        </Button>
        <Button variant="ghost" size="icon" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ActiveExperimentBar;
