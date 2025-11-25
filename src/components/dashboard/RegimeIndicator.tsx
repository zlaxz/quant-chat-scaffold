/**
 * Regime Indicator - Current market state in header
 *
 * Shows:
 * - Current regime (LOW_VOL_GRIND, HIGH_VOL_OSCILLATION, etc.)
 * - VIX level with trend indicator
 * - Term structure (Contango/Backwardation)
 *
 * Created: 2025-11-24
 */

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type RegimeType =
  | 'LOW_VOL_GRIND'
  | 'HIGH_VOL_OSCILLATION'
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'BREAKOUT'
  | 'CRASH'
  | 'UNKNOWN';

type TermStructure = 'CONTANGO' | 'BACKWARDATION' | 'FLAT';

interface RegimeState {
  regime: RegimeType;
  vix: number;
  vix_trend: 'up' | 'down' | 'flat';
  vix_percentile: number;
  term_structure: TermStructure;
  vix9d?: number;
  vix3m?: number;
  updated_at: string;
  confidence: number;
}

const regimeConfig: Record<
  RegimeType,
  { label: string; color: string; bgColor: string; description: string }
> = {
  LOW_VOL_GRIND: {
    label: 'Low Vol Grind',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    description: 'Calm markets, steady uptrend. Sell premium, favor short vol.',
  },
  HIGH_VOL_OSCILLATION: {
    label: 'High Vol Oscillation',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    description: 'Choppy, elevated volatility. Mean reversion works well.',
  },
  TREND_UP: {
    label: 'Trend Up',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    description: 'Strong bullish trend. Momentum strategies favored.',
  },
  TREND_DOWN: {
    label: 'Trend Down',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    description: 'Bearish trend. Protective puts, long vol strategies.',
  },
  BREAKOUT: {
    label: 'Breakout',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    description: 'Range break. Expect trend continuation or reversal.',
  },
  CRASH: {
    label: 'CRASH',
    color: 'text-red-600',
    bgColor: 'bg-red-600/20',
    description: 'Extreme vol spike. Defensive positions, long vol.',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Regime not yet classified.',
  },
};

const termStructureLabels: Record<TermStructure, { label: string; color: string }> = {
  CONTANGO: { label: 'Contango', color: 'text-green-500' },
  BACKWARDATION: { label: 'Backwardation', color: 'text-red-500' },
  FLAT: { label: 'Flat', color: 'text-muted-foreground' },
};

export function RegimeIndicator() {
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegime = useCallback(async () => {
    try {
      // Fetch latest regime state from Supabase
      const { data, error: fetchError } = await supabase
        .from('regime_state')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        // If table doesn't exist or no data, use demo data for UI
        if (fetchError.code === 'PGRST116' || fetchError.code === '42P01') {
          // Use realistic demo defaults (typical low vol environment)
          setRegime({
            regime: 'LOW_VOL_GRIND',
            vix: 14.2,
            vix_trend: 'down',
            vix_percentile: 25,
            term_structure: 'CONTANGO',
            vix9d: 12.8,
            vix3m: 16.4,
            updated_at: new Date().toISOString(),
            confidence: 0.85,
          });
          setError('Demo mode - daemon not running');
        } else {
          throw fetchError;
        }
      } else {
        setRegime(data as RegimeState);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch regime:', err);
      setError(err instanceof Error ? err.message : 'Failed to load regime');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegime();
    // Refresh every 60 seconds
    const interval = setInterval(fetchRegime, 60000);
    return () => clearInterval(interval);
  }, [fetchRegime]);

  const VixTrendIcon = () => {
    if (!regime) return null;
    switch (regime.vix_trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Loading regime...</span>
      </div>
    );
  }

  if (!regime || regime.regime === 'UNKNOWN') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">No Regime</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="font-medium text-sm">Regime Detection Offline</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Start the Night Shift daemon to enable real-time regime classification.
            </p>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const config = regimeConfig[regime.regime];
  const termConfig = termStructureLabels[regime.term_structure];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 gap-2 px-2', config.bgColor)}
        >
          <Activity className={cn('h-3 w-3', config.color)} />
          <span className={cn('text-xs font-medium', config.color)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs font-mono">VIX: {regime.vix.toFixed(1)}</span>
          <VixTrendIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Regime Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h4 className={cn('font-semibold', config.color)}>{config.label}</h4>
              <Badge variant="outline" className="text-xs">
                {(regime.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>

          {/* VIX Details */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground">Volatility</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">VIX</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-medium">{regime.vix.toFixed(2)}</span>
                  <VixTrendIcon />
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Percentile</span>
                <span className="font-mono font-medium">{regime.vix_percentile}%</span>
              </div>
              {regime.vix9d && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">VIX9D</span>
                  <span className="font-mono">{regime.vix9d.toFixed(2)}</span>
                </div>
              )}
              {regime.vix3m && (
                <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">VIX3M</span>
                  <span className="font-mono">{regime.vix3m.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Term Structure */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground">Term Structure</h5>
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Structure</span>
              <span className={cn('font-medium', termConfig.color)}>
                {termConfig.label}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              Updated: {new Date(regime.updated_at).toLocaleTimeString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRegime}
              className="h-6 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
