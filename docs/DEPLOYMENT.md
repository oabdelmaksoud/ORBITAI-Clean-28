# Deployment Guide

## Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:5173

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/orbitai
MONGO_USERNAME=admin
MONGO_PASSWORD=password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Gemini API Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# Logging
LOG_LEVEL=info
```

## Local Development Setup

1. **Install Dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Start MongoDB:**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:7.0
   
   # Or install MongoDB locally
   ```

3. **Create `.env` file** with your configuration

4. **Create logs directory:**
   ```bash
   mkdir -p logs
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Create `.env` file** with your environment variables

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Check logs:**
   ```bash
   docker-compose logs -f backend
   ```

5. **Stop services:**
   ```bash
   docker-compose down
   ```

### Manual Docker Build

1. **Build image:**
   ```bash
   docker build -t orbitai-backend .
   ```

2. **Run container:**
   ```bash
   docker run -d \
     -p 3001:3001 \
     -e MONGODB_URI=mongodb://host.docker.internal:27017/orbitai \
     -e GEMINI_API_KEY=your-key \
     -e JWT_SECRET=your-secret \
     --name orbitai-backend \
     orbitai-backend
   ```

## Cloud Deployment Options

### AWS (EC2 + MongoDB Atlas)

1. Launch EC2 instance
2. Install Docker and Docker Compose
3. Clone repository
4. Configure environment variables
5. Run `docker-compose up -d`
6. Configure security groups for port 3001

### AWS ECS/Fargate

1. Build and push Docker image to ECR
2. Create ECS task definition
3. Configure MongoDB Atlas connection
4. Deploy service

### Google Cloud Run

1. Build Docker image
2. Push to Google Container Registry
3. Deploy to Cloud Run
4. Configure environment variables
5. Set up Cloud SQL or use MongoDB Atlas

### Heroku

1. Install Heroku CLI
2. Create Heroku app
3. Add MongoDB addon (MongoDB Atlas)
4. Set environment variables
5. Deploy: `git push heroku main`

### DigitalOcean App Platform

1. Connect GitHub repository
2. Configure build settings
3. Add MongoDB database
4. Set environment variables
5. Deploy

## MongoDB Atlas Setup (Recommended for Production)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create cluster
3. Create database user
4. Whitelist IP addresses (or 0.0.0.0/0 for development)
5. Get connection string
6. Update `MONGODB_URI` in `.env` file

Connection string format:
```
mongodb+srv://username:password@cluster.mongodb.net/orbitai?retryWrites=true&w=majority
```

## Security Checklist

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Use MongoDB Atlas or secure MongoDB instance
- [ ] Enable HTTPS/TLS in production
- [ ] Configure CORS properly for production domain
- [ ] Set secure environment variables
- [ ] Enable MongoDB authentication
- [ ] Configure firewall rules
- [ ] Set up log monitoring
- [ ] Configure rate limiting appropriately
- [ ] Use secrets management (AWS Secrets Manager, etc.)

## Monitoring

### Health Checks

- Basic: `GET /api/health`
- Detailed: `GET /api/health/detailed`

### Logs

Logs are stored in:
- `logs/error.log` - Errors only
- `logs/combined.log` - All logs

In Docker:
```bash
docker-compose logs -f backend
```

## Scaling

### Horizontal Scaling

1. Use load balancer (AWS ALB, Nginx, etc.)
2. Deploy multiple backend instances
3. Use session storage (Redis) if needed
4. Configure MongoDB connection pooling

### Database Scaling

1. Use MongoDB replica sets
2. Configure read preferences
3. Use MongoDB Atlas auto-scaling

## Troubleshooting

### MongoDB Connection Issues

- Check connection string format
- Verify network connectivity
- Check firewall rules
- Verify credentials

### JWT Errors

- Verify `JWT_SECRET` is set
- Check token expiration
- Verify token format

### Port Conflicts

- Change `PORT` in `.env`
- Check if port is in use: `lsof -i :3001`

