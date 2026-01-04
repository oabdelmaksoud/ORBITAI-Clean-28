# Starting All Servers

This guide shows you how to start all OrbitAI servers together.

## Quick Start

### Option 1: Using npm script (Recommended)

```bash
npm run dev:all
```

This will start:
- **Frontend** (Vite) on `http://localhost:5173`
- **Backend** (Node.js) on `http://localhost:3001`

### Option 2: Using shell script

```bash
./start-all.sh
```

### Option 3: With Docker services (MongoDB, Weaviate)

```bash
npm run dev:all:with-docker
```

This will start:
- **Docker services** (MongoDB, Weaviate)
- **Frontend** (Vite) on `http://localhost:5173`
- **Backend** (Node.js) on `http://localhost:3001`

## Prerequisites

1. **Node.js 20+** installed
2. **Dependencies installed**:
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd server && npm install && cd ..
   ```

3. **MongoDB** (optional but recommended):
   - Local MongoDB running, OR
   - MongoDB Atlas connection string in `server/.env`, OR
   - Use Docker: `cd server && docker-compose up -d mongodb`

## Available Scripts

### Root package.json

- `npm run dev` - Start frontend only
- `npm run dev:backend` - Start backend only
- `npm run dev:all` - Start frontend + backend together
- `npm run dev:all:with-docker` - Start Docker services + frontend + backend

### Server package.json

- `cd server && npm run dev` - Start backend server
- `cd server && npm start` - Start backend in production mode

## Ports

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Backend Health**: `http://localhost:3001/health`
- **MongoDB**: `mongodb://localhost:27017` (if using Docker)
- **Weaviate**: `http://localhost:8080` (if using Docker)

## Troubleshooting

### Port already in use

If a port is already in use, you can:

1. **Kill the process using the port**:
   ```bash
   # For port 5173 (frontend)
   lsof -ti:5173 | xargs kill -9
   
   # For port 3001 (backend)
   lsof -ti:3001 | xargs kill -9
   ```

2. **Or use the clean dev script**:
   ```bash
   npm run dev:clean
   ```

### MongoDB connection issues

1. **Check if MongoDB is running**:
   ```bash
   # Local MongoDB
   mongosh --eval "db.adminCommand('ping')"
   
   # Docker MongoDB
   docker ps | grep mongo
   ```

2. **Start MongoDB with Docker**:
   ```bash
   cd server
   docker-compose up -d mongodb
   ```

3. **Check your `.env` file** in `server/.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/orbitai
   # OR for Docker:
   MONGODB_URI=mongodb://admin:password@localhost:27017/orbitai?authSource=admin
   ```

### Backend won't start

1. **Check server logs**:
   ```bash
   cd server
   tail -f logs/combined.log
   ```

2. **Verify environment variables**:
   ```bash
   cd server
   cat .env
   ```

3. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

### Frontend won't start

1. **Clear Vite cache**:
   ```bash
   rm -rf node_modules/.vite
   npm run dev:clean
   ```

2. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules
   npm install
   ```

## Stopping All Servers

Press `Ctrl+C` in the terminal where you started the servers. This will stop all servers at once.

If you need to stop individual servers:

```bash
# Stop frontend
pkill -f vite

# Stop backend
pkill -f "tsx watch"

# Stop Docker services
cd server && docker-compose down
```

## Development Workflow

1. **Start all servers**:
   ```bash
   npm run dev:all
   ```

2. **Make changes** - Both servers will auto-reload on file changes

3. **View logs** - Each server's logs are color-coded:
   - Blue: Frontend
   - Green: Backend

4. **Stop servers** - Press `Ctrl+C`

## Production Build

To build for production:

```bash
# Build frontend
npm run build

# Start backend in production mode
cd server
npm run build
npm start
```

