# Production Deployment Guide

Step-by-step guide for deploying OrbitAI to production.

---

## Prerequisites

- [ ] Domain name configured
- [ ] SSL certificate ready (Let's Encrypt or similar)
- [ ] MongoDB Atlas account (or production MongoDB)
- [ ] Cloud hosting (Render, Railway, AWS, GCP, etc.)
- [ ] All API keys regenerated

---

## Step 1: Prepare Environment

### 1.1 Copy Production Template

```bash
cd server
cp .env.production .env
```

### 1.2 Generate Secrets

```bash
# Generate JWT secret (64 chars)
openssl rand -base64 64

# Generate encryption key (32 hex chars)
openssl rand -hex 16
```

### 1.3 Update .env

Replace all `REPLACE_WITH_*` placeholders with actual values.

---

## Step 2: Database Setup

### MongoDB Atlas (Recommended)

1. Create cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create database user with strong password
3. Configure Network Access:
   - Add your server's IP
   - Or allow from anywhere (less secure)
4. Get connection string and update `MONGODB_URI`

---

## Step 3: Build Application

### Frontend

```bash
# In root directory
npm run build

# Output in /dist folder
```

### Backend

```bash
cd server
npm run build

# Output in /server/dist folder
```

---

## Step 4: Deploy

### Option A: Docker (Recommended)

```bash
# Build and run
docker-compose -f docker-compose.production.yml up -d
```

### Option B: Render.com

1. Connect GitHub repository
2. Set environment variables from `.env.production`
3. Configure build command: `npm run build`
4. Configure start command: `npm start`

### Option C: Railway

1. Connect repository
2. Set environment variables
3. Deploy automatically on push

---

## Step 5: Post-Deployment

### Verify Health

```bash
curl https://your-api-domain.com/health
```

### Create Admin User

```bash
cd server
npx ts-node scripts/create-admin.ts
```

### Configure API Keys

1. Login to Admin Console
2. Go to Settings → API Keys
3. Add your Gemini/OpenAI/Anthropic keys

---

## Monitoring

### Health Endpoints

- `/health` - Basic health check
- `/api/health/detailed` - Detailed status

### Logs

Logs are written to:
- `logs/error.log` - Errors only
- `logs/combined.log` - All logs

### Recommended Monitoring

- **Uptime:** UptimeRobot, Pingdom
- **Errors:** Sentry
- **Metrics:** Prometheus + Grafana

---

## Rollback Plan

1. Keep previous Docker image tagged
2. Database backups before updates
3. Blue-green deployment if possible

```bash
# Rollback Docker
docker-compose down
docker-compose -f docker-compose.previous.yml up -d
```

---

## Security Checklist

Before going live:

- [ ] All secrets rotated
- [ ] CORS configured for specific domains
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Security headers (Helmet.js)
- [ ] npm audit clean
