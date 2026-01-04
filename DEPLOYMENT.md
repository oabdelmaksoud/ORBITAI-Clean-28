# ORBITAI Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git for version control
- Accounts on deployment platforms (Vercel, Railway/Render)

## 📦 Project Structure

```
ORBITAI-Clean/
├── client/          # React frontend (Vite)
│   └── dist/        # Production build output
├── server/          # Node/Express backend
│   └── dist/        # Compiled TypeScript
├── shared/          # Shared types/constants
│   └── dist/        # Compiled shared module
└── package.json     # Monorepo configuration
```

---

## 🔨 Building for Production

### 1. Install Dependencies
```bash
npm install
```

### 2. Build All Packages
```bash
# Clean previous builds and build everything
npm run build:prod

# Or build individually
npm run build:shared  # Build shared types first
npm run build:client  # Build frontend
npm run build:server  # Build backend
```

### 3. Test Production Build Locally
```bash
# Preview client build
npm run preview:client

# Start production server
npm run start:prod
```

---

## 🌐 Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend)

#### Deploy Frontend to Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to client: `cd client`
3. Login: `vercel login`
4. Deploy: `vercel --prod`
5. Set environment variable in Vercel dashboard:
   - `VITE_API_URL`: Your backend URL from Railway

#### Deploy Backend to Railway
1. Install Railway CLI: `npm i -g @railway/cli`
2. Navigate to server: `cd server`
3. Login: `railway login`
4. Initialize: `railway init`
5. Deploy: `railway up`
6. Set environment variables in Railway dashboard:
   - `NODE_ENV=production`
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Your secure secret key
   - `GEMINI_API_KEY`: Your Google AI API key
   - `CORS_ORIGIN`: Your Vercel frontend URL

### Option 2: Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build -d
```

---

## ⚙️ Environment Configuration

### Client Variables (.env.production)
```bash
VITE_API_URL=https://your-backend-url.railway.app
VITE_ENVIRONMENT=production
```

### Server Variables (.env.production)
```bash
NODE_ENV=production
PORT=3002
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/orbitai
JWT_SECRET=your-super-secret-key-here
GEMINI_API_KEY=your-gemini-api-key
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

---

## ✅ Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Production build succeeds locally
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] API keys valid and active
- [ ] CORS configured for production domain
- [ ] MongoDB Atlas IP whitelist configured (0.0.0.0/0 for Railway/Render)
- [ ] .env files not committed to git
- [ ] Build size optimized (check bundle analyzer)

---

## 🔐 Security Best Practices

1. **Secrets Management**
   - Never commit `.env` files
   - Use platform environment variable dashboards
   - Rotate secrets regularly

2. **Database Security**
   - Use MongoDB Atlas with authentication
   - Enable IP whitelist (or 0.0.0.0/0 for cloud platforms)
   - Use strong database passwords

3. **API Security**
   - Enable rate limiting
   - Validate all inputs
   - Use HTTPS only
   - Implement proper CORS

---

## 📊 Monitoring & Maintenance

### After Deployment
1. Monitor application logs
2. Set up error tracking (Sentry recommended)
3. Configure uptime monitoring
4. Review performance metrics
5. Set up automated backups for database

### Troubleshooting
- Check deployment logs on platform dashboard
- Verify environment variables are set correctly
- Test API endpoints directly
- Check database connection status
- Review CORS configuration if frontend can't connect

---

## 🔄 Continuous Deployment

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml` for automated deployments on push to main branch.

---

## 📞 Support

For deployment issues:
1. Check platform-specific documentation (Vercel, Railway)
2. Review server logs for error messages
3. Verify all environment variables are set
4. Test database connectivity

---

## 📝 Build Output Sizes

Current production build sizes:
- Client: ~22 MB (includes Monaco editor, Three.js)
- Server: ~13 MB
- Shared: <1 MB

Consider code-splitting and lazy loading for further optimization.
