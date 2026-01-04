# API Key Environment Field Guide

## What is the "Environment" Field?

The **Environment** field categorizes your API key by the deployment environment it's intended for. This helps you organize and manage multiple keys for different environments.

## Available Options

You can choose from three environment types:

### 1. **Development** 🔧
- **Use for**: Local development, testing, personal projects
- **Example**: Your local machine, development server
- **Purpose**: Safe to use for testing and experimentation

### 2. **Staging** 🧪
- **Use for**: Pre-production testing, QA environments
- **Example**: Staging server, test deployments
- **Purpose**: Testing before production release

### 3. **Production** 🚀
- **Use for**: Live production systems, real users
- **Example**: Production server, live application
- **Purpose**: Real-world usage with actual users

## Why Use Environment Field?

### Benefits:

1. **Organization**: Easily identify which key is for which environment
2. **Security**: Separate keys for different environments
3. **Filtering**: Filter keys by environment in the UI
4. **Best Practice**: Industry standard for key management
5. **Audit Trail**: Track which environment keys are used in

## How to Choose

### For Most Users (Local Development):
**Select: `development`**

This is the most common choice if you're:
- Running the app locally
- Testing features
- Developing new functionality
- Not deploying to production yet

### For Staging/Testing:
**Select: `staging`**

Use this if you have:
- A separate testing server
- QA environment
- Pre-production testing setup

### For Production:
**Select: `production`**

Use this only when:
- Deploying to live production
- Real users will use the system
- You have a production server

## Example Scenarios

### Scenario 1: Local Development
```
Provider: Gemini
Key Name: My Gemini Key
Environment: development
Description: For local testing
```

### Scenario 2: Production Deployment
```
Provider: OpenAI
Key Name: Production OpenAI Key
Environment: production
Description: Live production key
```

### Scenario 3: Multiple Environments
You can have multiple keys for the same provider:

```
Key 1:
- Provider: Gemini
- Environment: development
- Key Name: Dev Gemini Key

Key 2:
- Provider: Gemini
- Environment: production
- Key Name: Prod Gemini Key
```

## Important Notes

1. **Optional Field**: Environment is optional - you can leave it blank
2. **Not Enforced**: The system doesn't enforce which environment you use
3. **For Organization**: It's mainly for your own organization and tracking
4. **Can Change**: You can update the environment later if needed

## Recommendation

**For your current setup (local development):**
- **Select: `development`** ✅

This is the most appropriate choice since you're:
- Running locally
- Testing the system
- Not in production yet

## Summary

| Environment | When to Use | Example |
|------------|-------------|---------|
| **development** | Local dev, testing | Your local machine |
| **staging** | Pre-production testing | Test server |
| **production** | Live production | Real users |

**For most users adding keys now: Choose `development`** 🎯













