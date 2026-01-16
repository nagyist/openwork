# ActivityRow Step Log Design

## Overview

Replace the Request/Response blocks in ActivityRow with a live step-by-step log showing what the agent is doing in plain English.

## Data Structure

```typescript
interface ActivityStep {
  id: string;
  icon: string;        // 📂 🔍 📁 ⚡ 📝 ✓ ✗
  text: string;        // "Opening ActivityRow.tsx"
  status: 'active' | 'done';
  details?: string[];  // sub-items like "→ ActivityRow.tsx (3)"
}
```

## Step Sequences Per Tool

### Read
```
📂 Opening {filename}
📄 Reading contents...
✓ Found {lines} lines of {type} code
```

### Grep
```
🔍 Searching for "{pattern}"
📁 Scanning {filetype} files...
✓ Found {count} matches in {fileCount} files
   → {file1} ({count})
   → {file2} ({count})
   → ...{n} more
```

### Bash
```
⚡ Running: {command}
📋 Executing command...
✓ Command completed (exit 0)
```
Error: `✗ Command failed (exit {code})`

### Glob
```
🔎 Finding files matching "{pattern}"
📁 Scanning directories...
✓ Found {count} files
   → {dir1} ({count})
   → {dir2} ({count})
```

### Write
```
📝 Creating {filename}
💾 Writing contents...
✓ Wrote {lines} lines
```

### Edit
```
📝 Editing {filename}
💾 Applying changes...
✓ Updated file ({lines} lines changed)
```

### WebFetch
```
🌐 Fetching {hostname}
📡 Downloading content...
✓ Retrieved page content
```

### WebSearch
```
🔍 Searching web for "{query}"
🌐 Querying search engine...
✓ Found {count} results
```

### Task (Agent)
```
🤖 Starting agent: {description}
⏳ Agent working...
✓ Agent completed
```

## Live Update Behavior

1. **Running state**: Steps 1-2 generated from `input`, step 2 shows as active with shimmer
2. **Complete state**: Final step generated from `output`, all steps marked done
3. **Timing**: Step 1 immediate, step 2 after 300ms, step 3 on completion
4. **Animation**: Framer-motion fade + slide up for new steps

## Visual Layout

Expanded view (replaces CodeBlock):
```
┌─────────────────────────────────────────────┐
│ 📂 Opening ActivityRow.tsx                  │
│ 📄 Reading contents...                      │
│ ✓ Found 397 lines of TypeScript code        │
└─────────────────────────────────────────────┘
```

- Left-aligned, one step per line
- Muted color for older steps, foreground for latest
- Details indented with → prefix, smaller text
- Active step has subtle shimmer animation

## Implementation

1. Create `generateSteps(tool, input, output, status)` function
2. Update ActivityRow to track and render steps array
3. Add step animations with framer-motion
4. Remove CodeBlock usage from ActivityRow
