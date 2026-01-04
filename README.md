# 🚀 OrbitAI

**The Autonomous Software Architect** - AI-powered brainstorming and project generation platform.

## Quick Start

```bash
# Frontend
npm install
npm run dev

# Backend (separate terminal)
cd server
npm install
npm run dev
```

**Frontend:** http://localhost:5173  
**Backend:** http://localhost:3001

## Project Structure

```
ORBITAI-Clean/
├── components/          # React UI components
├── services/            # Frontend API services
├── hooks/               # Custom React hooks
├── contexts/            # React context providers
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── i18n/                # Internationalization
├── server/              # Backend Express server
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── models/      # MongoDB models
│   │   └── middleware/  # Express middleware
│   └── scripts/         # Utility scripts
├── docs/                # Documentation
└── public/              # Static assets
```

## Key Features

- 🤖 **AI Brainstorming** - Interactive chat for project ideation
- 🔄 **LLM Router** - Intelligent routing across AI providers
- 📊 **Mind Map Visualization** - Visual idea organization
- 🎨 **Prototype Generation** - Auto-generate project previews
- 👤 **Admin Dashboard** - Full control panel

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Backend:** Node.js, Express, MongoDB
- **AI:** Gemini, OpenAI, Anthropic (via router)

## Documentation

See [`/docs`](docs/README.md) for detailed guides.
