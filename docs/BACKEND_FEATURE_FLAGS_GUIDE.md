# Backend Feature Flags Usage Guide 🔒

## Overview

The feature flags system is **fully functional** in the backend server. You can protect routes and control access based on user roles using feature flags stored in MongoDB.

## Two Ways to Use Feature Flags

### Method 1: Middleware (Recommended)

Use `checkFeatureAccess()` middleware to protect entire routes:

```typescript
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';

// Protect a route with middleware
router.post('/', 
  authenticateToken,           // First authenticate
  checkFeatureAccess('project_creation'),  // Then check feature access
  async (req: FeatureRequest, res, next) => {
    // Route handler - only executes if feature is enabled for user's role
    // ...
  }
);
```

**Example from `project.routes.ts`:**
```typescript
// Create new project - protected by feature flag
router.post('/', 
  checkFeatureAccess('project_creation'), 
  async (req: FeatureRequest, res, next) => {
    // Only users with 'project_creation' feature enabled can reach here
    const project = await Project.create(projectData);
    // ...
  }
);
```

### Method 2: Inline Check

Use `requireFeatureAccess()` for conditional checks inside route handlers:

```typescript
import { requireFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';

router.delete('/:id', async (req: FeatureRequest, res, next) => {
  try {
    // Check feature access inline
    await requireFeatureAccess(req, 'project_deletion');
    
    // Continue with route logic
    const project = await Project.findOneAndDelete({...});
    // ...
  } catch (error) {
    next(error);
  }
});
```

**Example from `project.routes.ts`:**
```typescript
router.delete('/:id', async (req: FeatureRequest, res, next) => {
  try {
    await requireFeatureAccess(req, 'project_deletion');
    
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.id
    });
    // ...
  } catch (error) {
    next(error);
  }
});
```

## How It Works

1. **User makes request** → Authenticated via `authenticateToken` middleware
2. **Feature check** → `checkFeatureAccess()` or `requireFeatureAccess()` checks:
   - User's role (from `req.user.role`)
   - Feature flag in database (`FeatureFlag` model)
   - Whether feature is active and enabled for that role
3. **Access granted/denied**:
   - ✅ **Enabled**: Request proceeds to route handler
   - ❌ **Disabled**: Returns 403 error with message

## Available Feature Keys

From the seed script (`server/scripts/seed-feature-flags.ts`):

### Projects
- `project_creation` - Create Projects
- `project_deletion` - Delete Projects
- `project_sharing` - Share Projects
- `project_export` - Export Projects

### AI
- `ai_chat` - AI Chat
- `ai_code_generation` - AI Code Generation
- `ai_task_automation` - AI Task Automation
- `multi_llm_access` - Multi-LLM Access (admin/superadmin only)

### Agents
- `agent_creation` - Create Agents
- `agent_customization` - Customize Agents

### Export
- `export_data` - Export Data
- `export_code` - Export Code

### Admin
- `admin_console` - Admin Console
- `user_management` - User Management
- `package_management` - Package Management
- `audit_logs` - Audit Logs
- `feature_flags` - Feature Flags (superadmin only)

### Workspace
- `code_editor` - Code Editor
- `artifact_viewer` - Artifact Viewer
- `preview_mode` - Preview Mode

## Complete Example

```typescript
import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, requireFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Method 1: Middleware approach (cleaner)
router.post('/create', 
  authenticateToken,
  checkFeatureAccess('project_creation'),
  async (req: FeatureRequest, res, next) => {
    try {
      // User has access - proceed
      const project = await createProject(req.body);
      res.json({ success: true, data: { project } });
    } catch (error) {
      next(error);
    }
  }
);

// Method 2: Inline check (more flexible)
router.post('/export/:id', 
  authenticateToken,
  async (req: FeatureRequest, res, next) => {
    try {
      // Check feature access conditionally
      await requireFeatureAccess(req, 'project_export');
      
      // Additional business logic
      if (req.body.format === 'pdf') {
        await requireFeatureAccess(req, 'export_pdf'); // Check another feature
      }
      
      const exportData = await exportProject(req.params.id);
      res.json({ success: true, data: exportData });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

## Error Handling

When feature access is denied:
- **Status Code**: `403 Forbidden`
- **Error Message**: `"Access denied: This feature is not available for your role."`
- **Logging**: Warning logged with user email and role

## Best Practices

1. **Always authenticate first**: Use `authenticateToken` before `checkFeatureAccess`
2. **Use middleware for route-level protection**: Cleaner and more declarative
3. **Use inline checks for conditional logic**: When you need multiple feature checks or conditional access
4. **Default to enabled**: If feature flag doesn't exist, access is granted (backward compatibility)
5. **Check on backend**: Always enforce on backend - frontend checks are for UX only

## Testing

Test feature flag protection:

```bash
# 1. Create a feature flag (via admin API or seed script)
# 2. Test with enabled role
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}'

# 3. Disable feature for role in admin console
# 4. Test again - should get 403 error
```

## Current Implementation

✅ **Project Routes** (`server/src/routes/project.routes.ts`):
- `POST /api/projects` - Protected by `project_creation`
- `DELETE /api/projects/:id` - Protected by `project_deletion`

## Next Steps

Add feature flag protection to other routes:
- Export routes → `export_data`, `export_code`
- AI routes → `ai_chat`, `ai_code_generation`
- Agent routes → `agent_creation`, `agent_customization`
- Admin routes → Already protected by role, but can add feature flags for fine-grained control
















