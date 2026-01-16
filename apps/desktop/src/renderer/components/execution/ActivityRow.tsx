import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, FileText, Search, SquareTerminal, Brain, Globe, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '../../lib/animations';
import loadingSymbol from '/assets/loading-symbol.svg';

// Step log data structure
interface ActivityStep {
  id: string;
  icon: string;
  text: string;
  status: 'active' | 'done';
  details?: string[];
}

// Normalize tool name to PascalCase for consistent matching
function normalizeToolName(tool: string): string {
  if (!tool) return tool;
  const lowerTool = tool.toLowerCase();
  const toolMap: Record<string, string> = {
    read: 'Read',
    write: 'Write',
    edit: 'Edit',
    glob: 'Glob',
    grep: 'Grep',
    bash: 'Bash',
    task: 'Task',
    webfetch: 'WebFetch',
    websearch: 'WebSearch',
  };
  return toolMap[lowerTool] || tool.charAt(0).toUpperCase() + tool.slice(1);
}

// Tool icon mapping
const TOOL_ICONS: Record<string, typeof FileText> = {
  Read: FileText,
  Write: FileText,
  Edit: FileText,
  Glob: Search,
  Grep: Search,
  Bash: SquareTerminal,
  Task: Brain,
  WebFetch: Globe,
  WebSearch: Globe,
};

// Human-readable tool names
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  Read: 'Read File',
  Write: 'Write File',
  Edit: 'Edit File',
  Glob: 'Find Files',
  Grep: 'Search Code',
  Bash: 'Run Command',
  Task: 'Agent Task',
  WebFetch: 'Fetch URL',
  WebSearch: 'Web Search',
};

export interface ActivityRowProps {
  id: string;
  tool: string;
  input: unknown;
  output?: string;
  status: 'running' | 'complete' | 'error';
}

// Helper to get filename from path
function getFilename(path: string): string {
  return path?.split('/').pop() || path || 'file';
}

// Helper to detect file type from extension
function getFileType(path: string): string {
  const ext = path?.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript/React',
    js: 'JavaScript',
    jsx: 'JavaScript/React',
    py: 'Python',
    rs: 'Rust',
    go: 'Go',
    java: 'Java',
    rb: 'Ruby',
    md: 'Markdown',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
  };
  return typeMap[ext || ''] || 'code';
}

// Count lines in output
function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

// Parse grep/glob output for file details
function parseFileMatches(output: string): { total: number; files: { name: string; count: number }[] } {
  if (!output) return { total: 0, files: [] };

  const lines = output.split('\n').filter(l => l.trim());
  const fileMap = new Map<string, number>();

  for (const line of lines) {
    // Match patterns like "src/file.ts:10:content" or just "src/file.ts"
    const match = line.match(/^([^:]+)/);
    if (match) {
      const file = match[1];
      fileMap.set(file, (fileMap.get(file) || 0) + 1);
    }
  }

  const files = Array.from(fileMap.entries())
    .map(([name, count]) => ({ name: getFilename(name), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { total: lines.length, files };
}

// Generate steps based on tool type, input, output, and status
function generateSteps(
  tool: string,
  input: unknown,
  output: string | undefined,
  status: 'running' | 'complete' | 'error'
): ActivityStep[] {
  const inp = input as Record<string, unknown>;
  const steps: ActivityStep[] = [];
  const isComplete = status === 'complete';
  const isError = status === 'error';

  switch (tool) {
    case 'Read': {
      const filePath = inp?.file_path as string;
      const filename = getFilename(filePath);
      const fileType = getFileType(filePath);

      steps.push({ id: '1', icon: '📂', text: `Opening ${filename}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '📄', text: 'Reading contents...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '📄', text: 'Reading contents...', status: 'done' });
        const lines = countLines(output || '');
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Failed to read file' : `Found ${lines} lines of ${fileType}`,
          status: 'done'
        });
      }
      break;
    }

    case 'Write': {
      const filePath = inp?.file_path as string;
      const content = inp?.content as string;
      const filename = getFilename(filePath);
      const lines = countLines(content || '');

      steps.push({ id: '1', icon: '📝', text: `Creating ${filename}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '💾', text: 'Writing contents...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '💾', text: 'Writing contents...', status: 'done' });
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Failed to write file' : `Wrote ${lines} lines`,
          status: 'done'
        });
      }
      break;
    }

    case 'Edit': {
      const filePath = inp?.file_path as string;
      const oldString = inp?.old_string as string;
      const newString = inp?.new_string as string;
      const filename = getFilename(filePath);

      steps.push({ id: '1', icon: '📝', text: `Editing ${filename}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '💾', text: 'Applying changes...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '💾', text: 'Applying changes...', status: 'done' });
        const oldLines = countLines(oldString || '');
        const newLines = countLines(newString || '');
        const diff = newLines - oldLines;
        const diffText = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0';
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Failed to edit file' : `Updated file (${diffText} lines)`,
          status: 'done'
        });
      }
      break;
    }

    case 'Glob': {
      const pattern = inp?.pattern as string;

      steps.push({ id: '1', icon: '🔎', text: `Finding files matching "${pattern}"`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '📁', text: 'Scanning directories...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '📁', text: 'Scanning directories...', status: 'done' });
        const files = (output || '').split('\n').filter(l => l.trim());
        const details = files.slice(0, 4).map(f => `→ ${getFilename(f)}`);
        if (files.length > 4) {
          details.push(`→ ...${files.length - 4} more`);
        }
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Search failed' : `Found ${files.length} files`,
          status: 'done',
          details: files.length > 0 ? details : undefined
        });
      }
      break;
    }

    case 'Grep': {
      const pattern = inp?.pattern as string;
      const glob = inp?.glob as string;
      const fileType = glob ? glob.replace('*.', '').toUpperCase() : '';

      steps.push({ id: '1', icon: '🔍', text: `Searching for "${pattern}"`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '📁', text: `Scanning ${fileType || 'files'}...`, status: 'active' });
      } else {
        steps.push({ id: '2', icon: '📁', text: `Scanning ${fileType || 'files'}...`, status: 'done' });
        const { total, files } = parseFileMatches(output || '');
        const details = files.map(f => `→ ${f.name} (${f.count})`);
        if (files.length < total) {
          details.push(`→ ...more files`);
        }
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Search failed' : `Found ${total} matches in ${files.length} files`,
          status: 'done',
          details: files.length > 0 ? details : undefined
        });
      }
      break;
    }

    case 'Bash': {
      const command = inp?.command as string;
      const description = inp?.description as string;
      const shortCmd = command?.length > 40 ? command.slice(0, 40) + '...' : command;

      steps.push({ id: '1', icon: '⚡', text: description || `Running: ${shortCmd}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '📋', text: 'Executing command...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '📋', text: 'Executing command...', status: 'done' });
        // Check for exit code in output
        const exitMatch = output?.match(/exit code[:\s]+(\d+)/i);
        const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : (isError ? 1 : 0);
        steps.push({
          id: '3',
          icon: isError || exitCode !== 0 ? '✗' : '✓',
          text: exitCode === 0 ? 'Command completed (exit 0)' : `Command failed (exit ${exitCode})`,
          status: 'done'
        });
      }
      break;
    }

    case 'WebFetch': {
      const url = inp?.url as string;
      let hostname = 'URL';
      try {
        hostname = new URL(url).hostname;
      } catch { /* ignore */ }

      steps.push({ id: '1', icon: '🌐', text: `Fetching ${hostname}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '📡', text: 'Downloading content...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '📡', text: 'Downloading content...', status: 'done' });
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Failed to fetch' : 'Retrieved page content',
          status: 'done'
        });
      }
      break;
    }

    case 'WebSearch': {
      const query = inp?.query as string;

      steps.push({ id: '1', icon: '🔍', text: `Searching web for "${query}"`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '🌐', text: 'Querying search engine...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '🌐', text: 'Querying search engine...', status: 'done' });
        // Try to count results from output
        const resultCount = (output || '').split('\n').filter(l => l.includes('http')).length || 'several';
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Search failed' : `Found ${resultCount} results`,
          status: 'done'
        });
      }
      break;
    }

    case 'Task': {
      const description = inp?.description as string;

      steps.push({ id: '1', icon: '🤖', text: `Starting agent: ${description || 'task'}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '⏳', text: 'Agent working...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '⏳', text: 'Agent working...', status: 'done' });
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Agent failed' : 'Agent completed',
          status: 'done'
        });
      }
      break;
    }

    default: {
      // Generic steps for unknown tools
      steps.push({ id: '1', icon: '🔧', text: `Running ${tool}`, status: 'done' });

      if (status === 'running') {
        steps.push({ id: '2', icon: '⏳', text: 'Processing...', status: 'active' });
      } else {
        steps.push({ id: '2', icon: '⏳', text: 'Processing...', status: 'done' });
        steps.push({
          id: '3',
          icon: isError ? '✗' : '✓',
          text: isError ? 'Failed' : 'Completed',
          status: 'done'
        });
      }
    }
  }

  return steps;
}

// Generate smart summary based on tool and input
function getSummary(tool: string, input: unknown, fallbackName: string): string {
  const inp = input as Record<string, unknown>;

  switch (tool) {
    case 'Read': {
      const filePath = inp?.file_path as string;
      if (filePath) {
        const basename = filePath.split('/').pop() || filePath;
        return `Read ${basename}`;
      }
      return 'Read File';
    }

    case 'Write': {
      const filePath = inp?.file_path as string;
      if (filePath) {
        const basename = filePath.split('/').pop() || filePath;
        return `Write ${basename}`;
      }
      return 'Write File';
    }

    case 'Edit': {
      const filePath = inp?.file_path as string;
      if (filePath) {
        const basename = filePath.split('/').pop() || filePath;
        return `Edit ${basename}`;
      }
      return 'Edit File';
    }

    case 'Glob': {
      const pattern = inp?.pattern as string;
      return pattern ? `Find ${pattern}` : 'Find Files';
    }

    case 'Grep': {
      const pattern = inp?.pattern as string;
      return pattern ? `Search for "${pattern}"` : 'Search Code';
    }

    case 'WebFetch': {
      const url = inp?.url as string;
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          return `Fetch ${hostname}`;
        } catch {
          return 'Fetch URL';
        }
      }
      return 'Fetch URL';
    }

    case 'WebSearch': {
      const query = inp?.query as string;
      return query ? `Search "${query}"` : 'Web Search';
    }

    case 'Bash': {
      const description = inp?.description as string;
      if (description) return description;
      const command = inp?.command as string;
      if (command) {
        const shortCmd = command.length > 50 ? command.slice(0, 50) + '...' : command;
        return shortCmd;
      }
      return 'Run Command';
    }

    case 'Task': {
      const description = inp?.description as string;
      return description || 'Agent Task';
    }

    default:
      return fallbackName;
  }
}

// Spinning icon component
const SpinningIcon = ({ className }: { className?: string }) => (
  <img
    src={loadingSymbol}
    alt=""
    className={cn('animate-spin-ccw', className)}
  />
);

// Step row component with animation
const StepRow = memo(function StepRow({ step, isNew }: { step: ActivityStep; isNew?: boolean }) {
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col"
    >
      <div className={cn(
        'flex items-center gap-2 text-sm',
        step.status === 'active' ? 'text-foreground' : 'text-muted-foreground'
      )}>
        <span className="w-5 text-center shrink-0">{step.icon}</span>
        <span className={cn(
          step.status === 'active' && 'animate-pulse'
        )}>
          {step.text}
        </span>
      </div>
      {step.details && step.details.length > 0 && (
        <div className="ml-7 mt-1 space-y-0.5">
          {step.details.map((detail, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {detail}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
});

export const ActivityRow = memo(function ActivityRow({
  id,
  tool,
  input,
  output,
  status,
}: ActivityRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<ActivityStep[]>([]);

  const normalizedTool = normalizeToolName(tool);
  const Icon = TOOL_ICONS[normalizedTool] || Wrench;
  const fallbackName = TOOL_DISPLAY_NAMES[normalizedTool] || normalizedTool;
  const summary = getSummary(normalizedTool, input, fallbackName);

  // Generate all steps
  const allSteps = generateSteps(normalizedTool, input, output, status);

  // Progressive step reveal for running state
  useEffect(() => {
    if (status === 'running') {
      // Show first step immediately
      setVisibleSteps([allSteps[0]]);

      // Show second step after delay
      const timer = setTimeout(() => {
        setVisibleSteps(allSteps.slice(0, 2));
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // Show all steps when complete
      setVisibleSteps(allSteps);
    }
  }, [status, normalizedTool, JSON.stringify(input), output]);

  // Always allow expansion
  const canExpand = allSteps.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className="w-full relative"
    >
      {/* Timeline connector dot */}
      <div className="absolute -left-[21px] top-3 w-2 h-2 rounded-full bg-muted-foreground/50" />

      {/* Row - always clickable if expandable */}
      <button
        onClick={canExpand ? () => setIsExpanded(!isExpanded) : undefined}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
          'text-left text-sm',
          canExpand && 'cursor-pointer hover:bg-muted/50 transition-colors'
        )}
      >
        {/* Tool icon */}
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

        {/* Tool summary */}
        <span className="flex-1 font-medium text-foreground truncate">{summary}</span>

        {/* Status indicator */}
        {status === 'running' ? (
          <SpinningIcon className="h-4 w-4 shrink-0" />
        ) : status === 'error' ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        )}

        {/* Expand/collapse chevron */}
        {canExpand && (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        )}
      </button>

      {/* Expanded details - Step log */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 ml-4 space-y-1.5 border-l-2 border-muted">
              {visibleSteps.map((step, index) => (
                <StepRow
                  key={step.id}
                  step={step}
                  isNew={status === 'running' && index === visibleSteps.length - 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
