# Troubleshooting Guide

## Issue: Logs Still Appearing After Fixes

### Problem
Console logs that were removed from the code are still showing in the browser.

### Cause
Browser is serving **cached JavaScript files**.

### Solution

#### Option 1: Hard Refresh (Quickest)
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`

#### Option 2: Clear Cache via DevTools
1. Open Developer Tools (`F12`)
2. Right-click the **Refresh** button
3. Select **"Empty Cache and Hard Reload"**

#### Option 3: Clear All Cache
1. Open DevTools (`F12`)
2. Go to **Application** tab
3. Click **Clear storage**
4. Check all boxes
5. Click **Clear site data**

#### Option 4: Disable Cache (Development)
1. Open DevTools (`F12`)
2. Go to **Network** tab
3. Check **"Disable cache"** checkbox
4. Keep DevTools open while developing

---

## Issue: Prototype Preview Shows Plain Text (No Styling)

### Problem
The preview window shows content but without any CSS styling - just plain black text on white background.

### Causes & Solutions

#### Cause 1: Backend Not Running
**Check:**
```bash
lsof -ti:3002  # Should show process IDs
```

**Solution:**
```bash
cd server
npm run dev
```

#### Cause 2: HTML Generated Without CSS
The AI might be generating HTML without including `<style>` tags or CSS.

**Check the generated HTML:**
1. Open the preview that failed
2. Open DevTools → Elements tab
3. Look at the HTML structure
4. Check if there are `<style>` tags or linked CSS

**Possible fixes:**
- The blueprint generation prompt might need to explicitly request CSS
- Check `server/src/services/preview-generator/` for the generation logic

#### Cause 3: CSP (Content Security Policy) Blocking Styles
**Check console for errors like:**
```
Refused to apply inline style because it violates Content Security Policy
```

**Solution:**
The iframe needs proper CSP headers. Check [client/src/components/PreviewFrame.tsx](client/src/components/PreviewFrame.tsx) for sandbox attributes.

#### Cause 4: iframe Sandbox Restrictions
**Current sandbox settings** should include:
```tsx
sandbox="allow-scripts allow-same-origin allow-forms"
```

If styles are inline, ensure the iframe allows them.

---

## Issue: TypeScript/Build Errors

### Problem
Build fails or shows TypeScript errors.

### Solution
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

---

## Issue: Port Already in Use

### Problem
```
Error: listen EADDRINUSE: address already in use :::3002
```

### Solution
```bash
# Find and kill the process
lsof -ti:3002 | xargs kill -9

# Or use different port
PORT=3003 npm run dev
```

---

## Quick Diagnostic Commands

```bash
# Check if frontend is running
lsof -ti:5173

# Check if backend is running
lsof -ti:3002

# View backend logs
cd server && npm run dev

# View frontend logs
cd client && npm run dev

# Full rebuild
npm run clean && npm run build:prod

# Test production build locally
npm run preview:client  # Frontend preview
npm run start:prod      # Backend production
```

---

## Common Development Issues

### Vite HMR Not Working
**Solution:** Restart the dev server
```bash
pkill -f vite
npm run dev
```

### MongoDB Connection Error
**Solution:** Check `.env` file has correct `MONGODB_URI`

### API Calls Failing (CORS)
**Solution:** Backend must be running on correct port (3002)

---

## Browser-Specific Issues

### Chrome/Edge
- Clear cache: `Cmd/Ctrl + Shift + Delete`
- Hard reload: `Cmd/Ctrl + Shift + R`
- Disable cache in DevTools Network tab

### Firefox
- Clear cache: `Cmd/Ctrl + Shift + Delete`
- Hard reload: `Cmd/Ctrl + F5`

### Safari
- Clear cache: `Cmd + Option + E`
- Hard reload: `Cmd + R` (hold Shift)
- Enable Develop menu: Preferences → Advanced → "Show Develop menu"

---

## Still Having Issues?

1. **Check console for errors** - F12 → Console tab
2. **Check network tab** - F12 → Network tab (see failed requests)
3. **Check server terminal** - Look for backend errors
4. **Clear everything and restart:**
   ```bash
   # Kill all processes
   pkill -f vite
   pkill -f node

   # Clear caches
   rm -rf node_modules/.vite
   rm -rf client/dist
   rm -rf server/dist

   # Reinstall and restart
   npm install
   npm run dev
   ```
