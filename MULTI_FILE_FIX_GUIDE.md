# Multi-File Support Fix & Testing Guide

## 🔧 Changes Made

### 1. Enhanced File Creation Logging (Client)
- **File:** `apps/client/src/renderer/pages/Editor.jsx`
- **Change:** Added detailed console logging to `handleCreateFile`:
  - Logs when file is being created
  - Logs file count before/after
  - Logs when socket event is emitted
  - Logs when saving to server
- **Why:** To trace if files are being created but lost somewhere in the pipeline

### 2. Improved File Persistence Logging (Client)
- **File:** `apps/client/src/renderer/pages/Editor.jsx`
- **Change:** Added detailed console logging to `persistProjectFiles`:
  - Shows which files are being sent to server
  - Logs server response with file count
  - Shows rate limiting or errors
- **Why:** To verify all files reach the server

### 3. Better FileTree Input Handling (Client)
- **File:** `apps/client/src/renderer/components/FileTree.jsx`
- **Changes:**
  - Added dynamic key to input field to force React re-render
  - Added autofocus on input
  - Improved placeholder text with examples
  - Added logging when input is created/cleared
- **Why:** To ensure input properly resets between file creations

### 4. Server Logging (Backend)
- **File:** `apps/server/src/routes/projects.js`
  - Logs files received from client
  - Logs files after sanitization
  - Logs final file count
- **File:** `apps/server/src/sockets/roomManager.js`
  - Logs all files being persisted
  - Shows file names clearly
  - Logs success/failure of persistence
- **Why:** To verify files are properly saved to MongoDB

---

## 📋 Deployment Steps

### Step 1: Push Changes to GitHub
```bash
cd c:\Users\saura\OneDrive\Desktop\collab-code-desktop
git add apps/client/src/renderer/pages/Editor.jsx
git add apps/client/src/renderer/components/FileTree.jsx
git add apps/server/src/routes/projects.js
git add apps/server/src/sockets/roomManager.js
git commit -m "multi-file: add comprehensive logging and input reset fixes"
git push origin main
```

### Step 2: Redeploy Services on Render
1. **Server Service:**
   - Go to Render Dashboard → CollabCode Server
   - Click "Manual Deploy" → "Clear build cache and deploy latest commit"
   - Wait for deployment to complete (2-3 min)

2. **Client (Netlify):**
   - The client builds automatically when you push
   - Or manually: Go to Netlify → Site → Deploys → "Trigger deploy"
   - Wait for build to complete (1-2 min)

---

## 🧪 Testing Multi-File Creation

### Test Case 1: Create Two JavaScript Files
1. **Open Editor** in your app
2. **Create first file:**
   - Click `+ New File` button (top-right of file list)
   - Type: `main.js`
   - Press Enter
   - ✅ File appears in tree

3. **Open Browser Console (F12):**
   - Look for: `[FileCreate] Creating new file: { name: 'main.js', language: 'javascript', id: '...' }`
   - Look for: `[FileTree] Input cleared, ready for next file`

4. **Create second JavaScript file:**
   - Click `+ New File` again
   - Type: `utils.js`
   - Press Enter
   - ✅ Both `main.js` and `utils.js` appear in file tree

5. **Check Console:**
   - Should show `[FileCreate] Total files after: 2`
   - Should show both files: `main.js, utils.js`

### Test Case 2: Create Python Files
Repeat Test Case 1 but with:
- `script1.py`
- `script2.py`

Both should appear and be executable separately.

### Test Case 3: Page Reload Persistence
1. Create `test1.js` and `test2.js` (both JavaScript)
2. Reload the page (F5)
3. ✅ Both files should reappear in file tree
4. Open console: Look for `[Persist] Files saved successfully, server returned 2 files`

---

## 🔍 Debugging: What to Look For

### Browser Console (F12):
```
✅ GOOD:
[FileCreate] Creating new file: { name: 'utils.js', language: 'javascript', id: '...' }
[FileCreate] Total files before: 1
[FileCreate] Total files after: 2
[FileCreate] Updated files list: [{name: "main.js", language: "javascript"}, {name: "utils.js", language: "javascript"}]
[FileCreate] Saving project with 2 files
[Persist] Saving 2 files to server: main.js, utils.js

❌ BAD:
File "utils.js" already exists (wrong - name is unique)
[Persist] Saving 1 files to server (should be 2!)
```

### Render Server Logs:
Go to Render Dashboard → Server → Logs. Look for:
```
✅ GOOD:
[ProjectsRoute] Received 2 files from client, after sanitization: 2 files
[ProjectsRoute] Files being saved: main.js, utils.js
[ProjectsRoute] Project updated with 2 files

❌ BAD:
[ProjectsRoute] Received 2 files from client, after sanitization: 1 files (file loss!)
```

---

## ✅ Success Criteria

You'll know it's working when:
1. ✅ You can create 2+ files with same language (e.g., two .js files)
2. ✅ All files appear in the file tree
3. ✅ Files persist after page reload
4. ✅ Browser console shows "2 files" when there are 2
5. ✅ Server logs show "2 files" being persisted
6. ✅ You can switch between files and edit each one
7. ✅ You can run each file independently

---

## 🚀 Next Steps (After Deployment)

1. **Test locally** using the steps above
2. **Check logs** at each step
3. **Report findings** with:
   - Number of files created
   - Browser console output
   - Render server log output
   - Any error messages
4. **If working:** Test multi-file execution (running different files)
5. **If not working:** Share log output and I'll patch the issue

---

## ⏱️ Timeline
- Push + Deploy: ~5 minutes
- Testing: ~5 minutes
- Total: ~10 minutes

Good luck! 🎉
