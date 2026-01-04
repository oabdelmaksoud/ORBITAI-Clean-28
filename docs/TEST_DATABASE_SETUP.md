# Test Database Setup Guide

## 🎯 Purpose

This guide explains how to set up a **separate test database** to prevent test data from polluting your production/development database.

## ⚠️ Why This Matters

Without a separate test database:
- Test users and data can end up in your production database
- Tests can accidentally delete or modify real data
- Test cleanup failures can leave orphaned data
- You risk data corruption in production

## ✅ Setup Instructions

### Step 1: Add TEST_MONGODB_URI to Your .env File

Add this line to your `server/.env` file:

```env
# Production/Development Database
MONGODB_URI=mongodb://localhost:27017/orbitai

# Test Database (REQUIRED for running tests)
TEST_MONGODB_URI=mongodb://localhost:27017/orbitai-test
```

### Step 2: For MongoDB Atlas (Cloud)

If you're using MongoDB Atlas, create a separate cluster or database for testing:

```env
# Production Database
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/orbitai?retryWrites=true&w=majority

# Test Database (use different database name)
TEST_MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/orbitai-test?retryWrites=true&w=majority
```

**Note:** You can use the same cluster, just change the database name from `orbitai` to `orbitai-test`.

### Step 3: Create the Test Database

The test database will be created automatically when you run tests. However, you can verify it exists:

```bash
# Connect to MongoDB
mongosh "your-test-database-uri"

# List databases
show dbs

# You should see orbitai-test listed
```

## 🔒 Safety Features

The test setup includes **safety checks** to prevent accidental production database usage:

1. **Database Name Validation**: Tests will fail if they try to use a database without "test" in the name
2. **Explicit Configuration**: Encourages setting `TEST_MONGODB_URI` explicitly
3. **Warnings**: Shows warnings if test database is not configured

## 🧪 Running Tests

### Run All Tests

```bash
cd server
npm test
```

Tests will automatically use `TEST_MONGODB_URI` if set, or fall back to a safe default (`orbitai-test`).

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## 📋 Test Database Behavior

### Automatic Cleanup

Tests automatically clean up after themselves:
- Test users are deleted after each test suite
- Test projects are removed
- Test data is isolated to the test database

### Manual Cleanup

If you need to manually clean up the test database:

```bash
# Connect to test database
mongosh "your-test-database-uri"

# Drop the entire test database (WARNING: This deletes everything!)
use orbitai-test
db.dropDatabase()

# Or clean specific collections
db.users.deleteMany({})
db.projects.deleteMany({})
```

## 🚨 Troubleshooting

### Error: "Tests cannot use production database!"

**Problem:** Tests are trying to use your production database.

**Solution:** Set `TEST_MONGODB_URI` in your `.env` file with a database name that includes "test".

### Error: "TEST_MONGODB_URI appears to point to production database!"

**Problem:** Your `TEST_MONGODB_URI` is pointing to the production database.

**Solution:** Change the database name in `TEST_MONGODB_URI` to include "test" (e.g., `orbitai-test`).

### Tests are slow or timing out

**Problem:** Test database connection issues.

**Solution:**
1. Verify `TEST_MONGODB_URI` is correct
2. Check MongoDB is running
3. Verify network connectivity (for Atlas)

### Test data persists between test runs

**Problem:** Cleanup isn't working properly.

**Solution:**
1. Check test logs for cleanup errors
2. Manually clean the test database
3. Verify `cleanupTestData()` is being called in test teardown

## 📝 Example .env Configuration

```env
# ============================================
# Database Configuration
# ============================================

# Production/Development Database
MONGODB_URI=mongodb://localhost:27017/orbitai

# Test Database (REQUIRED for tests)
TEST_MONGODB_URI=mongodb://localhost:27017/orbitai-test

# ============================================
# Other Configuration...
# ============================================
JWT_SECRET=your-secret-key-here
NODE_ENV=development
PORT=3001
```

## 🔍 Verifying Setup

Run this command to verify your test database is configured correctly:

```bash
cd server
npm test -- --reporter=verbose
```

You should see:
- ✅ Connection to test database
- ✅ Tests running successfully
- ✅ Cleanup after tests complete
- ⚠️ Warnings if `TEST_MONGODB_URI` is not set (but tests will still work with safe defaults)

## 🎓 Best Practices

1. **Always use a separate test database** - Never run tests against production
2. **Set TEST_MONGODB_URI explicitly** - Don't rely on defaults
3. **Clean test database regularly** - Drop and recreate if needed
4. **Use different credentials** - If possible, use a separate MongoDB user for tests
5. **Monitor test database size** - Keep it clean to avoid storage issues

## 📚 Related Documentation

- [Test Helpers](./src/__tests__/helpers/testHelpers.ts) - Test utility functions
- [Test Setup](./src/__tests__/setup.ts) - Test environment configuration
- [Database Configuration](./src/config/database.ts) - Database connection setup




