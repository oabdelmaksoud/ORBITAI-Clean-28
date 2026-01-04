# Prototype Preview Styling Diagnostic Guide

## Date
December 30, 2025

## Issue Summary
User reports that the prototype preview window shows plain text without CSS styling, with error: "Page failed to render: Page appears blank (text: 0 chars, elements: 1, interactive: 0)"

## Architecture Flow

### How Prototypes Are Generated and Displayed

1. **Backend Generation** ([server/src/services/enhancedPreviewGenerator.service.ts](server/src/services/enhancedPreviewGenerator.service.ts))
   - `generatePreview()` method (line 3174) orchestrates generation
   - `generateWireframeV2()` creates full HTML with CSS (line 1820-1898)
   - Template includes:
     ```html
     <script src="https://cdn.tailwindcss.com"></script>
     <style>
       :root { --primary: #3b82f6; --secondary: #8b5cf6; --accent: #ec4899; }
       .glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.1); }
     </style>
     ```
   - Returns `preview.wireframeCode` containing complete HTML

2. **Frontend Display** ([client/src/components/PreviewFrame.tsx](client/src/components/PreviewFrame.tsx))
   - Receives `wireframeCode` as `artifact.content` (line 636)
   - Processes HTML through `generateHtmlContent()` (line 385)
   - Renders in iframe using `srcDoc` attribute (line 1915)

## Diagnostic Steps

### Step 1: Verify Browser Cache is Cleared

**Why:** Your screenshot shows console logs that were removed in the performance fixes, indicating cached JavaScript.

**How to Clear:**
```bash
# Mac
Cmd + Shift + R

# Windows/Linux
Ctrl + Shift + R
```

**Alternative:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Expected Result:** Console should stop showing:
- "Save effect triggered"
- "Scheduling save"
- "Cannot save conversation - user not authenticated"
- Excessive render logs

---

### Step 2: Inspect Generated HTML Content

**Purpose:** Verify backend is generating HTML with CSS

**How to Check:**
1. Open DevTools Console
2. Run this command:
```javascript
// Check if preview has wireframeCode
const preview = window.lastGeneratedPreview; // This may vary
console.log('Has wireframeCode:', !!preview?.wireframeCode);
console.log('HTML length:', preview?.wireframeCode?.length);
console.log('Has Tailwind:', preview?.wireframeCode?.includes('tailwindcss.com'));
console.log('First 500 chars:', preview?.wireframeCode?.substring(0, 500));
```

**Expected Result:**
- `Has wireframeCode: true`
- `HTML length:` should be > 1000 characters
- `Has Tailwind: true`
- HTML should start with `<!DOCTYPE html>` or contain `<script src="https://cdn.tailwindcss.com"></script>`

---

### Step 3: Inspect Iframe Content

**Purpose:** See what's actually being rendered in the iframe

**How to Check:**
1. Open DevTools
2. In Elements tab, find the `<iframe>` element
3. Look for `srcdoc` attribute - it should contain full HTML
4. Right-click iframe → "Inspect iframe content"

**Alternative Method (Console):**
```javascript
// Get the iframe
const iframe = document.querySelector('iframe[title="Interactive Prototype Preview"]');
if (iframe) {
    console.log('srcDoc length:', iframe.getAttribute('srcdoc')?.length);
    console.log('srcDoc has Tailwind:', iframe.getAttribute('srcdoc')?.includes('tailwindcss'));
    console.log('First 500 chars:', iframe.getAttribute('srcdoc')?.substring(0, 500));
}
```

**Expected Result:**
- `srcDoc` should contain full HTML document
- Should include `<script src="https://cdn.tailwindcss.com"></script>`

---

### Step 4: Check for Content Security Policy Issues

**Purpose:** Verify CSP isn't blocking external CSS/scripts

**How to Check:**
1. Open DevTools Console
2. Look for CSP errors (they appear in red)
3. Check Network tab for failed requests to `cdn.tailwindcss.com`

**What to Look For:**
- ❌ `Refused to load the script 'https://cdn.tailwindcss.com'`
- ❌ `Content Security Policy blocked...`
- ❌ Failed requests (red) in Network tab

**Expected Result:** No CSP errors, Tailwind CDN loads successfully (200 status)

---

### Step 5: Check Network Connectivity to CDN

**Purpose:** Ensure Tailwind CSS CDN is reachable

**How to Check:**
1. Open DevTools → Network tab
2. Filter by "tailwindcss"
3. Refresh preview
4. Check status of `cdn.tailwindcss.com` request

**Expected Result:**
- Status: 200 (green)
- Type: script
- Size: ~50-100 KB

**If Failed:**
- Status: Failed or (blocked)
- This indicates network/firewall blocking CDN

---

### Step 6: Test with Manual HTML

**Purpose:** Isolate whether issue is with generation or rendering

**How to Test:**
1. Create a simple test HTML:
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div class="p-8 bg-blue-500 text-white text-2xl">
    Test: If this is blue with padding, Tailwind works!
  </div>
</body>
</html>
```

2. Save as `test.html`
3. Open in browser directly
4. Also test in your app's preview iframe

**Expected Result:**
- Blue background box with white text
- If this works in browser but NOT in iframe → iframe/CSP issue
- If this works nowhere → CDN/network issue

---

### Step 7: Check PreviewFrame Console Logs

**Purpose:** See what PreviewFrame component is receiving

**How to Check:**
PreviewFrame.tsx logs diagnostic info at line 49-56. Check console for:

```
[PreviewFrame] Rendering artifact: {
  hasArtifact: true,
  contentLength: <number>,
  contentPreview: "<first 100 chars>",
  artifactType: "wireframe",
  ...
}
```

**Expected Result:**
- `hasArtifact: true`
- `contentLength: > 1000`
- `contentPreview` should show HTML with `<!DOCTYPE` or `<script src=`

**If Problems:**
- `contentLength: 0` → Backend didn't generate HTML
- `contentLength: < 100` → HTML generation incomplete
- `contentPreview` shows plain text → Generation failed

---

## Common Issues and Solutions

### Issue 1: Browser Cache (Most Likely)
**Symptoms:**
- Console shows removed logs
- Old behavior persists after code changes

**Solution:**
```bash
# Hard refresh
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows)

# Or: DevTools → Network tab → Check "Disable cache"
```

---

### Issue 2: Empty or Malformed HTML
**Symptoms:**
- `contentLength: 0` or very small
- "Page appears blank" error

**Solution:**
1. Check backend logs for generation errors
2. Verify `generateWireframeV2()` is being called
3. Check if AI model response is complete
4. Look for truncation in API response

**Backend Check:**
```bash
# In server logs, look for:
grep "generateWireframeV2" server.log
grep "wireframeCode" server.log
```

---

### Issue 3: CSP Blocking External Resources
**Symptoms:**
- Console errors: "Refused to load"
- Network tab shows blocked requests
- HTML exists but no styling

**Solution:**
1. Check app's CSP headers in Network → Response Headers
2. Ensure CSP allows `cdn.tailwindcss.com`
3. If using strict CSP, add:
```
Content-Security-Policy: script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline'
```

---

### Issue 4: Network/Firewall Blocking CDN
**Symptoms:**
- Tailwind CDN request fails in Network tab
- Works in one environment but not another
- Offline or restricted network

**Solution:**
1. Test CDN access directly: `curl https://cdn.tailwindcss.com`
2. Check corporate firewall/proxy settings
3. Consider self-hosting Tailwind as fallback

**Alternative Approach:**
Instead of CDN, bundle Tailwind in the app (requires build changes)

---

### Issue 5: Iframe Sandbox Restrictions
**Symptoms:**
- HTML loads but scripts don't execute
- No console errors but no styling

**Solution:**
Check iframe sandbox attribute at [PreviewFrame.tsx:1915](client/src/components/PreviewFrame.tsx:1915)
```javascript
// Currently: No sandbox (allows everything)
<iframe srcDoc={htmlContentForSrcdoc} allowFullScreen />

// If sandbox exists, ensure it allows scripts:
<iframe sandbox="allow-scripts allow-same-origin" srcDoc={...} />
```

**Note:** The code currently has NO sandbox attribute, so this is unlikely the issue.

---

## Immediate Next Steps

Based on your screenshot, here's what to do RIGHT NOW:

### 1. Clear Browser Cache (CRITICAL)
```
Press: Cmd + Shift + R (Mac) or Ctrl + Shift + R (Windows)
```

Your console shows logs that were removed, proving you're running cached code.

### 2. Open DevTools Console
After cache clear, run:
```javascript
// Check if backend generated HTML
const iframe = document.querySelector('iframe[title="Interactive Prototype Preview"]');
console.log('Iframe srcDoc:', iframe?.getAttribute('srcDoc')?.substring(0, 500));
```

### 3. Check Network Tab
1. Open DevTools → Network
2. Refresh preview
3. Look for request to `cdn.tailwindcss.com`
4. Check status (should be 200)

### 4. Report Back
After doing steps 1-3, report:
- Did cache clear fix the console logs?
- What does the iframe srcDoc show?
- Did Tailwind CDN load successfully (200 status)?

---

## Technical Reference

### File Locations

**Backend HTML Generation:**
- [server/src/services/enhancedPreviewGenerator.service.ts](server/src/services/enhancedPreviewGenerator.service.ts)
- Line 1820-1898: HTML template with Tailwind
- Line 3174: `generatePreview()` entry point
- Line 3621: `generateWireframeV2()` call

**Frontend Rendering:**
- [client/src/components/PreviewFrame.tsx](client/src/components/PreviewFrame.tsx)
- Line 385: `generateHtmlContent()` processes HTML
- Line 636: Receives `wireframeCode` as artifact content
- Line 1915: Renders iframe with `srcDoc`

**Data Flow:**
1. Backend: `enhancedPreviewGenerator.service.ts` → `preview.wireframeCode`
2. API: Returns `{ preview: { wireframeCode: "<html>..." } }`
3. Frontend: `NeuralStreamChat.tsx` receives preview
4. Frontend: Passes to `PrototypePreviewToast.tsx`
5. Frontend: Renders in `PreviewFrame.tsx` via iframe

---

## Debug Commands

### Check Preview Data in Console
```javascript
// Find the preview object
console.log('lastProjectPreview:', window.lastProjectPreview);

// Manually inspect wireframeCode
const code = window.lastProjectPreview?.wireframeCode;
console.log('Has code:', !!code);
console.log('Code length:', code?.length);
console.log('Has DOCTYPE:', code?.includes('<!DOCTYPE'));
console.log('Has Tailwind:', code?.includes('tailwindcss.com'));
console.log('First 1000 chars:', code?.substring(0, 1000));
```

### Force Preview Refresh
```javascript
// Trigger iframe reload
const iframe = document.querySelector('iframe[title="Interactive Prototype Preview"]');
iframe?.contentWindow?.location.reload();
```

### Check for React Errors
```javascript
// Look for React error boundaries
console.log('React errors:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.rendererInterfaces);
```

---

## Contact/Support

If issue persists after trying all diagnostic steps:

1. **Capture diagnostics:**
   - Console logs (after cache clear)
   - Network tab screenshot
   - Result of iframe srcDoc check

2. **Check backend logs:**
```bash
# In server directory
tail -f logs/server.log | grep -i "wireframe\|preview\|generate"
```

3. **Verify environment:**
   - Node version: `node --version` (should be 18+)
   - Browser version
   - Operating system
   - Network restrictions (corporate firewall, VPN, etc.)

---

## Success Checklist

✅ **Browser cache cleared** (no old console logs)
✅ **Backend generates HTML** (contentLength > 1000)
✅ **HTML includes Tailwind CDN** (`<script src="https://cdn.tailwindcss.com">`)
✅ **Iframe receives HTML** (srcDoc attribute populated)
✅ **Tailwind CDN loads** (200 status in Network tab)
✅ **No CSP errors** (no "Refused to load" in console)
✅ **Preview displays styled content** (not plain text)

Once all items are checked, the preview should display properly with full Tailwind styling.
