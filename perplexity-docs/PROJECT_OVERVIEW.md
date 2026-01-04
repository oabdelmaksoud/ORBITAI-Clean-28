# ORBITAI - Project Overview for Documentation Preparation

## 🎯 Project Summary

**OrbitAI** is an AI-powered autonomous software architect platform that enables users to brainstorm, design, and generate complete software projects through interactive AI collaboration.

**Current Status:** Production-ready monorepo with successful builds
**Deployment Target:** Cloud hosting (Vercel + Railway/Render recommended)

---

## 🏗️ Architecture

### Monorepo Structure
```
ORBITAI-Clean/
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Node.js backend (Express + MongoDB)
└── shared/          # Shared TypeScript types/constants
```

### Technology Stack

#### Frontend (@orbitai/client)
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 5.x
- **Styling:** TailwindCSS + Framer Motion
- **3D Graphics:** Three.js + React Three Fiber
- **State Management:** React Context + Reducers
- **Code Editor:** Monaco Editor
- **Page Builder:** GrapesJS
- **Testing:** Vitest + Playwright
- **Internationalization:** i18next

#### Backend (@orbitai/server)
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB (with Mongoose ODM)
- **Authentication:** JWT
- **AI Integration:** 
  - Google Gemini (primary)
  - OpenAI GPT-4
  - Anthropic Claude
  - LLM Router for intelligent model selection
- **Real-time:** Socket.io
- **Task Queue:** Bull (Redis-based)
- **File Processing:** Multer
- **Validation:** Zod

#### Shared (@orbitai/shared)
- TypeScript type definitions
- Shared constants
- Common interfaces

---

## 🚀 Core Features

### 1. AI Brainstorming System
- Interactive chat interface for project ideation
- Multi-agent collaboration (Orchestrator, Requirements, Design, etc.)
- Real-time mind map visualization with D3.js
- Idea categorization and organization
- Voice synthesis support for agent responses

### 2. LLM Router
- Intelligent routing across multiple AI providers
- Model selection based on task complexity
- Fallback mechanisms
- Cost optimization
- Performance monitoring

### 3. Project Generation
- Automated project structure generation
- Technology stack recommendations
- Wireframe creation
- Code scaffolding
- Methodology selection (V-Model, Agile, Waterfall, etc.)

### 4. Admin Dashboard
- User management
- API key configuration
- Rate limiting controls
- Model health monitoring
- Analytics and metrics

### 5. Advanced Features
- **Page Builder:** Visual website creation with GrapesJS
- **Knowledge Base:** RAG (Retrieval Augmented Generation) system
- **ASPICE Compliance:** Automotive software quality standards
- **Test Generation:** Automated test case creation
- **Security Scanning:** Code vulnerability detection
- **Maturity Assessment:** Project readiness evaluation

---

## 📦 Build Information

### Production Builds
- **Client:** ~22 MB (includes Monaco, Three.js, GrapesJS)
- **Server:** ~13 MB
- **Shared:** <1 MB

### Build Commands
```bash
# Build all workspaces
npm run build

# Production build (clean + build all)
npm run build:prod

# Individual workspace builds
npm run build:client
npm run build:server
npm run build:shared
```

---

## 🔐 Environment Variables

### Client (.env)
```
VITE_API_URL=<backend-url>
VITE_ENVIRONMENT=production
```

### Server (.env)
```
NODE_ENV=production
PORT=3002
MONGODB_URI=<mongodb-connection-string>
JWT_SECRET=<secure-secret>
GEMINI_API_KEY=<google-api-key>
OPENAI_API_KEY=<openai-key>
ANTHROPIC_API_KEY=<anthropic-key>
CORS_ORIGIN=<frontend-url>
E2B_API_KEY=<e2b-sandbox-key>
```

---

## 🌐 Deployment Configuration

### Created Files
- ✅ `docker-compose.yml` - Full stack containerization
- ✅ `client/Dockerfile` - Nginx-based frontend container
- ✅ `server/Dockerfile` - Multi-stage Node.js container
- ✅ `client/nginx.conf` - SPA routing + caching
- ✅ `client/vercel.json` - Vercel deployment config
- ✅ `server/Procfile` - Railway/Heroku process definition
- ✅ `DEPLOYMENT.md` - Comprehensive deployment guide

### Recommended Platforms
1. **Frontend:** Vercel or Netlify
2. **Backend:** Railway, Render, or Heroku
3. **Database:** MongoDB Atlas
4. **Alternative:** Full Docker deployment

---

## 📊 Key Dependencies

### Frontend (38 total)
- React ecosystem (react, react-dom, react-router-dom)
- UI libraries (framer-motion, tailwindcss)
- 3D graphics (three, @react-three/fiber, @react-three/drei)
- Editors (monaco-editor, grapesjs)
- Data visualization (d3, cytoscape, mermaid)
- AI integration (@google/genai, @e2b/code-interpreter)

### Backend (40+ total)
- Express.js + middleware
- MongoDB + Mongoose
- AI SDKs (Google AI, OpenAI, Anthropic)
- Authentication (jsonwebtoken, bcrypt)
- File handling (multer, pdf-parse)
- Task processing (bull, redis)
- WebSocket (socket.io)

---

## 🔄 Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development servers
npm run dev              # Both client & server
npm run dev:client       # Frontend only
npm run dev:server       # Backend only
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

---

## 📁 Important Directories

### Client
- `client/src/components/` - UI components (100+ files)
- `client/src/services/` - API integration
- `client/src/hooks/` - Custom React hooks
- `client/src/contexts/` - React contexts
- `client/src/views/` - Main views (Workspace, Setup)

### Server
- `server/src/routes/` - API endpoints
- `server/src/services/` - Business logic
- `server/src/models/` - MongoDB schemas
- `server/src/middleware/` - Express middleware
- `server/src/utils/` - Helper functions

### Documentation
- `docs/` - Technical documentation
- `DEPLOYMENT.md` - Deployment guide
- `README.md` - Project overview

---

## 🎨 UI/UX Features

- Modern glassmorphism design
- Dark mode support
- Responsive layout (mobile, tablet, desktop)
- Drag-and-drop interfaces
- Real-time chat with typing indicators
- Progress tracking with visual feedback
- Toast notifications
- Modal dialogs
- Context menus
- Keyboard shortcuts

---

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS configuration
- Rate limiting
- Input validation with Zod
- XSS protection
- CSRF tokens
- Secure headers
- Environment variable management

---

## 📈 Scalability Considerations

- Stateless server design
- MongoDB indexing strategy
- Redis caching layer
- Task queue for long-running operations
- Database connection pooling
- Horizontal scaling support
- CDN integration for static assets
- Load balancer ready

---

## 🎯 Use This Information To:

1. **Generate deployment documentation** for various platforms
2. **Create user guides** for features and workflows
3. **Prepare API documentation** for integrations
4. **Draft architecture diagrams** for technical documentation
5. **Write setup instructions** for developers
6. **Create troubleshooting guides** for common issues
7. **Prepare marketing materials** describing capabilities
8. **Generate security documentation** for compliance
9. **Create onboarding materials** for new users
10. **Draft technical specifications** for stakeholders

---

## 📝 Next Steps for Documentation

Ask Perplexity to help you create:
- Detailed API documentation
- User onboarding guides
- Developer setup instructions
- Architecture decision records (ADRs)
- Security and compliance documentation
- Performance optimization guides
- Monitoring and logging setup
- Disaster recovery procedures
- Contribution guidelines
- FAQ and troubleshooting guides
