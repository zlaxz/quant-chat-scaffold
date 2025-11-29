/**
 * PythonExecutionPanel - Rich visualization for Python script execution
 * 
 * Shows:
 * - Full command being executed
 * - Real-time stdout/stderr streaming
 * - Execution phases (starting → running → complete)
 * - Detailed metadata (exit code, duration, timeout)
 * - Clear visual separation of output types
 */

import { Terminal, Play, CheckCircle2, XCircle, Clock, Code, AlertTriangle, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface PythonExecutionData {
  id: string;
  scriptPath: string;
  args: string[];
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  timestamp: number;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'timeout';
  timeout?: number;
}

interface PythonExecutionPanelProps {
  execution: PythonExecutionData;
  className?: string;
}

export function PythonExecutionPanel({ execution, className }: PythonExecutionPanelProps) {
  const isRunning = execution.status === 'starting' || execution.status === 'running';
  const isSuccess = execution.status === 'completed' && execution.exitCode === 0;
  const isFailed = execution.status === 'failed' || (execution.status === 'completed' && execution.exitCode !== 0);
  const isTimeout = execution.status === 'timeout';

  return (
    <Card className={cn(
      'p-4 mb-3 border-l-4 animate-fade-in',
      isSuccess && 'border-l-green-500 bg-green-50 dark:bg-green-950/20',
      isFailed && 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
      isTimeout && 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
      isRunning && 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-foreground" />
          <h4 className="text-sm font-semibold">Python Execution</h4>
          {isRunning && <Play className="h-4 w-4 text-blue-500 animate-pulse" />}
          {isSuccess && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
          {isFailed && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
          {isTimeout && <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
        </div>
        <Badge 
          variant={isSuccess ? 'default' : isFailed || isTimeout ? 'destructive' : 'secondary'}
          className="font-mono text-xs"
        >
          {execution.status.toUpperCase()}
        </Badge>
      </div>

      {/* Script Info */}
      <div className="space-y-2 mb-4 pb-4 border-b border-border/50">
        <div className="flex items-start gap-2 text-sm">
          <Code className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground font-medium min-w-[60px]">Script:</span>
          <code className="text-foreground font-mono text-xs bg-background/50 px-2 py-0.5 rounded flex-1">
            {execution.scriptPath}
          </code>
        </div>

        {execution.args.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Zap className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground font-medium min-w-[60px]">Args:</span>
            <code className="text-foreground font-mono text-xs bg-background/50 px-2 py-0.5 rounded flex-1">
              {execution.args.join(' ')}
            </code>
          </div>
        )}

        <div className="flex items-start gap-2 text-sm">
          <Terminal className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground font-medium min-w-[60px]">Command:</span>
          <code className="text-foreground font-mono text-xs bg-background/50 px-2 py-0.5 rounded flex-1 break-all">
            {execution.command}
          </code>
        </div>
      </div>

      {/* Execution Metadata */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="font-mono">{execution.duration}ms</span>
        </div>
        {execution.exitCode !== null && (
          <Badge variant="outline" className={cn(
            "font-mono",
            execution.exitCode === 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            Exit: {execution.exitCode}
          </Badge>
        )}
        {execution.timeout && (
          <Badge variant="outline" className="font-mono text-xs">
            Timeout: {execution.timeout}ms
          </Badge>
        )}
        <span className="font-mono ml-auto">
          {new Date(execution.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Output Sections */}
      <div className="space-y-3">
        {/* STDOUT */}
        {execution.stdout && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                Output
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <ScrollArea className="h-48 rounded-md bg-background/50 border border-border p-3">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                {execution.stdout}
                {isRunning && <span className="inline-block w-2 h-3 bg-blue-500 animate-pulse ml-1" />}
              </pre>
            </ScrollArea>
          </div>
        )}

        {/* STDERR */}
        {execution.stderr && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-red-500/30" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide px-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Errors / Warnings
              </span>
              <div className="h-px flex-1 bg-red-500/30" />
            </div>
            <ScrollArea className="h-32 rounded-md bg-red-100 dark:bg-red-950/30 border border-red-500/30 p-3">
              <pre className="text-xs font-mono text-red-900 dark:text-red-200 whitespace-pre-wrap leading-relaxed">
                {execution.stderr}
              </pre>
            </ScrollArea>
          </div>
        )}

        {/* No Output Yet */}
        {!execution.stdout && !execution.stderr && isRunning && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Zap className="h-6 w-6 mx-auto mb-2 animate-pulse" />
            <p>Script is running...</p>
            <p className="text-xs mt-1">Output will appear here</p>
          </div>
        )}

        {/* Timeout Warning */}
        {isTimeout && (
          <div className="bg-orange-100 dark:bg-orange-950/30 border border-orange-500/30 rounded-md p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="text-xs text-orange-900 dark:text-orange-200">
                <p className="font-semibold mb-1">Execution Timeout</p>
                <p>The script exceeded the maximum execution time of {execution.timeout}ms and was terminated.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
