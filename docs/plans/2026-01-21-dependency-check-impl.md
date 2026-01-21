# Dependency Check Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fail fast at dev startup if dependencies are out of sync with lockfile.

**Architecture:** Store hash of `pnpm-lock.yaml` in `node_modules/.lockfile-hash` after install. Before dev, compare hashes. Mismatch = error with clear message.

**Tech Stack:** Node.js scripts (CommonJS for broad compatibility)

---

### Task 1: Create scripts directory

**Files:**
- Create: `scripts/` directory

**Step 1: Create directory**

Run: `mkdir scripts`

**Step 2: Commit**

```bash
git add -N scripts && git commit --allow-empty -m "chore: add scripts directory"
```

---

### Task 2: Create save-lockfile-hash.cjs

**Files:**
- Create: `scripts/save-lockfile-hash.cjs`

**Step 1: Write the script**

```javascript
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const lockfilePath = path.join(__dirname, '..', 'pnpm-lock.yaml');
const hashPath = path.join(__dirname, '..', 'node_modules', '.lockfile-hash');

const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
const hash = crypto.createHash('sha256').update(lockfileContent).digest('hex').slice(0, 16);

fs.writeFileSync(hashPath, hash);
console.log('Lockfile hash saved:', hash);
```

**Step 2: Test manually**

Run: `node scripts/save-lockfile-hash.cjs`
Expected: "Lockfile hash saved: <16-char-hash>"

**Step 3: Verify hash file created**

Run: `cat node_modules/.lockfile-hash`
Expected: 16-character hex string

**Step 4: Commit**

```bash
git add scripts/save-lockfile-hash.cjs
git commit -m "feat: add save-lockfile-hash script"
```

---

### Task 3: Create check-deps.cjs

**Files:**
- Create: `scripts/check-deps.cjs`

**Step 1: Write the script**

```javascript
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const lockfilePath = path.join(__dirname, '..', 'pnpm-lock.yaml');
const hashPath = path.join(__dirname, '..', 'node_modules', '.lockfile-hash');

// Compute current lockfile hash
const lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
const currentHash = crypto.createHash('sha256').update(lockfileContent).digest('hex').slice(0, 16);

// Check if hash file exists
if (!fs.existsSync(hashPath)) {
  console.error('\n❌ Dependencies not installed. Run: pnpm install\n');
  process.exit(1);
}

// Compare hashes
const storedHash = fs.readFileSync(hashPath, 'utf8').trim();
if (storedHash !== currentHash) {
  console.error('\n❌ Dependencies out of sync. Run: pnpm install\n');
  process.exit(1);
}

console.log('✓ Dependencies in sync');
```

**Step 2: Test with matching hash**

Run: `node scripts/check-deps.cjs`
Expected: "✓ Dependencies in sync" (exit 0)

**Step 3: Test with missing hash file**

Run: `rm node_modules/.lockfile-hash && node scripts/check-deps.cjs`
Expected: "❌ Dependencies not installed. Run: pnpm install" (exit 1)

**Step 4: Restore hash file**

Run: `node scripts/save-lockfile-hash.cjs`

**Step 5: Test with mismatched hash**

Run: `echo "badhash" > node_modules/.lockfile-hash && node scripts/check-deps.cjs`
Expected: "❌ Dependencies out of sync. Run: pnpm install" (exit 1)

**Step 6: Restore correct hash**

Run: `node scripts/save-lockfile-hash.cjs`

**Step 7: Commit**

```bash
git add scripts/check-deps.cjs
git commit -m "feat: add check-deps script"
```

---

### Task 4: Wire up package.json scripts

**Files:**
- Modify: `package.json`

**Step 1: Add predev and update postinstall**

In `package.json`, update the scripts section:

```json
"scripts": {
  "predev": "node scripts/check-deps.cjs",
  "dev": "pnpm -F @accomplish/desktop dev",
  "dev:clean": "pnpm -F @accomplish/desktop dev:clean",
  "postinstall": "node scripts/save-lockfile-hash.cjs",
  "build": "pnpm -r build",
  "build:desktop": "pnpm -F @accomplish/desktop build",
  "lint": "pnpm -r lint",
  "typecheck": "pnpm -r typecheck",
  "clean": "pnpm -r clean && rm -rf node_modules"
}
```

**Step 2: Verify predev runs before dev**

Run: `pnpm dev` (then Ctrl+C after seeing deps check pass)
Expected: First line shows "✓ Dependencies in sync", then dev starts

**Step 3: Verify postinstall runs**

Run: `pnpm install`
Expected: Near end of output, see "Lockfile hash saved: <hash>"

**Step 4: Commit**

```bash
git add package.json
git commit -m "feat: wire up dep check to dev and postinstall"
```

---

### Task 5: Final integration test

**Step 1: Simulate the problem scenario**

```bash
# Corrupt the hash to simulate outdated deps
echo "stale" > node_modules/.lockfile-hash
```

**Step 2: Run dev and verify it fails**

Run: `pnpm dev`
Expected: "❌ Dependencies out of sync. Run: pnpm install" (exits, dev never starts)

**Step 3: Run install and verify it fixes**

Run: `pnpm install`
Expected: Hash file updated

**Step 4: Run dev and verify it succeeds**

Run: `pnpm dev` (Ctrl+C after seeing success)
Expected: "✓ Dependencies in sync", then dev starts normally

**Step 5: Final commit if any cleanup needed**

No commit needed if all prior steps were committed.

---

## Summary

| File | Purpose |
|------|---------|
| `scripts/save-lockfile-hash.cjs` | Saves lockfile hash after install |
| `scripts/check-deps.cjs` | Checks hash before dev, fails if mismatch |
| `package.json` | Wires predev + postinstall hooks |
