# Complete Task Enforcement Design

**Date:** 2026-01-21
**Problem:** Agent sometimes stops mid-task without completing all parts of the user's request, especially on longer tasks.

## Solution Overview

Require the agent to explicitly call a `complete_task` MCP tool to finish any task. If the agent stops without calling it, inject a continuation prompt to remind it to finish or explain why it can't.

## Components

### 1. New MCP Tool: `complete_task`

**Location:** `apps/desktop/skills/complete-task/`

**Schema:**
```typescript
{
  name: "complete_task",
  inputSchema: {
    type: "object",
    required: ["status", "summary", "original_request_summary"],
    properties: {
      status: {
        type: "string",
        enum: ["success", "blocked", "partial"]
      },
      original_request_summary: {
        type: "string",
        description: "Restate what user asked (forces review)"
      },
      summary: {
        type: "string",
        description: "What was accomplished"
      },
      remaining_work: {
        type: "string",
        description: "If blocked/partial, what's left"
      }
    }
  }
}
```

**Statuses:**
- `success` — fully completed all parts
- `blocked` — hit unresolvable blocker
- `partial` — completed some but not all

### 2. System Prompt Changes

**Location:** `apps/desktop/src/main/opencode/config-generator.ts`

Replace TASK COMPLETION section with instructions that:
- REQUIRE calling `complete_task` to finish
- Explain the three statuses
- Emphasize: never stop without calling the tool

### 3. Adapter Changes

**Location:** `apps/desktop/src/main/opencode/adapter.ts`

**New state:**
```typescript
private completeTaskCalled: boolean = false;
private continuationAttempts: number = 0;
private readonly maxContinuationAttempts: number = 2;
```

**Logic in `step_finish` handler:**
1. If `reason === "stop"` and `complete_task` not called:
   - If attempts < 2: inject continuation prompt, don't emit complete
   - If attempts >= 2: emit complete anyway (prevent infinite loop)
2. If `complete_task` was called: emit complete normally

**Continuation prompt:**
> "You stopped without calling complete_task. Review the original request. Did you complete ALL parts? If yes, call complete_task. If blocked, call it with status 'blocked'. Do not stop again without calling it."

### 4. Config Registration

**Location:** `apps/desktop/src/main/opencode/config-generator.ts`

Add to `mcp` object:
```typescript
'complete-task': {
  type: 'local',
  command: ['npx', 'tsx', path.join(skillsPath, 'complete-task', 'src', 'index.ts')],
  enabled: true,
  timeout: 5000,
},
```

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `apps/desktop/skills/complete-task/src/index.ts` |
| Create | `apps/desktop/skills/complete-task/package.json` |
| Create | `apps/desktop/skills/complete-task/SKILL.md` |
| Modify | `apps/desktop/src/main/opencode/config-generator.ts` |
| Modify | `apps/desktop/src/main/opencode/adapter.ts` |

## Behavior Flow

```
User starts task
       ↓
Agent works...
       ↓
Agent emits step_finish(reason: "stop")
       ↓
Was complete_task called? ──YES──→ Emit complete, task ends
       ↓ NO
continuationAttempts < 2? ──NO──→ Emit complete anyway
       ↓ YES
Inject continuation prompt
       ↓
Agent continues...
       ↓
(loop)
```

## Edge Cases

- **Agent calls complete_task early:** Allowed — agent explicitly decided it's done
- **Agent loops forever:** Prevented by maxContinuationAttempts = 2
- **Agent ignores continuation:** After 2 attempts, we give up and emit complete
- **Legitimate failure:** Agent uses status "blocked" with explanation
