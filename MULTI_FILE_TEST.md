# Multi-File Same Language Test Guide

## Expected Behavior
You should be able to create multiple files with **different names** but the **same language/extension**.

### Test Case 1: JavaScript Files
1. Open Editor
2. Click **+ New File** (in Project Files header)
3. Type: `main.js`
4. Press Enter → **File created ✓**
5. Click **+ New File** again
6. Type: `utils.js`
7. Press Enter → **File should be created ✓**

**Expected Result:** Both `main.js` and `utils.js` appear in file tree

### Test Case 2: Python Files  
1. Create `script1.py`
2. Create `script2.py`

**Expected Result:** Both files appear, separate entries

---

## If Files Aren't Creating:

### Browser Console Check (F12):
Look for errors like:
- ❌ `File "filename" already exists` (wrong - filename is unique)
- ❌ `Duplicate language` (shouldn't happen - our system allows it)
- ❌ Network errors

### Server Logs Check:
```bash
# On Render Dashboard:
# Select Server Service → Logs
# Look for errors when creating 2nd file
```

---

## Possible Issues & Fixes

### Issue: Only 1 file created, 2nd doesn't appear
**Possible Cause:** File creation input modal closes/resets
**Fix:** Click **+ New File** again after creating first file

### Issue: Files appear locally but vanish after reload
**Possible Cause:** Backend validation rejecting duplicate languages
**Fix:** Check server logs for sanitization errors

### Issue: Can't run multiple files together
**Possible Cause:** Execution handler only uses 1 file
**Fix:** Need to update code execution logic

---

## Immediate Next Steps:

1. **Try the test above** → Report what happens
2. **Open browser console** → Copy any error messages
3. **Check Render logs** → Look for 400/422 errors
4. I will patch the issue based on what you find
