# Environment Variables Setup Guide

## Quick Setup

Copy this template to create your `server/.env` file:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/orbitai
TEST_MONGODB_URI=mongodb://localhost:27017/orbitai-test

# Security
JWT_SECRET=your-random-secret-key-here

# Server
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## Required Variables

### MONGODB_URI
- **Required:** Yes
- **Description:** Connection string for your production/development database
- **Example (Local):** `mongodb://localhost:27017/orbitai`
- **Example (Atlas):** `mongodb+srv://user:password@cluster.xxxxx.mongodb.net/orbitai?retryWrites=true&w=majority`

### TEST_MONGODB_URI
- **Required:** Yes (for running tests)
- **Description:** Connection string for your test database (must be separate from production)
- **Example (Local):** `mongodb://localhost:27017/orbitai-test`
- **Example (Atlas):** `mongodb+srv://user:password@cluster.xxxxx.mongodb.net/orbitai-test?retryWrites=true&w=majority`
- **Important:** Database name must include "test" to prevent accidental production usage

### JWT_SECRET
- **Required:** Yes
- **Description:** Secret key for JWT token signing
- **Example:** `your-super-secret-random-key-change-this-in-production`
- **Security:** Use a strong random string in production

## Optional Variables

See `TEST_DATABASE_SETUP.md` for complete documentation on test database setup.

See `QUICK_START.md` for MongoDB setup instructions.




