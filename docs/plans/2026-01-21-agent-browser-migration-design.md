# Agent-Browser Migration Design

**Date:** 2026-01-21
**Status:** Pending Approval

## Overview

Replace the existing `dev-browser` and `dev-browser-mcp` implementation with Vercel's `agent-browser` CLI tool, exposed via a thin MCP wrapper for cross-platform compatibility.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integration approach | MCP wrapper around CLI | Cross-platform Windows support, avoid shell dependency |
| Tool naming | Adopt agent-browser's structure | Follow their documentation, remove redundant code |
| Chromium handling | Keep existing approach | Don't touch this area |
| Coverage | All 36 commands | Full feature parity with agent-browser |

## Files to Delete

```
apps/desktop/skills/dev-browser/           # ~11 files - Playwright server, relay, snapshot
apps/desktop/skills/dev-browser-mcp/       # MCP server wrapping dev-browser
```

## Files to Create

```
apps/desktop/skills/agent-browser-mcp/
├── package.json
├── src/
│   └── index.ts          # MCP server (36 tools → child_process.spawn)
└── SKILL.md              # Agent documentation
```

## Files to Modify

### `apps/desktop/package.json`

**Dependencies - Add:**
```json
{
  "dependencies": {
    "agent-browser": "^0.6.0"
  }
}
```

**Scripts - Update:**
```json
{
  "scripts": {
    "postinstall": "electron-rebuild && npm --prefix skills/agent-browser-mcp install && npm --prefix skills/file-permission install && npm --prefix skills/ask-user-question install",
    "build": "tsc && vite build && npm --prefix skills/agent-browser-mcp install --omit=dev && npm --prefix skills/file-permission install --omit=dev && npm --prefix skills/ask-user-question install --omit=dev"
  }
}
```

**electron-builder config - Update:**
```json
{
  "asarUnpack": [
    "node_modules/agent-browser/**"
  ],
  "files": [
    "node_modules/agent-browser/**"
  ]
}
```

### `apps/desktop/src/main/opencode/config-generator.ts`

**MCP config - Replace dev-browser-mcp:**
```typescript
mcp: {
  // ... other servers unchanged ...
  'agent-browser-mcp': {
    type: 'local',
    command: ['npx', 'tsx', path.join(skillsPath, 'agent-browser-mcp', 'src', 'index.ts')],
    enabled: true,
    environment: {
      ACCOMPLISH_TASK_ID: '${TASK_ID}',
    },
    timeout: 30000,
  },
}
```

**System prompt - Update tool references:**
- Remove: `browser_navigate`, `browser_type`, `browser_sequence`, `browser_keyboard`
- Add complete list of 36 browser_* tools

### `packages/shared/src/constants.ts`

- Remove `DEV_BROWSER_PORT` if present

## MCP Tool Specifications

### Navigation (2 tools)

**browser_open**
```typescript
{ url: string, headed?: boolean, cdp?: number }
// → agent-browser open <url> [--headed] [--cdp <port>]
```

**browser_navigate**
```typescript
{ action: "back" | "forward" | "reload" | "close" }
// → agent-browser back|forward|reload|close
```

### Snapshot (1 tool)

**browser_snapshot**
```typescript
{ interactive_only?: boolean, compact?: boolean, depth?: number, selector?: string, json?: boolean }
// → agent-browser snapshot [-i] [-c] [-d N] [-s "sel"] [--json]
```

### Interactions (10 tools)

**browser_click**
```typescript
{ ref?: string, selector?: string, double?: boolean }
// → agent-browser click|dblclick @ref|<selector>
```

**browser_fill**
```typescript
{ ref?: string, selector?: string, text: string, clear?: boolean }
// → agent-browser fill|type @ref "text"
```

**browser_press**
```typescript
{ key: string, action?: "press" | "keydown" | "keyup" }
// → agent-browser press|keydown|keyup <key>
```

**browser_hover**
```typescript
{ ref?: string, selector?: string }
// → agent-browser hover @ref
```

**browser_focus**
```typescript
{ ref?: string, selector?: string }
// → agent-browser focus @ref
```

**browser_check**
```typescript
{ ref?: string, selector?: string, uncheck?: boolean }
// → agent-browser check|uncheck @ref
```

**browser_select**
```typescript
{ ref?: string, selector?: string, value: string }
// → agent-browser select @ref "value"
```

**browser_scroll**
```typescript
{ direction?: "up" | "down" | "left" | "right", amount?: number, ref?: string, selector?: string }
// → agent-browser scroll <dir> <amount> | scrollintoview @ref
```

**browser_drag**
```typescript
{ from_ref: string, to_ref: string }
// → agent-browser drag @e1 @e2
```

**browser_upload**
```typescript
{ ref?: string, selector?: string, files: string[] }
// → agent-browser upload @ref file1 file2
```

### Information (2 tools)

**browser_get**
```typescript
{ what: "text" | "html" | "value" | "attr" | "title" | "url" | "count" | "box", ref?: string, selector?: string, attr_name?: string, json?: boolean }
// → agent-browser get text|html|value|attr|title|url|count|box @ref
```

**browser_is**
```typescript
{ check: "visible" | "enabled" | "checked", ref?: string, selector?: string }
// → agent-browser is visible|enabled|checked @ref
```

### Capture (3 tools)

**browser_screenshot**
```typescript
{ path?: string, full_page?: boolean }
// → agent-browser screenshot [path] [--full]
```

**browser_pdf**
```typescript
{ path: string }
// → agent-browser pdf <path>
```

**browser_record**
```typescript
{ action: "start" | "stop" | "restart", path?: string }
// → agent-browser record start|stop|restart <path>
```

### Timing (1 tool)

**browser_wait**
```typescript
{ ref?: string, ms?: number, text?: string, url?: string, load?: "load" | "domcontentloaded" | "networkidle", fn?: string }
// → agent-browser wait @ref|<ms>|--text|--url|--load|--fn
```

### Mouse (1 tool)

**browser_mouse**
```typescript
{ action: "move" | "down" | "up" | "wheel", x?: number, y?: number, button?: "left" | "right" | "middle", delta?: number }
// → agent-browser mouse move|down|up|wheel <args>
```

### Semantic Locators (1 tool)

**browser_find**
```typescript
{ by: "role" | "text" | "label" | "placeholder" | "alt" | "title" | "testid" | "first" | "last" | "nth", value: string, action: "click" | "fill" | "text" | "hover", action_value?: string, name?: string, nth?: number }
// → agent-browser find <by> <value> <action> [--name] [nth]
```

### Settings (1 tool)

**browser_set**
```typescript
{ setting: "viewport" | "device" | "geo" | "offline" | "headers" | "credentials" | "media", width?: number, height?: number, device_name?: string, lat?: number, lon?: number, enabled?: boolean, headers?: Record<string, string>, user?: string, pass?: string, scheme?: "dark" | "light" }
// → agent-browser set <setting> <args>
```

### Storage (2 tools)

**browser_cookies**
```typescript
{ action: "get" | "set" | "clear", name?: string, value?: string }
// → agent-browser cookies [set <name> <value>] [clear]
```

**browser_storage**
```typescript
{ type: "local" | "session", action: "get" | "get_key" | "set" | "clear", key?: string, value?: string }
// → agent-browser storage local|session [key] [set k v] [clear]
```

### Network (1 tool)

**browser_network**
```typescript
{ action: "route" | "unroute" | "requests", url?: string, abort?: boolean, body?: string, filter?: string }
// → agent-browser network route|unroute|requests <args>
```

### Tabs/Windows (2 tools)

**browser_tab**
```typescript
{ action: "list" | "new" | "switch" | "close", url?: string, index?: number }
// → agent-browser tab [new [url]] [<index>] [close]
```

**browser_window**
```typescript
{ action: "new" }
// → agent-browser window new
```

### Frames (1 tool)

**browser_frame**
```typescript
{ selector: string }
// → agent-browser frame <selector>|main
```

### Dialogs (1 tool)

**browser_dialog**
```typescript
{ action: "accept" | "dismiss", text?: string }
// → agent-browser dialog accept|dismiss [text]
```

### JavaScript (1 tool)

**browser_eval**
```typescript
{ script: string }
// → agent-browser eval "code"
```

### Sessions/State (2 tools)

**browser_session**
```typescript
{ action: "list" }
// → agent-browser session list
```

**browser_state**
```typescript
{ action: "save" | "load", path: string }
// → agent-browser state save|load <path>
```

### Debugging (4 tools)

**browser_console**
```typescript
{ clear?: boolean }
// → agent-browser console [--clear]
```

**browser_errors**
```typescript
{ clear?: boolean }
// → agent-browser errors [--clear]
```

**browser_highlight**
```typescript
{ ref?: string, selector?: string }
// → agent-browser highlight @ref
```

**browser_trace**
```typescript
{ action: "start" | "stop", path?: string }
// → agent-browser trace start|stop [path]
```

## Implementation Details

### MCP Server Architecture

```typescript
// agent-browser-mcp/src/index.ts

import { spawn } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const TASK_ID = process.env.ACCOMPLISH_TASK_ID || 'default';

function runAgentBrowser(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const agentBrowserPath = getAgentBrowserPath();
    const proc = spawn(agentBrowserPath, ['--session', TASK_ID, ...args]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exit code ${code}`));
    });
  });
}

// Example tool handler
async function handleBrowserOpen(params: { url: string, headed?: boolean, cdp?: number }) {
  const args = ['open', params.url];
  if (params.headed) args.push('--headed');
  if (params.cdp) args.push('--cdp', String(params.cdp));
  return runAgentBrowser(args);
}
```

### Binary Location

```typescript
function getAgentBrowserPath(): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'agent-browser',
      'bin',
      'agent-browser'
    );
  } else {
    return path.join(
      app.getAppPath(),
      'node_modules',
      'agent-browser',
      'bin',
      'agent-browser'
    );
  }
}
```

### Session Isolation

All commands include `--session ${ACCOMPLISH_TASK_ID}` to isolate parallel tasks:
- Each task gets its own browser session
- Sessions have separate cookies, storage, state
- Multiple tasks can run browser automation concurrently

## Not Changed

- Chromium download/installation handling
- Other MCP servers (file-permission, ask-user-question)
- Core Electron architecture
- Bundled Node.js approach

## Testing Plan

1. **Unit tests**: MCP tool → CLI argument mapping
2. **Integration tests**: Full workflow (open → snapshot → click → screenshot)
3. **E2E tests**: Form filling, navigation, state persistence
4. **Platform tests**: Verify on macOS, Windows, Linux
5. **Packaging tests**: Verify in packaged DMG/exe
