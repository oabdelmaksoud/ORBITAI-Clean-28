# ORBITAI - Technical Specifications

## System Architecture

### High-Level Architecture
```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐     ┌──────────────┐
│  Vercel (CDN)   │────▶│  Client SPA  │
│   Static Host   │     │  (React)     │
└─────────────────┘     └──────┬───────┘
                              │ REST API
                              │ WebSocket
                              ▼
┌─────────────────┐     ┌──────────────┐
│  Railway/Render │────▶│Express Server│
│   Node.js Host  │     │  (Node.js)   │
└─────────────────┘     └──────┬───────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
            ┌──────────┐ ┌────────┐ ┌──────┐
            │ MongoDB  │ │ Redis  │ │ AI   │
            │  Atlas   │ │(Bull Q)│ │ APIs │
            └──────────┘ └────────┘ └──────┘
```

---

## API Endpoints Structure

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### AI Chat
- `POST /api/llm/chat` - Send chat message
- `POST /api/llm/stream` - Streaming chat
- `POST /api/brainstorming/start` - Start brainstorming session
- `POST /api/brainstorming/generate-ideas` - AI idea generation

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/api-keys` - Configure API keys
- `GET /api/admin/analytics` - System analytics
- `POST /api/admin/rate-limiting` - Configure rate limits

### MCP (Model Context Protocol)
- `GET /api/mcp-servers` - List available servers
- `POST /api/mcp/discover` - Discover tools
- `POST /api/mcp/call` - Execute tool

---

## Database Schema (MongoDB)

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  name: String,
  role: String (enum: 'user', 'admin'),
  planTier: String (enum: 'free', 'pro', 'enterprise'),
  apiKeys: {
    gemini: String,
    openai: String,
    anthropic: String
  },
  settings: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Projects Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  name: String,
  description: String,
  methodology: String,
  techStack: Array,
  phases: Array,
  tasks: Array,
  agents: Array,
  artifacts: Array,
  status: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Conversations Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  folderId: String,
  title: String,
  messages: Array,
  ideas: Array,
  projectPreview: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Folders Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  name: String,
  description: String,
  platforms: Array,
  createdAt: Date,
  updatedAt: Date
}
```

---

## AI Integration Details

### LLM Router Logic
```
Request → Task Analysis → Model Selection
                             │
        ┌────────────────────┼─────────────────┐
        ▼                    ▼                 ▼
   Gemini 2.5           GPT-4 Turbo      Claude 3.5
   (Default/Fast)       (Complex)        (Creative)
```

### Model Selection Criteria
- **Gemini 2.5 Flash**: Quick responses, brainstorming, simple queries
- **GPT-4 Turbo**: Complex reasoning, large context, technical tasks
- **Claude 3.5 Sonnet**: Creative writing, code generation, analysis

### Streaming Implementation
- Server-Sent Events (SSE) for real-time responses
- Chunked transfer encoding
- Token-by-token streaming
- Error recovery mechanisms

---

## Security Implementation

### Authentication Flow
```
1. User submits credentials
2. Server validates against MongoDB
3. bcrypt compares hashed passwords
4. JWT token generated (24h expiry)
5. Token sent in HTTP-only cookie
6. Client includes token in Authorization header
7. Middleware validates JWT on protected routes
```

### Rate Limiting
- IP-based throttling
- User-based quotas
- Endpoint-specific limits
- Sliding window algorithm

### Data Validation
- Zod schemas for request validation
- Input sanitization
- SQL injection prevention (MongoDB)
- XSS protection

---

## Performance Optimization

### Frontend
- Code splitting by route
- Lazy loading for heavy components
- Image optimization
- Bundle size monitoring
- React.memo for expensive components
- Virtual scrolling for long lists

### Backend
- Connection pooling (MongoDB)
- Redis caching layer
- Query optimization with indexes
- Background job processing (Bull)
- Gzip compression
- Response caching

---

## Monitoring & Logging

### Logging Strategy
- Winston logger implementation
- Log levels: error, warn, info, debug
- Structured JSON logging
- Log rotation
- Error tracking with stack traces

### Metrics to Track
- API response times
- Error rates
- User activity
- AI token usage
- Database query performance
- Memory usage
- CPU utilization

---

## Deployment Pipeline

### CI/CD Flow
```
Git Push → GitHub Actions
    │
    ├─→ Run Tests
    ├─→ Build Client
    ├─→ Build Server
    └─→ Deploy
         ├─→ Vercel (Client)
         └─→ Railway (Server)
```

### Environment Configuration
- Development: Local MongoDB, test API keys
- Staging: Cloud MongoDB, separate environment
- Production: MongoDB Atlas, production API keys

---

## Scalability Plan

### Horizontal Scaling
- Stateless server design
- Session storage in Redis
- Load balancer compatibility
- Database read replicas

### Vertical Scaling
- Container resource limits
- Auto-scaling policies
- Database performance tuning
- Query optimization

---

## Backup & Recovery

### Database Backups
- Daily automated backups (MongoDB Atlas)
- Point-in-time recovery
- 30-day retention period
- Backup encryption

### Disaster Recovery
- Multi-region deployment option
- Database failover
- Application health checks
- Rollback procedures

---

## Testing Strategy

### Unit Tests
- Jest/Vitest for business logic
- React Testing Library for components
- 80%+ code coverage target

### Integration Tests
- API endpoint testing
- Database interaction tests
- Service layer tests

### E2E Tests
- Playwright for critical user flows
- Signup/login flow
- Project creation flow
- AI chat interaction

---

## Compliance & Standards

### ASPICE (Automotive SPICE)
- Requirements traceability
- Test coverage mapping
- Documentation standards
- Quality assurance processes

### Security Standards
- OWASP Top 10 compliance
- Data encryption at rest
- Secure API design
- Regular security audits

---

## Third-Party Integrations

### AI Providers
- Google Gemini API
- OpenAI API
- Anthropic Claude API
- E2B Code Interpreter

### Infrastructure
- MongoDB Atlas (Database)
- Redis Cloud (Caching/Queue)
- Vercel (Frontend hosting)
- Railway/Render (Backend hosting)

### Development Tools
- GitHub (Version control)
- npm (Package management)
- Docker (Containerization)

---

## File Structure Details

### Client Components (150+ files)
- UI components
- Business logic components
- Layout components
- Form components
- Visualization components

### Server Services (30+ files)
- LLM services
- Project management
- User management
- File processing
- Analytics

### Shared Types (100+ interfaces)
- Project types
- User types
- AI types
- UI types
- API types

---

## Performance Benchmarks

### Target Metrics
- Page load: <2s (first load)
- Time to Interactive: <3s
- API response: <500ms (p95)
- AI response start: <1s
- Database queries: <100ms (p95)

### Current Build Sizes
- Client bundle: 22 MB (production)
- Server bundle: 13 MB (production)
- Docker images: ~300 MB (combined)
