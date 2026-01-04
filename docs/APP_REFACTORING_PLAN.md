# App.tsx Refactoring Plan

## Current State Analysis

**File:** `App.tsx`  
**Total Lines:** 7,373  
**Outline Items:** 117 functions/components  
**Main App Function:** Lines 379–7,370 (~7,000 lines!)

---

## Extraction Strategy

We will use a **feature-based extraction** approach, grouping related functions into custom hooks and components.

---

## Phase 1: Extract Custom Hooks (Highest Impact)

### 1.1 `useProjectManagement` Hook
**Lines:** ~1,200  
**Location:** `hooks/useProjectManagement.ts`

**Functions to extract:**
- `loadProjects()` (1189-1211)
- `loadSampleProjects()` (1220-1252)
- `handleCreateNewProject()` (3206-3258)
- `handleLoadProject()` (3437-3612)
- `handleDeleteProject()` (3613)
- `confirmDeleteProject()` (3898-4156)
- `handleLoadDemoProject()` (3260-3379)
- `handleSelectTemplate()` (3381-3432)
- `handleSaveAsTemplate()` (3434-3436)
- `handleToggleSampleProject()` (3615-3800)
- `handleExportProjectData()` (3801-3896)
- `handleRenameProject()` (4582)
- `saveCurrentProject()` (3122-3130)

---

### 1.2 `useAuthentication` Hook
**Lines:** ~400  
**Location:** `hooks/useAuthentication.ts`

**Functions to extract:**
- `handleSignup()` (1996-2006)
- `handleLogin()` (2008-2035)
- `handleUserLoginSuccess()` (2037-2077)
- `handleUserSignupSuccess()` (2079-2084)
- `handlePackageSelect()` (2086-2097)
- `handlePaymentSuccess()` (2099-2102)
- `completeSignup()` (2104-2130)
- `handleUpgradeClick()` (2132-2135)
- `handleProfileClick()` (2137-2143)
- `handleUserLogout()` (2239-2244)
- `refreshUserRole()` (531-571)

---

### 1.3 `useAdminOperations` Hook
**Lines:** ~200  
**Location:** `hooks/useAdminOperations.ts`

**Functions to extract:**
- `handleAdminClick()` (2217-2220)
- `handleAdminLoginSuccess()` (2222-2227)
- `handleAdminLogout()` (2229-2237)

---

### 1.4 `useAutoPilot` Hook
**Lines:** ~600  
**Location:** `hooks/useAutoPilot.ts`

**Functions to extract:**
- `startAutoPilot()` (4161-4227)
- `handleAutoPilotClick()` (4229-4248)
- `runAutoPilot()` (6635-6702)
- `pauseAutoPilot()` (6634)
- `stopExecution()` (6580-6633)
- `orchestratePhase()` (6156-6400)
- `advancePhase()` (6577)
- `startNextSprint()` (6578)
- `regressPhase()` (6579)
- `handleForceBuild()` (6487)
- `runAllTasksInternal()` (6491-6526)

---

### 1.5 `useBrainstorming` Hook
**Lines:** ~800  
**Location:** `hooks/useBrainstorming.ts`

**Functions to extract:**
- `handleSetupSend()` (4685-5340)
- `proceedToWorkspace()` (5342-5783)
- `handleManualLaunch()` (5785-5801)
- `handleLaunchFromBrainstorming()` (5803-6153)
- `handleEnhanceInput()` (4252)
- `handleDeepResearch()` (4253-4294)
- `handleAiThemeGen()` (4589-4615)
- `handleRandomTheme()` (4617-4683)
- `handleSuggestionClick()` (2465)

---

### 1.6 `useStandards` Hook
**Lines:** ~300  
**Location:** `hooks/useStandards.ts`

**Functions to extract:**
- `toggleStandard()` (4296)
- `inferStandardsFromDescription()` (4380-4462)
- `handleAddStandard()` (4575)
- `handleRemoveStandard()` (4576)
- `handleRunAudit()` (4581)

---

### 1.7 `useWebSocket` Hook
**Lines:** ~100  
**Location:** `hooks/useWebSocket.ts`

**Functions to extract:**
- `setupWebSocket()` (735-824)

---

### 1.8 `useHITL` Hook (Human-In-The-Loop)
**Lines:** ~100  
**Location:** `hooks/useHITL.ts`

**Functions to extract:**
- `hasHITLPreferenceSet()` (2145-2148)
- `setHITLPreference()` (2150-2155)
- `getHITLPreference()` (2157-2164)

---

### 1.9 `useFeatureFlags` Hook
**Lines:** ~200  
**Location:** `hooks/useFeatureFlags.ts`

**Functions to extract:**
- `initFeatureFlags()` (969-986)
- `isFeatureEnabled()` (867-893)
- `shouldShowFeature()` (895-921)
- `isButtonDisabled()` (923-949)

---

### 1.10 `useSharing` Hook
**Lines:** ~300  
**Location:** `hooks/useSharing.ts`

**Functions to extract:**
- `checkShareLink()` (1273-1292)
- `handleLoadSharedProject()` (1770-1964)

---

## Phase 2: Extract Components

### 2.1 `ProcessingOverlay` Component
**Lines:** 170-244 (~75 lines)  
**Location:** `components/ProcessingOverlay.tsx`

Already defined inline, just needs to be moved.

---

### 2.2 `LandingPageContent` Component
**Location:** `components/landing/LandingPageContent.tsx`

Extract the landing page rendering logic from the main return statement.

---

### 2.3 `WorkspaceContent` Component
**Location:** `components/workspace/WorkspaceContent.tsx`

Extract the workspace view rendering logic.

---

### 2.4 `AdminContent` Component
**Location:** `components/admin/AdminContent.tsx`

Extract admin dashboard rendering.

---

## Phase 3: Extract State Management

### 3.1 `appReducer.ts`
**Lines:** 247-366  
**Location:** `state/appReducer.ts`

Move:
- `Action` type definition (247-279)
- `createInitialState()` (281-301)
- `reducer()` (303-366)
- `ProjectState` type
- `ProjectMetadata` interface

---

### 3.2 `AppContext.tsx`
**Location:** `state/AppContext.tsx`

Create context provider for global app state.

---

## Phase 4: Code Quality & Cleanup

### 4.1 Type Safety
Fix all existing Type Errors in `App.tsx` and related files.
- **Goal:** Clean build (0 errors)
- **Status:** ✅ Complete (App.tsx)

---

## Implementation Order

```
Week 1: Foundation
├── Day 1-2: Extract state (types.ts ✅, appReducer - In Progress)
├── Day 3: Extract ProcessingOverlay component
└── Day 4-5: Extract useAuthentication hook

Week 2: Core Hooks
├── Day 1-2: Extract useProjectManagement hook ✅
├── Day 3: Extract useAutoPilot hook
└── Day 4-5: Extract useBrainstorming hook

Week 3: Remaining Hooks + Components
├── Day 1: Extract useStandards, useWebSocket, useHITL
├── Day 2: Extract useFeatureFlags, useSharing
└── Day 3-5: Extract view components
```

---

## Expected Results

| App.tsx lines | 7,373 | 7,373 (Progress: Extracted ~1200 lines) |
| Number of hooks | 0 | 1 (`useProjectManagement`) |
| Number of components | All inline | In Progress |
| Testability | Near impossible | Improving |
| Code discoverability | Very poor | Improving |
| Type Safety | 210 errors | Significant reduction |

---

## Progress Log

- **[2025-12-21]**: 
  - Extracted `useProjectManagement` hook (~1200 lines logic moved).
  - Centralized `ProjectMetadata` type in `types.ts`.
  - Refactored `App.tsx` state management for project data.
  - Fixed duplicate type definitions and circular dependencies.

---

## Files to Create

```
/hooks/
├── useProjectManagement.ts    (~800 lines)
├── useAuthentication.ts       (~400 lines)
├── useAdminOperations.ts      (~150 lines)
├── useAutoPilot.ts            (~500 lines)
├── useBrainstorming.ts        (~700 lines)
├── useStandards.ts            (~250 lines)
├── useWebSocket.ts            (~100 lines)
├── useHITL.ts                 (~50 lines)
├── useFeatureFlags.ts         (~150 lines)
└── useSharing.ts              (~250 lines)

/state/
├── appReducer.ts              (~150 lines)
├── AppContext.tsx             (~100 lines)
└── types.ts                   (~100 lines)

/components/
├── ProcessingOverlay.tsx      (~80 lines)
├── landing/
│   └── LandingPageContent.tsx (~200 lines)
├── workspace/
│   └── WorkspaceContent.tsx   (~300 lines)
└── admin/
    └── AdminContent.tsx       (~150 lines)
```

---

## Start Command

Ready to begin? I recommend starting with **Phase 1.1: Extract appReducer.ts and state types** as the foundation.
