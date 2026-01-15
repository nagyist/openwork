# Task Launcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Spotlight-style task launcher modal triggered by Cmd+K or search button.

**Architecture:** Zustand state controls modal visibility. TaskLauncher component renders a Dialog with search input, "New task" option, and filtered task list. Keyboard listener registered at App level.

**Tech Stack:** React, Zustand, Radix Dialog, framer-motion, lucide-react icons.

---

### Task 1: Add launcher state to Zustand store

**Files:**
- Modify: `apps/desktop/src/renderer/stores/taskStore.ts`

**Step 1: Add state and actions to interface**

In `TaskState` interface (around line 26), add:

```typescript
// Task launcher
isLauncherOpen: boolean;
openLauncher: () => void;
closeLauncher: () => void;
```

**Step 2: Add initial state**

In the store creation (around line 66), add:

```typescript
isLauncherOpen: false,
```

**Step 3: Add action implementations**

After `reset` function (around line 437), add:

```typescript
openLauncher: () => set({ isLauncherOpen: true }),
closeLauncher: () => set({ isLauncherOpen: false }),
```

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/stores/taskStore.ts
git commit -m "feat(launcher): add isLauncherOpen state to task store"
```

---

### Task 2: Create TaskLauncherItem component

**Files:**
- Create: `apps/desktop/src/renderer/components/TaskLauncher/TaskLauncherItem.tsx`

**Step 1: Create directory**

```bash
mkdir -p apps/desktop/src/renderer/components/TaskLauncher
```

**Step 2: Write the component**

```tsx
'use client';

import type { Task } from '@accomplish/shared';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface TaskLauncherItemProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusIcon(status: Task['status']) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />;
    case 'completed':
      return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
    case 'failed':
      return <XCircle className="h-3 w-3 text-destructive shrink-0" />;
    case 'cancelled':
    case 'interrupted':
      return <AlertCircle className="h-3 w-3 text-yellow-500 shrink-0" />;
    default:
      return null;
  }
}

export default function TaskLauncherItem({ task, isSelected, onClick }: TaskLauncherItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-100',
        'flex items-center gap-2',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-accent'
      )}
    >
      {getStatusIcon(task.status)}
      <span className="truncate flex-1">{task.prompt}</span>
      <span className={cn(
        'text-xs shrink-0',
        isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
      )}>
        {formatRelativeDate(task.createdAt)}
      </span>
    </button>
  );
}
```

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/TaskLauncher/TaskLauncherItem.tsx
git commit -m "feat(launcher): add TaskLauncherItem component"
```

---

### Task 3: Create TaskLauncher modal component

**Files:**
- Create: `apps/desktop/src/renderer/components/TaskLauncher/TaskLauncher.tsx`
- Create: `apps/desktop/src/renderer/components/TaskLauncher/index.ts`

**Step 1: Write the TaskLauncher component**

```tsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Plus, X } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { getAccomplish } from '@/lib/accomplish';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/animations';
import TaskLauncherItem from './TaskLauncherItem';

export default function TaskLauncher() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const {
    isLauncherOpen,
    closeLauncher,
    tasks,
    startTask,
    isLoading
  } = useTaskStore();
  const accomplish = getAccomplish();

  // Filter tasks by search query (title only)
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show last 7 days when no search
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return tasks.filter(t => new Date(t.createdAt).getTime() > sevenDaysAgo);
    }
    const query = searchQuery.toLowerCase();
    return tasks.filter(t => t.prompt.toLowerCase().includes(query));
  }, [tasks, searchQuery]);

  // Total items: "New task" + filtered tasks
  const totalItems = 1 + filteredTasks.length;

  // Reset state when modal opens
  useEffect(() => {
    if (isLauncherOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLauncherOpen]);

  // Clamp selected index when results change
  useEffect(() => {
    setSelectedIndex(i => Math.min(i, Math.max(0, totalItems - 1)));
  }, [totalItems]);

  const handleSelect = useCallback(async (index: number) => {
    if (index === 0) {
      // "New task" selected
      if (searchQuery.trim()) {
        // Start task with search query as prompt
        const hasKey = await accomplish.hasAnyApiKey();
        if (!hasKey) {
          closeLauncher();
          navigate('/');
          return;
        }
        closeLauncher();
        const taskId = `task_${Date.now()}`;
        const task = await startTask({ prompt: searchQuery.trim(), taskId });
        if (task) {
          navigate(`/execution/${task.id}`);
        }
      } else {
        // Navigate to home for empty input
        closeLauncher();
        navigate('/');
      }
    } else {
      // Task selected - navigate to it
      const task = filteredTasks[index - 1];
      if (task) {
        closeLauncher();
        navigate(`/execution/${task.id}`);
      }
    }
  }, [searchQuery, filteredTasks, closeLauncher, navigate, startTask, accomplish]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeLauncher();
        break;
    }
  }, [totalItems, selectedIndex, handleSelect, closeLauncher]);

  return (
    <DialogPrimitive.Root open={isLauncherOpen} onOpenChange={(open) => !open && closeLauncher()}>
      <AnimatePresence>
        {isLauncherOpen && (
          <DialogPrimitive.Portal forceMount>
            {/* Overlay */}
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>

            {/* Content */}
            <DialogPrimitive.Content
              className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
              onKeyDown={handleKeyDown}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={springs.bouncy}
                className="w-full max-w-lg bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
              >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <DialogPrimitive.Close asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </DialogPrimitive.Close>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto p-2">
                  {/* New Task Option */}
                  <button
                    onClick={() => handleSelect(0)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-100',
                      'flex items-center gap-2',
                      selectedIndex === 0
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent'
                    )}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>New task</span>
                    {searchQuery.trim() && (
                      <span className={cn(
                        'text-xs truncate',
                        selectedIndex === 0 ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        — "{searchQuery}"
                      </span>
                    )}
                  </button>

                  {/* Task List */}
                  {filteredTasks.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        {searchQuery.trim() ? 'Results' : 'Last 7 days'}
                      </div>
                      {filteredTasks.slice(0, 10).map((task, i) => (
                        <TaskLauncherItem
                          key={task.id}
                          task={task}
                          isSelected={selectedIndex === i + 1}
                          onClick={() => handleSelect(i + 1)}
                        />
                      ))}
                    </>
                  )}

                  {/* Empty State */}
                  {searchQuery.trim() && filteredTasks.length === 0 && (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No tasks found
                    </div>
                  )}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
                  <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd> Select</span>
                  <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close</span>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
```

**Step 2: Write the index export**

```typescript
export { default as TaskLauncher } from './TaskLauncher';
export { default as TaskLauncherItem } from './TaskLauncherItem';
```

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/TaskLauncher/
git commit -m "feat(launcher): add TaskLauncher modal component"
```

---

### Task 4: Add search button to Sidebar

**Files:**
- Modify: `apps/desktop/src/renderer/components/layout/Sidebar.tsx`

**Step 1: Import search icon and store action**

Add `Search` to the lucide imports:

```typescript
import { Settings, MessageSquarePlus, Search } from 'lucide-react';
```

**Step 2: Get openLauncher from store**

Update the destructuring:

```typescript
const { tasks, loadTasks, updateTaskStatus, addTaskUpdate, openLauncher } = useTaskStore();
```

**Step 3: Add search button next to New Task**

Replace the "New Task Button" section (around line 53-64) with:

```tsx
{/* Action Buttons */}
<div className="px-3 py-3 border-b border-border flex gap-2">
  <Button
    onClick={handleNewConversation}
    variant="default"
    size="sm"
    className="flex-1 justify-center gap-2"
    title="New Task"
  >
    <MessageSquarePlus className="h-4 w-4" />
    New Task
  </Button>
  <Button
    onClick={openLauncher}
    variant="outline"
    size="sm"
    className="px-2"
    title="Search Tasks (⌘K)"
  >
    <Search className="h-4 w-4" />
  </Button>
</div>
```

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/layout/Sidebar.tsx
git commit -m "feat(launcher): add search button to sidebar"
```

---

### Task 5: Add Cmd+K listener and render TaskLauncher in App

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`

**Step 1: Import TaskLauncher and useTaskStore**

Add imports:

```typescript
import { TaskLauncher } from './components/TaskLauncher';
import { useTaskStore } from './stores/taskStore';
```

**Step 2: Add keyboard listener in App component**

After the existing `useEffect` hooks (around line 28), add:

```typescript
// Get launcher actions
const { openLauncher, isLauncherOpen } = useTaskStore();

// Cmd+K keyboard shortcut
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openLauncher();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [openLauncher]);
```

**Step 3: Render TaskLauncher**

In the "Ready" return (around line 81), add `<TaskLauncher />` after the closing `</main>` tag:

```tsx
// Ready - render the app with sidebar
return (
  <div className="flex h-screen overflow-hidden bg-background">
    {/* Invisible drag region for window dragging (macOS hiddenInset titlebar) */}
    <div className="drag-region fixed top-0 left-0 right-0 h-10 z-50" />
    <Sidebar />
    <main className="flex-1 overflow-hidden">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* ... existing routes ... */}
        </Routes>
      </AnimatePresence>
    </main>
    <TaskLauncher />
  </div>
);
```

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/App.tsx
git commit -m "feat(launcher): add Cmd+K shortcut and render TaskLauncher"
```

---

### Task 6: Manual Testing

**Step 1: Start the dev server**

Run: `pnpm dev`

**Step 2: Test keyboard shortcut**

- Press Cmd+K (or Ctrl+K on Windows/Linux)
- Expected: Launcher modal opens, centered on screen

**Step 3: Test search button**

- Click the search icon button in the sidebar
- Expected: Launcher modal opens

**Step 4: Test navigation**

- Use arrow keys to navigate up/down
- Expected: Selection highlight moves
- Press Enter on "New task"
- Expected: Navigates to home page
- Press Escape
- Expected: Modal closes

**Step 5: Test search filtering**

- Open launcher and type a search query
- Expected: Tasks filtered by title, "No tasks found" if no matches

**Step 6: Test new task creation**

- Type a prompt in the search bar
- Select "New task"
- Expected: Task starts with that prompt

**Step 7: Test task selection**

- Select an existing task
- Expected: Navigates to /execution/:id

**Step 8: Final commit if all tests pass**

```bash
git add -A
git commit -m "test(launcher): verify task launcher functionality"
```
