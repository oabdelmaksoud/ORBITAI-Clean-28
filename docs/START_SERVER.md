# Starting OrbitAI Backend Server

## Current Configuration

- **Port:** 3002
- **Environment:** Development
- **MongoDB:** Needs to be configured

## Quick Start

The server is configured to run on **port 3002**. 

### Option 1: Start with MongoDB Atlas (Recommended)

1. Update `.env` file with MongoDB Atlas connection string:
   ```env
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/orbitai
   ```

2. Start the server:
   ```bash
   cd server
   npm run dev
   ```

### Option 2: Start with Local MongoDB (Docker)

1. Start MongoDB:
   ```bash
   cd server
   docker-compose up -d mongodb
   ```

2. The `.env` file is already configured for local MongoDB

3. Start the server:
   ```bash
   npm run dev
   ```

### Option 3: Skip Database Connection (For Testing)

The server will attempt to connect to MongoDB. If you want to test without MongoDB first, you can modify the connection to be optional (not recommended for production).

## Verify Server is Running

```bash
# Check health endpoint
curl http://localhost:3002/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

## Server Status

- Port: **3002**
- URL: http://localhost:3002
- Health Check: http://localhost:3002/health
- API Base: http://localhost:3002/api

## Troubleshooting

### Server Won't Start

1. Check if port 3002 is available:
   ```bash
   lsof -i :3002
   ```

2. Check MongoDB connection:
   - Verify MongoDB is running
   - Check connection string in `.env`
   - Test connection manually

3. Check logs:
   ```bash
   cd server
   tail -f logs/combined.log
   ```

### MongoDB Connection Issues

- Make sure MongoDB is running
- Verify connection string format
- Check network/firewall settings
- For Atlas: Verify IP whitelist

---

**Server Configuration:**
- Port: 3002
- Environment File: `server/.env`
- Logs: `server/logs/`

