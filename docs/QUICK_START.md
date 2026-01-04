# Quick Start Guide 🚀

## Step 1: Choose Your Database Option

### Option A: MongoDB Atlas (Cloud - Recommended) ⭐

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a free account (Free tier available)
3. Create a new cluster (choose FREE tier)
4. Create a database user:
   - Go to "Database Access" → "Add New Database User"
   - Username: `orbitai_user`
   - Password: Create a strong password (save it!)
   - Database User Privileges: "Atlas admin"
5. Whitelist your IP:
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (for development) or add your IP
6. Get connection string:
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://orbitai_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/orbitai?retryWrites=true&w=majority`

7. Update `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://orbitai_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/orbitai?retryWrites=true&w=majority
   ```

### Option B: Local MongoDB with Docker

1. Start Docker Desktop
2. Run MongoDB:
   ```bash
   docker run -d \
     --name orbitai-mongodb \
     -p 27017:27017 \
     -e MONGO_INITDB_ROOT_USERNAME=admin \
     -e MONGO_INITDB_ROOT_PASSWORD=password \
     mongo:7.0
   ```

3. Your `.env` already has the correct URI:
   ```env
   MONGODB_URI=mongodb://admin:password@localhost:27017/orbitai?authSource=admin
   ```

### Option C: Install MongoDB Locally

```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0

# The connection string in .env will work:
# MONGODB_URI=mongodb://localhost:27017/orbitai
```

## Step 2: Start the Backend Server

```bash
cd server
npm run dev
```

Or use the startup script:
```bash
cd server
./start-dev.sh
```

## Step 3: Verify It's Working

### Check Health Endpoint
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-11-29T...",
  "database": "connected",
  "uptime": 1.234,
  "environment": "development"
}
```

### Check Detailed Health
```bash
curl http://localhost:3001/api/health/detailed
```

## Step 4: Test Authentication

### Register a User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the `token` from the response for authenticated requests.

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongoServerError: bad auth"**
- Check your username and password
- Verify the connection string format

**Error: "MongooseServerSelectionError: connect ECONNREFUSED"**
- MongoDB is not running
- Check if the connection string is correct
- Verify network access (for Atlas) or firewall settings

**Docker Connection Issues**
- Make sure Docker Desktop is running
- Check container status: `docker ps -a`
- View logs: `docker logs orbitai-mongodb`

### Server Issues

**Port Already in Use**
```bash
# Change PORT in .env file
PORT=3002
```

**Module Not Found**
```bash
cd server
npm install
```

**Environment Variables Not Loading**
- Make sure `.env` file exists in `server/` directory
- Check file permissions
- Verify `.env` file syntax (no quotes around values)

## Next Steps

1. ✅ Backend is running
2. 🔄 Connect frontend to backend API
3. 🧪 Test full integration
4. 🚀 Deploy to production

---

**Ready to go!** 🎉

