// Quick test - run this in browser console (F12) to see current files state
// This will help us diagnose if files are being created/stored properly

// Option 1: Check Render Server Logs
// 1. Go to https://dashboard.render.com → Select CollabCode Server Service
// 2. Click "Logs" tab
// 3. Create files in the UI
// 4. Look for these messages:
//    - "[RoomManager] Persisted 1 files to MongoDB"
//    - "[RoomManager] Persisted 2 files to MongoDB"  ← Second file should show 2 files
//    - Any error messages

// Option 2: Browser Network Tab
// 1. Open F12 → Network tab
// 2. Create first file main.js
// 3. Look for PUT request to /projects/{id} with payload containing files array
// 4. Click to view request body - should show:
//    {
//      "files": [
//        { "name": "main.js", "content": "", "language": "javascript" }
//      ]
//    }
// 5. Create second file utils.js
// 6. New PUT request should show:
//    {
//      "files": [
//        { "name": "main.js", ... },
//        { "name": "utils.js", ... }  ← Both files!
//      ]
//    }

// Option 3: Check MongoDB directly
// If you have MongoDB Atlas admin access:
// 1. Go to Project data → collections → projects
// 2. Find your project
// 3. Look at "files" array → should contain multiple file objects

console.log("Multi-file diagnostic: Check the 3 options above");
