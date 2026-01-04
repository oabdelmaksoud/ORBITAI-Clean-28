# API Reference

Complete API endpoint documentation for OrbitAI backend.

**Base URL:** `http://localhost:3001`

---

## Authentication

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

**Response:** `201 Created`
```json
{
  "token": "jwt-token",
  "user": { "id": "...", "email": "...", "name": "..." }
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

## Projects

### List Projects
```http
GET /api/projects
Authorization: Bearer <token>
```

### Create Project
```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Project",
  "description": "Project description"
}
```

### Get Single Project
```http
GET /api/projects/:id
Authorization: Bearer <token>
```

### Update Project
```http
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Delete Project
```http
DELETE /api/projects/:id
Authorization: Bearer <token>
```

---

## Conversations

### Save Conversation
```http
POST /api/conversations
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Project brainstorming",
  "messages": [...],
  "ideas": [...],
  "folderId": "folder-id"
}
```

### Get User Conversations
```http
GET /api/conversations
Authorization: Bearer <token>
```

---

## Chat / AI

### Stream Chat Response
```http
POST /api/chat/stream
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "User input",
  "context": {...}
}
```
Returns: Server-Sent Events (SSE)

### Generate Prototype
```http
POST /api/preview/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "...",
  "blueprint": {...}
}
```

---

## Admin Endpoints

> Require admin authentication

### LLM Models
```http
GET /api/admin/llm-models
POST /api/admin/llm-models
PUT /api/admin/llm-models/:id
DELETE /api/admin/llm-models/:id
```

### Routing Rules
```http
GET /api/admin/llm-router/rules
POST /api/admin/llm-router/rules
PUT /api/admin/llm-router/rules/:id
DELETE /api/admin/llm-router/rules/:id
```

### Feature Flags
```http
GET /api/admin/feature-flags
PUT /api/admin/feature-flags/:id
```

---

## Health Check

```http
GET /health
```
**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "environment": "development"
}
```

```http
GET /api/health/detailed
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Rate Limiting

- **Default:** 100 requests per 15 minutes
- **Auth endpoints:** 10 requests per minute
- **AI endpoints:** 30 requests per minute

Headers returned:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```
