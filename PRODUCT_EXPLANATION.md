# OrbitAI: Product Overview & Capabilities

## 1. Product Overview
**OrbitAI** is an "Autonomous Software Architect" platform designed to accelerate the software development lifecycle from initial ideation to functional prototyping and testing. It leverages advanced AI to act as a co-founder and technical guide, helping users brainstorm, plan, visualize, generate, and **autonomously test** software projects.

Unlike standard chatbots, OrbitAI is context-aware, stateful, and integrated with a suite of professional tools for project management, compliance, and automated quality assurance.

## 2. Core Purpose
The primary purpose of OrbitAI is to bridge the gap between a **rough idea** and a **production-ready specification**. It solves:
*   **Analysis Paralysis:** Guidance through the initial planning phase.
*   **Technical Complexity:** Abstracting architectural decisions.
*   **Visualization:** Instantly turning text descriptions into visual user interfaces.
*   **Testing & Quality:** **(New)** Autonomously navigating and testing applications using a Computer Use Agent.
*   **Governance:** Ensuring projects meet maturity and compliance standards from Day 1.

## 3. Key Features

### 🤖 Computer Use Agent (CUA)
A cutting-edge feature that allows OrbitAI to "see" and interact with the generated application like a human user.
*   **Autonomous Testing:** Uses a Headless Browser (Playwright) to navigate the prototype, click buttons, fill forms, and verify logic.
*   **Live Visual Feed:** Streams the browser view back to the user in real-time, showing the AI's cursor movements and typing.
*   **AI Scan & Scenario Generation:** Automatically analyzes the HTML structure of the prototype to generate relevant test scenarios (e.g., "Login Flow", "Shopping Cart Checkout") without user input.
*   **Human-Like Interaction:** Simulates natural mouse curves, typing delays, and "thinking pauses" to test realistic usage patterns.

### 🧠 AI Brainstorming & Neural Stream
The heart of the application is the **Neural Stream Chat**.
*   **Multi-Model Intelligence:** Uses an "LLM Router" to switch between Gemini, OpenAI, and Anthropic models based on task complexity.
*   **Context Awareness:** Remembers project history and decisions.
*   **Visual Logic:** Can generate mind maps and flowcharts to visualize ideas during the conversation.

### 📊 Live Maturity Assessment
A real-time scoring engine that evaluates project readiness.
*   **5-Point Criteria:** Clarity, Feasibility, Completeness, Standards, and Research.
*   **AI Insights:** Provides detailed reasoning and actionable recommendations to improve the score.
*   **Readiness Tracking:** Visual progress bars indicating when a project is "Green" and ready for development.

### 🎨 Instant Prototype Generation & Sandbox
Turns requirements into working React code instantly.
*   **WebContainer Technology:** Runs a full Node.js environment directly in the browser for secure, zero-latency execution.
*   **Live Preview:** Renders React/Tailwind code with hot-reloading.
*   **Interactive Editing:** Users can modify the code or ask the AI to "Make the buttons blue" and see changes instantly.

### � Mission Control & Project Management
A centralized hub for tracking project velocity.
*   **Visual Progress:** A "System Building" visualization that tracks the AI's progress through analysis, architecture, and generation phases.
*   **Kanban Boards:** automated task tracking.
*   **Milestone Tracker:** High-level project timeline management.

### 🤝 Real-Time Collaboration
*   **Multi-User Presence:** See who else is viewing the project.
*   **Live Cursors:** Track team members' mouse movements in real-time (WebSocket-powered).
*   **Conflict Resolution:** Handles concurrent edits to project state.

### 💬 Intelligent User Support Widget
A built-in support system for users of the platform.
*   **Hybrid Support:** Seamlessly switches between an automated AI Agent and human support staff.
*   **Queue System:** Manages user wait times for human agents.
*   **Ticket Management:** Allows users to submit and track complex issues.

### 🛡️ Admin & Governance
*   **Compliance Dashboards:** ASPICE, Security, and NFR (Non-Functional Requirements) monitoring.
*   **Cost Estimation:** Real-time calculation of projected cloud and system costs.

## 4. How It Works (The User Journey)

### Step 1: Ideation & Brainstorming
The user starts in the **Neural Stream Chat**. They describe their idea (e.g., "I want to build a fitness app"). The AI asks clarifying questions, suggests features, and builds a **Mind Map** of the core concepts.

### Step 2: Assessment & Refinement
As the conversation progresses, the **Maturity Assessment** score updates in real-time. If the score is low, the AI proactively asks questions to define the missing pieces.

### Step 3: Prototyping
The user triggers **Prototype Generation**. OrbitAI writes the React/Tailwind code and displays it in the **Preview Panel**.

### Step 4: Autonomous Verification (CUA)
The user activates the **Computer Use Agent**. The CUA:
1.  Analyzes the prototype's DOM.
2.  Generates a test suite (e.g., "Verify Login Button", "Test Navigation").
3.  **Executes the tests live**, streaming the video feed to the user.
4.  Reports pass/fail results for each scenario.

### Step 5: Governance & Handover
The user moves to the **Project View** to export the **Kanban Plan**, **Cost Estimates**, and **Compliance Checklists**, ready for the engineering team.

## 5. Technology Stack
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend:** Node.js, Express, MongoDB, Socket.IO (for real-time streaming)
*   **AI Layer:** Multi-provider integration (Gemini, OpenAI, Anthropic).
*   **Automation:** Playwright (for CUA/Browser automation).
