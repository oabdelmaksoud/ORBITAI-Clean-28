# Developer Guide

A comprehensive guide for new developers joining OrbitAI.

## Prerequisites

- **Node.js** 20+ (use `nvm` for version management)
- **MongoDB** 7.0+ (local, Docker, or Atlas)
- **Git** for version control
- **IDE** with TypeScript support (VS Code recommended)

---

## Initial Setup

### 1. Clone & Install

```bash
# Clone repository
git clone <repository-url>
cd ORBITAI-Clean

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Environment Configuration

**Frontend** (`.env` in root):
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

**Backend** (`server/.env`):
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/orbitai
JWT_SECRET=your-development-secret
API_KEY_ENCRYPTION_KEY=32-char-encryption-key
```

### 3. Start Development

```bash
# Terminal 1: Frontend
npm run dev
# → http://localhost:5173

# Terminal 2: Backend  
cd server
npm run dev
# → http://localhost:3001
```

---

## Project Structure

### Frontend

```
/
├── App.tsx              # Main app (large - being refactored)
├── components/          # UI components
│   ├── neural-stream-chat/  # Main chat feature
│   │   ├── hooks/       # Feature-specific hooks
│   │   ├── components/  # Sub-components
│   │   └── utils/       # Utilities
│   └── admin-dashboard/ # Admin panel
├── services/            # API clients
├── hooks/               # Shared hooks
├── contexts/            # React contexts
└── types/               # TypeScript types
```

### Backend

```
server/src/
├── routes/              # API endpoints
├── services/            # Business logic
├── models/              # MongoDB schemas
├── middleware/          # Express middleware
└── config/              # Configuration
```

---

## Key Patterns

### 1. API Calls
Use service files in `/services`:

```typescript
// services/projectService.ts
export const getProjects = async (token: string) => {
  const response = await fetch(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
};
```

### 2. Authentication
Use the `useAuth` hook:

```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user, token, isAuthenticated } = useAuth();
  // ...
}
```

### 3. LLM Calls
Use the LLM Router service (don't call providers directly):

```typescript
// Backend: use llmRouter or internalTaskRouter
import { llmRouter } from './llm/llmRouter.service';

const response = await llmRouter.generateContent(prompt, {
  taskType: 'brainstorming',
  model: 'gemini-2.0-flash'
});
```

---

## Development Workflow

### 1. Feature Development
1. Create a branch: `git checkout -b feature/my-feature`
2. Implement changes
3. Test locally
4. Submit PR

### 2. Adding a New Component
```bash
# Create component
components/
└── MyComponent/
    ├── MyComponent.tsx
    ├── MyComponent.css (optional)
    └── index.ts
```

### 3. Adding an API Endpoint
```typescript
// server/src/routes/myFeature.routes.ts
import { Router } from 'express';
import { auth } from '../middleware/auth';

const router = Router();

router.get('/', auth, async (req, res) => {
  // Implementation
});

export default router;
```

Register in `server/src/index.ts`.

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `cd server && npm run dev` | Start backend |
| `npm run build` | Build frontend |
| `npm test` | Run tests |

---

## Getting Help

1. Check `/docs` folder for specific guides
2. Review `PROJECT_REVIEW.md` for codebase overview
3. Use Swagger UI at `http://localhost:3001/api-docs`
