import { memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DebugLog {
  taskId: string;
  timestamp: string;
  type: string;
  message: string;
  data?: unknown;
}

interface DebugPanelProps {
  logs: DebugLog[];
  isExpanded: boolean;
  onToggle: () => void;
}

export const DebugPanel = memo(function DebugPanel({
  logs,
  isExpanded,
  onToggle,
}: DebugPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, isExpanded]);

  if (logs.length === 0) return null;

  return (
    <div className="border-t border-border bg-zinc-950">
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2',
          'hover:bg-zinc-900 transition-colors',
          'text-left text-sm'
        )}
      >
        <Terminal className="h-4 w-4 text-zinc-500" />
        <span className="flex-1 font-medium text-zinc-400">
          Debug Logs ({logs.length})
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {/* Log content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 300 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="h-[300px] overflow-y-auto p-4 font-mono text-xs">
              {logs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={cn(
                    'py-0.5',
                    log.type === 'stdout' && 'text-zinc-300',
                    log.type === 'info' && 'text-blue-400',
                    log.type === 'exit' && 'text-yellow-400',
                    log.type === 'parse-warning' && 'text-orange-400',
                    log.type === 'error' && 'text-red-400'
                  )}
                >
                  <span className="text-zinc-600 mr-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-zinc-500 mr-2">[{log.type}]</span>
                  <span className="whitespace-pre-wrap break-all">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
