# Fix Reload Loop Issue

If your app is stuck in a reload loop, follow these steps:

## Quick Fix (Recommended)

### Option 1: Use the Web Tool
1. Open: `http://localhost:5173/clear-service-worker.html`
2. Click "Clear All Service Workers & Caches"
3. Wait for the page to reload automatically

### Option 2: Manual Browser Clear

**Chrome/Edge:**
1. Press `F12` (or `Cmd+Option+I` on Mac) to open DevTools
2. Go to **Application** tab
3. Click **Service Workers** in the left sidebar
4. Click **Unregister** on all service workers
5. Click **Clear storage** in the left sidebar
6. Check all boxes and click **Clear site data**
7. Close DevTools and hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

**Firefox:**
1. Press `F12` to open DevTools
2. Go to **Storage** tab
3. Expand **Service Workers**
4. Right-click each service worker and select **Unregister**
5. Click **Clear All** button
6. Close DevTools and hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

**Safari:**
1. Enable Developer menu: Preferences → Advanced → Show Develop menu
2. Develop → Empty Caches
3. Develop → Disable Service Workers
4. Hard refresh: `Cmd+Shift+R`

## What Was Fixed

The following changes were made to prevent reload loops:

1. **Service Worker in Development**: Now automatically unregisters itself in development mode
2. **Pre-Load Script**: Added script that unregisters service workers before React loads
3. **No Auto-Reload**: Service worker no longer forces page reloads on update
4. **Reload Loop Detection**: Added detection to stop infinite reloads

## Prevention

The app now:
- ✅ Automatically disables service workers in development (localhost)
- ✅ Prevents service worker from forcing reloads
- ✅ Clears old service workers on page load in development
- ✅ Detects and stops reload loops automatically

## If Problem Persists

1. **Clear browser data completely:**
   - Chrome: Settings → Privacy → Clear browsing data → All time
   - Firefox: Settings → Privacy → Clear Data
   - Safari: Develop → Empty Caches

2. **Restart your browser completely**

3. **Check for browser extensions** that might interfere

4. **Try incognito/private mode** to rule out extensions

5. **Check console for errors:**
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

## Technical Details

The reload loop was caused by:
- Service worker using `skipWaiting()` and `clients.claim()` which forced immediate activation
- Service worker registration triggering updates that caused reloads
- No detection/prevention of infinite reload loops

All of these have been fixed.

