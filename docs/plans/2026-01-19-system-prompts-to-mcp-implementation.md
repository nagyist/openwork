# System Prompts to MCP Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce system prompt from 268 lines to ~25 lines by moving tool documentation into MCP server descriptions.

**Architecture:** MCP tools self-document via rich `description` fields. System prompt retains only identity, capabilities, and behavior guidelines.

**Tech Stack:** TypeScript, MCP SDK (@modelcontextprotocol/sdk), Vitest

---

## Task 1: Enhance file-permission MCP Tool Description

**Files:**
- Modify: `apps/desktop/skills/file-permission/src/index.ts:35-71`

**Step 1: Update the tool description**

Replace the minimal description with the full workflow rules. Find the `ListToolsRequestSchema` handler and update the `description` field:

```typescript
// In apps/desktop/skills/file-permission/src/index.ts
// Replace lines 39-41 with:

      description: `Request user permission before performing file operations.

CRITICAL WORKFLOW - NEVER SKIP:
Before using Write, Edit, Bash (with file ops), or ANY tool that touches files:
1. FIRST: Call this tool and wait for response
2. ONLY IF "allowed": Proceed with the file operation
3. IF "denied": Stop and inform the user

WRONG:
  Write({ path: "/tmp/file.txt" })  <- Permission not requested!

CORRECT:
  request_file_permission({ operation: "create", filePath: "/tmp/file.txt" })
  -> Wait for "allowed"
  Write({ path: "/tmp/file.txt" })  <- OK after permission granted

APPLIES TO:
- Creating files (Write tool, bash echo/cat, scripts that output files)
- Renaming files (bash mv, rename commands)
- Deleting files (bash rm, delete commands)
- Modifying files (Edit tool, bash sed/awk)

EXCEPTION: Temp scripts matching /tmp/accomplish-*.mts are auto-allowed.

Returns: "allowed" or "denied"`,
```

**Step 2: Verify the file compiles**

Run:
```bash
cd apps/desktop/skills/file-permission && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add apps/desktop/skills/file-permission/src/index.ts
git commit -m "$(cat <<'EOF'
feat(file-permission): add workflow rules to MCP tool description

Move critical file permission workflow rules from system prompt into
the MCP tool description. This allows the model to discover the rules
when the tool is loaded, following MCP best practices for structured
context management.

Includes:
- WRONG/CORRECT examples
- List of operations requiring permission
- /tmp/accomplish-*.mts exception

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Enhance ask-user-question MCP Tool Description

**Files:**
- Modify: `apps/desktop/skills/ask-user-question/src/index.ts:40-97`

**Step 1: Update the tool description**

Replace the minimal description with the full communication rules. Find the `ListToolsRequestSchema` handler and update the `description` field:

```typescript
// In apps/desktop/skills/ask-user-question/src/index.ts
// Replace lines 44-45 with:

      description: `Ask the user a question via UI modal.

CRITICAL: The user CANNOT see your text output or CLI prompts!
If you write "Let me ask you..." - THE USER WILL NOT SEE IT.
You MUST call this tool to communicate with the user.

WHEN TO USE:
- Clarifying questions before ambiguous tasks
- Confirming destructive/irreversible actions
- Getting user preferences or approval

CUSTOM TEXT INPUT:
Include { label: "Other", description: "Type your own" } to allow free text.
Response will be "User responded: [text]" instead of "User selected: Other".

RESPONSE FORMAT:
- "User selected: Option A"
- "User selected: Option A, Option B" (if multiSelect)
- "User responded: [custom text]"
- "User declined to answer the question."`,
```

**Step 2: Verify the file compiles**

Run:
```bash
cd apps/desktop/skills/ask-user-question && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add apps/desktop/skills/ask-user-question/src/index.ts
git commit -m "$(cat <<'EOF'
feat(ask-user-question): add communication rules to MCP tool description

Move critical user communication rules from system prompt into the MCP
tool description. The model must use this tool to communicate since
users cannot see CLI output.

Includes:
- CLI invisibility warning
- When to use guidance
- Custom text input ("Other" option) documentation
- Response format reference

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Minimize System Prompt

**Files:**
- Modify: `apps/desktop/src/main/opencode/config-generator.ts:49-316`

**Step 1: Replace the system prompt template**

Replace the entire `ACCOMPLISH_SYSTEM_PROMPT_TEMPLATE` constant (lines 49-316) with the minimal version:

```typescript
// In apps/desktop/src/main/opencode/config-generator.ts
// Replace lines 49-316 with:

const ACCOMPLISH_SYSTEM_PROMPT_TEMPLATE = `<identity>
You are Accomplish, a browser automation assistant.
</identity>

<capabilities>
When users ask about your capabilities, mention:
- **Browser Automation**: Control web browsers, navigate sites, fill forms, click buttons
- **File Management**: Sort, rename, and move files based on content or rules
</capabilities>

<behavior>
- Write small, focused scripts - each does ONE thing
- After each script, evaluate the output before deciding next steps
- Be concise - don't narrate every internal action
- Hide implementation details - describe actions in user terms
- Only speak when you have meaningful results or need input
</behavior>
`;
```

**Step 2: Remove the skills path replacement**

Since `{{SKILLS_PATH}}` is no longer in the template, update the `generateOpenCodeConfig` function. Find line 412 and simplify:

```typescript
// In apps/desktop/src/main/opencode/config-generator.ts
// Replace line 412:
//   const systemPrompt = ACCOMPLISH_SYSTEM_PROMPT_TEMPLATE.replace(/\{\{SKILLS_PATH\}\}/g, skillsPath);
// With:
  const systemPrompt = ACCOMPLISH_SYSTEM_PROMPT_TEMPLATE;
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
pnpm typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add apps/desktop/src/main/opencode/config-generator.ts
git commit -m "$(cat <<'EOF'
refactor(config-generator): minimize system prompt to ~25 lines

Remove tool documentation and skill instructions from system prompt.
These now live in MCP tool descriptions where they belong.

Removed sections:
- <environment> (8 lines) - dev-browser handles NODE_BIN_PATH
- <filesystem-rules> (27 lines) - now in file-permission MCP
- <tool> (31 lines) - MCP inputSchema provides this
- <skill dev-browser> (169 lines) - handled in separate PR
- <user-communication> (4 lines) - now in ask-user-question MCP

Kept sections:
- <identity> - who the agent is
- <capabilities> - user-facing description
- <behavior> - output guidelines

System prompt reduced from 268 lines to 25 lines.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Delete Redundant SKILL.md

**Files:**
- Delete: `apps/desktop/skills/ask-user-question/SKILL.md`

**Step 1: Delete the file**

```bash
rm apps/desktop/skills/ask-user-question/SKILL.md
```

**Step 2: Verify no references to this file**

Run:
```bash
grep -r "ask-user-question/SKILL" apps/desktop/
```

Expected: No output (no references)

**Step 3: Commit**

```bash
git add -A apps/desktop/skills/ask-user-question/SKILL.md
git commit -m "$(cat <<'EOF'
chore(ask-user-question): remove redundant SKILL.md

Content has been moved to the MCP tool description in index.ts.
Single source of truth now lives with the MCP server.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update Integration Tests

**Files:**
- Modify: `apps/desktop/__tests__/integration/main/opencode/config-generator.integration.test.ts:248-287`

**Step 1: Update the "System Prompt Content" test suite**

Replace the three tests in the "System Prompt Content" describe block (lines 248-287) with tests that verify the new minimal prompt structure:

```typescript
// In apps/desktop/__tests__/integration/main/opencode/config-generator.integration.test.ts
// Replace lines 248-287 with:

  describe('System Prompt Content', () => {
    it('should include identity section', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;

      expect(prompt).toContain('<identity>');
      expect(prompt).toContain('Accomplish');
      expect(prompt).toContain('browser automation assistant');
    });

    it('should include capabilities section', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;

      expect(prompt).toContain('<capabilities>');
      expect(prompt).toContain('Browser Automation');
      expect(prompt).toContain('File Management');
    });

    it('should include behavior section', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;

      expect(prompt).toContain('<behavior>');
      expect(prompt).toContain('small, focused scripts');
    });

    it('should NOT include file permission rules (moved to MCP)', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;

      // These should NOT be in the system prompt anymore
      expect(prompt).not.toContain('FILE PERMISSION WORKFLOW');
      expect(prompt).not.toContain('request_file_permission');
    });

    it('should NOT include dev-browser skill (moved to separate PR)', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;

      // These should NOT be in the system prompt anymore
      expect(prompt).not.toContain('{{SKILLS_PATH}}');
      expect(prompt).not.toContain('<skill name="dev-browser">');
      expect(prompt).not.toContain('NODE_BIN_PATH');
    });

    it('should be minimal (under 50 lines)', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;
      const lineCount = prompt.split('\n').length;

      expect(lineCount).toBeLessThan(50);
    });
  });
```

**Step 2: Also update the "inject skills path" test since we no longer use {{SKILLS_PATH}}**

Find the test "should inject skills path into system prompt" (lines 201-214) and update it:

```typescript
// In apps/desktop/__tests__/integration/main/opencode/config-generator.integration.test.ts
// Replace lines 201-214 with:

    it('should not contain template placeholders', async () => {
      // Act
      const { generateOpenCodeConfig } = await import('@main/opencode/config-generator');
      const configPath = await generateOpenCodeConfig();

      // Assert
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const prompt = config.agent['accomplish'].prompt;

      // Prompt should not contain any template placeholders
      expect(prompt).not.toContain('{{');
      expect(prompt).not.toContain('}}');
    });
```

**Step 3: Run tests to verify they pass**

Run:
```bash
pnpm -F @accomplish/desktop test:unit -- --run apps/desktop/__tests__/integration/main/opencode/config-generator.integration.test.ts
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add apps/desktop/__tests__/integration/main/opencode/config-generator.integration.test.ts
git commit -m "$(cat <<'EOF'
test(config-generator): update tests for minimal system prompt

Update integration tests to verify:
- Identity, capabilities, behavior sections present
- File permission rules NOT in prompt (moved to MCP)
- Dev-browser skill NOT in prompt (separate PR)
- No template placeholders remain
- Prompt is under 50 lines

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run Full Test Suite

**Files:** None (verification only)

**Step 1: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: No errors

**Step 2: Run lint**

Run:
```bash
pnpm lint
```

Expected: No errors

**Step 3: Run all tests**

Run:
```bash
pnpm -F @accomplish/desktop test:unit -- --run
```

Expected: All tests pass

---

## Summary

After completing all tasks:

| Metric | Before | After |
|--------|--------|-------|
| System prompt lines | 268 | ~25 |
| file-permission description | 2 lines | 25 lines |
| ask-user-question description | 2 lines | 18 lines |
| SKILL.md files | 2 | 1 (dev-browser only) |

**Total commits:** 5
