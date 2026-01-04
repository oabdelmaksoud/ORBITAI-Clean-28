# Feature Flags Testing Guide 🧪

## Quick Test Steps

### 1. Seed Feature Flags

```bash
cd server
npm run seed-feature-flags
```

Expected output:
```
✅ Connected to MongoDB
📦 Seeding 21 feature flags...
  ✅ Created/Updated: project_creation
  ✅ Created/Updated: project_deletion
  ...
  ✅ Created/Updated: viewing_sample_projects
✅ Successfully seeded 21 feature flags!
✅ Disconnected from MongoDB
```

### 2. Verify Public Check Endpoint Works

```bash
# Test without auth (should work - public endpoint)
curl 'http://localhost:3001/api/admin/feature-flags/check/project_creation?role=public'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "featureKey": "project_creation",
    "featureName": "Create Projects",
    "isActive": true,
    "hasRoleAccess": false,
    "userRole": "public",
    "enabledRoles": ["user", "admin", "superadmin", "editor"]
  }
}
```

### 3. Test Protected Routes

#### Test Project Creation (Should Work)
```bash
# Get auth token first (login as user)
TOKEN="your_auth_token_here"

# Test project creation
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "Test"}'
```

Expected: `201 Created` with project data

#### Test with Feature Disabled

1. **Disable feature in admin console:**
   - Login as admin
   - Go to Feature Flags
   - Disable `project_creation` for `user` role
   
2. **Retry request:**
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "Test"}'
```

Expected: `403 Forbidden`
```json
{
  "success": false,
  "error": {
    "message": "Access denied: This feature is not available for your role."
  }
}
```

### 4. Test AI Chat Feature

```bash
# Test AI chat endpoint
curl -X POST http://localhost:3001/api/gemini/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "history": []}'
```

Expected: Chat response if `ai_chat` feature is enabled

### 5. Test Export Feature (Admin Only)

```bash
# Test export (requires admin role + export_data feature)
curl http://localhost:3001/api/admin/export/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected: CSV or JSON export if `export_data` feature is enabled

## Feature Flag Coverage

| Route | Feature Flag | Status |
|-------|-------------|--------|
| POST /api/projects | `project_creation` | ✅ Protected |
| DELETE /api/projects/:id | `project_deletion` | ✅ Protected |
| POST /api/gemini/chat | `ai_chat` | ✅ Protected |
| POST /api/gemini/orchestrate | `ai_task_automation` | ✅ Protected |
| POST /api/gemini/execute-task | `ai_task_automation` | ✅ Protected |
| POST /api/agent/execute | `agent_creation` | ✅ Protected |
| POST /api/artifact/upload/:projectId | `artifact_viewer` | ✅ Protected |
| GET /api/admin/export/* | `export_data` | ✅ Protected |

## Troubleshooting

### Issue: "Access token required" on public check endpoint
**Solution**: Verify route order in `server/src/index.ts` - feature flags routes must be registered BEFORE general `/api/admin` routes.

### Issue: Feature always enabled even when disabled
**Solution**: 
1. Check feature flag exists in database
2. Verify `enabledRoles` array includes user's role
3. Check `isActive` is `true`
4. Clear frontend cache if using cached values

### Issue: 403 Forbidden for admin users
**Solution**: 
1. Verify admin role is in feature flag's `enabledRoles`
2. Check feature flag `isActive` is `true`
3. Verify user's role matches exactly (case-sensitive)

## Monitoring

Check server logs for feature access attempts:
- ✅ Allowed: `Feature access granted: User {email} (role: {role}) accessed '{featureKey}'`
- ❌ Denied: `Feature access denied: User {email} (role: {role}) tried to access '{featureKey}'`

## Database Verification

Connect to MongoDB and verify flags:
```javascript
db.featureflags.find({ featureKey: "project_creation" })
```

Expected:
```json
{
  "_id": ObjectId("..."),
  "featureKey": "project_creation",
  "featureName": "Create Projects",
  "enabledRoles": ["user", "admin", "superadmin", "editor"],
  "isActive": true,
  ...
}
```
















