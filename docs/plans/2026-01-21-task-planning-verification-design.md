# Task Planning & Verification Design

**Date:** 2026-01-21
**Status:** Ready for implementation

## Problem

The browser agent stops mid-task without completing. The `complete_task` enforcement catches this and nudges continuation, but the agent lacks a clear sense of what "done" means before starting.

## Solution

Update the system prompt to require the agent to:
1. **Plan first** - Before any action, output a numbered plan with steps and completion criteria
2. **Execute** - Work through the steps
3. **Verify before completing** - When calling `complete_task`, review each step's completion criteria

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When to plan | Always | Consistency, forces thinking before acting |
| Plan contents | Steps + completion criteria | Enough structure without over-engineering |
| Verification timing | End of task | Simpler than per-step verification, integrates with `complete_task` |
| Plan storage | Conversation context | No new tools/state needed, just prompt engineering |

## Implementation

### File to Modify

`apps/desktop/src/main/opencode/config-generator.ts`

### Prompt Addition

Add to `ACCOMPLISH_SYSTEM_PROMPT_TEMPLATE` before the existing `<behavior>` section:

```xml
<behavior name="task-planning">
**TASK PLANNING - REQUIRED FOR EVERY TASK**

Before taking ANY action, you MUST first output a plan:

1. **State the goal** - What the user wants accomplished
2. **List steps with verification** - Numbered steps, each with a completion criterion

Format:
**Plan:**
Goal: [what user asked for]

Steps:
1. [Action] → verify: [how to confirm it's done]
2. [Action] → verify: [how to confirm it's done]
...

Then execute the steps. When calling `complete_task`:
- Review each step's verification criterion
- Only use status "success" if ALL criteria are met
- Use "partial" if some steps incomplete, list which ones in `remaining_work`

**Example:**
Goal: Extract analytics data from a website

Steps:
1. Navigate to URL → verify: page title contains expected text
2. Locate data section → verify: can see the target metrics
3. Extract values → verify: have captured specific numbers
4. Report findings → verify: summary includes all extracted data
</behavior>
```

### Expected Agent Output

```
Task: Go to Google Analytics and extract user data

**Plan:**
Goal: Extract interesting user behavior data from Google Analytics

Steps:
1. Navigate to the Analytics URL → verify: page loads with "Analytics" in title
2. Find user behavior data → verify: can see metrics like Active Users, Events
3. Extract key metrics → verify: have at least 3 data points captured
4. Summarize findings → verify: summary includes the extracted data

Let me start with step 1...
```

## Integration

Works with existing systems:
- **`complete_task` enforcement** - Still functions as safety net if agent stops without completing
- **`complete_task` tool schema** - Already has `original_request_summary` and `remaining_work` fields for verification
- **Continuation prompt** - Still triggers if agent stops without calling `complete_task`

## No Changes Required

- `adapter.ts` - Existing `complete_task` detection works
- `complete-task` MCP tool - Schema unchanged
- Continuation mechanism - Works as backup

## Testing

1. Manual testing with browser automation tasks
2. Verify agent outputs plan before taking actions
3. Verify agent references plan criteria in `complete_task` summary
4. Verify partial completion correctly identifies incomplete steps

## Rollback

Remove the `<behavior name="task-planning">` section from the system prompt.
