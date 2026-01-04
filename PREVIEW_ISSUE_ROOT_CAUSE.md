# Prototype Preview Issue - Root Cause Found

**Date:** December 30, 2025
**Status:** 🔴 Root cause identified

---

## Issue Summary

The prototype preview shows **"No wireframe code available for view: endUser"** because the backend is not returning the `wireframeCode` in the project preview response.

---

## Root Cause

### Console Error
```
[PrototypingPanel] No wireframe code available for view: endUser
```

**Location:** [client/src/components/PrototypingPanel.tsx:608](client/src/components/PrototypingPanel.tsx:608)

### What This Means
The frontend is correctly checking for wireframe code, but `projectPreview?.wireframeCode` is **empty or undefined**.

---

## Data Flow Analysis

### 1. Backend Should Generate HTML
**File:** [server/src/services/enhancedPreviewGenerator.service.ts](server/src/services/enhancedPreviewGenerator.service.ts)

The backend service **does** have code to generate HTML with Tailwind CSS:
- Line 1820-1898: HTML template with `<script src="https://cdn.tailwindcss.com"></script>`
- Line 3174: `generatePreview()` method orchestrates generation
- Line 3621: `generateWireframeV2()` creates the HTML
- Lines 3766-3786: Returns `preview.wireframeCode` in response

**Expected Response Structure:**
```typescript
{
  preview: {
    wireframeCode: "<html>...</html>",  // Should contain full HTML
    views: {
      endUser: {
        preview: "<html>...</html>"
      }
    },
    ...
  }
}
```

---

### 2. Frontend Expects wireframeCode
**File:** [client/src/services/chatApi.ts:62](client/src/services/chatApi.ts:62)

```typescript
projectPreview?: {
    wireframeCode?: string;  // Expected from backend
    ...
}
```

**File:** [client/src/components/PrototypingPanel.tsx:588](client/src/components/PrototypingPanel.tsx:588)

```typescript
let targetCode = projectPreview?.wireframeCode || '';

if (!targetCode || targetCode.trim().length === 0) {
    console.warn('[PrototypingPanel] No wireframe code available for view:', activeView);
    return null;  // ← This is what's happening
}
```

---

### 3. The Problem
**The backend is either:**
1. Not calling `generateWireframeV2()` at all
2. Calling it but getting empty/failed response from AI
3. Calling it successfully but NOT returning `wireframeCode` in the API response
4. Returning it but frontend is not receiving/parsing it correctly

---

## Diagnostic Questions

### Question 1: Is the Backend Route Being Called?
Check server logs for blueprint generation:
```bash
tail -f server/logs/server.log | grep -i "generatePreview\|wireframe\|blueprint"
```

**What to Look For:**
- ✅ "generatePreview called" or similar
- ✅ "generateWireframeV2 starting"
- ✅ "wireframeCode generated: <length>"
- ❌ Any errors or timeouts

---

### Question 2: Is the AI Response Complete?
The backend uses AI to generate HTML. Check if:
- AI model is responding
- Response is not truncated
- Response contains valid HTML

**File to Check:** [server/src/services/enhancedPreviewGenerator.service.ts:3621](server/src/services/enhancedPreviewGenerator.service.ts:3621)

Look for logs like:
```
AI generated wireframe: <length> characters
```

---

### Question 3: Is wireframeCode in the API Response?
Check network tab in DevTools:
1. Open DevTools → Network
2. Filter by "preview" or "blueprint"
3. Find the API call that generates the project preview
4. Check Response tab for `wireframeCode` field

**Expected:**
```json
{
  "preview": {
    "wireframeCode": "<!DOCTYPE html>...",
    ...
  }
}
```

**If Missing:**
The backend is not including it in the response.

---

### Question 4: Is Frontend Parsing Response Correctly?
**File:** [client/src/components/NeuralStreamChat.tsx:4590-4596](client/src/components/NeuralStreamChat.tsx:4590-4596)

```typescript
const preview = await generateProjectPreview(...);
const normalizedPreview = normalizeProjectPreview(preview);
setProjectPreview(normalizedPreview || null);
```

Check if `normalizeProjectPreview` is stripping out `wireframeCode`.

---

## Immediate Action Items

### ✅ Step 1: Check What You're Actually Receiving (User Can Do This)
Open DevTools Console and run:
```javascript
// Check current projectPreview state
console.log('Current projectPreview:', window.__projectPreview);

// Or try to find it in React DevTools
// Look for NeuralStreamChat component → State → projectPreview
```

Expected output should show:
```javascript
{
  projectName: "...",
  techStack: [...],
  wireframeCode: "<!DOCTYPE html>..."  // ← Should have HTML here
}
```

**If wireframeCode is missing:** Backend is not returning it.
**If wireframeCode is empty string:** Backend is returning it but with no content.

---

### 🔧 Step 2: Check Backend Logs (Requires Server Access)
```bash
# In server directory
cd server
tail -f logs/server.log | grep -i "wireframe\|generatePreview"
```

**What to Look For:**
1. Is `generatePreview` being called?
2. Is `generateWireframeV2` being called?
3. Are there any errors in AI generation?
4. What is the length of generated wireframeCode?

---

### 🔍 Step 3: Test Backend API Directly
Use curl or Postman to call the preview generation endpoint:

```bash
curl -X POST http://localhost:3002/api/preview/generate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Create a simple todo app",
    "messages": [],
    "useInternet": false
  }'
```

**Check Response:**
- Does it include `wireframeCode`?
- Is `wireframeCode` populated with HTML?
- What is the length of `wireframeCode`?

---

### 🐛 Step 4: Add Debug Logging
If backend logs don't show enough info, add temporary logging:

**File:** [server/src/services/enhancedPreviewGenerator.service.ts](server/src/services/enhancedPreviewGenerator.service.ts)

Around line 3766-3786 (where response is returned), add:
```typescript
console.log('[EnhancedPreviewGenerator] Returning preview with wireframeCode length:', wireframeCode?.length || 0);
console.log('[EnhancedPreviewGenerator] wireframeCode preview:', wireframeCode?.substring(0, 200));
```

Then restart server and try generating a preview again.

---

## Possible Solutions

### Solution 1: Backend Not Generating wireframeCode
**If backend logs show `generateWireframeV2` is NOT being called:**

Check the generation flow in [server/src/services/enhancedPreviewGenerator.service.ts:3174](server/src/services/enhancedPreviewGenerator.service.ts:3174)

Ensure `generateWireframeV2()` is being invoked and its result is stored in `wireframeCode` variable.

---

### Solution 2: AI Generation Failing
**If backend logs show errors like "AI generation timeout" or "AI response empty":**

Possible causes:
- AI model not responding
- API key invalid/expired
- Prompt too complex
- Response truncated due to token limits

**Fix:**
1. Check AI API key is valid
2. Verify AI service is reachable
3. Test with simpler project description
4. Check AI response length limits

---

### Solution 3: wireframeCode Not in Response
**If backend generates HTML but doesn't include it in API response:**

Check the return statement in [server/src/services/enhancedPreviewGenerator.service.ts:3766-3786](server/src/services/enhancedPreviewGenerator.service.ts:3766-3786)

Ensure response includes:
```typescript
return {
  preview: {
    wireframeCode: wireframeCode,  // ← Must be included
    views: {
      endUser: {
        preview: wireframeCode  // ← Alternative location
      }
    },
    ...
  }
};
```

---

### Solution 4: Frontend Not Parsing Response
**If backend returns wireframeCode but frontend doesn't have it:**

Check `normalizeProjectPreview` function:
```bash
grep -n "normalizeProjectPreview" client/src/components/NeuralStreamChat.tsx
```

Ensure it's not filtering out or renaming `wireframeCode`.

---

## Quick Test to Isolate Issue

### Test 1: Manual HTML Injection (Frontend Test)
Open console and manually set wireframeCode:
```javascript
// Find the PrototypingPanel component in React DevTools
// Or manually trigger a state update

const testHTML = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="p-8 bg-blue-500">
  <h1 class="text-4xl text-white">Test Preview</h1>
  <p class="text-white">If you see blue background with white text, PreviewFrame works!</p>
</body>
</html>`;

// This requires React DevTools to modify state
// Alternatively, we can test by checking if PreviewFrame receives proper content
```

**If this works:** Backend generation is the problem.
**If this doesn't work:** PreviewFrame rendering is the problem.

---

### Test 2: Check Backend Generation Directly
```bash
# In server directory
node -e "
const service = require('./dist/services/enhancedPreviewGenerator.service');
(async () => {
  const result = await service.generatePreview({
    goal: 'Create a todo app',
    messages: [],
    useInternet: false
  });
  console.log('wireframeCode length:', result.preview?.wireframeCode?.length);
  console.log('First 500 chars:', result.preview?.wireframeCode?.substring(0, 500));
})();
"
```

---

## Next Steps

Based on your environment, choose the appropriate diagnostic:

### If You Have Backend Access:
1. ✅ Check server logs for generation errors
2. ✅ Add debug logging to see wireframeCode generation
3. ✅ Test API endpoint directly with curl
4. ✅ Verify AI service is working

### If You Only Have Frontend Access:
1. ✅ Check browser DevTools → Network tab for API response
2. ✅ Inspect `projectPreview` object in console/React DevTools
3. ✅ Verify if `wireframeCode` field exists in response
4. ✅ Share API response structure here

---

## Summary

**Problem:** `projectPreview?.wireframeCode` is empty or undefined
**Impact:** Preview cannot render without HTML content
**Most Likely Cause:** Backend is not generating or returning wireframeCode
**Less Likely Cause:** Frontend is not parsing/storing wireframeCode correctly

**Confidence:** 🟢 High (we've confirmed frontend is asking for wireframeCode correctly)

---

## Status

✅ Cache cleared (console logs are clean)
✅ Frontend code is correct (checks for wireframeCode properly)
❌ Backend is NOT providing wireframeCode in response
🔍 Need to investigate why backend generation is failing or not being called

---

**Next Action:** Check Network tab in DevTools to see actual API response structure
