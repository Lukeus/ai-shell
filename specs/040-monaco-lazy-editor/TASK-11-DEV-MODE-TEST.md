# Task 11 — Dev Mode Manual Testing Documentation

## Objective
Manually verify Monaco Editor loads correctly in development mode with proper lazy-loading behavior.

## Prerequisites
- All previous tasks (1-10) completed successfully
- Development environment configured
- No TypeScript/ESLint errors

## Test Command
```bash
pnpm dev
```

## Manual Testing Steps

### Step 1: Verify App Launches Without Monaco
**Action**: Start the application using `pnpm dev`

**Expected Result**:
- Application window opens successfully
- No Monaco-related assets loaded on startup
- DevTools Network tab shows NO requests for `monaco-editor` chunks
- Initial bundle size small (no ~3MB Monaco library)

**Verification**:
- [ ] App launches successfully
- [ ] No console errors
- [ ] No Monaco chunks in initial network requests

---

### Step 2: Open Workspace with Files
**Action**: Click "File → Open Workspace" or use File Explorer panel

**Expected Result**:
- Native folder picker dialog appears
- After selection, file tree populates with workspace files
- Still NO Monaco loaded (no editor opened yet)

**Verification**:
- [ ] Workspace opens successfully
- [ ] File tree displays correctly
- [ ] Still no Monaco in Network tab

---

### Step 3: Click on TypeScript File
**Action**: Click on a `.ts` or `.tsx` file in the explorer panel

**Expected Result**:
- Loading spinner appears briefly with "Loading Editor..." message
- IPC call to `fs:read-file` in Network/IPC log
- Monaco chunks begin loading (network requests visible)
- Editor area transitions from placeholder to Monaco editor

**Verification**:
- [ ] Loading spinner visible
- [ ] File content fetched via IPC
- [ ] Monaco chunks load dynamically
- [ ] Editor renders with file content

---

### Step 4: Verify Loading Spinner
**Action**: Observe the loading transition

**Expected Result**:
- Spinner shows "Loading Editor..." text
- Uses CSS variables (P4 compliance): `var(--editor-bg)`, `var(--primary-fg)`
- Smooth transition to loaded editor

**Verification**:
- [ ] Loading state displays correctly
- [ ] CSS variables used (inspect element)
- [ ] No flash of unstyled content

---

### Step 5: Verify Monaco Editor Display
**Action**: Inspect the loaded Monaco editor

**Expected Result**:
- File content displays in editor
- Line numbers visible
- Minimap visible (if enabled in config)
- Editor is read-only (no cursor blinking, can't type)
- Theme: vs-dark

**Verification**:
- [ ] File content renders correctly
- [ ] Line numbers present
- [ ] Read-only mode active
- [ ] Dark theme applied

---

### Step 6: Verify Syntax Highlighting
**Action**: Observe the TypeScript code in the editor

**Expected Result**:
- Keywords highlighted (e.g., `const`, `function`, `import`)
- Strings, numbers, and comments have different colors
- TypeScript-specific syntax colored correctly
- Monaco's TextMate grammar working

**Verification**:
- [ ] Keywords highlighted
- [ ] Strings/numbers colored
- [ ] Syntax highlighting functional

---

### Step 7: Verify IntelliSense (Optional Test)
**Action**: If editor were editable, hover over identifiers or type `const x = `

**Expected Result**:
- IntelliSense popup would appear (if not read-only)
- Type information displayed
- Monaco workers loading (TypeScript worker active)

**Note**: Current implementation is read-only, so IntelliSense won't be interactive. Check DevTools console for worker loading:
```
[Monaco] TypeScript worker loaded
```

**Verification**:
- [ ] No worker errors in console
- [ ] Workers load successfully (check Network tab for worker.js files)

---

### Step 8: Close Tab
**Action**: Click the × button on the editor tab

**Expected Result**:
- Tab closes
- Editor placeholder returns ("No file open")
- No console errors
- Monaco editor instance disposed properly (memory cleanup)

**Verification**:
- [ ] Tab closes cleanly
- [ ] Placeholder shows
- [ ] No console errors
- [ ] No memory leak warnings

---

### Step 9: Open Another File
**Action**: Click on a different file (e.g., `.js`, `.json`, `.md`)

**Expected Result**:
- Editor loads without re-downloading Monaco (already cached)
- Faster load time (no spinner or very brief)
- Language inference works:
  - `.js` → JavaScript highlighting
  - `.json` → JSON highlighting
  - `.md` → Markdown highlighting
- Content updates correctly

**Verification**:
- [ ] Second file loads faster
- [ ] Language inference correct
- [ ] Content displays properly
- [ ] No errors switching files

---

## DevTools Console Verification

### Expected Console Output
```
[Monaco] Loading editor...
[Monaco] Editor initialized
[Monaco] Language: typescript
[Monaco] Worker: typescript.worker.js loaded
```

### NO Errors Expected
- No "Failed to load Monaco"
- No "Could not create web worker"
- No CSP violations
- No module resolution errors

---

## Network Tab Verification

### Initial Load (Before Opening File)
- Main bundle: `index-<hash>.js` (~small size)
- NO Monaco assets

### After Opening File
- `monaco-editor-<hash>.js` (~300-500KB)
- `editor.worker.js` (~100-200KB)
- `ts.worker.js` or `json.worker.js` (language-specific)

---

## Performance Verification

### Metrics to Check (Chrome DevTools → Performance)
1. **Initial Load**: <500ms to interactive (no Monaco)
2. **Monaco Load**: <2 seconds after file open
3. **Memory**: Monaco heap <50MB after initialization

---

## Invariants Verification (Constitution)

### P1 — Process Isolation
- [ ] Renderer remains sandboxed
- [ ] No Node.js APIs accessed from renderer
- [ ] File content fetched via IPC only

### P2 — Security Defaults
- [ ] contextIsolation ON (check main process code)
- [ ] No secrets in console logs
- [ ] CSP allows workers (`worker-src 'self'`)

### P5 — Performance Budgets
- [ ] Monaco NOT loaded on app startup
- [ ] Monaco loads on-demand when file opened
- [ ] Initial bundle small (<1MB)

### P6 — Contracts-First
- [ ] File reading uses existing `window.api.fs.readFile`
- [ ] No new IPC channels added
- [ ] Existing api-contracts used

---

## Test Results

### Date: _________________
### Tester: _________________

| Step | Status | Notes |
|------|--------|-------|
| 1. App launches without Monaco | ☐ Pass ☐ Fail | |
| 2. Open workspace | ☐ Pass ☐ Fail | |
| 3. Open TypeScript file | ☐ Pass ☐ Fail | |
| 4. Loading spinner | ☐ Pass ☐ Fail | |
| 5. Monaco displays | ☐ Pass ☐ Fail | |
| 6. Syntax highlighting | ☐ Pass ☐ Fail | |
| 7. Workers load | ☐ Pass ☐ Fail | |
| 8. Close tab | ☐ Pass ☐ Fail | |
| 9. Open another file | ☐ Pass ☐ Fail | |

### Overall Result
- [ ] ✅ PASS - All steps completed successfully
- [ ] ❌ FAIL - Issues found (see notes)

### Issues Found
_Document any issues, errors, or unexpected behavior:_

---

## Next Steps
- If PASS: Proceed to Task 12 (Test in built app)
- If FAIL: Debug issues, fix code, re-test

---

## Notes
- This is a **manual testing task** that requires human interaction
- Automated E2E tests will be added in Task 13
- DevTools must be open to verify console output and network activity
- Take screenshots of key verification points if needed
