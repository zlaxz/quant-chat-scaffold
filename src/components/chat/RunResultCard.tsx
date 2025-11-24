import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RunMetrics {
  sharpe?: number;
  cagr?: number;
  maxDrawdown?: number;
  winRate?: number;
  totalTrades?: number;
  profitFactor?: number;
}

interface RunResultCardProps {
  runId: string;
  strategyName: string;
  dateRange: string;
  metrics: RunMetrics;
  regime?: string;
  profile?: string;
  status: 'success' | 'warning' | 'error';
  onAudit?: () => void;
  onCompare?: () => void;
  onIterate?: () => void;
}

export const RunResultCard: React.FC<RunResultCardProps> = ({
  runId,
  strategyName,
  dateRange,
  metrics,
  regime,
  profile,
  status,
  onAudit,
  onCompare,
  onIterate,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'border-green-500/50 bg-green-500/5';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'error': return 'border-red-500/50 bg-red-500/5';
    }
  };

  const getSharpeColor = (sharpe?: number) => {
    if (!sharpe) return 'text-muted-foreground';
    if (sharpe >= 2) return 'text-green-500';
    if (sharpe >= 1) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className={cn('my-2 border-2', getStatusColor())}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-mono">
              {strategyName}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Run #{runId.slice(-6)}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {dateRange}
          {regime && <span className="ml-2">• Regime: {regime}</span>}
          {profile && <span className="ml-2">• Profile: {profile}</span>}
        </div>
      </CardHeader>

      <CardContent className="py-2 px-4">
        {/* Key Metrics Summary */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className={cn('text-lg font-bold', getSharpeColor(metrics.sharpe))}>
              {metrics.sharpe?.toFixed(2) ?? '-'}
            </div>
            <div className="text-xs text-muted-foreground">Sharpe</div>
          </div>
          <div>
            <div className="text-lg font-bold flex items-center justify-center gap-1">
              {metrics.cagr !== undefined && (
                metrics.cagr >= 0
                  ? <TrendingUp className="h-4 w-4 text-green-500" />
                  : <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              {metrics.cagr !== undefined ? `${(metrics.cagr * 100).toFixed(1)}%` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">CAGR</div>
          </div>
          <div>
            <div className={cn('text-lg font-bold', metrics.maxDrawdown && metrics.maxDrawdown > 0.2 ? 'text-red-500' : '')}>
              {metrics.maxDrawdown !== undefined ? `${(metrics.maxDrawdown * 100).toFixed(1)}%` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Max DD</div>
          </div>
          <div>
            <div className="text-lg font-bold">
              {metrics.winRate !== undefined ? `${(metrics.winRate * 100).toFixed(0)}%` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Trades:</span>
                <span className="font-mono">{metrics.totalTrades ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit Factor:</span>
                <span className="font-mono">{metrics.profitFactor?.toFixed(2) ?? '-'}</span>
              </div>
            </div>

            {/* Warning if metrics look suspicious */}
            {metrics.sharpe && metrics.sharpe > 3 && (
              <div className="mt-3 p-2 bg-yellow-500/10 rounded flex items-center gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>Sharpe &gt; 3 may indicate overfitting. Consider audit.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex gap-2">
              {onAudit && (
                <Button variant="outline" size="sm" onClick={onAudit}>
                  Audit
                </Button>
              )}
              {onCompare && (
                <Button variant="outline" size="sm" onClick={onCompare}>
                  Compare
                </Button>
              )}
              {onIterate && (
                <Button variant="outline" size="sm" onClick={onIterate}>
                  Iterate
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RunResultCard;
