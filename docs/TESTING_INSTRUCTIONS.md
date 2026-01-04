# Testing Instructions

## ✅ Frontend Server Status

The frontend development server is **running** and accessible at:
- **URL**: http://localhost:5174
- **Status**: ✅ Active

## ⚠️ Backend Server Status

The backend server is **not currently running**. To test full functionality, you'll need to start it.

### Starting the Backend Server

1. **Open a new terminal** (keep the frontend server running)

2. **Navigate to the server directory**:
   ```bash
   cd server
   ```

3. **Start the backend server**:
   ```bash
   npm run dev
   ```

4. **Verify it's running**:
   - Backend should be available at: http://localhost:3002
   - Health check: http://localhost:3002/health
   - API base: http://localhost:3002/api

### Backend Requirements

Before starting the backend, ensure you have:

1. **MongoDB Connection**:
   - Set `MONGODB_URI` in `server/.env`
   - Or use local MongoDB with Docker: `docker-compose up -d mongodb`

2. **Environment Variables** (optional but recommended):
   - `JWT_SECRET` - For authentication
   - `API_KEY_ENCRYPTION_KEY` - For secure API key storage (required in production)

## Testing in Browser

### Current Status
- ✅ Frontend: Running on http://localhost:5174
- ❌ Backend: Not running (needed for full functionality)

### What You Can Test Now

Even without the backend, you can test:
- ✅ Landing page UI
- ✅ Navigation
- ✅ Static content
- ✅ Frontend routing
- ✅ UI components

### What Requires Backend

These features need the backend server:
- ❌ User authentication (Sign Up / Sign In)
- ❌ Project creation and management
- ❌ API calls
- ❌ Real-time features (WebSocket)
- ❌ Data persistence

## Quick Test Checklist

### Frontend Only (Current State)
- [x] Landing page loads
- [x] Navigation works
- [x] UI renders correctly
- [ ] Sign Up button (will fail without backend)
- [ ] Sign In button (will fail without backend)

### Full Stack (After Starting Backend)
- [ ] User registration
- [ ] User login
- [ ] Project creation
- [ ] Project loading
- [ ] API connectivity
- [ ] Real-time updates

## Troubleshooting

### Frontend Issues
- If page doesn't load, check: `lsof -i :5174`
- Clear browser cache if you see old content
- Check browser console for errors (F12)

### Backend Issues
- Check MongoDB connection
- Verify `.env` file exists in `server/` directory
- Check logs: `server/logs/combined.log`
- Verify port 3002 is available: `lsof -i :3002`

### Connection Issues
- Frontend proxies `/api` requests to `http://localhost:3002`
- If backend is on different port, update `vite.config.ts`
- Check CORS settings if you see CORS errors

## Next Steps

1. **Start the backend server** (see instructions above)
2. **Test user registration/login**
3. **Create a test project**
4. **Verify all features work end-to-end**

---

**Note**: The frontend is currently running in the background. To stop it, find the process and kill it:
```bash
lsof -ti:5174 | xargs kill
```

Or press `Ctrl+C` in the terminal where it's running.







