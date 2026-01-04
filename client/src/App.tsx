
import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo, startTransition } from 'react';
import {
  ProjectState, Phase, AgentRole, TaskStatus, Task, LogEntry, Artifact, Agent, ChatMessage, AppSettings, MCPServer, DialogueEvent, ProjectBudget, TokenUsage, EvaluationResult, UserProfile, PlanTier, Methodology, ProjectMetadata
} from '@orbitai/shared';
import { AGENTS, AGENT_NAMES_POOL, PHASE_ORDER, INITIAL_PROJECT_NAME, INITIAL_PROJECT_DESC, DEFAULT_MCP_SERVERS, QUALITY_STANDARDS, INITIAL_BUDGET, MODEL_PRICING, PROJECT_THEMES } from '@orbitai/shared';
import { executeAgentTask, orchestrateNextSteps, interrogateAgent, validateProjectScope, chatWithOrchestrator, enhanceUserPrompt, generateEmbedding, performDeepResearch, modifyTaskWithAI, extractMCPTools, generateAgentProfile, apiMonitor, APIHealth, APIMetrics, generateProjectPreview, ProjectPreview, generateQuickSuggestions, generateAppTheme } from './services/geminiService';
import { executeTaskWithQualityImprovement } from './services/qualityImprovement.service';
import { getUserFriendlyErrorFromError } from './services/errorMessages';
import { getSampleProjects } from './services/sampleProjectsApi';
import { markProjectAsSample, unmarkProjectAsSample } from './services/adminApi';
import { projectsApi, setAuthToken } from '@src/services/api';
import { projectStorage, generateObjectId, isValidObjectId, cleanupInvalidProjectIds, cleanupProjectIdFromAllSources, isProjectNotFound } from './services/projectStorage';
import { agentAssignmentService } from './services/agentAssignment.service';
import AgentCard from './components/AgentCard';
import KanbanBoard from './components/KanbanBoard';
import LogConsole from './components/LogConsole';
import MCPStatus from './components/MCPStatus';
import TaskEditModal from './components/TaskEditModal';
import WorkspaceTutorial, { hasCompletedTutorial } from './components/WorkspaceTutorial';
import { initializeBrowserUtils } from './utils/browserUtils';
import AdminLogin from './components/AdminLogin';
import SubscriptionOverlay from './components/SubscriptionOverlay';
import LandingPage from './components/LandingPage';
import { ElementorLandingShell } from './components/ElementorLandingShell';
import { getLandingConfig } from './config/landing';
import UserLogin from './components/UserLogin';
import Logo from './components/Logo';
import UserSignup from './components/UserSignup';
import PackageSelection from './components/PackageSelection';
import Payment from './components/Payment';
import UserProfileModal from './components/UserProfileModal';
import UserSupportWidget from './components/UserSupportWidget';
import { Tooltip, HelpIcon } from './components/Tooltip';
import ErrorDisplay from './components/ErrorDisplay';
import ConfirmationModal from './components/ConfirmationModal';
import HITLPromptModal from './components/HITLPromptModal';
import { useHistory } from './hooks/useHistory';
import { useFeatureAccess } from './hooks/useFeatureAccess';
import { useUserSettings } from './hooks/useUserSettings';
import { useProjectState } from './hooks/useProjectState';
import { useProjectManagement } from './hooks/useProjectManagement';
import { useAuth } from './contexts/AuthContext';
import { SkipLink } from './components/SkipLink';
import { ProjectTemplate } from '@orbitai/shared';
import { AppRouter } from './components/AppRouter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { toastService, Toast, toast } from './services/toastService';
import { Settings, RotateCw, Layout, FileText, ChevronRight, ChevronLeft, Hexagon, Activity, GripVertical, Code, Zap, StopCircle, Bot, Globe, Wifi, WifiOff, Network, MessageSquare, Users, Send, Sparkles, User, Paperclip, Trash2, ArrowDown, Loader2, Wand2, MessageSquarePlus, ShieldCheck, CheckSquare, Pause, Square, Terminal as TerminalIcon, Microscope, Book, CreditCard, Layers, Plus, Folder, LayoutGrid, Clock, Calendar, Gauge, Signal, Repeat, FilePlus, X, Save, Edit2, ShoppingCart, Gamepad2, Database, Smartphone, Server, Shield, Crown, Lock, Eye, GitGraph, FileCode, Play, Cpu, ShieldAlert, Palette, Dices, Undo2, Redo2, LogOut, Share2, Rocket, Heart, Ticket, Download, FileJson, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import JSZip from 'jszip';
// @ts-ignore
import remarkGfm from 'remark-gfm';

// ... Lazy Load Heavy Components ...
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const ComplianceDashboard = React.lazy(() => import('./components/ComplianceDashboard'));
const AgentDetailModal = React.lazy(() => import('./components/AgentDetailModal'));
const AgentEditorModal = React.lazy(() => import('./components/AgentEditorModal'));
const ArtifactViewer = React.lazy(() => import('./components/ArtifactViewer'));
const CodeEditor = React.lazy(() => import('./components/CodeEditor'));
const VModelVisualizer = React.lazy(() => import('./components/VModelVisualizer'));
const AgentChat = React.lazy(() => import('./components/AgentChat'));
const PreviewFrame = React.lazy(() => import('./components/PreviewFrame'));
const MermaidDiagram = React.lazy(() => import('./components/MermaidDiagram'));
const NetworkVisualizer = React.lazy(() => import('./components/NetworkVisualizer'));
const KnowledgeBase = React.lazy(() => import('./components/KnowledgeBase'));
const CostEstimator = React.lazy(() => import('./components/CostEstimator'));
const RequirementsDashboard = React.lazy(() => import('./components/RequirementsDashboard'));
const MilestoneTracker = React.lazy(() => import('./components/MilestoneTracker'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const ShareProject = React.lazy(() => import('./components/ShareProject'));
const ProjectTemplateSelector = React.lazy(() => import('./components/ProjectTemplateSelector'));
const ProjectImport = React.lazy(() => import('./components/ProjectImport'));
const ProjectReportExport = React.lazy(() => import('./components/ProjectReportExport'));
const Terminal = React.lazy(() => import('./components/Terminal'));

// Helper to clean Mermaid code
const cleanMermaidCode = (code: string | undefined | null | any) => {
  if (!code) return '';
  // Ensure code is a string
  if (typeof code !== 'string') {
    console.warn('[cleanMermaidCode] Received non-string value:', typeof code, code);
    // Try to convert to string if possible
    if (code && typeof code.toString === 'function') {
      code = code.toString();
    } else {
      return '';
    }
  }
  // Remove markdown code blocks
  let cleaned = code
    .replace(/```(?:mermaid|mmd)?/gi, '')
    .replace(/```/g, '');

  // Fix line breaks within strings (common issue from LLM generation)
  // Process character by character to handle escaped quotes properly
  let fixedCode = '';
  let inString = false;
  let stringChar: string | null = null;
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];
    const prevChar = i > 0 ? cleaned[i - 1] : null;

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      fixedCode += char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = null;
      fixedCode += char;
    } else if (inString && (char === '\n' || char === '\r')) {
      // Replace line breaks within strings with spaces
      if (fixedCode[fixedCode.length - 1] !== ' ') {
        fixedCode += ' ';
      }
    } else {
      fixedCode += char;
    }
    i++;
  }

  cleaned = fixedCode
    // Fix common syntax issues
    .replace(/Container_Component\(/g, 'Container(')
    .replace(/System_Backend\(/g, 'System(')
    .replace(/Container_/g, 'Container')
    .replace(/System_/g, 'System')
    // Fix HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    // Remove leading/trailing whitespace and newlines
    .trim();

  // Ensure it starts with a valid Mermaid directive
  if (cleaned && !cleaned.match(/^(C4Container|C4System|C4Person|graph|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|gitgraph|journey|stateDiagram|mindmap|timeline|requirement|quadrantChart|C4Context)/i)) {
    // Try to prepend C4Container if it looks like C4 diagram
    if (cleaned.includes('Container(') || cleaned.includes('System(') || cleaned.includes('Person(')) {
      cleaned = 'C4Container\n' + cleaned;
    }
  }

  // Validate C4 diagrams: if it's a C4 diagram, ensure it has actual content
  if (cleaned && cleaned.match(/^C4(Container|System|Person)/i)) {
    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // C4 diagrams must have at least the directive + one function call (Container, System, Person, Rel, etc.)
    const hasContent = lines.some(line =>
      /^(Container|System|Person|System_Ext|Container_Ext|Rel|SystemBoundary|ContainerBoundary|Person_Ext|UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig)\(/i.test(line)
    );

    if (!hasContent && lines.length <= 1) {
      // Diagram is incomplete - provide a fallback
      console.warn('[cleanMermaidCode] Incomplete C4 diagram detected, providing fallback');
      return `C4Container
Container(frontend, "Frontend Application", "React application providing user interface", "React")
Container(backend, "Backend API", "Node.js API server handling business logic", "Node.js")
ContainerDb(database, "Database", "PostgreSQL database storing application data", "PostgreSQL")
Rel(frontend, backend, "Makes API calls")
Rel(backend, database, "Reads from and writes to")`;
    }
  }

  return cleaned;
};

// ... ProcessingOverlay Component ...
const ProcessingOverlay = ({
  label,
  progress,
  statusText,
  estimatedTime,
  taskCount
}: {
  label: string,
  progress?: number,
  statusText?: string,
  estimatedTime?: number,
  taskCount?: number
}) => {
  // Calculate estimated time remaining based on progress and elapsed time
  const getEstimatedTimeText = () => {
    if (estimatedTime !== undefined && estimatedTime > 0) {
      return `~${estimatedTime}s remaining`;
    }
    // If no explicit estimate, don't show time estimate
    return '';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 min-w-[320px] max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-primary animate-shimmer bg-[length:200%_100%]"></div>
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
          <div className={`absolute inset-0 border-4 border-primary border-t-transparent rounded-full ${progress !== undefined ? 'transition-all duration-500' : 'animate-spin'}`} style={progress !== undefined ? { transform: `rotate(${progress * 3.6}deg)` } : {}}></div>
          {progress !== undefined && (
            <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-primary font-mono">
              {Math.round(progress)}%
            </div>
          )}
          {progress === undefined && <Bot size={32} className="text-primary animate-pulse" />}
        </div>
        <div className="text-center space-y-2 z-10">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">{label}</h3>
          <p className="text-sm text-slate-500 font-medium">
            {statusText || 'AI Agents are analyzing requirements...'}
          </p>
          {taskCount !== undefined && taskCount > 0 && (
            <p className="text-xs text-slate-400 font-medium">
              Generated {taskCount} task{taskCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            <span>Progress</span>
            <span className={progress !== undefined ? "text-primary" : "animate-pulse"}>
              {progress !== undefined ? (progress >= 100 ? 'Complete' : 'Processing...') : 'Thinking...'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            {progress !== undefined ? (
              <div
                className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <div className="h-full bg-gradient-to-r from-primary to-blue-400 w-1/2 animate-[shimmer_1.5s_infinite] rounded-full"></div>
            )}
          </div>
          {(progress !== undefined && progress < 100) && getEstimatedTimeText() && (
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-medium">{getEstimatedTimeText()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type ViewMode = 'landing' | 'hub' | 'setup' | 'workspace' | 'admin' | 'shared' | 'agentic-demo';

const App: React.FC = () => {
  // Reload loop detection and prevention
  useEffect(() => {
    const reloadCount = sessionStorage.getItem('app_reload_count') || '0';
    const reloadTime = sessionStorage.getItem('app_reload_time') || '0';
    const now = Date.now();

    // If we've reloaded more than 3 times in 5 seconds, stop
    if (parseInt(reloadCount) > 3 && (now - parseInt(reloadTime)) < 5000) {
      console.error('🚨 RELOAD LOOP DETECTED - Stopping app to prevent infinite reload');
      sessionStorage.setItem('app_reload_count', '0');
      sessionStorage.setItem('app_reload_time', '0');
      // Show error message
      const root = document.getElementById('root');
      if (root) {
        root.innerHTML = `
          <div style="padding: 50px; text-align: center; font-family: sans-serif;">
            <h1 style="color: #dc2626;">⚠️ Reload Loop Detected</h1>
            <p>Please clear your browser cache and service workers:</p>
            <ol style="text-align: left; max-width: 600px; margin: 20px auto;">
              <li>Open DevTools (F12)</li>
              <li>Go to Application → Service Workers → Unregister all</li>
              <li>Go to Application → Clear storage → Clear site data</li>
              <li>Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)</li>
            </ol>
            <button onclick="location.reload()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Try Again
            </button>
          </div>
        `;
      }
      return;
    }

    // Increment reload count
    const newCount = parseInt(reloadCount) + 1;
    sessionStorage.setItem('app_reload_count', newCount.toString());
    sessionStorage.setItem('app_reload_time', now.toString());

    // Reset after 5 seconds
    setTimeout(() => {
      sessionStorage.setItem('app_reload_count', '0');
    }, 5000);

    // Diagnostic logging
    if (newCount > 1) {
      console.warn(`⚠️ App mounted ${newCount} times - possible reload loop`);
    }
  }, []);

  // Check if we're restoring a workspace project on mount to prevent blank project flicker
  const isRestoringWorkspace = (): boolean => {
    const hash = window.location.hash;
    if (hash === '#workspace') {
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('project');
      // If project ID is in URL and valid, we should attempt to restore
      // Database check will happen asynchronously in useEffect
      if (projectId && isValidObjectId(projectId)) {
        return true;
      }
      // Clear invalid project ID from URL
      if (projectId && !isValidObjectId(projectId)) {
        const url = new URL(window.location.href);
        url.searchParams.delete('project');
        window.history.replaceState({}, '', url.toString());
      }
    }
    return false;
  };

  const { state, dispatch, actions } = useProjectState();
  const stateRef = useRef(state);
  // CRITICAL FIX: Update ref directly in render phase - no useEffect needed
  // This prevents infinite render loop caused by state dependency
  stateRef.current = state;
  const [isRestoring, setIsRestoring] = useState(isRestoringWorkspace());

  // Initialize viewMode from URL hash if present
  const getInitialViewMode = (): ViewMode => {
    const hash = window.location.hash;
    // Check if hash starts with #admin (supports #admin?tab=finance format)
    if (hash.startsWith('#admin')) {
      return 'admin';
    }
    if (hash === '#hub') {
      return 'hub';
    }
    if (hash === '#setup') {
      return 'setup';
    }
    if (hash === '#workspace') {
      return 'workspace';
    }
    return 'landing';
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode());

  // --- MODERN VIEW STATE ---
  const [isModernView, setIsModernView] = useState<boolean>(() => {
    try {
      return localStorage.getItem('orbitai_modern_view') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleModernView = useCallback(() => {
    setIsModernView(prev => {
      const newValue = !prev;
      localStorage.setItem('orbitai_modern_view', String(newValue));
      return newValue;
    });
  }, []);

  // --- AUTH & SUBSCRIPTION STATE ---
  // Use centralized AuthContext instead of local state
  const { user, loading: authLoading, updateUser, logout: authLogout } = useAuth();

  // User settings from database
  const { settings: userSettings, updateSettings, updatePreference, loading: settingsLoading } = useUserSettings(user?.token || null);

  // Helper function to check if user is admin
  const isAdminUser = useCallback((user: UserProfile | null): boolean => {
    if (!user) return false;

    // Check role from user object
    let role = user.role?.toLowerCase()?.trim();

    // Fallback: Check localStorage directly if role is missing
    if (!role) {
      try {
        const storedUserStr = localStorage.getItem('orbitai_user');
        if (storedUserStr) {
          const storedUser = JSON.parse(storedUserStr);
          role = storedUser?.role?.toLowerCase()?.trim();
        }
      } catch (e) {
        console.error('Failed to check localStorage for role', e);
      }
    }

    const isAdmin = role === 'admin' || role === 'superadmin';

    return isAdmin;
  }, []);

  // Refresh user role from backend if missing (for existing logged-in users)
  const userEmailRef = useRef<string | undefined>(user?.email);
  const hasRefreshedRoleRef = useRef(false);

  useEffect(() => {
    userEmailRef.current = user?.email;
  }, [user?.email]);

  useEffect(() => {
    const refreshUserRole = async () => {
      // Only refresh once per email change, and only if role is missing
      if (!user || user.role || hasRefreshedRoleRef.current || userEmailRef.current !== user?.email) {
        return;
      }

      hasRefreshedRoleRef.current = true;

      try {
        // Try to get role from admin API
        const adminToken = localStorage.getItem('admin_token');
        if (adminToken && user.email) {
          const { getUsers } = await import('./services/adminApi');
          const response = await getUsers(adminToken);
          const adminUser = response.users.find((u: any) => u.email === user.email);
          if (adminUser && adminUser.role) {
            const roleStr = adminUser.role.toLowerCase().trim();
            const role = (['user', 'admin', 'editor', 'superadmin'].includes(roleStr) ? roleStr : 'user') as 'user' | 'admin' | 'editor' | 'superadmin';
            const updatedUser = { ...user, role };
            updateUser({ role });
            // Save user preferences to database if user is logged in
            if (user?.token) {
              try {
                await updatePreference('selectedTheme', updatedUser.selectedTheme);
                if (updatedUser.theme) {
                  await updatePreference('theme', updatedUser.theme);
                }
              } catch (dbError) {
                console.warn('Failed to save preferences to database:', dbError);
              }
            }
            // Keep localStorage as fallback
            localStorage.setItem('orbitai_user', JSON.stringify(updatedUser));
            console.log('[Refresh Role] User role updated from admin API:', adminUser.role);
          }
        }
      } catch (e) {
        console.warn('Failed to refresh user role from admin API', e);
        hasRefreshedRoleRef.current = false; // Allow retry on error
      }
    };

    refreshUserRole();
  }, [user?.email]); // Only run when user email changes

  // Reset refresh flag when email changes
  useEffect(() => {
    hasRefreshedRoleRef.current = false;
  }, [user?.email]);

  // Cleanup invalid project IDs - combined into single effect
  // CRITICAL: Run cleanup BEFORE project loading to prevent invalid project IDs from causing warnings
  useEffect(() => {
    const performCleanup = async () => {
      try {
        // Clean up invalid project IDs from all sources (URL, localStorage, user settings)
        // This prevents the "Project not found" warning by removing invalid IDs before they're used
        await cleanupInvalidProjectIds();

        // Also check URL and clean up immediately if project doesn't exist
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        if (urlProjectId && isValidObjectId(urlProjectId)) {
          // Verify project exists before allowing it to be loaded
          try {
            const dbProject = await projectsApi.getById(urlProjectId);
            if (!dbProject) {
              // Project doesn't exist - clean up immediately
              await cleanupProjectIdFromAllSources(urlProjectId);
            }
          } catch (error) {
            // Silently ignore - cleanup will handle it
          }
        }
      } catch (error) {
        // Silently fail - cleanup is non-critical
        if (import.meta.env.DEV) {
          console.debug('[App] Project ID cleanup error (non-critical):', error);
        }
      }
    };

    // Run cleanup on mount or when user logs in
    // This MUST run before the project loading useEffect below
    performCleanup();
  }, [user?.id]); // Runs on mount (undefined) and when user logs in

  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionMode, setSubscriptionMode] = useState<'login' | 'pricing'>('login');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [showUserSignup, setShowUserSignup] = useState(false);
  const [showPackageSelection, setShowPackageSelection] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Subscribe to toast service
  useEffect(() => {
    const unsubscribe = toastService.subscribe(setToasts);
    return unsubscribe;
  }, []);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [showShareProject, setShowShareProject] = useState(false);
  const [showProjectImport, setShowProjectImport] = useState(false);
  const [showReportExport, setShowReportExport] = useState(false);
  const [showExportDataMenu, setShowExportDataMenu] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showMobileDeploymentWizard, setShowMobileDeploymentWizard] = useState(false); // Mobile deployment wizard
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [sharedProjectToken, setSharedProjectToken] = useState<string | null>(null);
  const [dismissedGuestBanner, setDismissedGuestBanner] = useState(() => {
    // Check if banner was dismissed in this session
    return sessionStorage.getItem('guest_banner_dismissed') === 'true';
  });

  // --- ADMIN STATE ---
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    localStorage.getItem('admin_token')
  );
  const [adminUser, setAdminUser] = useState<any>(null);

  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatusText, setProcessingStatusText] = useState<string | undefined>(undefined);
  const [processingEstimatedTime, setProcessingEstimatedTime] = useState<number | undefined>(undefined);
  const [processingTaskCount, setProcessingTaskCount] = useState<number | undefined>(undefined);
  const processingStartTimeRef = useRef<number | null>(null);

  // Auto-Pilot State (HAND-OFF AI)
  // CRITICAL: Always initialize to 'idle' - never auto-start HAND-OFF AI
  // HAND-OFF AI should ONLY start on explicit user button click
  const [autoPilotStatus, setAutoPilotStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const autoPilotStatusRef = useRef<'idle' | 'running' | 'paused'>('idle');
  const isStoppingRef = useRef(false);
  const isBatchingRef = useRef(false);
  const activeTaskControllersRef = useRef<Map<string, AbortController>>(new Map());
  const batchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // HITL Prompt Modal state
  const [showHITLPrompt, setShowHITLPrompt] = useState(false);

  // App Settings state (needed for HITL preference functions)
  const [appSettings, setAppSettings] = useState<AppSettings>({ executionSpeed: 'normal', maxRetries: 2, autoScrollLogs: true, maxTasksPerPhase: 20, maxParallelTasks: 5, enableHumanInTheLoop: false });
  const settingsRef = useRef(appSettings);

  // Project Management State


  // Feature access checks
  // 'public' role is used when user is not signed in (user === null/undefined)
  // Normalize role to lowercase for consistent comparison with backend
  // CRITICAL: Memoize userRole to prevent infinite re-renders
  // Without memoization, this creates a new string on every render,
  // causing all useFeatureAccess hooks to re-run and trigger re-renders
  const userRole = useMemo(() => {
    return user?.role ? user.role.toLowerCase().trim() : 'public';
  }, [user?.role]);

  // Clear cache when user role changes from 'public' to actual role
  // This prevents showing stale 'public' cache entries for logged-in users
  const previousUserRoleRef = useRef<string>(userRole);
  const hasClearedCacheRef = useRef<boolean>(false);

  useEffect(() => {
    // Clear cache when:
    // 1. User logs in (transitions from 'public' to actual role)
    // 2. User role changes
    // 3. User object loads after initial render (to clear any 'public' cache from initial load)
    const shouldClearCache =
      (user && user.role && userRole !== 'public' && previousUserRoleRef.current !== userRole) ||
      (user && user.role && userRole !== 'public' && !hasClearedCacheRef.current);

    if (shouldClearCache) {
      previousUserRoleRef.current = userRole;
      hasClearedCacheRef.current = true;
      // User just logged in or role changed - clear old 'public' cache entries
      import('./services/featureAccess').then(({ clearFeatureCache }) => {
        clearFeatureCache();
        if (import.meta.env.DEV) {
          console.log('[App] Cleared feature cache - user role:', userRole);
        }
      });
    }

    // Reset flag when user logs out
    if (!user || !user.role) {
      hasClearedCacheRef.current = false;
    }
  }, [userRole, user?.role, user?.id]); // Use user?.id instead of user object to prevent re-runs

  // Listen for WebSocket broadcasts about feature flag updates
  useEffect(() => {
    // Only set up WebSocket listener if socket.io is available
    let socket: any = null;

    const setupWebSocket = async () => {
      try {
        // Delay WebSocket connection slightly to not block initial render
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Dynamically import socket.io-client only if needed
        const { io } = await import('socket.io-client');
        // Ensure we have a proper URL - socket.io-client needs a full URL
        // Import the normalizer to ensure port 3002
        const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
        let API_BASE_URL = getApiBaseUrl();

        // Ensure URL is properly formatted (no trailing slash, has protocol)
        API_BASE_URL = API_BASE_URL.trim().replace(/\/$/, '');
        if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
          API_BASE_URL = 'http://' + API_BASE_URL;
        }

        socket = io(API_BASE_URL, {
          transports: ['polling', 'websocket'], // Try polling first, then websocket
          reconnection: false, // Disable automatic reconnection to prevent console spam
          reconnectionDelay: 5000,
          reconnectionDelayMax: 10000,
          reconnectionAttempts: 1, // Only try once
          timeout: 5000, // Fail fast
          forceNew: false,
          upgrade: false, // Disable automatic upgrade to prevent multiple connection attempts
          autoConnect: false // Don't auto-connect - only connect when needed
        });

        // Only attempt connection if backend might be available
        // This prevents constant failed connection attempts
        socket.connect();

        socket.on('connect', () => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket] Connected for feature flag updates');
          }
        });

        socket.on('connect_error', (error: any) => {
          // Completely silent - backend is not running or WebSocket not ready, this is expected
          // Feature flags will work without WebSocket
          // Don't log anything to avoid console noise
          // Suppress the error from appearing in console
          if (error.message) {
            // Prevent default error logging
            error.preventDefault = () => { };
          }
        });

        socket.on('broadcast', (message: { type: string; featureKey?: string; message?: string }) => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket] Received broadcast:', message);
          }
          if (message.type === 'feature_flag_updated') {
            // Clear feature flag cache when flags are updated
            import('./services/featureAccess').then(({ clearFeatureCache, clearFeatureCacheForKey }) => {
              if (message.featureKey) {
                clearFeatureCacheForKey(message.featureKey);
              } else {
                clearFeatureCache();
              }
              // Trigger refresh of all useFeatureAccess hooks
              // Throttle to prevent rapid-fire updates
              const lastRefresh = sessionStorage.getItem('last_feature_refresh') || '0';
              const now = Date.now();
              if ((now - parseInt(lastRefresh)) > 500) { // Throttle to max once per 500ms
                sessionStorage.setItem('last_feature_refresh', now.toString());
                import('./hooks/useFeatureAccess').then(({ triggerFeatureRefresh }) => {
                  triggerFeatureRefresh();
                });
              }
            });
          }
        });

        socket.on('disconnect', () => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket] Disconnected');
          }
        });
      } catch (error) {
        // Socket.io not available or failed to connect - that's okay
        // Feature flags will still work, just without real-time updates
        if (import.meta.env.DEV) {
          console.debug('[WebSocket] Not available for feature flag updates');
        }
      }
    };

    setupWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []); // Only run once on mount

  // Debug logging for superadmin role
  useEffect(() => {
    if (userRole === 'superadmin' && (import.meta as any).env?.DEV) {
      // Debug: Reduced console noise
      // console.debug('[App] Superadmin detected - role:', userRole);
    }
  }, [userRole]); // Removed user dependency - userRole already depends on user?.role

  // Feature access checks - get full objects for helper functions
  const canViewSamples = useFeatureAccess('viewing_sample_projects', userRole);
  const canCreateProjects = useFeatureAccess('project_creation', userRole);
  const canDeleteProjects = useFeatureAccess('project_deletion', userRole);
  const canSwitchEnvironment = useFeatureAccess('environment_switching', userRole);
  const canExportProjects = useFeatureAccess('project_export', userRole);
  const canShareProjects = useFeatureAccess('project_sharing', userRole);
  const canImportProjects = useFeatureAccess('project_import', userRole);
  const canExportReports = useFeatureAccess('export_reports', userRole);
  const canExportData = useFeatureAccess('export_data', userRole);
  const canAccessTerminal = useFeatureAccess('terminal_access', userRole);
  const canUseTemplates = useFeatureAccess('template_use', userRole);
  const canViewAllProjects = useFeatureAccess('view_all_projects', userRole);
  const canUseCodeEditor = useFeatureAccess('code_editor', userRole);
  const canUseArtifactViewer = useFeatureAccess('artifact_viewer', userRole);
  const canUsePreviewMode = useFeatureAccess('preview_mode', userRole);
  const canUseAIChat = useFeatureAccess('ai_chat', userRole);
  const canUseAICodeGeneration = useFeatureAccess('ai_code_generation', userRole);
  const canUseAITaskAutomation = useFeatureAccess('ai_task_automation', userRole);
  const canUseAISuggestions = useFeatureAccess('ai_suggestions', userRole);
  const canCustomizeAgents = useFeatureAccess('agent_customization', userRole);
  const canDeleteAgents = useFeatureAccess('agent_deletion', userRole);
  const canAutomateAgents = useFeatureAccess('agent_automation', userRole);

  /**
   * Helper function to check if feature is enabled
   * ALL roles (including superadmin) are determined by database feature flags
   * 
   * @param feature - Feature access result from useFeatureAccess hook
   * @returns true if feature is enabled for the current role (from database)
   * 
   * Access is determined by:
   * - Database feature flags (enabledRoles array)
   * - Feature must be active (isActive = true)
   * - Role must be in enabledRoles array
   * - While loading: Returns false to prevent premature access
   */
  const isFeatureEnabled = (feature: { enabled: boolean; loading: boolean } | undefined) => {
    // Handle undefined feature (e.g., not passed as prop)
    if (!feature) {
      return false;
    }

    // If still loading, return false to prevent premature access
    if (feature.loading) {
      return false; // Wait for API response
    }

    // Return the actual enabled status from database
    return feature.enabled;
  };

  /**
   * Helper function to check if feature should be shown (for conditional rendering)
   * ALL roles (including superadmin) are determined by database feature flags
   * 
   * @param feature - Feature access result from useFeatureAccess hook
   * @returns true if feature should be rendered (from database)
   * 
   * Access is determined by:
   * - Database feature flags (enabledRoles array)
   * - Feature must be active (isActive = true)
   * - Role must be in enabledRoles array
   * - While loading: Uses optimistic rendering (shows if enabled)
   */
  const shouldShowFeature = (feature: { enabled: boolean; loading: boolean } | undefined) => {
    // Handle undefined feature (e.g., not passed as prop)
    if (!feature) {
      return false;
    }

    // Optimistic: Show while loading (better UX - buttons appear immediately)
    // If loading, show optimistically (assume enabled until we know otherwise)
    // If not loading, use actual enabled status
    if (feature.loading) {
      return true; // Show optimistically while loading
    }
    return feature.enabled;
  };

  /**
   * Helper function to check if button should be disabled
   * ALL roles (including superadmin) are determined by database feature flags
   * 
   * @param feature - Feature access result from useFeatureAccess hook
   * @returns true if button should be disabled (from database)
   * 
   * Access is determined by:
   * - Database feature flags (enabledRoles array)
   * - Feature must be active (isActive = true)
   * - Role must be in enabledRoles array
   * - While loading: Not disabled (optimistic UI)
   */
  const isButtonDisabled = (feature: { enabled: boolean; loading: boolean } | undefined) => {
    // Handle undefined feature (e.g., not passed as prop)
    if (!feature) {
      return true; // Disable if feature is not available
    }

    // Don't disable while loading (optimistic UI - better UX)
    if (feature.loading) {
      return false; // Optimistic: allow interaction while loading
    }

    // Disable if feature is not enabled for this role (from database)
    return !feature.enabled;
  };

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Messages State
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([{ id: 'welcome', sender: 'system', text: '**Global Neural Link Established.**\n\nAll agent communications and system events will appear here. You can interject at any time to guide the Orchestrator.', timestamp: Date.now(), isLogEvent: false }]);
  const [globalChatInput, setGlobalChatInput] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isEnhancingChat, setIsEnhancingChat] = useState(false);
  const [isResearchingChat, setIsResearchingChat] = useState(false);

  // --- PROJECT MANAGEMENT HOOK ---

  const addLog = useCallback((message: string, agentRole: string | any = AgentRole.ORCHESTRATOR, type: LogEntry['type'] = 'info', taskId?: string) => {
    dispatch({ type: 'ADD_LOG', payload: { id: Math.random().toString(36).substring(7), timestamp: Date.now(), agent: agentRole, message, type } });

    if (taskId) {
      const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      dispatch({ type: 'ADD_TASK_LOG', payload: { id: taskId, message: `[${timestamp}] ${message}` } });
    }

    if (type === 'action' || type === 'error' || type === 'success' || (agentRole === AgentRole.ORCHESTRATOR && type === 'info')) {
      const agentObj = stateRef.current.agents.find(a => a.role === agentRole) || AGENTS.find(a => a.role === agentRole);
      if (agentObj) {
        setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'agent', text: message, timestamp: Date.now(), agentId: agentObj.id, isLogEvent: true }]);
      }
    }
  }, [dispatch, setGlobalMessages]);

  const stopAutoPilot = useCallback(() => {
    setAutoPilotStatus('idle');
    // Reset associated refs and state if needed
    // This logic mirrors what was previously done manually
  }, [setAutoPilotStatus]);

  const uiHelpers = useMemo(() => ({
    setGlobalMessages,
    addLog
  }), [setGlobalMessages, addLog]);

  const pm = useProjectManagement({
    user,
    state,
    dispatch,
    viewModeHelpers: { viewMode, setViewMode },
    featureFlags: {
      canCreateProjects,
      canViewSamples,
      isFeatureEnabled: (f) => isFeatureEnabled(f),
      shouldShowFeature: (f) => shouldShowFeature(f)
    },
    autoPilot: { stop: stopAutoPilot },
    uiHelpers
  });

  // Destructure state and actions
  const {
    projectList,
    sampleProjects,
    loadingSamples,
    hasLoaded,
    setup: {
      messages: setupMessages,
      input: setupInput,
      projectName: setupProjectName,
      hasManuallyEditedProjectName, // Destructured matching original variable name
      files: setupFiles,
      tempSelectedStandards,
      stage: setupStage,
      projectPreview,
    },
    projectToDelete, // Added state
    taskToDelete,    // Added state

    theme: {
      selected: selectedTheme, // Aliased to match original
      available: availableThemes,
      input: themeInput
    },
    templates: {
      selectedId: selectedTemplateId,
      selectedName: selectedTemplateName
    }
  } = pm.state;

  const {
    setHasLoaded,
    setProjectList,
    setSampleProjects,
    setLoadingSamples,
    setProjectToDelete, // Added action
    setTaskToDelete,    // Added action
    // Setup setters aliases
    setSetupMessages: setSetupMessages_pm,
    setSetupInput: setSetupInput_pm,
    setSetupFiles: setSetupFiles_pm,
    setSetupProjectName: setSetupProjectName_pm,
    setHasManuallyEditedProjectName: setHasManuallyEditedProjectName_pm,
    setTempSelectedStandards: setTempSelectedStandards_pm,
    setSetupStage: setSetupStage_pm,
    setProjectPreview: setProjectPreview_pm,
    // Theme setters
    setSelectedTheme: setSelectedTheme_pm,
    setAvailableThemes: setAvailableThemes_pm,
    setThemeInput: setThemeInput_pm,
    // Template setters
    setSelectedTemplateId: setSelectedTemplateId_pm,
    setSelectedTemplateName: setSelectedTemplateName_pm,
    // Actions
    handleCreateNewProject,
    handleLoadProject,
    handleLoadDemoProject,
    handleSelectTemplate,
    handleSaveAsTemplate,
    deleteProject,
  } = pm.actions;

  // Shim basic setters that were just useState setters to the hook's actions
  const setSetupMessages = setSetupMessages_pm;
  const setSetupInput = setSetupInput_pm;
  const setSetupFiles = setSetupFiles_pm;
  const setSetupProjectName = setSetupProjectName_pm;
  const setHasManuallyEditedProjectName = setHasManuallyEditedProjectName_pm;
  const setTempSelectedStandards = setTempSelectedStandards_pm;
  const setSetupStage = setSetupStage_pm;
  const setProjectPreview = setProjectPreview_pm;
  const setSelectedTheme = setSelectedTheme_pm;
  const setAvailableThemes = setAvailableThemes_pm;
  const setThemeInput = setThemeInput_pm;

  // NOTE: selectedTemplate setters are simple state setters in hook?
  const setSelectedTemplateId = setSelectedTemplateId_pm;
  const setSelectedTemplateName = setSelectedTemplateName_pm;

  // Initialize Feature Flag Adapter
  useEffect(() => {
    const initFeatureFlags = async () => {
      try {
        const { initializeFeatureFlags } = await import('./services/featureFlagAdapter');
        await initializeFeatureFlags({
          providerType: (import.meta.env.VITE_FEATURE_FLAG_PROVIDER as 'custom' | 'flagsmith' | 'hybrid') || 'custom',
          flagsmith: {
            environmentId: import.meta.env.VITE_FLAGSMITH_ENVIRONMENT_ID || '',
            apiUrl: import.meta.env.VITE_FLAGSMITH_API_URL
          }
        });
        if (import.meta.env.DEV) {
          // Debug: Reduced console noise
          // console.log('[Feature Flags] Adapter initialized');
        }
      } catch (error) {
        console.warn('[Feature Flags] Failed to initialize adapter, using default:', error);
      }
    };
    initFeatureFlags();
  }, []);

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type?: 'confirm' | 'alert' | 'success' | 'error' | 'info';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  // Helper function to show confirmation modal
  const showConfirmation = (
    title: string,
    message: string,
    type: 'confirm' | 'alert' | 'success' | 'error' | 'info' = 'confirm',
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmationModal({
        isOpen: true,
        type,
        title,
        message,
        confirmText: confirmText || (type === 'confirm' ? 'Confirm' : 'OK'),
        cancelText: cancelText || 'Cancel',
        onConfirm: () => {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
          if (onConfirm) onConfirm();
          resolve(true);
        },
        onCancel: () => {
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
          if (onCancel) onCancel();
          resolve(false);
        }
      });
    });
  };

  // Setup Chat State

  const [isDraggingSetup, setIsDraggingSetup] = useState(false);

  const setupEndRef = useRef<HTMLDivElement>(null);
  const isProcessingMessageRef = useRef(false); // Lock to prevent concurrent message processing
  const processedMessageIdsRef = useRef<Set<string>>(new Set()); // Track processed message IDs to prevent duplicates


  // Generate unique message ID with timestamp + random
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const [previewTab, setPreviewTab] = useState<'summary' | 'wireframe' | 'architecture' | 'theme'>('summary'); // 'theme' is now the primary Prototype tab

  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
  const [showThemeStudio, setShowThemeStudio] = useState(false); // Theme Studio modal in workspace

  // Sync selectedTheme with state.selectedTheme
  useEffect(() => {
    if (state.selectedTheme && state.selectedTheme !== selectedTheme) {
      setSelectedTheme(state.selectedTheme);
    }
  }, [state.selectedTheme]);

  const [isEnhancingInput, setIsEnhancingInput] = useState(false);
  const [isResearching, setIsResearching] = useState(false);

  // Dynamic Suggestions
  const [dynamicSuggestions, setDynamicSuggestions] = useState<any[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Template Management
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  // Undo/Redo for tasks - sync with state
  const [taskHistoryState, setTaskHistoryState] = useState(state.tasks);

  useEffect(() => {
    setTaskHistoryState(state.tasks);
  }, [state.tasks]);

  const handleUndo = () => {
    // Implementation will be added when task operations are tracked
  };

  const handleRedo = () => {
    // Implementation will be added when task operations are tracked
  };

  const [activeTab, setActiveTab] = useState<'board' | 'artifacts' | 'ide' | 'prototype' | 'network' | 'compliance' | 'knowledge' | 'budget' | 'requirements' | 'dev-tools'>('board');

  // Standards Selection State
  const [showStandards, setShowStandards] = useState(false);


  // Debug: Log when tempSelectedStandards changes
  useEffect(() => {
    // Debug: Standards state change (reduced console noise)
    // if ((import.meta as any).env?.DEV) {
    //   console.debug('[Standards] tempSelectedStandards state changed:', {
    //     count: tempSelectedStandards.length,
    //     standards: tempSelectedStandards,
    //     timestamp: new Date().toISOString()
    //   });
    // }
  }, [tempSelectedStandards]);

  // Template reference tracking (for wizard migration)


  // Project Renaming State in Workspace
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState("");

  // Task Editing State
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Left Column State
  const [leftTab, setLeftTab] = useState<'agents' | 'chat'>('chat');
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<Agent | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreatingNewAgent, setIsCreatingNewAgent] = useState(false);

  // Workspace Tutorial State
  const [showWorkspaceTutorial, setShowWorkspaceTutorial] = useState(false);

  // API Health Monitoring State
  const [apiHealth, setApiHealth] = useState<{ status: APIHealth, metrics: APIMetrics }>({
    status: 'healthy',
    metrics: { requests: 0, lastLatency: 0, errors: 0, latencyHistory: [], usageHistory: [] }
  });



  // Subscribe to API Monitor
  useEffect(() => {
    const unsubscribe = apiMonitor.subscribe((status, metrics) => { setApiHealth({ status, metrics }); });
    return () => { unsubscribe(); };
  }, []);

  // Track if user has been loaded to prevent duplicate logs in StrictMode
  const userLoadedRef = useRef(false);

  // --- Auth Check on Mount ---
  // NOTE: User loading is now handled by AuthContext (contexts/AuthContext.tsx)
  // AuthContext automatically loads user from localStorage on mount
  // No need to duplicate that logic here



  // Refs to track current state without causing re-renders
  const viewModeRef = useRef(viewMode);
  const userRef = useRef(user);
  const isManuallyLoadingProjectRef = useRef(false); // Flag to prevent auto-restore when manually loading
  const isProgrammaticHashChangeRef = useRef(false); // Track if hash change is programmatic to prevent loops

  // Keep refs in sync with state
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Check for shared project link on mount and on URL change - MUST RUN FIRST
  useEffect(() => {
    const checkShareLink = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const fullPath = path + (hash ? hash : '');

      // Try both /share/ and #/share/ patterns
      const shareMatch = path.match(/^\/share\/([^/]+)\/([^/]+)$/) ||
        fullPath.match(/\/share\/([^/]+)\/([^/]+)/);

      if (shareMatch) {
        const projectId = shareMatch[1];
        const token = shareMatch[2];
        console.log('Share link detected in URL:', { projectId, token });

        // Load shared project - this will set viewMode to 'workspace' if successful
        handleLoadSharedProject(projectId, token);
        return true; // Indicate we handled a share link
      }
      return false;
    };

    // Check immediately - this must run before any other initialization
    const isShareLink = checkShareLink();

    // Only load user/auth if NOT a share link
    if (!isShareLink) {
      // AuthContext now handles user initialization automatically
      // No need to manually load from localStorage here
    }

    // Also listen for popstate events (back/forward navigation)
    const handlePopState = () => {
      checkShareLink();
    };

    // Listen for hash changes (for SPA routing)
    const handleHashChange = () => {
      // Skip if this is a programmatic hash change (to prevent loops)
      if (isProgrammaticHashChangeRef.current) {
        isProgrammaticHashChangeRef.current = false;
        return;
      }

      // Throttle hash changes to prevent loops
      const now = Date.now();
      const lastHashChange = sessionStorage.getItem('lastHashChange') || '0';
      if ((now - parseInt(lastHashChange)) < 200) {
        console.log('[HashChange] Throttled - ignoring rapid hash change');
        return;
      }
      sessionStorage.setItem('lastHashChange', now.toString());

      const hash = window.location.hash;
      const currentViewMode = viewModeRef.current;
      const currentUser = userRef.current;

      // Check for share link first (takes priority)
      const isShareLink = checkShareLink();

      // If not a share link, check for admin console or other navigation
      // Only update viewMode if it's different to prevent loops
      if (!isShareLink) {
        // Check if hash starts with #admin (supports #admin?tab=finance format)
        if (hash.startsWith('#admin') && currentViewMode !== 'admin') {
          startTransition(() => setViewMode('admin'));
        } else if (hash === '#hub' && currentViewMode !== 'hub') {
          // Allow navigation to hub even without user (for guest mode)
          startTransition(() => setViewMode('hub'));
        } else if (hash === '#setup' && currentViewMode !== 'setup') {
          startTransition(() => setViewMode('setup'));
        } else if (hash === '#workspace' && currentViewMode !== 'workspace') {
          startTransition(() => setViewMode('workspace'));
        } else if ((hash === '' || hash === '#') && currentViewMode !== 'landing' && !currentUser) {
          // Only redirect to landing if NOT in workspace mode
          // Workspace should persist even without user (demo mode)
          if (currentViewMode !== 'workspace') {
            startTransition(() => setViewMode('landing'));
          }
        }
        // IMPORTANT: If hash is #workspace, always preserve workspace mode
        // Don't redirect away from workspace on refresh
        if (hash === '#workspace') {
          // Ensure workspace mode is set and hash is preserved
          if (currentViewMode !== 'workspace') {
            startTransition(() => setViewMode('workspace'));
          }
          // Don't process any other redirects when workspace hash is present
          return;
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);

    // Check hash on initial load only if not a share link
    if (!isShareLink) {
      handleHashChange();

      // If workspace hash is present, try to restore the current project
      if (window.location.hash === '#workspace') {
        // Skip auto-restore if we're manually loading a project
        if (isManuallyLoadingProjectRef.current) {
          console.log('[Project Load] Skipping auto-restore - manual load in progress');
          return;
        }

        // Skip auto-restore if project is already loaded and matches URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        if (urlProjectId && stateRef.current.id === urlProjectId && stateRef.current.name !== INITIAL_PROJECT_NAME) {
          console.log('[Project Load] Skipping auto-restore - project already loaded:', urlProjectId);
          return;
        }

        // Restore immediately without delay to prevent flickering
        // Wrap in startTransition to fix React Suspense error
        startTransition(() => {
          (async () => {
            try {
              setIsRestoring(true);
              // First, check URL for project ID (most reliable)
              // Validate the project ID from URL - must be a valid MongoDB ObjectId
              let currentProjectId: string | null = urlProjectId && isValidObjectId(urlProjectId) ? urlProjectId : null;

              // If URL has invalid project ID, clear it
              if (urlProjectId && !currentProjectId) {
                console.warn('[Project Load] Invalid project ID in URL, clearing:', urlProjectId);
                const url = new URL(window.location.href);
                url.searchParams.delete('project');
                window.history.replaceState({}, '', url.toString());
              }

              const currentUserId = userRef.current?.id;
              const userToken = userRef.current?.token;

              // If not in URL, try database (if user is logged in)
              if (!currentProjectId && userToken && currentUserId) {
                try {
                  const { getUserSettings } = await import('./services/userSettingsApi');
                  const settings = await getUserSettings(userToken);
                  if (settings.currentProjectId && isValidObjectId(settings.currentProjectId)) {
                    currentProjectId = settings.currentProjectId;
                    // Update URL to include project ID
                    const url = new URL(window.location.href);
                    url.searchParams.set('project', currentProjectId);
                    window.history.replaceState({}, '', url.toString());
                  } else if (settings.currentProjectId) {
                    console.warn('[Project Load] Invalid project ID in user settings, ignoring:', settings.currentProjectId);
                  }
                } catch (dbError) {
                  console.warn('Failed to load currentProjectId from database, falling back to localStorage:', dbError);
                }
              }

              // For logged-in users: ONLY use database (no localStorage fallback)
              // For guest users: can use localStorage as fallback
              if (!currentProjectId && !userToken) {
                // Guest users: try localStorage as fallback
                try {
                  const localStorageProjectId = localStorage.getItem('orbitai_current_project_id');
                  if (localStorageProjectId && isValidObjectId(localStorageProjectId)) {
                    currentProjectId = localStorageProjectId;
                    // Update URL to include project ID
                    const url = new URL(window.location.href);
                    url.searchParams.set('project', currentProjectId);
                    window.history.replaceState({}, '', url.toString());
                  } else if (localStorageProjectId) {
                    // Clear invalid project ID from localStorage
                    console.warn('[Project Load] Invalid project ID in localStorage, clearing:', localStorageProjectId);
                    localStorage.removeItem('orbitai_current_project_id');
                  }
                } catch (e) {
                  // Ignore localStorage errors
                }
              }

              let projectToLoad: ProjectMetadata | null = null;
              let projectDataToLoad: string | null = null;

              if (currentProjectId) {
                // Check "not found" cache FIRST to prevent unnecessary API requests
                if (isProjectNotFound(currentProjectId)) {
                  // Project was recently confirmed as not found - clean up immediately
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('project');
                    window.history.replaceState({}, '', url.toString());
                    await cleanupProjectIdFromAllSources(currentProjectId);
                  } catch (cleanupError) {
                    // Silently ignore cleanup errors
                  }
                  currentProjectId = null;
                  setIsRestoring(false);
                  startTransition(() => {
                    setViewMode('hub');
                  });
                  window.location.hash = '#hub';
                  return; // Exit early - don't make API request
                }

                // For logged-in users: ONLY load from database (verify it exists)
                if (userToken && currentUserId) {
                  try {
                    // Suppress 404 errors for project loading - this is expected when project doesn't exist
                    const dbProject = await projectsApi.getById(currentProjectId);

                    // Handle 404 (project not found) - getById returns null for 404s
                    // This is expected behavior when projects are deleted - clean up silently
                    if (!dbProject) {
                      // Project doesn't exist - clean up immediately and prevent retries
                      // This is normal when projects are deleted or IDs are invalid
                      if (currentProjectId) {
                        try {
                          // Clean up synchronously from URL first to prevent retries
                          const url = new URL(window.location.href);
                          url.searchParams.delete('project');
                          window.history.replaceState({}, '', url.toString());
                          // Then clean up from all other sources
                          await cleanupProjectIdFromAllSources(currentProjectId);
                        } catch (cleanupError) {
                          // Silently ignore cleanup errors
                        }
                      }
                      currentProjectId = null;
                      // Redirect to hub silently (no warning - this is expected behavior)
                      setIsRestoring(false);
                      startTransition(() => {
                        setViewMode('hub');
                      });
                      window.location.hash = '#hub';
                      return; // Exit early - don't try to load again
                    }

                    // Verify ownership: only load if it's the user's project (not sample projects or other users' projects)
                    if (dbProject && dbProject.userId === currentUserId && !dbProject.isSample) {
                      projectDataToLoad = JSON.stringify(dbProject);
                      projectToLoad = {
                        id: dbProject._id || dbProject.id,
                        name: dbProject.name,
                        lastModified: new Date(dbProject.lastModified || dbProject.updatedAt || Date.now()).getTime(),
                        description: (dbProject.description || "").substring(0, 100),
                        phase: dbProject.currentPhase || 'Initiation',
                        userId: dbProject.userId
                      };
                    } else if (dbProject && (dbProject.userId !== currentUserId || dbProject.isSample)) {
                      // Project doesn't belong to user or is a sample - clean up silently
                      await cleanupProjectIdFromAllSources(currentProjectId);
                      currentProjectId = null;
                      // Redirect to hub silently (no warning - this is expected behavior)
                      setIsRestoring(false);
                      startTransition(() => {
                        setViewMode('hub');
                      });
                      window.location.hash = '#hub';
                      return; // Exit early
                    }
                  } catch (dbError: any) {
                    // Handle any other errors (but suppress 404s - they're expected)
                    if (dbError?.status !== 404 && !dbError?.isProjectNotFound) {
                      console.error('Failed to load project from database:', dbError);
                    }
                    // Clear project ID from URL on error
                    const url = new URL(window.location.href);
                    url.searchParams.delete('project');
                    window.history.replaceState({}, '', url.toString());
                    if (currentProjectId) {
                      await cleanupProjectIdFromAllSources(currentProjectId);
                    }
                    currentProjectId = null;
                    // Redirect to hub on error
                    setIsRestoring(false);
                    setViewMode('hub');
                    window.location.hash = '#hub';
                    return; // Exit early
                  }
                } else {
                  // Guest users: can use projectStorage as fallback
                  const loadedProject = await projectStorage.getProject(currentProjectId);
                  if (loadedProject) {
                    projectDataToLoad = JSON.stringify(loadedProject);

                    // Also verify it exists in metadata
                    const metas = await projectStorage.getMetadataList();
                    const userProjects = currentUserId
                      ? metas.filter(p => p.userId === currentUserId)
                      : metas.filter(p => !p.userId);

                    // Verify the project exists in the list
                    const foundProject = userProjects.find(p => p.id === currentProjectId);
                    if (foundProject) {
                      projectToLoad = foundProject;
                    }
                  }
                }
              }

              // If current project not found or invalid, fall back to most recent USER project
              if (!projectToLoad || !projectDataToLoad) {
                // Try loading from database first (if user is logged in)
                if (userToken && currentUserId) {
                  try {
                    const dbProjects = await projectsApi.getAll();
                    // Filter to only user's own projects (not sample projects)
                    const userDbProjects = dbProjects.filter((p: any) =>
                      p.userId === currentUserId && !p.isSample
                    );

                    if (userDbProjects.length > 0) {
                      // Sort by lastModified and get the most recent
                      userDbProjects.sort((a: any, b: any) =>
                        new Date(b.lastModified || b.updatedAt || 0).getTime() -
                        new Date(a.lastModified || a.updatedAt || 0).getTime()
                      );
                      const mostRecent = userDbProjects[0];
                      projectDataToLoad = JSON.stringify(mostRecent);
                      projectToLoad = {
                        id: mostRecent._id || mostRecent.id,
                        name: mostRecent.name,
                        lastModified: new Date(mostRecent.lastModified || mostRecent.updatedAt || Date.now()).getTime(),
                        description: (mostRecent.description || "").substring(0, 100),
                        phase: mostRecent.currentPhase || 'Initiation',
                        userId: mostRecent.userId
                      };
                    }
                  } catch (dbError) {
                    console.warn('Failed to load projects from database, trying localStorage:', dbError);
                  }
                }

                // Fallback to projectStorage if database didn't have user projects
                if (!projectToLoad || !projectDataToLoad) {
                  const metas = await projectStorage.getMetadataList();
                  const currentUserId = userRef.current?.id;
                  const userProjects = currentUserId
                    ? metas.filter(p => p.userId === currentUserId)
                    : metas.filter(p => !p.userId);

                  if (userProjects.length > 0) {
                    // Sort by lastModified and get the most recent
                    userProjects.sort((a, b) => b.lastModified - a.lastModified);
                    projectToLoad = userProjects[0];
                    const loadedProject = await projectStorage.getProject(projectToLoad.id);
                    if (loadedProject) {
                      projectDataToLoad = JSON.stringify(loadedProject);
                    }
                  }
                }
              }

              // Load the project if found AND verify it belongs to the current user
              if (projectToLoad && projectDataToLoad) {
                // Verify ownership before loading
                const loadedState = JSON.parse(projectDataToLoad) as ProjectState;
                const projectUserId = loadedState.userId || projectToLoad.userId;
                const currentUserId = userRef.current?.id;

                // Only load if it's the user's project OR if user is not logged in (guest mode)
                const canLoad = !currentUserId || !projectUserId || projectUserId === currentUserId;

                if (canLoad && loadedState && loadedState.name && loadedState.name !== INITIAL_PROJECT_NAME) {
                  // Restore project state
                  if (!loadedState.id) loadedState.id = projectToLoad.id;
                  if (!loadedState.currentSprint) loadedState.currentSprint = 1;
                  if (!loadedState.methodology) loadedState.methodology = 'V-Model';
                  if (!loadedState.selectedTheme) loadedState.selectedTheme = 'modern';

                  // Ensure tasks and artifacts arrays exist (safety check)
                  if (!Array.isArray(loadedState.tasks)) {
                    if ((import.meta as any).env?.DEV) {
                      console.debug('[Project Load] Initializing missing tasks array');
                    }
                    loadedState.tasks = [];
                  }
                  if (!Array.isArray(loadedState.artifacts)) {
                    if ((import.meta as any).env?.DEV) {
                      console.debug('[Project Load] Initializing missing artifacts array');
                    }
                    loadedState.artifacts = [];
                  }

                  // Map tasks to pause any in-progress ones
                  loadedState.tasks = (loadedState.tasks || []).map(t => {
                    if (t.status === TaskStatus.IN_PROGRESS) {
                      return { ...t, status: TaskStatus.PAUSED, logs: [...(t.logs || []), "[System] Session restored. Task paused due to interruption."] };
                    }
                    return t;
                  });

                  // Store as current project (database + localStorage for fallback)
                  if (userToken && currentUserId) {
                    try {
                      const { updateUserSettings } = await import('./services/userSettingsApi');
                      await updateUserSettings(userToken, { currentProjectId: projectToLoad.id });
                    } catch (settingsError) {
                      console.warn('Failed to save currentProjectId to database:', settingsError);
                    }
                  }
                  projectStorage.setCurrentProjectId(projectToLoad.id);

                  // Reset HAND-OFF AI state when restoring project
                  setAutoPilotStatus('idle');
                  autoPilotStatusRef.current = 'idle';
                  isStoppingRef.current = true;
                  isBatchingRef.current = false;
                  if (batchIntervalRef.current) {
                    clearInterval(batchIntervalRef.current);
                    batchIntervalRef.current = null;
                  }
                  activeTaskControllersRef.current.forEach(c => c.abort());
                  activeTaskControllersRef.current.clear();
                  dispatch({ type: 'SET_PROCESSING', payload: false });

                  // Restore the project state
                  dispatch({ type: 'RESET_PROJECT', payload: loadedState });
                  const themeToSet = loadedState.selectedTheme || 'modern';
                  setSelectedTheme(themeToSet);
                  // Save theme preference to database if user is logged in
                  if (userToken && currentUserId) {
                    try {
                      const { updatePreference } = await import('./services/userSettingsApi');
                      await updatePreference(userToken, 'selectedTheme', themeToSet);
                    } catch (dbError) {
                      console.warn('Failed to save theme preference to database:', dbError);
                    }
                  }
                  startTransition(() => {
                    setViewMode('workspace');
                  });
                  // Update URL with project ID
                  const url = new URL(window.location.href);
                  url.hash = '#workspace';
                  url.searchParams.set('project', projectToLoad.id);
                  window.history.replaceState({}, '', url.toString());
                  setIsRestoring(false);
                } else {
                  // Project not found or invalid - clean up and redirect to hub silently
                  // This is expected behavior when projects are deleted or don't exist
                  if (currentProjectId) {
                    await cleanupProjectIdFromAllSources(currentProjectId);
                  }
                  // Clear project ID from URL
                  const url = new URL(window.location.href);
                  url.searchParams.delete('project');
                  window.history.replaceState({}, '', url.toString());
                  setIsRestoring(false);
                  startTransition(() => {
                    setViewMode('hub');
                  });
                  window.location.hash = '#hub';
                }
              } else {
                // No project to load - redirect to hub to prevent blank project
                // Only log in development and suppress duplicate warnings from React StrictMode
                if (import.meta.env?.DEV) {
                  const warningKey = 'no-project-id-on-refresh';
                  if (!sessionStorage.getItem(warningKey)) {
                    sessionStorage.setItem(warningKey, 'true');
                    console.warn('No project ID found on refresh, redirecting to hub');
                    // Clear after 2 seconds to allow re-warning if needed
                    setTimeout(() => sessionStorage.removeItem(warningKey), 2000);
                  }
                }
                setIsRestoring(false);
                setViewMode('hub');
                window.location.hash = '#hub';
              }
            } catch (e) {
              console.error('Failed to restore workspace project on refresh', e);
              setIsRestoring(false);
              // On error, redirect to hub and clean up URL
              const url = new URL(window.location.href);
              url.searchParams.delete('project');
              window.history.replaceState({}, '', url.toString());
              setViewMode('hub');
              window.location.hash = '#hub';
            }
          })();
        });
      } else {
        setIsRestoring(false);
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Only run once on mount - use refs for current values

  const handleLoadSharedProject = (projectId: string, token: string) => {
    try {
      console.log('=== Loading Shared Project ===');
      console.log('Project ID:', projectId);
      console.log('Token:', token);
      console.log('Current URL:', window.location.href);

      // Try to load from shared project snapshot first (this works for recipients)
      const snapshotKey = `shared_project_${token}`;
      let projectData = localStorage.getItem(snapshotKey);
      let loadedState: any = null;
      let tokenInfo: any = null;

      console.log('Snapshot key:', snapshotKey);
      console.log('Snapshot found:', !!projectData);

      if (projectData) {
        console.log('Found shared project snapshot, parsing...');
        try {
          // Load from shared snapshot
          loadedState = JSON.parse(projectData);
          console.log('Snapshot parsed successfully');
          console.log('Project name:', loadedState.name);
          console.log('Has shareTokens:', !!loadedState.shareTokens);
          console.log('sharedVia:', loadedState.sharedVia);

          // Verify token matches - check shareTokens array
          if (loadedState.shareTokens && Array.isArray(loadedState.shareTokens)) {
            console.log('shareTokens array length:', loadedState.shareTokens.length);
            tokenInfo = loadedState.shareTokens.find((t: any) => t.token === token);
            console.log('Token found in shareTokens:', !!tokenInfo);
          }

          // Also check sharedVia field as fallback
          if (!tokenInfo && loadedState.sharedVia === token) {
            console.log('Token matches sharedVia field - accepting');
            // If sharedVia matches, create a tokenInfo from the snapshot
            tokenInfo = {
              token,
              createdAt: loadedState.sharedAt || Date.now(),
              expiresAt: undefined, // If not in shareTokens, assume no expiration
            };

            // Try to find in shareTokens for expiration info
            if (loadedState.shareTokens && Array.isArray(loadedState.shareTokens)) {
              const foundToken = loadedState.shareTokens.find((t: any) => t.token === token);
              if (foundToken) {
                tokenInfo = foundToken;
              }
            }
          }
        } catch (parseError) {
          console.error('Failed to parse snapshot:', parseError);
          projectData = null; // Reset to try fallback
        }
      }

      // Fallback: Try to load from owner's project data (if snapshot not found)
      if (!projectData || !tokenInfo) {
        console.log('Trying fallback: owner project data');
        const ownerKey = `orbitai_project_${projectId}`;
        projectData = localStorage.getItem(ownerKey);
        console.log('Owner project found:', !!projectData);

        if (projectData) {
          try {
            loadedState = JSON.parse(projectData);

            // Check if token exists in project's shareTokens array
            if (loadedState.shareTokens && Array.isArray(loadedState.shareTokens)) {
              tokenInfo = loadedState.shareTokens.find((t: any) => t.token === token);
            }

            // Fallback: Check localStorage (for backward compatibility)
            if (!tokenInfo) {
              const tokenData = localStorage.getItem(`share_token_${token}`);
              if (tokenData) {
                const storedTokenInfo = JSON.parse(tokenData);
                if (storedTokenInfo.projectId === projectId) {
                  tokenInfo = storedTokenInfo;
                }
              }
            }
          } catch (parseError) {
            console.error('Failed to parse owner project:', parseError);
          }
        }
      }

      if (!loadedState) {
        console.error('=== ERROR: No project data found ===');
        console.log('Checked keys:');
        console.log('  - shared_project_' + token);
        console.log('  - orbitai_project_' + projectId);

        // List all localStorage keys for debugging
        const allKeys = Object.keys(localStorage);
        const relevantKeys = allKeys.filter(k => k.includes('project') || k.includes('share'));
        console.log('Relevant localStorage keys:', relevantKeys);

        alert('Project not found. The share link may have been revoked or the project deleted.\n\nPlease ask the project owner to create a new share link.');
        window.location.href = '/';
        return;
      }

      if (!tokenInfo) {
        console.error('=== ERROR: Token validation failed ===');
        console.log('Token not found in shareTokens array');
        console.log('sharedVia value:', loadedState.sharedVia);
        console.log('Expected token:', token);

        // If sharedVia matches, accept it even without tokenInfo
        if (loadedState.sharedVia === token) {
          console.log('Accepting via sharedVia match');
          tokenInfo = {
            token,
            createdAt: loadedState.sharedAt || Date.now(),
            expiresAt: undefined,
          };
        } else {
          alert('Invalid or expired share link.\n\nThe token in the URL does not match the project\'s share tokens.');
          window.location.href = '/';
          return;
        }
      }

      // Check expiration
      if (tokenInfo.expiresAt && Date.now() > tokenInfo.expiresAt) {
        console.error('Token expired');
        alert('This share link has expired.');
        window.location.href = '/';
        return;
      }

      console.log('=== Token validated successfully ===');
      console.log('Loading project state...');

      // Clean up the loaded state (remove shareTokens and shared metadata from the state)
      const { shareTokens, sharedVia, sharedAt, ...cleanState } = loadedState;
      const projectState = cleanState as ProjectState;

      if (!projectState.id) projectState.id = projectId;
      if (!projectState.currentSprint) projectState.currentSprint = 1;
      if (!projectState.methodology) projectState.methodology = 'V-Model';

      // Set view-only mode - NO AUTH REQUIRED
      setIsViewOnly(true);
      setSharedProjectToken(token);
      // Reset HAND-OFF AI state when loading shared project
      setAutoPilotStatus('idle');
      autoPilotStatusRef.current = 'idle';
      isStoppingRef.current = true;
      isBatchingRef.current = false;
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
      }
      activeTaskControllersRef.current.forEach(c => c.abort());
      activeTaskControllersRef.current.clear();
      dispatch({ type: 'SET_PROCESSING', payload: false });

      dispatch({ type: 'RESET_PROJECT', payload: projectState });

      // Note: Share link access count is automatically tracked in database
      // when the share token endpoint is accessed (handled by backend)

      setGlobalMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'welcome');
        return [{
          id: `shared-project-${Date.now()}`,
          sender: 'system',
          text: `**Shared Project: ${projectState.name}**\n\nYou are viewing this project in read-only mode. All editing features are disabled.`,
          timestamp: Date.now(),
          isLogEvent: false
        }, ...filtered];
      });

      // Set view mode to workspace - this allows non-registered users to view
      startTransition(() => {
        setViewMode('workspace');
      });
      console.log('=== Shared project loaded successfully ===');
      console.log('View mode set to:', 'workspace');
      console.log('Is view only:', true);
    } catch (e) {
      console.error("=== ERROR: Failed to load shared project ===", e);
      console.error('Error details:', e);
      toast.error(`Failed to load shared project: ${e instanceof Error ? e.message : 'Unknown error'}`, 8000);
      alert("Failed to load shared project: " + (e instanceof Error ? e.message : 'Unknown error') + '\n\nCheck the browser console for more details.');
      // Don't redirect immediately, give user a chance to see the error
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  };

  const handleLaunchApp = () => {
    // Require authentication before launching console
    if (!user) {
      setShowUserLogin(true);
      return;
    }

    // User is authenticated, proceed to console
    if (projectList.length > 0) {
      setViewMode('hub');
    } else {
      // Use setTimeout to ensure handleCreateNewProject is defined
      setTimeout(() => {
        if (typeof handleCreateNewProject === 'function') {
          handleCreateNewProject();
        } else {
          // Fallback: navigate to setup view directly
          setViewMode('setup');
          window.location.hash = '#setup';
        }
      }, 0);
    }
  };

  const handleLaunchDemo = () => {
    // For non-users, show hub view in demo mode
    setViewMode('hub');
    window.location.hash = '#hub';
  };

  const handleSignup = (preSelectedPackage?: any) => {
    console.log('handleSignup called with package:', preSelectedPackage);
    // Store preselected package if provided
    if (preSelectedPackage) {
      console.log('Setting selected package:', preSelectedPackage);
      setSelectedPackage(preSelectedPackage);
    }
    // Show signup modal
    console.log('Opening signup modal');
    setShowUserSignup(true);
  };

  const handleLogin = async (u: UserProfile) => {
    // NOTE: User state is managed by AuthContext - no need to setUser here
    // AuthContext.login() or register() was already called before this

    // CRITICAL: Persist auth token to localStorage (AuthContext should handle this, but ensure it's set)
    if (u.token) {
      setAuthToken(u.token);
    }

    // Migrate localStorage data to database on login
    if (u.token) {
      try {
        const { migrateLocalStorageToDatabase, extractLocalStorageData } = await import('./services/userSettingsApi');
        const localStorageData = extractLocalStorageData();
        if (localStorageData.currentProjectId || Object.keys(localStorageData.preferences).length > 0 || Object.keys(localStorageData.shareLinks).length > 0) {
          await migrateLocalStorageToDatabase(u.token, localStorageData);
          console.log('LocalStorage data migrated to database');
        }
      } catch (migrationError) {
        console.warn('Failed to migrate localStorage data on login:', migrationError);
        // Non-critical, continue with login
      }
    }

    setShowSubscription(false);
    setShowUserLogin(false);
    setShowUserSignup(false);
  };

  const handleUserLoginSuccess = async (userData: any) => {
    // Convert API user to UserProfile format
    // IMPORTANT: Ensure role is included from API response
    const userProfile: UserProfile = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=2563eb&color=fff`,
      plan: userData.plan || 'Starter',
      role: (userData.role?.toLowerCase()?.trim() || 'user') as 'admin' | 'user' | 'editor' | 'superadmin', // Include role from API, default to 'user'
      subscriptionStatus: userData.subscriptionStatus || 'active',
      memberSince: userData.memberSince || Date.now(),
      token: userData.token // Ensure token is preserved for migration and persistence
    };

    // Debug: Log role information
    console.log('[Login] User data received:', {
      hasRole: !!userData.role,
      role: userData.role,
      userProfileRole: userProfile.role,
      fullUserData: userData
    });

    handleLogin(userProfile);

    // After login, automatically launch the console
    if (projectList.length > 0) {
      setViewMode('hub');
    } else {
      // Use setTimeout to ensure handleCreateNewProject is defined
      setTimeout(() => {
        if (typeof handleCreateNewProject === 'function') {
          handleCreateNewProject();
        } else {
          // Fallback: navigate to setup view directly
          setViewMode('setup');
          window.location.hash = '#setup';
        }
      }, 0);
    }
  };

  const handleUserSignupSuccess = (userData: any) => {
    // Store user data temporarily and show package selection
    setPendingUser(userData);
    setShowUserSignup(false);
    setShowPackageSelection(true);
  };

  const handlePackageSelect = (pkg: any) => {
    setSelectedPackage(pkg);
    setShowPackageSelection(false);

    // If free package, complete signup immediately
    if (pkg.price === 0) {
      completeSignup(pkg);
    } else {
      // Show payment for paid packages
      setShowPayment(true);
    }
  };

  const handlePaymentSuccess = (paymentData: any) => {
    // Complete signup with selected package
    completeSignup(selectedPackage, paymentData);
  };

  const completeSignup = (pkg: any, paymentData?: any) => {
    if (!pendingUser) return;

    // Convert API user to UserProfile format
    const userProfile: UserProfile = {
      id: pendingUser.id,
      name: pendingUser.name,
      email: pendingUser.email,
      avatar: pendingUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(pendingUser.name)}&background=2563eb&color=fff`,
      plan: pkg.name === 'Starter' || pkg.name === 'Free' ? 'Starter' :
        pkg.name === 'Pro' ? 'Pro' : 'Enterprise',
      role: pendingUser.role?.toLowerCase() || 'user', // Include role from API, default to 'user'
      subscriptionStatus: 'active',
      memberSince: Date.now()
    };

    handleLogin(userProfile);
    setShowPayment(false);
    setShowPackageSelection(false);
    setPendingUser(null);
    setSelectedPackage(null);

    // After signup, automatically launch the console
    if (projectList.length > 0) {
      setViewMode('hub');
    } else {
      handleCreateNewProject();
    }
  };

  const handleUpgradeClick = () => {
    setSubscriptionMode('pricing');
    setShowSubscription(true);
  };

  const handleProfileClick = () => {
    if (user) {
      setShowUserProfile(true);
    } else {
      setShowUserLogin(true);
    }
  };

  // Check if HITL preference has been set this session
  const hasHITLPreferenceSet = () => {
    return sessionStorage.getItem('hitl_preference_set') === 'true';
  };

  // Set HITL preference for this session
  const setHITLPreference = (enableHITL: boolean) => {
    sessionStorage.setItem('hitl_preference_set', 'true');
    sessionStorage.setItem('hitl_enabled', enableHITL.toString());
    setAppSettings(prev => ({ ...prev, enableHumanInTheLoop: enableHITL }));
  };

  // Get HITL preference from session storage or settings
  const getHITLPreference = (): boolean => {
    const sessionPref = sessionStorage.getItem('hitl_enabled');
    if (sessionPref !== null) {
      return sessionPref === 'true';
    }
    return appSettings.enableHumanInTheLoop;
  };

  // Update URL hash when viewMode changes (for browser history support)
  useEffect(() => {
    // Don't update hash if we're viewing a shared project
    if (isViewOnly) return;

    const currentHash = window.location.hash;
    const expectedHash =
      viewMode === 'admin' ? '#admin' :
        viewMode === 'hub' ? '#hub' :
          viewMode === 'setup' ? '#setup' :
            viewMode === 'workspace' ? '#workspace' :
              viewMode === 'landing' ? '' : null;

    // Only update hash if it doesn't match expected value
    // For admin mode, check if hash starts with #admin (to preserve tab parameters)
    const hashMatches = expectedHash === null ? false :
      viewMode === 'admin' ? currentHash.startsWith('#admin') :
        currentHash === expectedHash;

    if (expectedHash !== null && !hashMatches) {
      // Skip update if hash is already being changed programmatically
      if (isProgrammaticHashChangeRef.current) {
        isProgrammaticHashChangeRef.current = false;
        return;
      }

      // Set flag before changing hash
      isProgrammaticHashChangeRef.current = true;

      if (viewMode === 'admin') {
        // Only update hash if it doesn't already start with #admin (preserve tab parameters)
        const currentHashInEffect = window.location.hash;
        if (!currentHashInEffect.startsWith('#admin')) {
          window.location.hash = '#admin';
        }
      } else if (viewMode === 'hub') {
        // Allow hub navigation even without user (for guest mode)
        window.location.hash = '#hub';
      } else if (viewMode === 'setup') {
        window.location.hash = '#setup';
      } else if (viewMode === 'workspace') {
        window.location.hash = '#workspace';
      } else if (viewMode === 'landing' && !user) {
        // Clear hash when going to landing without user (but not if it's a share link)
        if (!window.location.pathname.includes('/share/')) {
          window.location.hash = '';
        }
      }
    }
  }, [viewMode, user, isViewOnly]);

  const handleAdminClick = () => {
    setViewMode('admin');
    window.location.hash = '#admin';
  };

  const handleAdminLoginSuccess = (token: string, adminUserData: any) => {
    localStorage.setItem('admin_token', token);
    setAdminToken(token);
    setAdminUser(adminUserData);
    setViewMode('admin');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setViewMode('hub');
    // Explicitly update hash to ensure navigation works
    isProgrammaticHashChangeRef.current = true;
    window.location.hash = '#hub';
  };

  const handleUserLogout = () => {
    authLogout();
    setViewMode('landing');
    // Clear any user-specific data if needed
  };

  // ... existing resizing state ...
  const [leftWidth, setLeftWidth] = useState(400);
  const [logHeight, setLogHeight] = useState(200);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingLogs, setIsResizingLogs] = useState(false);
  const [isLogsCollapsed, setIsLogsCollapsed] = useState(true);

  // Memoize collapse handler to prevent unnecessary re-renders
  const handleToggleLogsCollapse = useCallback(() => {
    setIsLogsCollapsed(prev => !prev);
  }, []);

  // ... existing chat state ...
  const [activeChatAgent, setActiveChatAgent] = useState<Agent | null>(null);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [isChatThinking, setIsChatThinking] = useState(false);

  // ... existing global chat state ...


  const globalChatEndRef = useRef<HTMLDivElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const globalChatInputRef = useRef<HTMLInputElement>(null);

  // Ensure autoPilotStatus is always reset to 'idle' on mount/refresh
  // This prevents any accidental auto-start from previous session
  useEffect(() => {
    // Force reset to idle on component mount (page load/refresh)
    // This ensures HAND-OFF AI never auto-starts after refresh
    // Debug: Component mount (reduced console noise)
    // console.log('Component mounted - resetting HAND-OFF AI to idle state');
    setAutoPilotStatus('idle');
    autoPilotStatusRef.current = 'idle';
    // Stop any running auto-pilot loops
    isStoppingRef.current = true;
    isBatchingRef.current = false;
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
    activeTaskControllersRef.current.forEach(c => c.abort());
    activeTaskControllersRef.current.clear();
  }, []); // Only run once on mount

  // ... existing settings state ...
  const [showSettings, setShowSettings] = useState(false);
  const setupInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { settingsRef.current = appSettings; }, [appSettings]);
  useEffect(() => { autoPilotStatusRef.current = autoPilotStatus; }, [autoPilotStatus]);

  // Track previous viewMode to detect transitions
  const prevViewModeRef = useRef<ViewMode | null>(null);

  // CRITICAL: Reset HAND-OFF AI to idle ONLY when transitioning INTO workspace mode
  // This ensures it never auto-starts when opening a project, but allows it to run once started
  useEffect(() => {
    const prevViewMode = prevViewModeRef.current;
    const isEnteringWorkspace = prevViewMode !== 'workspace' && viewMode === 'workspace';

    if (isEnteringWorkspace && autoPilotStatus !== 'idle') {
      // Force reset HAND-OFF AI to idle state when FIRST entering workspace
      console.log('Entering workspace mode - resetting HAND-OFF AI to idle');
      // Use the same cleanup as stopExecution() to ensure everything is stopped
      isStoppingRef.current = true;
      isBatchingRef.current = false;
      setAutoPilotStatus('idle');
      autoPilotStatusRef.current = 'idle';
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
      }
      activeTaskControllersRef.current.forEach(c => c.abort());
      activeTaskControllersRef.current.clear();
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }

    // Update ref for next comparison
    prevViewModeRef.current = viewMode;
  }, [viewMode]); // Only depend on viewMode, not autoPilotStatus

  useEffect(() => { if (leftTab === 'chat' && appSettings.autoScrollLogs) { globalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); } }, [globalMessages, leftTab, appSettings.autoScrollLogs]);
  useEffect(() => {
    if (setupEndRef.current && viewMode === 'setup') {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        setupEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [setupMessages, viewMode, setupStage]);

  // Auto-switch tabs if they become disabled by permissions
  useEffect(() => {
    if (viewMode === 'workspace') {
      startTransition(() => {
        if (activeTab === 'ide' && !shouldShowFeature(canUseCodeEditor)) {
          setActiveTab('board');
        } else if (activeTab === 'artifacts' && !shouldShowFeature(canUseArtifactViewer)) {
          setActiveTab('board');
        }

        if (leftTab === 'chat' && !shouldShowFeature(canUseAIChat)) {
          setLeftTab('agents');
        }
      });
    }
  }, [viewMode, activeTab, leftTab, canUseCodeEditor, canUseArtifactViewer, canUseAIChat, userRole]);

  // AI Suggestion Logic - Protected by ai_suggestions flag
  useEffect(() => {
    // Only generate suggestions if feature is enabled (don't clear if just loading)
    if (!canUseAISuggestions.enabled) {
      setDynamicSuggestions([]);
      setIsGeneratingSuggestions(false);
      return;
    }

    // Don't generate if still loading feature access
    if (canUseAISuggestions.loading) {
      return;
    }

    const handler = setTimeout(async () => {
      // Skip suggestion generation for error messages, system status messages, or placeholder text
      const inputTrimmed = setupInput.trim();

      // Enhanced system message detection - catch all status patterns
      const hasEmojiPrefix = /^(⚠️|❌|🎤|🔊|⏸️|▶️|🔄|🛑|🤖|💬)/.test(inputTrimmed);
      const systemStatusPatterns = [
        'Server connection error',
        'Transcription failed',
        'check if backend',
        'Starting live conversation',
        'You interrupted',
        'AI is speaking',
        'listening',
        'Transcribing',
        'Live conversation active',
        'interrupt',
        'AI is thinking',
        'Starting live',
        'thinking',
        'processing',
        'sending',
        'recording',
        'transcription',
        'server error',
        'connection error',
        'backend',
        'error',
        'failed'
      ];
      const isSystemStatus = systemStatusPatterns.some(pattern =>
        inputTrimmed.toLowerCase().includes(pattern.toLowerCase())
      );

      // Check if it's a system message or placeholder
      const isSystemMessage = hasEmojiPrefix || isSystemStatus || inputTrimmed.length < 3;

      if (inputTrimmed.length > 2 && !isSystemMessage) {
        setIsGeneratingSuggestions(true);
        try {
          if ((import.meta as any).env?.DEV) {
            console.log('[Suggestions] Generating suggestions for input:', setupInput.substring(0, 50));
          }
          const suggestions = await generateQuickSuggestions(setupInput, setupMessages);
          if ((import.meta as any).env?.DEV) {
            console.log('[Suggestions] Received', suggestions.length, 'suggestions');
          }
          // Map simple output to UI format
          const formatted = suggestions.map(s => ({
            label: s.label || s.prompt?.substring(0, 30) || 'Suggestion',
            prompt: s.prompt || s.label || '',
            icon: Sparkles
          }));
          // Always update suggestions (even if empty, to clear previous ones)
          // generateQuickSuggestions now returns fallback suggestions when backend returns 0
          setDynamicSuggestions(formatted);
          if ((import.meta as any).env?.DEV && formatted.length > 0) {
            console.log('[Suggestions] Formatted suggestions:', formatted.map(s => s.label));
          } else if ((import.meta as any).env?.DEV && formatted.length === 0) {
            console.log('[Suggestions] No suggestions available (input too short or error)');
          }
        } catch (error) {
          console.error('[Suggestions] Failed to generate suggestions:', error);
          // Don't clear existing suggestions on error, just stop loading
        } finally {
          setIsGeneratingSuggestions(false);
        }
      } else {
        // For system messages or short input, don't generate but keep existing suggestions
        // Only clear if input is completely empty (after debounce delay)
        if (setupInput.trim().length === 0) {
          // Add delay before clearing to prevent flashing
          setTimeout(() => {
            if (setupInput.trim().length === 0) {
              setDynamicSuggestions([]);
            }
          }, 1000); // 1 second delay before clearing when empty
        }
        setIsGeneratingSuggestions(false);
      }
    }, 500); // 500ms debounce before generating

    return () => clearTimeout(handler);
  }, [setupInput, setupMessages, canUseAISuggestions.enabled, canUseAISuggestions.loading]);

  // Convert displayedSuggestions from useMemo to state to match SetupView interface
  const [displayedSuggestions, setDisplayedSuggestions] = useState<any[]>([]);

  // Sync displayedSuggestions with dynamicSuggestions
  useEffect(() => {
    setDisplayedSuggestions(dynamicSuggestions);
  }, [dynamicSuggestions]);

  const handleSuggestionClick = (prompt: string) => { if (setupInput.trim()) { setSetupInput(`${prompt}\n\nAdditional Requirements: ${setupInput}`); } else { setSetupInput(prompt); } setupInputRef.current?.focus(); };

  // Debounce and throttle saveProject to prevent rate limiting
  const saveProjectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const pendingSaveRef = useRef<boolean>(false);
  const fixingInvalidIdRef = useRef<string | null>(null); // Track which invalid ID we're fixing
  const MIN_SAVE_INTERVAL = 2000; // Minimum 2 seconds between saves
  const DEBOUNCE_DELAY = 1000; // Wait 1 second after last change before saving

  const saveProject = useCallback(async () => {
    const s = stateRef.current;
    if (!s) return;

    // Don't save demo projects (projects with demo- prefix in ID)
    if (s.id && s.id.startsWith('demo-')) {
      return; // Don't save demo projects
    }

    // Validate project ID before any async operations
    // Use ref to prevent multiple simultaneous fixes of the same invalid ID
    if (!isValidObjectId(s.id)) {
      // If we're already fixing this ID, skip (prevents duplicate warnings in StrictMode)
      if (fixingInvalidIdRef.current === s.id) {
        return; // Already fixing this ID, skip this call
      }

      // Mark that we're fixing this ID
      fixingInvalidIdRef.current = s.id;
      // Silently fix invalid project ID

      // Generate a new valid ID for the project
      const newId = generateObjectId();
      dispatch({ type: 'UPDATE_PROJECT_ID', payload: newId });

      // Clear the fixing flag after a short delay to allow state to update
      setTimeout(() => {
        if (fixingInvalidIdRef.current === s.id) {
          fixingInvalidIdRef.current = null;
        }
      }, 100);

      // Skip this save cycle, will save on next cycle with valid ID
      return;
    }

    // Clear fixing flag if ID is now valid
    if (fixingInvalidIdRef.current) {
      fixingInvalidIdRef.current = null;
    }

    // Don't save uninitialized projects (projects that haven't been created by the user)
    // Check if this is just the default initial state that hasn't been modified
    const isUninitialized = s.name === INITIAL_PROJECT_NAME &&
      s.description === INITIAL_PROJECT_DESC &&
      s.tasks.length === 0 &&
      s.artifacts.length === 0 &&
      s.logs.length === 0;

    // Only save if project has been initialized (user has started working on it)
    // OR if it already exists (meaning it was previously saved)
    // Use project ID from URL if available (most reliable), otherwise use state.id
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get('project');
    const projectIdToUse = (urlProjectId && isValidObjectId(urlProjectId)) ? urlProjectId : s.id;

    // CRITICAL: Skip saving if project ID is known to not exist (prevents repeated 404s)
    // Check this BEFORE calling getProject to prevent any API calls
    if (projectIdToUse && isProjectNotFound(projectIdToUse)) {
      // Project is confirmed as not found - clean up immediately and skip save
      // Clean up synchronously from URL first to prevent any retries
      /*
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('project') === projectIdToUse) {
            url.searchParams.delete('project');
            window.history.replaceState({}, '', url.toString());
          }
        } catch (e) {
          // Ignore errors
        }
      }
      // Then clean up from all other sources
      await cleanupProjectIdFromAllSources(projectIdToUse);
      */
      console.warn('[App] Project not found, but skipping cleanup to prevent reset during mock debugging:', projectIdToUse);
      return; // Skip save entirely - don't even try to get the project
    }

    // If URL has a different project ID than state, update state to match URL
    if (urlProjectId && isValidObjectId(urlProjectId) && urlProjectId !== s.id && viewMode === 'workspace') {
      // But only if the project actually exists (not in "not found" cache)
      if (!isProjectNotFound(urlProjectId)) {
        console.warn('[Save Project] URL project ID differs from state.id, updating state:', {
          urlProjectId,
          stateId: s.id
        });
        // Update state.id to match URL using UPDATE_PROJECT_ID action
        dispatch({ type: 'UPDATE_PROJECT_ID', payload: urlProjectId });
        s.id = urlProjectId;
      } else {
        // URL has invalid project ID - clean it up
        await cleanupProjectIdFromAllSources(urlProjectId);
        const url = new URL(window.location.href);
        url.searchParams.delete('project');
        window.history.replaceState({}, '', url.toString());
        return; // Skip save
      }
    }

    // Check "not found" cache before attempting to load project
    if (projectIdToUse && isProjectNotFound(projectIdToUse)) {
      // Project was recently confirmed as not found - skip save
      console.warn('[Save Project] Project in "not found" cache, skipping save:', projectIdToUse);
      return;
    }

    // Check if project is known to not exist before making API call
    if (projectIdToUse && isProjectNotFound(projectIdToUse)) {
      // Project is confirmed as not found - skip save and cleanup
      if (import.meta.env.DEV) {
        console.log('[App] Skipping save - project not found:', projectIdToUse);
      }
      return;
    }

    const existingProject = await projectStorage.getProject(projectIdToUse);
    if (isUninitialized && !existingProject) {
      return; // Don't save uninitialized projects
    }

    // Ensure project has userId from current user
    const currentUserId = user?.id;

    // Load existing project to preserve shareTokens if they exist
    let shareTokens = undefined;
    if (existingProject) {
      if ((existingProject as any).shareTokens) {
        shareTokens = (existingProject as any).shareTokens;
      }
      if ((existingProject as any).userId && !s.userId) {
        s.userId = (existingProject as any).userId;
      }
    }

    if (!currentUserId) {
      // User must be authenticated to save projects - all saves go to database
      console.warn("Cannot save project: User not authenticated. Please log in to save projects.");
      toast.error("Please log in to save projects", 4000);
      return;
    }

    // User is logged in - continue with database save

    try {
      // User is logged in - save to database
      if (!s.userId) {
        s.userId = currentUserId;
      }

      // Store current project ID for restoration on refresh (will be saved to database via userSettings)
      // Keep localStorage as fallback for guest users
      if (s.id && viewMode === 'workspace') {
        // Ensure state.id matches URL project ID if URL has one
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        if (urlProjectId && isValidObjectId(urlProjectId) && urlProjectId !== s.id) {
          // URL has a different project ID - update state to match URL
          console.warn('[Project ID Sync] URL project ID differs from state, updating state:', {
            urlProjectId,
            stateId: s.id
          });
          dispatch({ type: 'UPDATE_PROJECT_ID', payload: urlProjectId });
          s.id = urlProjectId;
        }

        // Update URL with project ID (ensures URL is always in sync)
        const url = new URL(window.location.href);
        url.hash = '#workspace';
        url.searchParams.set('project', s.id);
        window.history.replaceState({}, '', url.toString());

        // Save to database immediately if user is logged in
        if (currentUserId && user?.token) {
          try {
            const { updateUserSettings } = await import('./services/userSettingsApi');
            await updateUserSettings(user.token, { currentProjectId: s.id });
          } catch (settingsError) {
            console.warn('Failed to save currentProjectId to database:', settingsError);
          }
        }
        // Always save to localStorage as backup
        projectStorage.setCurrentProjectId(s.id);
      }

      // Also update userId from existing project data if needed
      if (existingProject && (existingProject as any).userId && !s.userId) {
        s.userId = (existingProject as any).userId;
      }

      // Prepare project data for database - ensure tasks and artifacts are always arrays
      // Ensure project name meets minimum length requirement (3 characters)
      let projectName = s.name?.trim() || '';
      if (projectName.length < 3) {
        // Use a meaningful default name if name is too short or empty
        projectName = 'Untitled Project';
        // Update state to reflect the corrected name
        if (s.name !== projectName) {
          dispatch({ type: 'SET_PROJECT_DETAILS', payload: { name: projectName, description: s.description || '' } });
        }
      }

      const projectToSave = {
        ...s,
        name: projectName,
        tasks: Array.isArray(s.tasks) ? s.tasks : [],
        artifacts: Array.isArray(s.artifacts) ? s.artifacts : [],
        logs: Array.isArray(s.logs) ? s.logs : [],
        agents: Array.isArray(s.agents) ? s.agents : [],
        ...(shareTokens ? { shareTokens } : {})
      };

      // Check if project ID is a MongoDB ObjectId (already in database)
      const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(s.id);
      let savedProject;
      let newProjectId = s.id;

      // Check if we're online (for offline support)
      const isOnline = navigator.onLine;

      if (isOnline) {
        // If project doesn't exist in database (existingProject is null), create it
        // Otherwise, update it if it exists
        if (existingProject && hasValidMongoId) {
          // Project exists in database - update it
          // But first verify it still exists (cache might be stale)
          try {
            // Try to verify project exists by fetching it first (this will use cache if available)
            const verifyProject = await projectStorage.getProject(s.id);
            if (!verifyProject) {
              // Project doesn't exist - create it instead
              if ((import.meta as any).env?.DEV) {
                console.log('[Save Project] Project not found in database (stale cache), creating new project');
              }
              savedProject = await projectsApi.create({
                ...projectToSave,
                lastModified: new Date(projectToSave.lastModified || Date.now())
              });
              newProjectId = savedProject._id || savedProject.id;
            } else {
              // Project exists - update it
              savedProject = await projectsApi.update(s.id, {
                ...projectToSave,
                lastModified: new Date(projectToSave.lastModified || Date.now())
              });
            }
          } catch (dbError: any) {
            // If update fails with 404, project was deleted - create it instead
            if (dbError.status === 404) {
              if ((import.meta as any).env?.DEV) {
                console.log('[Save Project] Project not found during update, creating new project');
              }
              savedProject = await projectsApi.create({
                ...projectToSave,
                lastModified: new Date(projectToSave.lastModified || Date.now())
              });
              newProjectId = savedProject._id || savedProject.id;
            } else {
              console.warn('Database update failed:', dbError);
              throw dbError;
            }
          }
        } else {
          // Project doesn't exist in database - create it
          // This handles both new projects and projects with non-ObjectId IDs
          try {
            savedProject = await projectsApi.create({
              ...projectToSave,
              lastModified: new Date(projectToSave.lastModified || Date.now())
            });
            newProjectId = savedProject._id || savedProject.id;
            if ((import.meta as any).env?.DEV) {
              console.log('[Save Project] Created new project in database:', newProjectId);
            }
          } catch (createError: any) {
            // If create fails, try update in case project was just created
            if (createError.status === 409 || createError.message?.includes('duplicate')) {
              try {
                savedProject = await projectsApi.update(s.id, {
                  ...projectToSave,
                  lastModified: new Date(projectToSave.lastModified || Date.now())
                });
              } catch (updateError) {
                console.warn('Database create/update failed, using localStorage:', updateError);
                throw updateError;
              }
            } else {
              console.warn('Database create failed, using localStorage:', createError);
              throw createError;
            }
          }
        }
      } else {
        // Offline mode - skip database operations
        console.log('Offline mode: Skipping database save, using localStorage only');
        savedProject = null;
      }

      // Update project ID if it changed (local to database migration) and we have a saved project
      if (savedProject && newProjectId !== s.id) {
        // Update state with new database ID
        dispatch({ type: 'UPDATE_PROJECT_ID', payload: newProjectId });
        // Update projectStorage with new ID
        const updatedProject = { ...projectToSave, id: newProjectId, _id: newProjectId };
        await projectStorage.saveProject(newProjectId, updatedProject);
        // Remove old project entry (only if it was a valid MongoDB ID)
        // Skip deletion if old ID was invalid or project doesn't exist
        const oldIdIsValidMongoId = /^[0-9a-fA-F]{24}$/.test(s.id);
        if (oldIdIsValidMongoId) {
          try {
            await projectStorage.deleteProject(s.id);
          } catch (deleteError: any) {
            // Silently ignore 404s - project was already deleted or never existed
            if (deleteError.status !== 404 && !deleteError.message?.includes('not found')) {
              console.warn('Failed to delete old project entry:', deleteError);
            }
          }
        }
      } else {
        // Save to projectStorage as backup/cache (always do this, even if database save failed)
        await projectStorage.saveProject(newProjectId, projectToSave);
      }

      // Update project metadata
      const meta: ProjectMetadata = {
        id: newProjectId,
        name: s.name,
        lastModified: savedProject?.lastModified ? new Date(savedProject.lastModified).getTime() : s.lastModified,
        description: (s.description || "").substring(0, 100),
        phase: s.currentPhase,
        userId: s.userId || currentUserId
      };

      // Refresh project list from database (only if online)
      if (isOnline) {
        try {
          const dbProjects = await projectsApi.getAll();
          const dbMetas = dbProjects.map((p: any) => ({
            id: p._id || p.id,
            name: p.name,
            lastModified: new Date(p.lastModified || p.updatedAt || Date.now()).getTime(),
            description: (p.description || "").substring(0, 100),
            phase: p.currentPhase || 'Initiation',
            userId: p.userId,
            isOwner: p.isOwner !== undefined ? p.isOwner : (p.userId === currentUserId)
          }));
          dbMetas.sort((a, b) => b.lastModified - a.lastModified);
          setProjectList(dbMetas);

          // Update currentProjectId in database userSettings
          if (currentUserId && user?.token && s.id && viewMode === 'workspace') {
            try {
              const { updateUserSettings } = await import('./services/userSettingsApi');
              await updateUserSettings(user.token, { currentProjectId: newProjectId || s.id });
            } catch (settingsError) {
              console.warn('Failed to update currentProjectId in database:', settingsError);
              // Non-critical, continue
            }
          }
        } catch (error) {
          console.error('Failed to refresh project list from database, using projectStorage', error);
          // Fallback to projectStorage update
          const metas = await projectStorage.getMetadataList();
          const filtered = metas.filter(p => p.id !== s.id && p.id !== newProjectId);
          const newList = [meta, ...filtered].sort((a, b) => b.lastModified - a.lastModified);
          setProjectList(newList);
        }
      } else {
        // Offline: Update projectStorage only
        const metas = await projectStorage.getMetadataList();
        const filtered = metas.filter(p => p.id !== s.id && p.id !== newProjectId);
        const newList = [meta, ...filtered].sort((a, b) => b.lastModified - a.lastModified);
        setProjectList(newList);
      }
    } catch (e: any) {
      console.error("Failed to save project to database", e);

      // Check if this is a network/connection error
      const isConnectionError = e?.message?.includes('Failed to fetch') ||
        e?.message?.includes('ERR_CONNECTION_REFUSED') ||
        e?.message?.includes('NetworkError') ||
        e?.name === 'TypeError' ||
        (e?.status === undefined && e?.message?.includes('fetch'));

      if (isConnectionError) {
        // Backend is not available - save to localStorage as fallback
        try {
          const projectToSave = {
            ...s,
            lastModified: Date.now()
          };
          localStorage.setItem(`orbitai_project_${s.id}`, JSON.stringify(projectToSave));

          // Also update metadata
          const metaStr = localStorage.getItem('orbitai_projects_meta');
          const metas = metaStr ? JSON.parse(metaStr) : [];
          const existingIndex = metas.findIndex((p: any) => p.id === s.id);
          const projectMeta = {
            id: s.id,
            name: s.name,
            description: s.description.substring(0, 200),
            lastModified: Date.now(),
            userId: user?.id
          };
          if (existingIndex >= 0) {
            metas[existingIndex] = projectMeta;
          } else {
            metas.push(projectMeta);
          }
          localStorage.setItem('orbitai_projects_meta', JSON.stringify(metas));

          toast.warning(
            'Backend unavailable - Project saved locally: The backend server is not available. Your project has been saved to local storage and will sync when the backend is back online.',
            8000
          );
        } catch (localStorageError) {
          console.error('Failed to save to localStorage:', localStorageError);
          toast.error(
            `Failed to save project: ${e instanceof Error ? e.message : 'Unknown error'}. Backend unavailable and local storage failed.`,
            8000
          );
        }
      } else {
        // Other error (not connection-related)
        toast.error(`Failed to save project: ${e instanceof Error ? e.message : 'Unknown error'}`, 6000);
      }
    }
  }, [user, viewMode]);

  // Debounced save function to prevent rate limiting
  const debouncedSaveProject = useCallback(() => {
    // Clear any pending timeout
    if (saveProjectTimeoutRef.current) {
      clearTimeout(saveProjectTimeoutRef.current);
    }

    // Check if enough time has passed since last save
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTimeRef.current;

    if (timeSinceLastSave < MIN_SAVE_INTERVAL && !pendingSaveRef.current) {
      // Too soon since last save, schedule it
      saveProjectTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = true;
        lastSaveTimeRef.current = Date.now();
        saveProject().finally(() => {
          pendingSaveRef.current = false;
        });
      }, MIN_SAVE_INTERVAL - timeSinceLastSave);
    } else if (!pendingSaveRef.current) {
      // Debounce: wait for DEBOUNCE_DELAY before saving
      saveProjectTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = true;
        lastSaveTimeRef.current = Date.now();
        saveProject().finally(() => {
          pendingSaveRef.current = false;
        });
      }, DEBOUNCE_DELAY);
    }
  }, [saveProject]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveProjectTimeoutRef.current) {
        clearTimeout(saveProjectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Clear debounce timeout and save immediately
      if (saveProjectTimeoutRef.current) {
        clearTimeout(saveProjectTimeoutRef.current);
        saveProjectTimeoutRef.current = null;
      }
      await saveProject();

      // If there are running tasks or auto-pilot, transfer them to background
      const hasRunningTasks = stateRef.current.tasks.some(t => t.status === TaskStatus.IN_PROGRESS);
      const hasAutoPilot = autoPilotStatusRef.current === 'running';

      if (hasRunningTasks || hasAutoPilot) {
        // Transfer running tasks to background service
        try {
          const runningTasks = stateRef.current.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);

          if (runningTasks.length > 0 && user?.id && stateRef.current.id) {
            // Send tasks to background service
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            const API_BASE_URL = getApiBaseUrl();
            // Try to get token from various possible locations
            const token = localStorage.getItem('authToken') ||
              localStorage.getItem('auth_token') ||
              localStorage.getItem('token') ||
              (user as any)?.token;

            for (const task of runningTasks) {
              const agent = stateRef.current.agents.find(a => a.role === task.assignedTo || a.name === task.assignedTo) || stateRef.current.agents[0];

              if (agent) {
                // Use sendBeacon for reliable delivery even if page is closing
                // sendBeacon doesn't support custom headers, so we'll use a different approach
                const data = {
                  projectId: stateRef.current.id,
                  taskId: task.id,
                  agent: agent,
                  task: task,
                  projectContext: stateRef.current.description,
                  artifacts: stateRef.current.artifacts,
                  useInternet: stateRef.current.useInternet,
                  mcpServers: stateRef.current.mcpServers,
                  standards: stateRef.current.selectedStandards,
                  token: token // Include token in body for sendBeacon compatibility
                };

                const dataString = JSON.stringify(data);

                // Use sendBeacon for reliable delivery (works even if page is closing)
                // Note: sendBeacon doesn't support custom headers, so token is in body
                if (navigator.sendBeacon) {
                  const blob = new Blob([dataString], { type: 'application/json' });
                  navigator.sendBeacon(`${API_BASE_URL}/api/background-tasks/start`, blob);
                } else {
                  // Fallback to fetch with keepalive
                  fetch(`${API_BASE_URL}/api/background-tasks/start`, {
                    method: 'POST',
                    headers: token ? {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    } : {
                      'Content-Type': 'application/json'
                    },
                    body: dataString,
                    keepalive: true // Keep request alive even if page closes
                  }).catch(() => {
                    // Silent fail - task will pause on frontend
                    console.warn('Failed to transfer task to background');
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn('Failed to transfer tasks to background:', error);
        }

        // Transfer HAND-OFF AI to background instead of stopping
        if (hasAutoPilot && user?.id && stateRef.current.id) {
          try {
            const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
            const API_BASE_URL = getApiBaseUrl();
            const token = localStorage.getItem('authToken') ||
              localStorage.getItem('auth_token') ||
              localStorage.getItem('token') ||
              (user as any)?.token;

            if (token) {
              const data = {
                projectId: stateRef.current.id,
                projectContext: stateRef.current.description,
                artifacts: stateRef.current.artifacts,
                agents: stateRef.current.agents,
                useInternet: stateRef.current.useInternet,
                mcpServers: stateRef.current.mcpServers,
                standards: stateRef.current.selectedStandards,
                currentPhase: stateRef.current.currentPhase,
                currentSprint: stateRef.current.currentSprint,
                token: token // Include token in body for sendBeacon compatibility
              };

              const dataString = JSON.stringify(data);

              // Use sendBeacon for reliable delivery (works even if page is closing)
              if (navigator.sendBeacon) {
                const blob = new Blob([dataString], { type: 'application/json' });
                navigator.sendBeacon(`${API_BASE_URL}/api/background-autopilot/start`, blob);
                console.log('HAND-OFF AI transferred to background');
              } else {
                // Fallback to fetch with keepalive
                fetch(`${API_BASE_URL}/api/background-autopilot/start`, {
                  method: 'POST',
                  headers: token ? {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  } : {
                    'Content-Type': 'application/json'
                  },
                  body: dataString,
                  keepalive: true // Keep request alive even if page closes
                }).catch(() => {
                  console.warn('Failed to transfer HAND-OFF AI to background');
                });
              }
            }
          } catch (error) {
            console.warn('Failed to transfer HAND-OFF AI to background:', error);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      // When page becomes hidden (tab switch, minimize, sleep, etc.)
      if (document.hidden) {
        console.log('[AutoSave] Tab hidden - saving project state...');

        // AUTO-SAVE: Save project state immediately when tab becomes hidden
        // This prevents data loss when PC goes to sleep or user switches tabs
        if (saveProjectTimeoutRef.current) {
          clearTimeout(saveProjectTimeoutRef.current);
          saveProjectTimeoutRef.current = null;
        }

        // Save to localStorage as emergency backup (works even for guests)
        try {
          const currentState = stateRef.current;
          if (currentState && currentState.id) {
            localStorage.setItem('orbitai_autosave_backup', JSON.stringify({
              timestamp: Date.now(),
              projectId: currentState.id,
              description: currentState.description,
              currentPhase: currentState.currentPhase,
              projectPreview: currentState.projectPreview,
              wizardMetadata: currentState.wizardMetadata,
              brainstormingContext: (currentState as any).brainstormingContext,
              artifacts: currentState.artifacts?.slice(0, 5) // Limit to avoid quota
            }));
            console.log('[AutoSave] Emergency backup saved to localStorage');
          }
        } catch (e) {
          console.warn('[AutoSave] Failed to save emergency backup:', e);
        }

        // Also trigger regular save (for logged-in users)
        saveProject();

        // Similar logic for running tasks
        const hasRunningTasks = stateRef.current.tasks.some(t => t.status === TaskStatus.IN_PROGRESS);
        if (hasRunningTasks && user?.id && stateRef.current.id) {
          // Transfer to background (same logic as beforeunload)
          // This allows tasks to continue when tab is hidden
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (viewMode === 'workspace') {
        // Clear debounce and save immediately on cleanup
        if (saveProjectTimeoutRef.current) {
          clearTimeout(saveProjectTimeoutRef.current);
          saveProjectTimeoutRef.current = null;
        }
        // Only save if project ID is valid (prevents warnings during cleanup)
        const currentState = stateRef.current;
        if (currentState && isValidObjectId(currentState.id)) {
          saveProject();
        }
      }
    };
  }, [saveProject, viewMode, user]);

  // Save currentProjectId whenever project changes in workspace mode
  useEffect(() => {
    if (viewMode === 'workspace' && state.id && user?.token && user?.id) {
      // Update URL with project ID
      const url = new URL(window.location.href);
      url.hash = '#workspace';
      url.searchParams.set('project', state.id);
      window.history.replaceState({}, '', url.toString());

      // Save to database
      const saveCurrentProject = async () => {
        try {
          const { updateUserSettings } = await import('./services/userSettingsApi');
          await updateUserSettings(user.token!, { currentProjectId: state.id });
        } catch (error) {
          console.warn('Failed to save currentProjectId:', error);
        }
      };
      saveCurrentProject();

      // Only save to localStorage for guest users (not logged in)
      // Logged-in users: database-only via UserSettings
      if (!user?.id) {
        try {
          // Only save valid project IDs to localStorage
          if (isValidObjectId(state.id)) {
            localStorage.setItem('orbitai_current_project_id', state.id);
          } else {
            // Clear invalid ID from localStorage if present
            localStorage.removeItem('orbitai_current_project_id');
          }
        } catch (e) {
          // Ignore localStorage errors for guest users
        }
      }
    }
  }, [state.id, viewMode, user?.token, user?.id]);

  useEffect(() => {
    if (!hasLoaded) return;

    // Don't save demo projects
    if (state.id && state.id.startsWith('demo-')) {
      return;
    }

    // Don't save if user is not authenticated
    if (!user?.id) {
      return;
    }


    // Check if tutorial should be shown (only once for new users)
    let tutorialTimeout: NodeJS.Timeout | null = null;
    if (viewMode === 'workspace' && !hasCompletedTutorial() && !showWorkspaceTutorial) {
      // Small delay to ensure workspace is fully rendered
      tutorialTimeout = setTimeout(() => {
        setShowWorkspaceTutorial(true);
      }, 1000);
    }

    const timeoutId = setTimeout(() => {
      debouncedSaveProject();
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (tutorialTimeout) clearTimeout(tutorialTimeout);
    };
  }, [state, hasLoaded, viewMode, user?.id, showWorkspaceTutorial, debouncedSaveProject]);

  // Store current project ID whenever state.id changes in workspace mode
  // Database-only for logged-in users, localStorage only for guest users
  useEffect(() => {
    if (viewMode === 'workspace' && state.id && state.name !== INITIAL_PROJECT_NAME) {
      // Only save to localStorage for guest users (not logged in)
      // Logged-in users: database-only via UserSettings (handled in saveProject)
      if (!user?.id) {
        try {
          // Only save valid project IDs to localStorage
          if (isValidObjectId(state.id)) {
            localStorage.setItem('orbitai_current_project_id', state.id);
          } else {
            // Clear invalid ID from localStorage if present
            localStorage.removeItem('orbitai_current_project_id');
          }
        } catch (e) {
          // Ignore localStorage errors for guest users
        }
      }
    }
  }, [state.id, state.name, viewMode, user?.id]);


  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); setProjectToDelete(projectId); };

  const handleToggleSampleProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!adminToken || !isAdminUser(user)) return;

    // Find project name for better confirmation message
    const project = projectList.find(p => p.id === projectId);
    const projectName = project?.name || 'this project';

    // Check if project ID is a valid MongoDB ObjectId (24 hex characters)
    // Projects stored only in localStorage have short random IDs and cannot be marked as samples
    const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);
    let actualProjectId = projectId;

    // If project is only stored locally, save it to database first
    if (!hasValidMongoId) {
      try {
        // Load project from projectStorage
        const localProject = await projectStorage.getProject(projectId);
        if (!localProject) {
          await showConfirmation(
            'Cannot Mark as Sample',
            `"${projectName}" could not be found in local storage.`,
            'error'
          );
          return;
        }

        const projectData = localProject;

        // Confirm with user that we'll save to database
        const shouldSave = await showConfirmation(
          'Save Project to Database',
          `"${projectName}" is stored locally only.\n\nTo mark it as a sample project, it needs to be saved to the database first.\n\nWould you like to save it to the database now?`,
          'confirm',
          undefined,
          undefined,
          'Save to Database',
          'Cancel'
        );

        if (!shouldSave) return;

        // Prepare project data for database (exclude local-only fields)
        const { shareTokens, ...dbProjectData } = projectData;

        // Save to database
        const savedProject = await projectsApi.create({
          ...dbProjectData,
          userId: user?.id || projectData.userId,
          name: projectData.name,
          description: projectData.description || '',
          currentPhase: projectData.currentPhase || 'Initiation',
          currentSprint: projectData.currentSprint || 1,
          methodology: projectData.methodology || 'V-Model',
          agents: projectData.agents || [],
          tasks: projectData.tasks || [],
          artifacts: projectData.artifacts || [],
          logs: projectData.logs || [],
          selectedStandards: projectData.selectedStandards || [],
          useInternet: projectData.useInternet || false,
          budget: projectData.budget || INITIAL_BUDGET,
          mcpServers: projectData.mcpServers || [],
          lastModified: new Date(projectData.lastModified || Date.now())
        });

        // Update project ID to the database ID
        actualProjectId = savedProject._id || savedProject.id;

        // Update projectStorage with new ID
        const updatedProjectData = { ...projectData, id: actualProjectId, _id: actualProjectId };
        await projectStorage.saveProject(actualProjectId, updatedProjectData);

        // Refresh project list from projectStorage
        const metas = await projectStorage.getMetadataList();
        const updatedMetas = metas.map((p: any) =>
          p.id === projectId
            ? { ...p, id: actualProjectId, lastModified: savedProject.lastModified || Date.now() }
            : p
        );

        // Update project list state
        setProjectList(updatedMetas);

        await showConfirmation(
          'Project Saved',
          `Project "${projectName}" has been saved to the database.\n\nNow marking it as a sample project...`,
          'success'
        );
      } catch (err: any) {
        console.error('Failed to save project to database:', err);
        await showConfirmation(
          'Save Failed',
          `Failed to save project to database: ${err.message || 'Unknown error'}\n\nCannot mark project as sample without saving it first.`,
          'error'
        );
        return;
      }
    }

    const isCurrentlySample = sampleProjects.some(p => p.id === actualProjectId);
    const action = isCurrentlySample ? 'remove from' : 'add to';
    const actionVerb = isCurrentlySample ? 'Remove' : 'Add';

    // Enhanced confirmation message with project name
    const confirmMessage = `${actionVerb} "${projectName}" ${action} sample projects?\n\n${isCurrentlySample ? 'This project will no longer appear in the sample projects section.' : 'This project will be visible to all users in the sample projects section.'}`;

    const shouldProceed = await showConfirmation(
      `${actionVerb} Sample Project`,
      confirmMessage,
      'confirm',
      undefined,
      undefined,
      actionVerb,
      'Cancel'
    );

    if (!shouldProceed) return;

    try {
      if (isCurrentlySample) {
        await unmarkProjectAsSample(adminToken, actualProjectId);
        await showConfirmation(
          'Sample Project Removed',
          `"${projectName}" has been removed from sample projects.`,
          'success'
        );
      } else {
        await markProjectAsSample(adminToken, actualProjectId);
        await showConfirmation(
          'Sample Project Added',
          `"${projectName}" has been added to sample projects.\n\nIt will now appear in the sample projects section for all users.`,
          'success'
        );
      }
      // Refresh sample projects list FIRST
      const token = user?.token || localStorage.getItem('token');
      const samples = await getSampleProjects();
      setSampleProjects(samples);

      // Small delay to ensure state updates before reloading project list
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload project list to ensure consistency
      // This ensures the project appears correctly in either the regular list or sample list
      if (user && user.id) {
        try {
          const dbProjects = await projectsApi.getAll();
          const dbMetas: ProjectMetadata[] = dbProjects
            .filter(p => p.userId === user.id)
            .map(p => ({
              id: p._id?.toString() || p.id,
              name: p.name,
              lastModified: p.lastModified ? new Date(p.lastModified).getTime() : Date.now(),
              description: (p.description || '').substring(0, 100),
              phase: p.currentPhase as Phase,
              userId: p.userId
            }));
          dbMetas.sort((a, b) => b.lastModified - a.lastModified);
          setProjectList(dbMetas);
        } catch (dbError) {
          console.error('Failed to reload projects from database:', dbError);
          // Database-only: Show error instead of falling back to localStorage
          // User should refresh or check their connection
          setGlobalMessages(prev => [...prev, {
            id: `db-error-${Date.now()}`,
            sender: 'system',
            text: 'Failed to reload projects. Please refresh the page.',
            timestamp: Date.now(),
            isLogEvent: false
          }]);
        }
      }
    } catch (err: any) {
      console.error('Failed to toggle sample project:', err);
      // Provide more helpful error messages
      let errorMessage = err.message || 'Unknown error';
      if (errorMessage.includes('ObjectId') || errorMessage.includes('Cast to')) {
        errorMessage = 'This project is not saved in the database. Only projects saved to the database can be marked as samples.';
      }
      await showConfirmation(
        'Operation Failed',
        `Failed to ${action} sample projects: ${errorMessage}`,
        'error'
      );
    }
  };
  const handleExportProjectData = async (format: 'json' | 'csv') => {
    if (!state.id || !isFeatureEnabled(canExportData)) {
      toast.error('Export data is not enabled for your role');
      return;
    }

    try {
      const projectData = {
        id: state.id,
        name: state.name,
        description: state.description,
        currentPhase: state.currentPhase,
        currentSprint: state.currentSprint,
        methodology: state.methodology,
        estimatedSprints: state.estimatedSprints,
        created: state.created,
        lastModified: state.lastModified,
        tasks: state.tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          phase: t.phase,
          assignedTo: t.assignedTo,
          progress: t.progress,
          cost: t.cost,
          tokenUsage: t.tokenUsage
        })),
        artifacts: state.artifacts.map(a => ({
          id: a.id,
          title: a.title,
          type: a.type,
          phase: a.phase,
          createdBy: a.createdBy,
          timestamp: a.timestamp,
          tags: a.tags
        })),
        agents: state.agents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          mode: a.mode,
          description: a.description
        })),
        budget: state.budget,
        selectedStandards: state.selectedStandards,
        useInternet: state.useInternet
      };

      if (format === 'json') {
        const jsonStr = JSON.stringify(projectData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.name || 'project'}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Project data exported as JSON');
      } else if (format === 'csv') {
        // Convert to CSV format
        const csvRows: string[] = [];
        csvRows.push('Type,ID,Name,Description,Status,Phase,Assigned To,Progress');

        // Add project info
        csvRows.push(`Project,${state.id},"${state.name}","${state.description || ''}",${state.currentPhase},${state.currentPhase},N/A,${state.currentSprint}`);

        // Add tasks
        state.tasks.forEach(task => {
          csvRows.push(`Task,${task.id},"${task.title}","${task.description || ''}",${task.status},${task.phase || ''},${task.assignedTo || ''},${task.progress || 0}`);
        });

        // Add artifacts
        state.artifacts.forEach(artifact => {
          csvRows.push(`Artifact,${artifact.id},"${artifact.title}","${artifact.type}",N/A,${artifact.phase || ''},${artifact.createdBy || ''},N/A`);
        });

        const csvStr = csvRows.join('\n');
        const blob = new Blob([csvStr], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.name || 'project'}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Project data exported as CSV');
      }
    } catch (error: any) {
      console.error('Failed to export project data:', error);
      toast.error(`Failed to export project data: ${error.message || 'Unknown error'}`);
    }
  };

  ;
  const handleApproveTask = useCallback((taskId: string) => { dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.COMPLETED } }); addLog(`Quality Gate: Manual approval granted for task ${taskId}.`, AgentRole.QA_AUDIT_AGENT, 'success', taskId); }, []);
  const handleRejectTask = useCallback((taskId: string) => { dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.PENDING } }); dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: 0 } }); addLog(`Quality Gate: Task rejected by user. Resetting for refinement.`, AgentRole.QA_AUDIT_AGENT, 'error', taskId); }, []);


  // HAND-OFF AI should ONLY start on explicit user button click - never auto-start
  const startAutoPilot = async () => {
    // Safety check: Ensure we're not already running
    if (autoPilotStatus === 'running') {
      console.warn('HAND-OFF AI already running - ignoring duplicate start request');
      return;
    }
    // Budget check
    if (stateRef.current.budget.used >= stateRef.current.budget.total) {
      addLog("Budget cap reached. Cannot start HAND-OFF AI.", AgentRole.ORCHESTRATOR, 'warning');
      return;
    }
    // Explicit user action confirmed - start HAND-OFF AI
    console.log('HAND-OFF AI started by explicit user action');
    isStoppingRef.current = false;
    autoPilotStatusRef.current = 'running'; // Set ref first to prevent race condition
    setAutoPilotStatus('running');
    addLog("Auto-Pilot sequence initiated.", AgentRole.ORCHESTRATOR, 'action');
    startTransition(() => setActiveTab('network'));

    // Start background AutoPilot for browser-close resilience
    if (user?.id && stateRef.current.id) {
      try {
        const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
        const API_BASE_URL = getApiBaseUrl();
        const token = localStorage.getItem('authToken') ||
          localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          (user as any)?.token;

        if (token) {
          const response = await fetch(`${API_BASE_URL}/api/background-autopilot/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              projectId: stateRef.current.id,
              projectContext: stateRef.current.description,
              artifacts: stateRef.current.artifacts,
              agents: stateRef.current.agents,
              useInternet: stateRef.current.useInternet,
              mcpServers: stateRef.current.mcpServers,
              standards: stateRef.current.selectedStandards,
              currentPhase: stateRef.current.currentPhase,
              currentSprint: stateRef.current.currentSprint
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log('Background HAND-OFF AI started:', result.data.autoPilotId);
            addLog("Background HAND-OFF AI enabled - will continue for 15 minutes if browser closes.", AgentRole.ORCHESTRATOR, 'info');
          }
        }
      } catch (error) {
        console.warn('Failed to start background HAND-OFF AI:', error);
        // Continue with frontend execution even if background start fails
      }
    }

    // Use setTimeout to ensure state is set before runAutoPilot checks it
    setTimeout(() => {
      runAutoPilot();
    }, 100);
  };

  const handleAutoPilotClick = () => {
    // HAND-OFF AI should only start on explicit user click - no auto-start
    if (user?.plan === 'Starter') {
      handleUpgradeClick();
    } else {
      // Check if HITL preference has been set this session
      if (!hasHITLPreferenceSet()) {
        // Store the action to execute after user confirms HITL preference
        pendingActionRef.current = () => {
          startAutoPilot();
        };
        setShowHITLPrompt(true);
      } else {
        // Use existing preference
        const enableHITL = getHITLPreference();
        setAppSettings(prev => ({ ...prev, enableHumanInTheLoop: enableHITL }));
        startAutoPilot();
      }
    }
  };

  useEffect(() => { const handleMouseMove = (e: MouseEvent) => { if (isResizingLeft) setLeftWidth(Math.min(Math.max(e.clientX, 220), 500)); if (isResizingLogs) { setIsLogsCollapsed(false); setLogHeight(Math.min(Math.max(document.body.clientHeight - e.clientY, 36), 600)); } }; const handleMouseUp = () => { setIsResizingLeft(false); setIsResizingLogs(false); }; if (isResizingLeft || isResizingLogs) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); document.body.style.cursor = isResizingLogs ? 'row-resize' : 'col-resize'; document.body.style.userSelect = 'none'; } else { document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; } return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; }; }, [isResizingLeft, isResizingLogs]);

  const handleEnhanceInput = async (isChat: boolean = false) => { const textToEnhance = isChat ? globalChatInput : setupInput; if (!textToEnhance.trim()) return; if (isChat) setIsEnhancingChat(true); else setIsEnhancingInput(true); const userMsg: ChatMessage = { id: Math.random().toString(), sender: 'user', text: `Polish this request: "${textToEnhance}"`, timestamp: Date.now() }; if (isChat) { setGlobalMessages(prev => [...prev, userMsg]); setGlobalChatInput(""); } else { setSetupMessages(prev => [...prev, userMsg]); setSetupInput(""); } try { const enhanced = await enhanceUserPrompt(textToEnhance); const resultMsg: ChatMessage = { id: Math.random().toString(), sender: 'system', text: `**Polished Proposal:**\n${enhanced}\n\n*Reply "Yes" or "Proceed" to accept this scope.*`, timestamp: Date.now() }; if (isChat) setGlobalMessages(prev => [...prev, resultMsg]); else setSetupMessages(prev => [...prev, resultMsg]); } catch (err) { console.error("Failed to enhance prompt", err); if (!isChat) setSetupInput(textToEnhance); } finally { if (isChat) setIsEnhancingChat(false); else setIsEnhancingInput(false); } };
  const handleDeepResearch = useCallback(async (isChat: boolean = false, query?: string) => {
    // Use provided query, or fall back to state
    const textToResearch = query || (isChat ? globalChatInput : setupInput);
    if (!textToResearch.trim()) return;

    if (isChat) setIsResearchingChat(true);
    else setIsResearching(true);

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: `Research Request: "${textToResearch}"`,
      timestamp: Date.now()
    };

    if (isChat) {
      setGlobalMessages(prev => [...prev, userMsg]);
      setGlobalChatInput("");
    } else {
      setSetupMessages(prev => [...prev, userMsg]);
      // Only clear input if we're using state, not if query was provided
      if (!query) setSetupInput("");
    }

    try {
      const researched = await performDeepResearch(textToResearch);
      const resultMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'system',
        text: `**Research Findings:**\n${researched}\n\n*Reply "Yes" or "Proceed" to initialize the project with this specification.*`,
        timestamp: Date.now()
      };
      if (isChat) setGlobalMessages(prev => [...prev, resultMsg]);
      else setSetupMessages(prev => [...prev, resultMsg]);
    } catch (err) {
      console.error("Deep research failed", err);
      if (!isChat && !query) setSetupInput(textToResearch);
    } finally {
      if (isChat) setIsResearchingChat(false);
      else setIsResearching(false);
    }
  }, [globalChatInput, setupInput, setIsResearchingChat, setIsResearching, setGlobalMessages, setGlobalChatInput, setSetupMessages, setSetupInput]);

  const toggleStandard = useCallback((id: string) => { setTempSelectedStandards(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]); }, []);

  // Check if conversation has enough information to proceed to preview
  const canProceedToPreview = useCallback((messages: ChatMessage[]): { canProceed: boolean; reason?: string } => {
    // Filter out system welcome messages and status messages
    const meaningfulMessages = messages.filter(m => {
      const text = m.text.toLowerCase();
      // Exclude welcome messages and status messages
      return !text.includes('welcome to orbitai') &&
        !text.includes('hello, i am') &&
        !text.includes('transcribing') &&
        !text.includes('ai is thinking') &&
        !text.includes('ai is speaking') &&
        !text.includes('listening');
    });

    const userMessages = meaningfulMessages.filter(m => m.sender === 'user');
    const systemMessages = meaningfulMessages.filter(m => m.sender === 'system' || m.sender === 'agent');

    // Check for research findings
    const hasResearch = systemMessages.some(m =>
      m.text.includes('Research Findings') ||
      m.text.includes('technical specification') ||
      (m.text.includes('initialize the project') && m.text.length > 500)
    );

    // Count meaningful exchanges (user message + AI response pairs)
    const exchangeCount = Math.min(userMessages.length, systemMessages.length);

    // Check if user has provided project description
    const userTexts = userMessages.map(m => m.text).join(' ').toLowerCase();
    const hasProjectIdea = userTexts.length > 20 && (
      userTexts.includes('build') ||
      userTexts.includes('create') ||
      userTexts.includes('develop') ||
      userTexts.includes('make') ||
      userTexts.includes('app') ||
      userTexts.includes('website') ||
      userTexts.includes('game') ||
      userTexts.includes('platform') ||
      userTexts.includes('system') ||
      userTexts.includes('project')
    );

    // Criteria for proceeding:
    // 1. Has research findings (automatic proceed), OR
    // 2. At least 2 meaningful exchanges AND has project idea, OR
    // 3. At least 3 user messages with substantial content

    if (hasResearch) {
      return { canProceed: true, reason: 'Research findings available' };
    }

    if (exchangeCount >= 2 && hasProjectIdea) {
      return { canProceed: true, reason: 'Enough exchanges with project idea' };
    }

    if (userMessages.length >= 3) {
      const totalUserContent = userMessages.reduce((sum, m) => sum + m.text.length, 0);
      if (totalUserContent > 50) {
        return { canProceed: true, reason: 'Multiple user messages with content' };
      }
    }

    // Not enough information
    const missingRequirements: string[] = [];
    if (userMessages.length < 2) {
      missingRequirements.push('more user input');
    }
    if (!hasProjectIdea && userMessages.length > 0) {
      missingRequirements.push('project description');
    }
    if (exchangeCount < 2) {
      missingRequirements.push('more conversation exchanges');
    }

    return {
      canProceed: false,
      reason: missingRequirements.length > 0
        ? `Need ${missingRequirements.join(', ')}`
        : 'Need more information about your project'
    };
  }, []);

  // Helper function to infer standards from project description
  const inferStandardsFromDescription = useCallback((description: string, messages: ChatMessage[]): string[] => {
    const text = `${description} ${messages.map(m => m.text).join(' ')}`.toLowerCase();
    const standards: string[] = [];

    // Game projects - typically need web/app security and accessibility
    if (text.includes('game') || text.includes('gaming') || text.includes('mario') || text.includes('player')) {
      if (text.includes('web') || text.includes('browser') || text.includes('html5')) {
        standards.push('owasp', 'wcag');
      } else {
        standards.push('owasp');
      }
    }

    // Web projects - security and accessibility
    if (text.includes('website') || text.includes('web app') || text.includes('web application') ||
      text.includes('react') || text.includes('vue') || text.includes('angular') || text.includes('html')) {
      standards.push('owasp', 'wcag');
      if (text.includes('e-commerce') || text.includes('ecommerce') || text.includes('payment') || text.includes('shop') || text.includes('store')) {
        standards.push('pci-dss');
      }
      if (text.includes('eu') || text.includes('europe') || text.includes('gdpr')) {
        standards.push('gdpr');
      }
    }

    // Mobile apps
    if (text.includes('mobile') || text.includes('ios') || text.includes('android') ||
      text.includes('react native') || text.includes('flutter') || text.includes('swift') || text.includes('kotlin')) {
      standards.push('owasp');
      if (text.includes('health') || text.includes('medical') || text.includes('patient')) {
        standards.push('hipaa', 'iec62304');
      }
    }

    // Healthcare/Medical
    if (text.includes('health') || text.includes('medical') || text.includes('patient') || text.includes('hospital') || text.includes('clinic')) {
      standards.push('hipaa', 'iec62304');
      if (text.includes('device') || text.includes('medical device')) {
        standards.push('fda21cfr', 'iso13485');
      }
    }

    // Financial
    if (text.includes('finance') || text.includes('banking') || text.includes('payment') ||
      text.includes('transaction') || text.includes('money') || text.includes('bank')) {
      standards.push('pci-dss', 'sox');
    }

    // Automotive
    if (text.includes('automotive') || text.includes('vehicle') || text.includes('car') || text.includes('auto')) {
      standards.push('aspice', 'iso26262');
    }

    // Data/Privacy
    if (text.includes('data') || text.includes('privacy') || text.includes('personal information') || text.includes('user data')) {
      if (text.includes('eu') || text.includes('europe')) {
        standards.push('gdpr');
      }
      if (text.includes('california') || text.includes('ca')) {
        standards.push('ccpa');
      }
      standards.push('gdpr'); // Default to GDPR for data projects
    }

    // Security-focused projects
    if (text.includes('security') || text.includes('secure') || text.includes('encryption') ||
      text.includes('authentication') || text.includes('cyber') || text.includes('hack')) {
      standards.push('owasp', 'iso27001');
    }

    // Cloud/SaaS
    if (text.includes('cloud') || text.includes('saas') || text.includes('aws') || text.includes('azure')) {
      standards.push('soc2', 'iso27001');
    }

    // Remove duplicates and limit to 5, ensure all IDs exist in QUALITY_STANDARDS
    const validStandards = Array.from(new Set(standards))
      .filter(id => QUALITY_STANDARDS.some(s => s.id === id))
      .slice(0, 5);

    return validStandards;
  }, []);

  // Handle manual jump to preview with current conversation
  const handleJumpToPreview = useCallback(async () => {
    if (setupStage === 'preview') {
      console.warn('[Jump to Preview] Already in preview stage');
      return;
    }

    // Check if we have enough information
    const checkResult = canProceedToPreview(setupMessages);
    if (!checkResult.canProceed) {
      console.warn('[Jump to Preview] Not enough information:', checkResult.reason);
      return;
    }

    console.log('[Jump to Preview] Generating preview with current conversation...');

    // Extract user input from messages for preview generation
    const userMessages = setupMessages.filter(m => m.sender === 'user');
    const userText = userMessages
      .map(m => m.text)
      .join('\n')
      .substring(0, 500); // Limit length

    // Use first user message or combined text as project goal
    const projectGoal = userMessages[0]?.text || userText || 'Project based on conversation';

    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      setProcessingLabel("Generating Project Preview...");
      setProcessingProgress(10);

      setProcessingProgress(40);
      const preview = await generateProjectPreview(projectGoal, setupMessages, state.useInternet);

      // Check if this is a game project and generate mechanics
      const isGameProject = state.description?.toLowerCase().includes('game') ||
        state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ||
        preview.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase()));

      if (isGameProject) {
        setProcessingStatusText('Generating game mechanics code...');
        setProcessingProgress(50);

        try {
          // Auto-detect game engine from tech stack
          let gameEngine: 'unity' | 'godot' | 'phaser' | null = null;
          const allTech = [...(state.techStack || []), ...(preview.techStack || [])];

          if (allTech.some(t => t.toLowerCase().includes('unity'))) {
            gameEngine = 'unity';
          } else if (allTech.some(t => t.toLowerCase().includes('godot'))) {
            gameEngine = 'godot';
          } else if (allTech.some(t => t.toLowerCase().includes('phaser'))) {
            gameEngine = 'phaser';
          } else {
            // Default to Unity for any game without specified engine
            gameEngine = 'unity';
          }

          if (gameEngine) {
            // Import game mechanics service
            const { gameMechanicsClientService } = await import('./services/gameMechanicsService');

            // Generate mechanics
            const mechanicsResult = await gameMechanicsClientService.generateMechanics({
              gameDescription: state.description || projectGoal,
              targetEngine: gameEngine
            });

            // Add to preview
            preview.gameMechanics = mechanicsResult;

            if ((import.meta as any).env?.DEV) {
              console.log('[Game Mechanics Generated]:', {
                engine: gameEngine,
                filesCount: mechanicsResult.files.length
              });
            }
          }
        } catch (mechanicsError) {
          // Non-blocking: Log error but continue with preview
          console.error('[Game Mechanics] Generation failed (non-blocking):', mechanicsError);
        }
      }

      setProcessingProgress(90);

      if ((import.meta as any).env?.DEV) {
        console.log('[Jump to Preview] Preview generated:', {
          hasPreview: !!preview,
          projectName: preview?.projectName
        });
      }

      setProjectPreview(preview);
      setSetupStage('preview');

      // Auto-populate project name
      if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
        if (!setupProjectName.trim() || setupProjectName.trim() === '') {
          setSetupProjectName(preview.projectName.trim());
        }
      }

      // Auto-populate standards
      if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
        const validStandards = Array.isArray(preview.recommendedStandards)
          ? preview.recommendedStandards.filter(id => QUALITY_STANDARDS.some(s => s.id === id))
          : [];
        if (validStandards.length > 0) {
          setTempSelectedStandards(validStandards);
        }
      } else {
        // Try to infer standards from conversation
        if (tempSelectedStandards.length === 0 && userText) {
          const inferredStandards = inferStandardsFromDescription(userText, setupMessages);
          if (inferredStandards.length > 0) {
            setTempSelectedStandards(inferredStandards);
          }
        }
      }

      // Add success message
      const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
        ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics.*`
        : '';

      const sprintsText = preview.estimatedSprints
        ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity analysis.*`
        : '';

      const successMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `✅ **Preview Generated!**\n\nI've created your project blueprint based on our conversation.\n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Optimized for your project type.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change.`,
        timestamp: Date.now()
      };

      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(successMessage.id)) {
          return prev;
        }
        return [...prev, successMessage];
      });

      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);
    } catch (error) {
      console.error('[Jump to Preview] Error generating preview:', error);
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: '⚠️ I encountered an issue generating the preview. Please try again or continue the conversation.',
        timestamp: Date.now()
      };
      setSetupMessages(prev => [...prev, errorMessage]);
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);
    }
  }, [setupMessages, setupStage, canProceedToPreview, state.useInternet, hasManuallyEditedProjectName, setupProjectName, tempSelectedStandards, inferStandardsFromDescription, generateMessageId, dispatch]);

  const handleAddStandard = (id: string) => { const current = state.selectedStandards; if (!current.includes(id)) { dispatch({ type: 'SET_STANDARDS', payload: [...current, id] }); const stdName = QUALITY_STANDARDS.find(s => s.id === id)?.name; addLog(`Compliance Protocol Added: ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'action'); } };
  const handleRemoveStandard = (id: string) => { const current = state.selectedStandards; dispatch({ type: 'SET_STANDARDS', payload: current.filter(s => s !== id) }); const stdName = QUALITY_STANDARDS.find(s => s.id === id)?.name; addLog(`Compliance Protocol Removed: ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'info'); };
  const handleDeleteTask = useCallback((taskId: string) => { setTaskToDelete(taskId); }, []);
  const confirmDeleteTask = () => { if (!taskToDelete) return; dispatch({ type: 'DELETE_TASK', payload: taskToDelete }); addLog("Task deleted by user", AgentRole.ORCHESTRATOR, 'info'); setTaskToDelete(null); };
  const handleUpdateTask = useCallback((taskId: string, title: string, description: string) => { dispatch({ type: 'UPDATE_TASK_DETAILS', payload: { id: taskId, title, description } }); addLog(`Task updated by user: ${title}`, AgentRole.ORCHESTRATOR, 'info'); }, [addLog]);
  const handleAiModifyTask = useCallback(async (taskId: string, instruction: string) => { const task = stateRef.current.tasks.find(t => t.id === taskId); if (!task) throw new Error("Task not found"); const newDetails = await modifyTaskWithAI(task, instruction); addLog(`Task modified via AI instruction: ${instruction}`, AgentRole.ORCHESTRATOR, 'action'); return newDetails; }, [addLog]);
  const handleRunAudit = (standardId: string) => { const stdName = QUALITY_STANDARDS.find(s => s.id === standardId)?.name || standardId; addLog(`Initiating specific audit task for ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'action'); const newTask: Task = { id: Math.random().toString(36).substring(7), title: `Run Compliance Audit: ${stdName}`, description: `Conduct a full compliance audit against the ${stdName} standard. Generate a structured Audit Report detailing pass/fail status for key requirements.`, assignedTo: AgentRole.QA_AUDIT_AGENT, phase: state.currentPhase, status: TaskStatus.PENDING, dependencies: [], logs: [], progress: 0, traceRefs: ["AUDIT", stdName], sprint: state.currentSprint, evaluation: { score: 0, reasoning: 'Quality score will be calculated when task is executed.', criteria: [], timestamp: Date.now() } }; dispatch({ type: 'ADD_TASK', payload: newTask }); setTimeout(() => executeTask(newTask.id), 100); };
  const handleRenameProject = () => { if (tempName.trim()) { dispatch({ type: 'SET_PROJECT_DETAILS', payload: { name: tempName, description: state.description } }); addLog(`Project renamed to: ${tempName}`, AgentRole.ORCHESTRATOR, 'info'); } setIsRenaming(false); };

  const handleSetupDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingSetup(true); };
  const handleSetupDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingSetup(false); };
  const handleSetupDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingSetup(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) setSetupFiles(prev => [...prev, ...files]); };
  const removeSetupFile = (index: number) => { setSetupFiles(prev => prev.filter((_, i) => i !== index)); };

  const handleAiThemeGen = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!themeInput.trim()) return;
    setIsGeneratingTheme(true);
    try {
      // Build project context from current state for project-type-aware theming
      const projectContext = [
        state.name && state.name !== INITIAL_PROJECT_NAME ? `Project: ${state.name}` : '',
        state.description ? `Description: ${state.description}` : '',
        state.techStack && state.techStack.length > 0 ? `Tech Stack: ${state.techStack.join(', ')}` : '',
        // Include project type hints from description and tech stack
        state.description?.toLowerCase().includes('game') || state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ? 'Type: Game' : '',
        state.description?.toLowerCase().includes('website') || state.description?.toLowerCase().includes('web app') || state.techStack?.some(tech => ['react', 'vue', 'angular', 'html', 'css'].includes(tech.toLowerCase())) ? 'Type: Website/Web App' : ''
      ].filter(Boolean).join('\n');

      const newTheme = await generateAppTheme(themeInput, projectContext);
      setAvailableThemes(prev => [...prev, newTheme]);
      const themeId = newTheme.id;
      setSelectedTheme(themeId);
      dispatch({ type: 'SET_THEME', payload: themeId });
      setThemeInput('');
    } catch (err) {
      console.error("Theme Gen Failed", err);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleRandomTheme = async () => {
    setIsGeneratingTheme(true);
    try {
      // Generate random theme descriptions - diverse themes including seasonal, aesthetic, era-based, and creative concepts
      const randomDescriptions = [
        // Seasonal/Holiday Themes
        'Halloween theme with spooky dark purples, oranges, and blacks, featuring bat silhouettes, spider webs, and pumpkin patterns with eerie glowing effects',
        'Christmas theme with festive reds, greens, golds, and whites, featuring snowflakes, stars, holly patterns, and warm sparkle effects',
        'Valentine\'s Day theme with romantic pinks, reds, and whites, featuring heart patterns and elegant cursive fonts',
        'Easter theme with pastel colors including soft pinks, blues, yellows, and greens, featuring egg patterns and spring flowers',
        'Thanksgiving theme with warm autumn colors including browns, oranges, and deep reds, featuring fall leaves and harvest decorations',
        'New Year theme with elegant golds, silvers, and blacks, featuring confetti patterns and celebration graphics',
        // Aesthetic Themes
        'Cyberpunk neon cityscape with electric blues and vibrant purples, featuring grid patterns and glowing effects',
        'Minimalist theme with clean whites, subtle grays, and lots of whitespace, featuring simple borders and soft shadows',
        'Retro 1980s theme with vibrant neons, geometric patterns, and bold typography',
        'Vintage Victorian theme with elegant burgundies, golds, and creams, featuring ornate borders and classic serif fonts',
        'Futuristic sci-fi theme with metallic silvers, electric blues, and holographic effects',
        'Art Deco theme with geometric patterns, gold accents, and elegant black and white contrasts',
        // Nature Themes
        'Ocean depths with deep blues and teals, featuring wave patterns and aquatic textures',
        'Forest green with natural earth tones, featuring leaf patterns and organic shapes',
        'Desert sand with warm beiges and terracotta, featuring cactus silhouettes and sun-baked textures',
        'Aurora borealis with greens and magentas, featuring flowing gradients and ethereal glows',
        'Cherry blossom with soft pinks and whites, featuring delicate flower patterns',
        'Tropical paradise with bright yellows and greens, featuring palm trees and vibrant florals',
        'Arctic ice with cool blues and whites, featuring snowflake patterns and frosty textures',
        // Era-Based Themes
        '1950s Diner theme with retro reds, whites, and chrome, featuring checkerboard patterns and neon signs',
        '1920s Jazz Age theme with art deco golds, blacks, and silvers, featuring geometric patterns',
        'Medieval theme with deep burgundies, golds, and stone grays, featuring heraldic patterns and ornate borders',
        'Space Age 1960s theme with bright oranges, silvers, and whites, featuring rocket and star patterns',
        // Creative/Abstract Themes
        'Neon retro with hot pinks and cyans, featuring grid lines and glowing effects',
        'Mystical forest with dark greens and purples, featuring magical sparkles and ethereal glows',
        'Volcanic with deep reds and oranges, featuring lava-like gradients and intense heat effects',
        'Midnight sky with deep purples and starry whites, featuring constellation patterns',
        'Coral reef with tropical pinks and aquas, featuring underwater textures and marine life patterns',
        'Vintage sepia with browns and creams, featuring old photograph textures and nostalgic borders'
      ];

      const randomDescription = randomDescriptions[Math.floor(Math.random() * randomDescriptions.length)];
      const newTheme = await generateAppTheme(randomDescription);

      // Add the new theme to available themes if it doesn't already exist
      setAvailableThemes(prev => {
        const exists = prev.find(t => t.id === newTheme.id);
        if (exists) {
          setSelectedTheme(newTheme.id);
          return prev;
        }
        return [...prev, newTheme];
      });

      const themeId = newTheme.id;
      setSelectedTheme(themeId);
      dispatch({ type: 'SET_THEME', payload: themeId });
    } catch (err) {
      console.error("Random Theme Gen Failed", err);
      // Fallback to random preset if generation fails
      const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
      setSelectedTheme(randomTheme.id);
      dispatch({ type: 'SET_THEME', payload: randomTheme.id });
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleSetupSend = useCallback(async (e: React.SyntheticEvent, stageContext?: string) => {
    e.preventDefault();

    // Prevent concurrent message processing
    if (isProcessingMessageRef.current) {
      console.warn('[Setup Chat] Message already being processed, skipping duplicate');
      return;
    }

    // Get user text from event target value (for voice input) or setupInput (for text input)
    const eventValue = (e.currentTarget as any)?.value || '';
    const inputText = eventValue.trim() || setupInput.trim();

    if ((!inputText && setupFiles.length === 0) || state.isProcessing) {
      console.log('[Setup Chat] Skipping send:', {
        hasInputText: !!inputText,
        inputTextLength: inputText.length,
        hasFiles: setupFiles.length > 0,
        isProcessing: state.isProcessing
      });
      return;
    }

    let userText = inputText || (setupFiles.length > 0 ? "Review attached files for project scope." : "");

    console.log('[Setup Chat] Processing message:', {
      userText: userText.substring(0, 50),
      source: eventValue ? 'event' : 'setupInput',
      hasStageContext: !!stageContext
    });

    // Handle system context updates (stage changes) - these are silent updates
    if (stageContext && stageContext.startsWith('[SYSTEM CONTEXT UPDATE:')) {
      // This is a stage change notification, add it to history but don't show to user
      const systemMessageId = generateMessageId();
      const systemMessage: ChatMessage = {
        id: systemMessageId,
        sender: 'system',
        text: stageContext,
        timestamp: Date.now()
      };

      // Check for duplicate before adding
      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(systemMessageId)) {
          console.warn('[Setup Chat] Duplicate system message ID detected, skipping');
          return prev;
        }
        processedMessageIdsRef.current.add(systemMessageId);
        return [...prev, systemMessage];
      });
      return; // Don't send to API, just update context
    }

    // Include stage context in the message if provided
    if (stageContext && !userText.includes('[Context:')) {
      userText = `${userText}\n\n[Context: ${stageContext}]`;
    }

    setSetupInput("");
    setDynamicSuggestions([]); // Clear suggestions on send

    // Generate unique message ID and check for duplicates
    let messageId = generateMessageId();

    // Check if this message ID was already processed (very unlikely but check anyway)
    if (processedMessageIdsRef.current.has(messageId)) {
      console.warn('[Setup Chat] Duplicate message ID detected, generating new one');
      // Generate a new ID (very unlikely to collide again)
      messageId = generateMessageId();
    }

    const newMessage: ChatMessage = {
      id: messageId,
      sender: 'user',
      text: setupFiles.length > 0 ? `${userText}\n\n**Attached Files:**\n${setupFiles.map(f => `- ${f.name}`).join('\n')}` : userText,
      timestamp: Date.now()
    };

    // Set processing lock
    isProcessingMessageRef.current = true;
    processedMessageIdsRef.current.add(messageId);

    // Add message with duplicate check - use functional update
    // Also check for duplicate text content to prevent exact duplicates
    let hasDuplicate = false;
    setSetupMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      if (existingIds.has(messageId)) {
        console.warn('[Setup Chat] Duplicate message ID in state, skipping');
        hasDuplicate = true;
        isProcessingMessageRef.current = false; // Release lock
        return prev;
      }

      // Also check for duplicate text content (same text, same sender, within last 5 seconds)
      const recentDuplicate = prev.find(m =>
        m.sender === 'user' &&
        m.text.trim() === newMessage.text.trim() &&
        Date.now() - m.timestamp < 5000 // Within last 5 seconds
      );
      if (recentDuplicate) {
        console.warn('[Setup Chat] Duplicate message text detected (likely double-send), skipping');
        hasDuplicate = true;
        isProcessingMessageRef.current = false; // Release lock
        return prev;
      }

      const updated = [...prev, newMessage];

      console.log('[Setup Chat] Adding user message:', {
        userText,
        messageId: newMessage.id,
        currentMessagesCount: prev.length,
        updatedMessagesCount: updated.length,
        messageText: newMessage.text.substring(0, 50),
        stageContext: stageContext || 'none'
      });

      return updated;
    });

    // If duplicate was detected, abort processing
    if (hasDuplicate) {
      return;
    }

    // Get current messages for processing (will use latest state)
    const currentMessages = setupMessages;
    const updatedMessages = [...currentMessages, newMessage];

    // Check if user is confirming after research findings - generate preview directly
    const confirmationPhrases = ['yes', 'proceed', 'initialize', 'ok', 'okay', 'go ahead', 'let\'s do it', 'sounds good', 'continue'];
    const userTextLower = userText.toLowerCase().trim();
    const isConfirmation = confirmationPhrases.some(phrase =>
      userTextLower === phrase ||
      userTextLower === phrase + '.' ||
      userTextLower.startsWith(phrase + ' ')
    );

    // Find the most recent research findings message
    const researchMessage = [...updatedMessages]
      .reverse()
      .find(m => m.sender === 'system' && (
        m.text.includes('Research Findings') ||
        m.text.includes('technical specification') ||
        (m.text.includes('initialize the project') && m.text.length > 500)
      ));

    // If user confirmed after research findings, generate preview directly
    if (isConfirmation && researchMessage && setupStage !== 'preview') {
      console.log('[Setup Chat] User confirmed after research findings, generating preview directly...');

      // Extract research findings text (everything after "Research Findings:")
      let researchText = researchMessage.text;
      const findingsIndex = researchText.indexOf('Research Findings');
      if (findingsIndex >= 0) {
        researchText = researchText.substring(findingsIndex);
      }

      // Combine user's original request with research findings for preview generation
      const originalUserMessages = updatedMessages
        .filter(m => m.sender === 'user')
        .slice(0, -1) // Exclude the current "yes" message
        .map(m => m.text)
        .join('\n');

      // Use the original project idea, and include research context in message history
      const previewInput = originalUserMessages || userText;

      // Generate preview directly from research findings
      dispatch({ type: 'SET_PROCESSING', payload: true });
      setProcessingLabel("Generating Project Preview from Research...");
      setProcessingProgress(10);

      try {
        // Create a comprehensive message history including research
        const previewMessages = [
          ...updatedMessages.slice(0, -1), // All messages except the "yes"
          {
            ...newMessage,
            text: `${previewInput}\n\n[User confirmed proceeding with research findings]`
          }
        ];

        setProcessingProgress(40);
        const preview = await generateProjectPreview(previewInput, previewMessages, state.useInternet);

        // Generate game mechanics if this is a game project
        const isGameProject = state.description?.toLowerCase().includes('game') ||
          state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ||
          preview.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase()));

        if (isGameProject) {
          setProcessingStatusText('Generating game mechanics code...');
          setProcessingProgress(50);
          try {
            let gameEngine: 'unity' | 'godot' | 'phaser' | null = null;
            const allTech = [...(state.techStack || []), ...(preview.techStack || [])];
            if (allTech.some(t => t.toLowerCase().includes('unity'))) gameEngine = 'unity';
            else if (allTech.some(t => t.toLowerCase().includes('godot'))) gameEngine = 'godot';
            else if (allTech.some(t => t.toLowerCase().includes('phaser'))) gameEngine = 'phaser';
            else gameEngine = 'unity';

            if (gameEngine) {
              const { gameMechanicsClientService } = await import('./services/gameMechanicsService');
              const mechanicsResult = await gameMechanicsClientService.generateMechanics({
                gameDescription: state.description || previewInput,
                targetEngine: gameEngine
              });
              preview.gameMechanics = mechanicsResult;
            }
          } catch (err) {
            console.error('[Game Mechanics] Generation failed (non-blocking):', err);
          }
        }

        setProjectPreview(preview);
        setSetupStage('preview');

        // Auto-populate project name
        if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
          if (!setupProjectName.trim() || setupProjectName.trim() === '') {
            setSetupProjectName(preview.projectName.trim());
          }
        }

        // Auto-populate standards
        if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
          const validStandards = Array.isArray(preview.recommendedStandards)
            ? preview.recommendedStandards.filter(id => QUALITY_STANDARDS.some(s => s.id === id))
            : [];
          if (validStandards.length > 0) {
            setTempSelectedStandards(validStandards);
          }
        }

        // Add success message
        const successMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'system',
          text: `✅ **Project initialized successfully!**\n\nI've generated your project blueprint based on the research findings.\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change.`,
          timestamp: Date.now()
        };

        setSetupMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          if (existingIds.has(successMessage.id)) {
            return prev;
          }
          return [...prev, successMessage];
        });

        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        isProcessingMessageRef.current = false; // Release lock after successful preview generation
        return; // Exit - preview generated, no need for AI response
      } catch (error) {
        console.error('[Setup Chat] Error generating preview from research:', error);
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'system',
          text: '⚠️ I encountered an issue generating the preview. Let me help you through the normal flow instead.',
          timestamp: Date.now()
        };
        setSetupMessages(prev => [...prev, errorMessage]);
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        // Continue with normal AI chat flow below
      }
    }

    // If we are already in preview stage, check for confirmation keywords
    if (setupStage === 'preview') {
      const lowerText = userText.toLowerCase();
      if (lowerText.includes('start') || lowerText.includes('launch') || lowerText.includes('proceed') || lowerText.includes('go')) {
        // Proceed to launch
        proceedToWorkspace(updatedMessages);
        return;
      }
    }

    // Use LLM chat API for conversation instead of immediately generating preview
    // Only generate preview when user explicitly requests it or AI indicates readiness
    // Don't show processing states during conversation - only when generating preview

    let isGeneratingPreview = false; // Track if we're generating preview to avoid clearing states in finally

    try {
      // Build conversation history for LLM
      const history = updatedMessages
        .filter(msg => msg.sender !== 'system' || !msg.text.includes('Hello, I am Raed'))
        .slice(-10) // Last 10 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Call LLM chat API with wizard context
      console.log('[Setup Chat] Calling LLM API with:', {
        message: userText.substring(0, 100),
        historyLength: history.length,
        projectStateId: state.id
      });

      const { apiRequest } = await import('@src/services/api');
      const response = await apiRequest<{
        success: boolean;
        response: string;
        usage?: any;
        modelUsed?: string;
        provider?: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userText,
          history: history,
          projectState: state.id ? { id: state.id } : null,
          contextType: 'wizard'
        })
      });

      console.log('[Setup Chat] LLM API response:', {
        success: response.success,
        responseLength: response.response?.length || 0,
        modelUsed: response.modelUsed,
        provider: response.provider
      });

      if (response.success && response.response) {
        console.log('[Setup Chat] Received AI response:', response.response.substring(0, 100) + '...');
        const aiResponseId = generateMessageId();
        const aiResponse: ChatMessage = {
          id: aiResponseId,
          sender: 'system',
          text: response.response,
          timestamp: Date.now()
        };
        setSetupMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          if (existingIds.has(aiResponseId)) {
            console.warn('[Setup Chat] Duplicate AI response ID detected, skipping');
            return prev;
          }

          // Also check for duplicate text content (same text, same sender, within last 5 seconds)
          const recentDuplicate = prev.find(m =>
            m.sender === 'system' &&
            m.text.trim() === aiResponse.text.trim() &&
            Date.now() - m.timestamp < 5000 // Within last 5 seconds
          );
          if (recentDuplicate) {
            console.warn('[Setup Chat] Duplicate AI response text detected (likely double-send), skipping');
            return prev;
          }

          const updated = [...prev, aiResponse];
          console.log('[Setup Chat] Updated messages count:', updated.length, 'New AI message ID:', aiResponse.id);
          console.log('[Setup Chat] Last message sender:', updated[updated.length - 1]?.sender, 'text preview:', updated[updated.length - 1]?.text.substring(0, 50));
          return updated;
        });

        // No processing state during conversation - only when generating preview
        // Check if AI indicates it has enough information or user explicitly requests preview
        const responseText = response.response.toLowerCase();
        const userTextLower = userText.toLowerCase();

        const explicitCompletionPhrases = [
          'i have enough information to generate',
          'i can now generate your project',
          'ready to create your project preview',
          'i have everything i need to get started',
          'perfect! i have enough information',
          'i\'m ready to generate your project'
        ];

        const userRequestPhrases = [
          'generate preview',
          'create preview',
          'show preview',
          'generate project',
          'create project',
          'build project',
          'start project',
          'launch project'
        ];

        // Check if user is confirming after research findings
        const confirmationPhrases = ['yes', 'proceed', 'initialize', 'ok', 'okay', 'go ahead', 'let\'s do it', 'sounds good', 'continue'];
        const userConfirmed = confirmationPhrases.some(phrase => userTextLower.trim() === phrase || userTextLower.trim().startsWith(phrase + ' '));

        // Check if previous message was research findings
        const previousSystemMessage = updatedMessages
          .slice()
          .reverse()
          .find(m => m.sender === 'system');
        const hasRecentResearch = previousSystemMessage && (
          previousSystemMessage.text.includes('Research Findings') ||
          previousSystemMessage.text.includes('initialize the project') ||
          previousSystemMessage.text.includes('technical specification')
        );

        const hasEnoughInfo = explicitCompletionPhrases.some(phrase => responseText.includes(phrase));
        const userRequestedPreview = userRequestPhrases.some(phrase => userTextLower.includes(phrase));
        const messageCount = updatedMessages.filter(m => m.sender === 'user').length;

        // Only generate preview if:
        // 1. User explicitly requests it, OR
        // 2. User confirms after research findings, OR
        // 3. AI indicates readiness AND we have at least 4 exchanges
        if (userRequestedPreview || (userConfirmed && hasRecentResearch) || (hasEnoughInfo && messageCount >= 4)) {
          // Generate preview - NOW we show processing states
          isGeneratingPreview = true;
          dispatch({ type: 'SET_PROCESSING', payload: true });
          setProcessingLabel(projectPreview ? "Refining Prototype..." : "Architecting Solution & Generating Prototype...");
          setProcessingProgress(10);

          // Process files if any
          const fileDataPayload: { mimeType: string, data: string }[] = [];

          setProcessingProgress(40);

          const preview = await generateProjectPreview(userText, [...updatedMessages, aiResponse], state.useInternet, projectPreview);
          if ((import.meta as any).env?.DEV) {
            console.log('[Preview] Received preview data:', {
              hasPreview: !!preview,
              hasArchitectureDiagram: !!preview?.architectureDiagram,
              architectureDiagramLength: preview?.architectureDiagram?.length || 0,
              architectureDiagramPreview: preview?.architectureDiagram?.substring(0, 200) || 'N/A',
              allKeys: preview ? Object.keys(preview) : []
            });
          }
          setProjectPreview(preview);
          setSetupStage('preview');

          // Auto-populate project name if user hasn't entered one and AI suggests a name
          // This ensures the system always suggests a name when available
          if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
            // Only auto-populate if field is empty or still has default value
            if (!setupProjectName.trim() || setupProjectName.trim() === '') {
              setSetupProjectName(preview.projectName.trim());
              if ((import.meta as any).env?.DEV) {
                console.log('[Project Name] Auto-populated AI-suggested name:', preview.projectName);
              }
            }
          } else if ((import.meta as any).env?.DEV) {
            console.log('[Project Name] Skipping auto-populate:', {
              hasManuallyEdited: hasManuallyEditedProjectName,
              currentName: setupProjectName,
              suggestedName: preview.projectName,
              isEmpty: !setupProjectName.trim()
            });
          }

          // Auto-populate standards dropdown with recommended standards
          if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
            console.log('[Standards] Received recommended standards from preview:', preview.recommendedStandards);
            // Ensure we're setting an array
            const standardsArray = Array.isArray(preview.recommendedStandards)
              ? preview.recommendedStandards
              : [preview.recommendedStandards];
            console.log('[Standards] Setting tempSelectedStandards to:', standardsArray);
            console.log('[Standards] Available QUALITY_STANDARDS IDs:', QUALITY_STANDARDS.map(s => s.id));
            console.log('[Standards] Matching standards:', standardsArray.filter(id => QUALITY_STANDARDS.some(s => s.id === id)));
            // Filter to only include valid standard IDs that exist in QUALITY_STANDARDS
            const validStandards = standardsArray.filter(id => QUALITY_STANDARDS.some(s => s.id === id));
            if (validStandards.length > 0) {
              console.log('[Standards] Setting valid standards:', validStandards);
              setTempSelectedStandards(validStandards);
            } else {
              console.warn('[Standards] No valid standards found. Received:', standardsArray, 'Available:', QUALITY_STANDARDS.map(s => s.id));
            }
          } else {
            console.warn('[Standards] No recommended standards in preview:', {
              hasPreview: !!preview,
              hasRecommendedStandards: !!preview?.recommendedStandards,
              standardsLength: preview?.recommendedStandards?.length || 0,
              recommendedStandards: preview?.recommendedStandards
            });

            // Fallback: Try to infer standards from project description if backend didn't return any
            if (tempSelectedStandards.length === 0 && userText) {
              const inferredStandards = inferStandardsFromDescription(userText, setupMessages);
              if (inferredStandards.length > 0) {
                console.log('[Standards] Inferred standards from description:', inferredStandards);
                setTempSelectedStandards(inferredStandards);
              }
            }
          }

          const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
            ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics and compliance requirements.*`
            : '';

          const sprintsText = preview.estimatedSprints
            ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity, team size, and requirements analysis.*`
            : '';

          const systemReply: ChatMessage = {
            id: Math.random().toString(),
            sender: 'system',
            text: `I've generated a project blueprint based on your request. \n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Reasoning: Adapted to your project type for optimal results.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change (e.g., "Add dark mode").`,
            timestamp: Date.now()
          };
          setSetupMessages(prev => [...prev, systemReply]);

          // Clear processing states after preview is generated
          dispatch({ type: 'SET_PROCESSING', payload: false });
          setProcessingLabel(null);
          setProcessingProgress(0);
          setIsResearching(false);
          isGeneratingPreview = false; // Reset flag
        } else {
          // AI wants to continue conversation - no preview generation
          // Processing state already cleared above, just return
          return; // Exit early, don't generate preview
        }
      } else {
        // LLM API failed - fallback to direct preview generation only if user explicitly requested
        const userTextLower = userText.toLowerCase();
        const userRequestedPreview = userTextLower.includes('generate') ||
          userTextLower.includes('preview') ||
          userTextLower.includes('create project') ||
          userTextLower.includes('build project');

        if (!userRequestedPreview) {
          // Don't generate preview if user didn't explicitly request it
          // No processing state to clear - we don't show it during conversation

          // Show error message
          const errorMessage: ChatMessage = {
            id: Math.random().toString(),
            sender: 'system',
            text: 'I encountered an issue processing your message. Please try again or type "generate preview" when you\'re ready to create your project.',
            timestamp: Date.now()
          };
          setSetupMessages(prev => [...prev, errorMessage]);
          return;
        }

        // User explicitly requested preview - generate it
        isGeneratingPreview = true;
        dispatch({ type: 'SET_PROCESSING', payload: true });
        setProcessingLabel(projectPreview ? "Refining Prototype..." : "Architecting Solution & Generating Prototype...");
        setProcessingProgress(10);

        // Process files if any
        const fileDataPayload: { mimeType: string, data: string }[] = [];

        setProcessingProgress(40);

        const preview = await generateProjectPreview(userText, updatedMessages, state.useInternet, projectPreview);
        if ((import.meta as any).env?.DEV) {
          console.log('[Preview] Received preview data:', {
            hasPreview: !!preview,
            hasArchitectureDiagram: !!preview?.architectureDiagram,
            architectureDiagramLength: preview?.architectureDiagram?.length || 0,
            architectureDiagramPreview: preview?.architectureDiagram?.substring(0, 200) || 'N/A',
            allKeys: preview ? Object.keys(preview) : []
          });
        }
        setProjectPreview(preview);
        setSetupStage('preview');

        // Auto-populate project name if user hasn't entered one and AI suggests a name
        if (!hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
          if (!setupProjectName.trim() || setupProjectName.trim() === '') {
            setSetupProjectName(preview.projectName.trim());
            if ((import.meta as any).env?.DEV) {
              console.log('[Project Name] Auto-populated AI-suggested name:', preview.projectName);
            }
          }
        } else if ((import.meta as any).env?.DEV) {
          console.log('[Project Name] Skipping auto-populate:', {
            hasManuallyEdited: hasManuallyEditedProjectName,
            currentName: setupProjectName,
            suggestedName: preview.projectName,
            isEmpty: !setupProjectName.trim()
          });
        }

        // Auto-populate standards dropdown with recommended standards
        if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
          console.log('[Standards] Received recommended standards from preview:', preview.recommendedStandards);
          const standardsArray = Array.isArray(preview.recommendedStandards)
            ? preview.recommendedStandards
            : [preview.recommendedStandards];
          const validStandards = standardsArray.filter(id => QUALITY_STANDARDS.some(s => s.id === id));
          if (validStandards.length > 0) {
            setTempSelectedStandards(validStandards);
          }
        } else {
          if (tempSelectedStandards.length === 0 && userText) {
            const inferredStandards = inferStandardsFromDescription(userText, setupMessages);
            if (inferredStandards.length > 0) {
              setTempSelectedStandards(inferredStandards);
            }
          }
        }

        const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
          ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics and compliance requirements.*`
          : '';

        const sprintsText = preview.estimatedSprints
          ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity, team size, and requirements analysis.*`
          : '';

        const systemReply: ChatMessage = {
          id: Math.random().toString(),
          sender: 'system',
          text: `I've generated a project blueprint based on your request. \n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Reasoning: Adapted to your project type for optimal results.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change (e.g., "Add dark mode").`,
          timestamp: Date.now()
        };
        setSetupMessages(prev => [...prev, systemReply]);

        // Clear processing states after preview is generated
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        setIsResearching(false);
        isGeneratingPreview = false; // Reset flag
      }
    } catch (err: any) {
      console.error("❌ Setup chat failed", err);
      console.error("Error details:", {
        message: err?.message,
        error: err?.error,
        response: err?.response,
        stack: err?.stack
      });
      setIsResearching(false);

      // Extract detailed error message
      const errorMessage = err?.message || err?.error?.message || err?.toString() || 'Unknown error';
      const errorDetails = err?.error?.details || err?.response?.data?.error || '';
      const fullError = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      // Check if it's a backend connection error
      const isBackendError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED');
      const backendHint = isBackendError ? '\n\n**Tip:** Make sure the backend server is running at http://localhost:3002' : '';

      // Show toast notification for user feedback
      if (toastService) {
        toastService.error(
          `Failed to process message: ${isBackendError
            ? 'Please check your backend connection'
            : 'Please try again or type "generate preview" when ready'}`
        );
      }

      const errReply: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `I encountered an error: ${fullError}${backendHint}\n\nPlease try again or type "generate preview" when you're ready to create your project.`,
        timestamp: Date.now()
      };

      // Add error message with duplicate check
      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(errReply.id)) {
          return prev;
        }
        return [...prev, errReply];
      });
    } finally {
      // Always release the processing lock
      isProcessingMessageRef.current = false;

      // Only clear processing states if we're NOT generating preview
      // If we're generating preview, let it continue showing
      if (!isGeneratingPreview) {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        setIsResearching(false);
      }
      setTimeout(() => setupInputRef.current?.focus(), 100);
    }
  }, [setupInput, setupFiles, state, setupMessages, projectPreview, dispatch, setSetupInput, setSetupMessages, setProjectPreview, setProcessingLabel, setProcessingProgress, setIsResearching, setTempSelectedStandards, setSetupStage, toastService, setupProjectName, hasManuallyEditedProjectName, setSetupProjectName, inferStandardsFromDescription]);

  const proceedToWorkspace = async (history: ChatMessage[]) => {
    let savedProject: any = null;
    // Validate transition prerequisites
    if (!history || history.length === 0) {
      console.error('[Transition] No chat history provided');
      if (toastService) {
        toastService.error('Transition Failed: No chat history available. Please restart the setup process.', 5000);
      }
      return;
    }

    // Warn if no project preview exists (but allow transition)
    if (!projectPreview) {
      console.warn('[Transition] No project preview available, proceeding with conversation history only');
      if (toastService) {
        toastService.warning(
          'No Preview Available: Proceeding to workspace with conversation history. You can generate artifacts manually.',
          5000
        );
      }
    }

    // Validate project name
    const finalProjectName = setupProjectName.trim() || projectPreview?.projectName || '';
    if (!finalProjectName) {
      console.error('[Transition] No project name available');
      if (toastService) {
        toastService.error('Transition Failed: Please provide a project name before launching.', 5000);
      }
      dispatch({ type: 'SET_PROCESSING', payload: false });
      return;
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });
    setProcessingLabel("Initializing Project Environment...");
    setProcessingProgress(0);

    const themeLabel = availableThemes.find(t => t.id === selectedTheme)?.label || 'Standard';

    // Wrap entire transition in try-catch for error recovery
    try {

      // Construct a clean, structured project description
      let structuredDescription = `# PROJECT: ${setupProjectName}\n\n`;

      if (projectPreview) {
        structuredDescription += `## EXECUTIVE SUMMARY\n${projectPreview.summary}\n\n`;
        structuredDescription += `## TECH STACK\n${projectPreview.techStack.map(t => `- ${t}`).join('\n')}\n\n`;
        structuredDescription += `## DESIGN THEME\n${themeLabel} (Theme ID: ${selectedTheme})\n\n`;

        // Embed the architecture diagram directly
        const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);
        structuredDescription += `## ARCHITECTURE DIAGRAM\n\`\`\`mermaid\n${cleanArch}\n\`\`\`\n\n`;

        // Reference the UI Prototype
        structuredDescription += `## UI PROTOTYPE\n(See 'Wireframe Prototype.html' artifact for the visual mockups. Agents should refer to this artifact for UI tasks.)\n\n`;

        structuredDescription += `## IDENTIFIED RISKS\n${projectPreview.risks.map(r => `- ${r}`).join('\n')}\n\n`;
      }

      structuredDescription += `## INITIAL REQUIREMENTS CONVERSATION\n`;
      structuredDescription += history.map(m => `**${m.sender.toUpperCase()}**: ${m.text}`).join('\n\n');

      // Initialize Project State with automatically determined methodology and estimated sprints
      // Use AI-suggested project name from preview if user hasn't provided one
      const finalProjectName = setupProjectName.trim() || projectPreview?.projectName || '';

      dispatch({
        type: 'SET_PROJECT_DETAILS',
        payload: {
          name: finalProjectName,
          description: structuredDescription,
          methodology: (projectPreview?.recommendedMethodology as Methodology) || 'V-Model',
          estimatedSprints: projectPreview?.estimatedSprints
        }
      });
      // Use recommended standards from preview if available, otherwise use tempSelectedStandards
      const standardsToUse = projectPreview?.recommendedStandards && projectPreview.recommendedStandards.length > 0
        ? projectPreview.recommendedStandards
        : (tempSelectedStandards || []);

      if ((import.meta as any).env?.DEV) {
        console.log('[Standards] Assigning standards to project:', {
          fromPreview: projectPreview?.recommendedStandards,
          fromTemp: tempSelectedStandards,
          final: standardsToUse,
          count: standardsToUse.length
        });
      }

      dispatch({ type: 'SET_STANDARDS', payload: standardsToUse });

      // INTELLIGENT AGENT ASSIGNMENT: Assign existing custom agents or create new ones based on project needs
      // This analyzes project requirements and either assigns existing custom agents or creates new ones
      setProcessingLabel("Intelligently assigning agents to project...");
      try {
        // First, try intelligent assignment (assigns existing custom agents or creates new ones)
        if (user?.id && savedProject?._id) {
          try {
            const intelligentResult = await agentAssignmentService.intelligentlyAssignCustomAgents(
              savedProject._id || savedProject.id,
              structuredDescription,
              Phase.INITIATION
            );

            addLog(
              `Intelligent assignment: ${intelligentResult.assignedExistingAgents} existing agent(s) assigned, ${intelligentResult.createdAgents} new agent(s) created. ${intelligentResult.reasoning}`,
              AgentRole.ORCHESTRATOR,
              'success'
            );

            if ((import.meta as any).env?.DEV) {
              console.log('[Intelligent Assignment]', intelligentResult);
            }
          } catch (intelligentError) {
            console.warn('[Intelligent Assignment] Failed, falling back to system agents:', intelligentError);
            // Fall through to system agent assignment
          }
        }

        // Also assign system agents using AI reasoning (for system agents like Orchestrator, etc.)
        setProcessingLabel("Orchestrator analyzing project requirements...");
        const agentAssignment = await agentAssignmentService.analyzeProjectForAgents(
          finalProjectName,
          structuredDescription,
          Phase.INITIATION
        );

        // Add the assigned system agents to the project
        dispatch({ type: 'ADD_AGENTS', payload: agentAssignment.agents });
        addLog(`Orchestrator assigned ${agentAssignment.agents.length} system agents based on AI analysis: ${agentAssignment.reasoning}`, AgentRole.ORCHESTRATOR, 'action');

        if ((import.meta as any).env?.DEV) {
          console.log('[Agent Assignment]', {
            agents: agentAssignment.agents.map(a => a.role),
            reasoning: agentAssignment.reasoning,
            justifications: agentAssignment.agentJustifications
          });
        }
      } catch (agentError) {
        console.warn('[Agent Assignment] Failed, using fallback:', agentError);
        // Fallback: Add basic team if AI fails
        const fallbackAgents = [AgentRole.REQUIREMENTS_AGENT, AgentRole.UX_DESIGNER, AgentRole.IMPLEMENTATION_AGENT];
        fallbackAgents.forEach(role => {
          const agent = AGENTS.find(a => a.role === role);
          if (agent) dispatch({ type: 'ADD_AGENT', payload: agent });
        });
        addLog('Orchestrator assigned default team (AI analysis unavailable).', AgentRole.ORCHESTRATOR, 'info');
      }
      // MIGRATION: Convert uploaded files to artifacts
      if (setupFiles.length > 0) {
        setProcessingLabel("Processing uploaded files...");
        setProcessingProgress(20);

        for (const file of setupFiles) {
          try {
            // Read file content (limit to 1MB for text files to prevent memory issues)
            let fileContent = '';
            if (file.size < 1024 * 1024 && (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|xml|html|css|js|ts|py|java|cpp|c)$/i))) {
              const reader = new FileReader();
              fileContent = await new Promise<string>((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
              });
            } else {
              fileContent = `[Binary file: ${file.name}]\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type || 'unknown'}\n\nThis file was uploaded during project setup but content could not be extracted as text.`;
            }

            // Determine artifact type based on file extension
            let artifactType: 'requirement' | 'design' | 'code' | 'documentation' | 'build' = 'requirement';
            const extension = file.name.split('.').pop()?.toLowerCase();
            if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension || '')) {
              artifactType = 'requirement';
            } else if (['png', 'jpg', 'jpeg', 'svg', 'fig', 'sketch'].includes(extension || '')) {
              artifactType = 'design';
            } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c'].includes(extension || '')) {
              artifactType = 'code';
            } else if (['html', 'css', 'json', 'xml'].includes(extension || '')) {
              artifactType = 'build';
            }

            dispatch({
              type: 'ADD_ARTIFACT', payload: {
                id: Math.random().toString(36).substring(7),
                title: file.name,
                content: fileContent,
                type: artifactType,
                phase: Phase.INITIATION,
                createdBy: AgentRole.ORCHESTRATOR,
                timestamp: Date.now(),
                tags: ['Uploaded', 'Wizard']
              }
            });
          } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            // Still create artifact entry even if reading fails
            dispatch({
              type: 'ADD_ARTIFACT', payload: {
                id: Math.random().toString(36).substring(7),
                title: file.name,
                content: `[File upload failed: ${error}]\n\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type || 'unknown'}`,
                type: 'requirement',
                phase: Phase.INITIATION,
                createdBy: AgentRole.ORCHESTRATOR,
                timestamp: Date.now(),
                tags: ['Uploaded', 'Wizard', 'Error']
              }
            });
          }
        }
      }

      // Add initial artifacts from preview
      if (projectPreview) {
        const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);

        dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'Executive Summary.md',
            content: projectPreview.summary,
            type: 'requirement',
            phase: Phase.INITIATION,
            createdBy: AgentRole.ORCHESTRATOR,
            timestamp: Date.now(),
            tags: ['Brief']
          }
        });
        dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'System Architecture.mermaid',
            content: `\`\`\`mermaid\n${cleanArch}\n\`\`\``,
            type: 'design',
            phase: Phase.INITIATION,
            createdBy: AgentRole.DESIGN_ARCH_AGENT,
            timestamp: Date.now(),
            tags: ['Architecture']
          }
        });
        dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'Wireframe Prototype.html',
            content: projectPreview.wireframeCode,
            type: 'build',
            phase: Phase.INITIATION,
            createdBy: AgentRole.UX_DESIGNER,
            timestamp: Date.now(),
            tags: ['Prototype']
          }
        });
      }

      // MIGRATION: Extract research findings as knowledge artifacts
      const researchMessages = history.filter(msg =>
        msg.sender === 'system' &&
        (msg.text.includes('Research Findings') || msg.text.includes('Deep Research'))
      );

      if (researchMessages.length > 0) {
        researchMessages.forEach((msg, index) => {
          dispatch({
            type: 'ADD_ARTIFACT', payload: {
              id: Math.random().toString(36).substring(7),
              title: `Research Findings ${index + 1}.md`,
              content: msg.text,
              type: 'requirement',
              phase: Phase.INITIATION,
              createdBy: AgentRole.ORCHESTRATOR,
              timestamp: msg.timestamp,
              tags: ['Research', 'Knowledge', 'Wizard']
            }
          });
        });
      }

      // MIGRATION: Store wizard metadata in project state
      // Get custom themes (themes not in default PROJECT_THEMES)
      const defaultThemeIds = PROJECT_THEMES.map(t => t.id);
      const customThemes = availableThemes
        .filter(t => !defaultThemeIds.includes(t.id))
        .map(t => ({
          id: t.id,
          label: t.label,
          primary: t.primary,
          secondary: (t as any).secondary,
          accent: (t as any).accent
        }));

      // Prepare uploaded files metadata
      const uploadedFilesMetadata = setupFiles.map(file => ({
        name: file.name,
        type: file.type || 'unknown',
        size: file.size
      }));

      // Store wizard metadata via direct state update (since we don't have a reducer action for this)
      const currentState = stateRef.current;
      if (currentState) {
        const updatedState: ProjectState = {
          ...currentState,
          wizardMetadata: {
            templateId: selectedTemplateId || undefined,
            templateName: selectedTemplateName || undefined,
            projectPreview: projectPreview ? {
              summary: projectPreview.summary,
              techStack: projectPreview.techStack,
              risks: projectPreview.risks,
              recommendedMethodology: projectPreview.recommendedMethodology as Methodology,
              recommendedStandards: projectPreview.recommendedStandards,
              estimatedSprints: projectPreview.estimatedSprints,
              projectName: projectPreview.projectName
            } : undefined,
            customThemes: customThemes.length > 0 ? customThemes : undefined,
            uploadedFiles: uploadedFilesMetadata.length > 0 ? uploadedFilesMetadata : undefined
          }
        };
        dispatch({ type: 'RESET_PROJECT', payload: updatedState });
      }

      addLog(`Project initialized based on interactive brief.`, AgentRole.ORCHESTRATOR, 'success');
      if (state.useInternet) addLog(`External Knowledge Access: ENABLED`, AgentRole.ORCHESTRATOR, 'info');
      if ((standardsToUse?.length || 0) > 0) {
        const stdNames = (standardsToUse || []).map(id => (QUALITY_STANDARDS || []).find(s => s.id === id)?.name).filter(Boolean).join(', ');
        addLog(`Compliance Protocols Activated: ${stdNames}`, AgentRole.QA_AUDIT_AGENT, 'action');
      }

      // Transfer setup chat messages to global chat for continuity
      // Filter out the initial welcome message from setup if it exists, and keep the global welcome message
      const setupMessagesToTransfer = history.filter(msg =>
        !(msg.sender === 'system' && msg.text.includes('Hello, I am Raed'))
      );

      // Get the orchestrator agent for proper message formatting
      const orchestrator = stateRef.current.agents.find(a => a.role === AgentRole.ORCHESTRATOR) || AGENTS[0];

      // Transfer messages, converting system messages to agent messages for continuity
      const transferredMessages: ChatMessage[] = setupMessagesToTransfer.map(msg => {
        if (msg.sender === 'system') {
          // Convert system messages to agent messages for continuity in global chat
          return {
            ...msg,
            sender: 'agent' as const,
            agentId: orchestrator.id,
            isLogEvent: false
          };
        }
        return msg;
      });

      // Append transferred messages to global messages (keeping the welcome message)
      setGlobalMessages(prev => {
        // Check if messages are already transferred to avoid duplicates
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = transferredMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMessages];
      });

      setSetupFiles([]);

      // CRITICAL: Save project immediately after adding wizard-created artifacts
      // This ensures all items created in wizard are persisted before transitioning to workspace
      // Wait a brief moment for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      await saveProject();

      setViewMode('workspace');
      window.location.hash = '#workspace';
      setProcessingProgress(50);

      // Orchestrate phase will create tasks - save again after it completes
      await orchestratePhase(Phase.INITIATION, structuredDescription);

      // CRITICAL: Save project again after orchestratePhase completes
      // This ensures all tasks and artifacts created during orchestration are persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      await saveProject();

      // Update URL with project ID for proper restoration
      const currentProjectId = stateRef.current?.id;
      if (currentProjectId) {
        const url = new URL(window.location.href);
        url.hash = '#workspace';
        url.searchParams.set('project', currentProjectId);
        window.history.replaceState({}, '', url.toString());
        projectStorage.setCurrentProjectId(currentProjectId);
      }

      setProcessingProgress(100);
      setProcessingLabel("Project initialized successfully!");

      // Clear processing state after a brief delay
      setTimeout(() => {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
      }, 1000);

    } catch (error: any) {
      // Error recovery for transition failures
      console.error('[Transition] Failed to initialize workspace:', error);

      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';

      // Show user-friendly error with recovery options
      if (toastService) {
        toastService.error(
          `Workspace Initialization Failed: Error: ${errorMessage}. You can try again or continue with manual setup.`,
          8000
        );
      }

      // Add error message to chat history
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `⚠️ **Transition Error:** ${errorMessage}\n\nYour project data has been saved. You can:\n1. Try launching again\n2. Continue in workspace with manual setup\n3. Contact support if the issue persists.`,
        timestamp: Date.now()
      };

      // Ensure chat history is preserved even on error
      setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(errorMsg.id)) {
          return prev;
        }
        return [...prev, errorMsg];
      });

      // Reset processing state
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);

      // Optionally, still transition to workspace but show error
      // Or stay in setup view - for now, we'll stay in setup
      // setViewMode('workspace'); // Uncomment to allow transition despite error
    }
  };

  const handleManualLaunch = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log("Manual Launch Triggered");

    const userText = "Start Project";
    const newMessage: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    };
    const updatedMessages = [...setupMessages, newMessage];
    setSetupMessages(updatedMessages);
    proceedToWorkspace(updatedMessages);
  };

  // Handle launching project from brainstorming view
  const handleLaunchFromBrainstorming = async (brainstormingData: {
    topic: string;
    ideas: any[];
    keyInsights: string[];
    nextSteps: string[];
    projectPreview: ProjectPreview | null;
    selectedStandards: string[];
    messages: ChatMessage[];
    useInternet: boolean;
    conversationId: string | null;
    buildPlatform?: string;
    buildFeatures?: string[];
    workspaceId?: string;
  }) => {
    try {
      const { topic, ideas, keyInsights, nextSteps, projectPreview, selectedStandards, messages, useInternet, conversationId, buildPlatform, buildFeatures, workspaceId } = brainstormingData;

      if (!projectPreview) {
        if (toastService) {
          toastService.error('Launch Failed: Project preview is required to launch. Please generate a prototype first.');
        }
        return;
      }

      dispatch({ type: 'SET_PROCESSING', payload: true });
      setProcessingLabel("Initializing Project from Brainstorming...");
      setProcessingProgress(0);

      // Construct structured description from brainstorming data
      let structuredDescription = `# PROJECT: ${projectPreview.projectName || topic || 'New Project'}\n\n`;

      if (topic) {
        structuredDescription += `## PROJECT TOPIC\n${topic}\n\n`;
      }

      // Add Build Configuration from User Selection
      if (buildPlatform || (buildFeatures && buildFeatures.length > 0)) {
        structuredDescription += `## BUILD CONFIGURATION\n`;
        if (buildPlatform) {
          // Map platform codenames to display names
          const platformName = buildPlatform === 'mobile' ? 'Mobile App (React Native)' :
            buildPlatform === 'web' ? 'Web Application (React/Next.js)' :
              buildPlatform === 'desktop' ? 'Desktop App (Electron/Tauri)' :
                buildPlatform === 'api' ? 'Backend API' :
                  buildPlatform === 'fullstack' ? 'Full Stack Application' : buildPlatform;
          structuredDescription += `- **Target Platform**: ${platformName}\n`;
        }
        if (buildFeatures && buildFeatures.length > 0) {
          structuredDescription += `- **Prioritized Features**: ${buildFeatures.join(', ')}\n`;
        }
        structuredDescription += `\n`;
      }

      if (projectPreview) {
        structuredDescription += `## EXECUTIVE SUMMARY\n${projectPreview.summary}\n\n`;
        structuredDescription += `## TECH STACK\n${projectPreview.techStack.map(t => `- ${t}`).join('\n')}\n\n`;

        // Embed the architecture diagram
        const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);
        structuredDescription += `## ARCHITECTURE DIAGRAM\n\`\`\`mermaid\n${cleanArch}\n\`\`\`\n\n`;
        structuredDescription += `## UI PROTOTYPE\n(See 'Wireframe Prototype.html' artifact for the visual mockups. Agents should refer to this artifact for UI tasks.)\n\n`;
        structuredDescription += `## IDENTIFIED RISKS\n${projectPreview.risks.map(r => `- ${r}`).join('\n')}\n\n`;

        // Add Full Architecture Analysis if available
        if (projectPreview.backendArchitecture || projectPreview.adminConsole || projectPreview.infrastructure ||
          projectPreview.securityArchitecture || projectPreview.databaseArchitecture || projectPreview.apiDesign) {
          structuredDescription += `## COMPLETE PROJECT ARCHITECTURE\n\n`;
          structuredDescription += `**This section contains the complete architecture breakdown for all project components. Agents MUST reference this when implementing backend, admin, infrastructure, security, database, and API components.**\n\n`;

          // Backend Architecture
          if (projectPreview.backendArchitecture) {
            structuredDescription += `### Backend Architecture\n`;
            structuredDescription += `- **API Server**: ${projectPreview.backendArchitecture.apiServer}\n`;
            structuredDescription += `- **Architecture Pattern**: ${projectPreview.backendArchitecture.architecture}\n`;
            structuredDescription += `- **Framework**: ${projectPreview.backendArchitecture.framework}\n`;
            structuredDescription += `- **Business Logic**: ${projectPreview.backendArchitecture.businessLogic}\n`;
            structuredDescription += `- **Data Access**: ${projectPreview.backendArchitecture.dataAccess}\n`;
            structuredDescription += `- **Background Jobs**: ${projectPreview.backendArchitecture.backgroundJobs}\n`;
            if (projectPreview.backendArchitecture.realTimeServices) {
              structuredDescription += `- **Real-time Services**: ${projectPreview.backendArchitecture.realTimeServices}\n`;
            }
            structuredDescription += `- **Description**: ${projectPreview.backendArchitecture.description}\n\n`;
          }

          // Admin Console
          if (projectPreview.adminConsole && projectPreview.adminConsole.required) {
            structuredDescription += `### Admin Console (REQUIRED)\n`;
            structuredDescription += `- **Required**: Yes\n`;
            structuredDescription += `- **Features**: ${projectPreview.adminConsole.features.join(', ')}\n`;
            structuredDescription += `- **User Management**: ${projectPreview.adminConsole.userManagement ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Content Management**: ${projectPreview.adminConsole.contentManagement ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Analytics**: ${projectPreview.adminConsole.analytics ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **System Configuration**: ${projectPreview.adminConsole.systemConfiguration ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Monitoring**: ${projectPreview.adminConsole.monitoring ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Description**: ${projectPreview.adminConsole.description}\n\n`;
          }

          // Infrastructure
          if (projectPreview.infrastructure) {
            structuredDescription += `### Infrastructure\n`;
            structuredDescription += `- **Application Servers**: ${projectPreview.infrastructure.applicationServers}\n`;
            structuredDescription += `- **Database Servers**: ${projectPreview.infrastructure.databaseServers}\n`;
            structuredDescription += `- **Caching**: ${projectPreview.infrastructure.caching}\n`;
            structuredDescription += `- **Message Queues**: ${projectPreview.infrastructure.messageQueues}\n`;
            structuredDescription += `- **CDN**: ${projectPreview.infrastructure.cdn}\n`;
            structuredDescription += `- **Monitoring**: ${projectPreview.infrastructure.monitoring}\n`;
            structuredDescription += `- **Logging**: ${projectPreview.infrastructure.logging}\n`;
            structuredDescription += `- **Deployment**: ${projectPreview.infrastructure.deployment}\n`;
            structuredDescription += `- **Description**: ${projectPreview.infrastructure.description}\n\n`;
          }

          // Security Architecture
          if (projectPreview.securityArchitecture) {
            structuredDescription += `### Security Architecture\n`;
            structuredDescription += `- **Authentication**: ${projectPreview.securityArchitecture.authentication}\n`;
            structuredDescription += `- **Authorization**: ${projectPreview.securityArchitecture.authorization}\n`;
            structuredDescription += `- **Data Encryption**: ${projectPreview.securityArchitecture.dataEncryption}\n`;
            structuredDescription += `- **API Security**: ${projectPreview.securityArchitecture.apiSecurity}\n`;
            structuredDescription += `- **Rate Limiting**: ${projectPreview.securityArchitecture.rateLimiting ? 'Yes' : 'No'}\n`;
            structuredDescription += `- **Security Monitoring**: ${projectPreview.securityArchitecture.securityMonitoring ? 'Yes' : 'No'}\n`;
            if (projectPreview.securityArchitecture.compliance.length > 0) {
              structuredDescription += `- **Compliance Requirements**: ${projectPreview.securityArchitecture.compliance.join(', ')}\n`;
            }
            structuredDescription += `- **Description**: ${projectPreview.securityArchitecture.description}\n\n`;
          }

          // Database Architecture
          if (projectPreview.databaseArchitecture) {
            structuredDescription += `### Database Architecture\n`;
            structuredDescription += `- **Primary Database**: ${projectPreview.databaseArchitecture.primaryDatabase}\n`;
            structuredDescription += `- **Database Type**: ${projectPreview.databaseArchitecture.databaseType.toUpperCase()}\n`;
            structuredDescription += `- **Schema Design**: ${projectPreview.databaseArchitecture.schemaDesign}\n`;
            structuredDescription += `- **Caching Strategy**: ${projectPreview.databaseArchitecture.cachingStrategy}\n`;
            structuredDescription += `- **Backup & Recovery**: ${projectPreview.databaseArchitecture.backupRecovery}\n`;
            structuredDescription += `- **Migrations**: ${projectPreview.databaseArchitecture.migrations}\n`;
            structuredDescription += `- **Description**: ${projectPreview.databaseArchitecture.description}\n\n`;
          }

          // API Design
          if (projectPreview.apiDesign) {
            structuredDescription += `### API Design\n`;
            structuredDescription += `- **API Style**: ${projectPreview.apiDesign.apiStyle}\n`;
            if (projectPreview.apiDesign.endpoints.length > 0) {
              structuredDescription += `- **Key Endpoints**:\n${projectPreview.apiDesign.endpoints.map(e => `  - ${e}`).join('\n')}\n`;
            }
            if (projectPreview.apiDesign.externalIntegrations.length > 0) {
              structuredDescription += `- **External Integrations**: ${projectPreview.apiDesign.externalIntegrations.join(', ')}\n`;
            }
            if (projectPreview.apiDesign.thirdPartyServices.length > 0) {
              structuredDescription += `- **Third-party Services**: ${projectPreview.apiDesign.thirdPartyServices.join(', ')}\n`;
            }
            if (projectPreview.apiDesign.webhooks.length > 0) {
              structuredDescription += `- **Webhooks**: ${projectPreview.apiDesign.webhooks.join(', ')}\n`;
            }
            structuredDescription += `- **Documentation**: ${projectPreview.apiDesign.documentation}\n`;
            structuredDescription += `- **Description**: ${projectPreview.apiDesign.description}\n\n`;
          }

          structuredDescription += `**IMPORTANT FOR AGENTS**: When implementing tasks, refer to the appropriate architecture section above. For example:\n`;
          structuredDescription += `- Backend tasks → Reference "Backend Architecture" section\n`;
          structuredDescription += `- Admin panel tasks → Reference "Admin Console" section\n`;
          structuredDescription += `- Database tasks → Reference "Database Architecture" section\n`;
          structuredDescription += `- API tasks → Reference "API Design" section\n`;
          structuredDescription += `- Security tasks → Reference "Security Architecture" section\n`;
          structuredDescription += `- Infrastructure/deployment tasks → Reference "Infrastructure" section\n\n`;
        }
      }

      // Add ideas as requirements
      if (ideas && ideas.length > 0) {
        structuredDescription += `## KEY IDEAS & REQUIREMENTS\n`;
        ideas.forEach(idea => {
          structuredDescription += `### ${idea.label}\n`;
          if (idea.description) structuredDescription += `${idea.description}\n`;
          if (idea.notes) structuredDescription += `\n**Notes:** ${idea.notes}\n`;
          structuredDescription += `\n`;
        });
      }

      // Add key insights
      if (keyInsights && keyInsights.length > 0) {
        structuredDescription += `## KEY INSIGHTS\n${keyInsights.map(insight => `- ${insight}`).join('\n')}\n\n`;
      }

      // Add next steps
      if (nextSteps && nextSteps.length > 0) {
        structuredDescription += `## RECOMMENDED NEXT STEPS\n${nextSteps.map(step => `- ${step}`).join('\n')}\n\n`;
      }

      // Add conversation history
      if (messages && messages.length > 0) {
        structuredDescription += `## BRAINSTORMING CONVERSATION\n`;
        structuredDescription += messages.map(m => `**${m.sender.toUpperCase()}**: ${m.text}`).join('\n\n');
      }

      const finalProjectName = projectPreview.projectName || topic || 'New Project';

      // Initialize project state
      dispatch({
        type: 'SET_PROJECT_DETAILS',
        payload: {
          name: finalProjectName,
          description: structuredDescription,
          methodology: (projectPreview.recommendedMethodology as Methodology) || 'V-Model',
          estimatedSprints: projectPreview.estimatedSprints
        }
      });

      // Set standards
      const standardsToUse = projectPreview.recommendedStandards && projectPreview.recommendedStandards.length > 0
        ? projectPreview.recommendedStandards
        : (selectedStandards || []);
      dispatch({ type: 'SET_STANDARDS', payload: standardsToUse });

      // Set internet usage
      dispatch({ type: 'TOGGLE_INTERNET', payload: useInternet });

      setProcessingLabel("Creating project artifacts...");
      setProcessingProgress(20);

      // Create artifacts from project preview
      if (projectPreview.wireframeCode) {
        dispatch({
          type: 'ADD_ARTIFACT',
          payload: {
            id: `wireframe-${Date.now()}`,
            title: 'Wireframe Prototype.html',
            content: projectPreview.wireframeCode,
            type: 'build',
            phase: Phase.ARCHITECTURE,
            timestamp: Date.now(),
            createdBy: 'Project Manager',
            tags: ['prototype', 'wireframe']
          }
        });
      }

      if (projectPreview.architectureDiagram) {
        dispatch({
          type: 'ADD_ARTIFACT',
          payload: {
            id: `architecture-${Date.now()}`,
            title: 'Architecture Diagram.mmd',
            content: projectPreview.architectureDiagram,
            type: 'design',
            phase: Phase.ARCHITECTURE,
            timestamp: Date.now(),
            createdBy: 'Architect',
            tags: ['architecture', 'diagram']
          }
        });
      }

      // NEW: Create Project Brief artifact
      dispatch({
        type: 'ADD_ARTIFACT',
        payload: {
          id: `project-brief-${Date.now()}`,
          title: 'Project Brief.md',
          content: structuredDescription,
          type: 'requirement', // Using 'requirement' as it is a valid ArtifactType
          phase: Phase.INITIATION,
          timestamp: Date.now(),
          createdBy: 'Project Manager',
          tags: ['brief', 'requirements']
        }
      });

      setProcessingProgress(40);
      setProcessingLabel("Saving project...");

      // Store full project preview (including architecture analysis) in wizardMetadata
      // This ensures agents can access the complete architecture analysis during execution
      // Also store conversationId to link the project back to its conversation
      const currentState = stateRef.current;
      if (currentState) {
        const updatedState: ProjectState = {
          ...currentState,
          wizardMetadata: {
            ...currentState.wizardMetadata,
            projectPreview: projectPreview, // Store complete project preview with architecture analysis
            conversationId: conversationId || undefined, // Link project to conversation
            data: {
              ...(currentState.wizardMetadata?.data || {}),
              brainstormingContext: {
                concept: topic,
                ideas: ideas,
                keyInsights: keyInsights,
                audience: 'General', // Default/Placeholder
                style: 'Standard', // Default/Placeholder
                coreLoop: 'Standard gameplay' // Default/Placeholder
              }
            }
          },
          folderId: workspaceId || currentState.folderId
        };
        dispatch({ type: 'RESET_PROJECT', payload: updatedState });
      }

      // Save project first to get the project ID
      await saveProject();

      // Link conversation to project after project is saved (so we have the project ID)
      if (conversationId && user) {
        try {
          const { chatApi } = await import('@src/services/chatApi');
          const projectId = stateRef.current?.id;
          if (projectId) {
            await chatApi.updateNeuralChat(conversationId, {
              projectId: projectId
            });
            if (import.meta.env.DEV) {
              console.log('[Launch Project] Linked conversation to project:', { conversationId, projectId });
            }
          }
        } catch (linkError) {
          console.warn('[Launch Project] Failed to link conversation to project:', linkError);
          // Don't fail the launch if linking fails
        }
      }

      setProcessingProgress(60);
      setProcessingLabel("Initializing workspace...");

      // Navigate to workspace
      setViewMode('workspace');
      window.location.hash = '#workspace';

      setProcessingProgress(80);

      // Orchestrate initiation phase
      await orchestratePhase(Phase.INITIATION, structuredDescription);

      setProcessingProgress(100);

      // Save again after orchestration
      await saveProject();

      // Update URL with project ID
      const currentProjectId = state.id;
      if (currentProjectId) {
        const url = new URL(window.location.href);
        url.searchParams.set('project', currentProjectId);
        window.history.replaceState({}, '', url.toString());
      }

      if (toastService) {
        toastService.success('Project Launched: Your project has been created and is ready to start!', 3000);
      }

      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingProgress(0);
      setProcessingLabel(null);

    } catch (error: any) {
      console.error('[Launch from Brainstorming] Failed:', error);
      if (toastService) {
        toastService.error('Launch Failed: ' + (error.message || 'Failed to launch project. Please try again.'));
      }
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingProgress(0);
      setProcessingLabel(null);
    }
  };

  const handleResetProject = () => { setViewMode('hub'); };
  const orchestratePhase = async (phase: Phase, description: string) => {
    // Track start time for accurate time estimation
    const startTime = Date.now();
    processingStartTimeRef.current = startTime;

    // Helper function to calculate and update estimated time based on actual elapsed time
    const updateEstimatedTime = (currentProgress: number) => {
      if (!processingStartTimeRef.current) return;
      const elapsedMs = Date.now() - processingStartTimeRef.current;
      const elapsedSeconds = elapsedMs / 1000;

      // Calculate estimated remaining time based on progress and elapsed time
      // Progress is not linear - most time is spent on LLM call (typically 2-8 seconds)
      if (currentProgress < 50) {
        // Before LLM call completes: estimate conservatively
        // Most orchestration time (70-80%) is spent waiting for LLM response
        // Typical LLM call: 3-6 seconds, but can be up to 8-10 seconds
        const typicalLLMDuration = 6; // Conservative estimate: 6 seconds for LLM
        const remainingForLLM = Math.max(3, typicalLLMDuration - elapsedSeconds);
        const remainingForProcessing = 3; // Task processing after LLM (conservative)
        const estimatedRemaining = remainingForLLM + remainingForProcessing;
        // Always show at least 5 seconds if early in process
        setProcessingEstimatedTime(Math.ceil(Math.max(5, estimatedRemaining)));
      } else if (currentProgress >= 50 && currentProgress < 90) {
        // After LLM call: estimate based on remaining task processing
        // Use actual elapsed time to predict remaining, but be conservative
        const progressRatio = Math.max(0.1, currentProgress / 100);
        const estimatedTotalSeconds = elapsedSeconds / progressRatio;
        const estimatedRemaining = estimatedTotalSeconds - elapsedSeconds;
        // Add 50% buffer for safety (was 20%, now more conservative)
        const bufferedRemaining = estimatedRemaining * 1.5;
        setProcessingEstimatedTime(Math.ceil(Math.max(2, bufferedRemaining)));
      } else {
        // Almost done (90%+)
        setProcessingEstimatedTime(1);
      }
    };

    // Initialize processing state
    setProcessingLabel(`Orchestrating Strategy for ${phase}...`);
    setProcessingProgress(10);
    setProcessingStatusText('Analyzing project requirements...');
    updateEstimatedTime(10);
    setProcessingTaskCount(0);
    dispatch({ type: 'SET_PROCESSING', payload: true });
    addLog(`Orchestrating tasks for ${phase} (Sprint ${stateRef.current.currentSprint})...`, AgentRole.ORCHESTRATOR, 'action');

    const currentState = stateRef.current;
    const allCompleted = currentState.tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const localAgents = [...currentState.agents];

    // Stage 1: Connect to AI orchestrator
    setProcessingLabel(`Orchestrating Strategy for ${phase}...`);
    setProcessingStatusText('Connecting to AI orchestrator...');
    setProcessingProgress(20);
    updateEstimatedTime(20);

    // Stage 2: Generate task breakdown
    setProcessingStatusText('Generating task breakdown...');
    setProcessingProgress(30);
    updateEstimatedTime(30);

    let result;
    try {
      result = await orchestrateNextSteps(phase, description, allCompleted, currentState.useInternet, currentState.mcpServers, settingsRef.current.maxTasksPerPhase, localAgents);
    } catch (error: any) {
      // Check if it's a connection error (backend not running)
      if (error?.isConnectionError || error?.message?.includes('Backend server is not running') || error?.message?.includes('Failed to fetch')) {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        setProcessingLabel(null);
        setProcessingProgress(0);
        setProcessingStatusText(undefined);
        toast.error(
          `Backend server is not running. Please start it:\n\n1. Open a terminal\n2. cd server\n3. npm run dev\n\nThe server should run on http://localhost:3002`,
          10000
        );
        addLog(
          `❌ Backend server is not running. Please start it:\n\n` +
          `1. Open a terminal\n` +
          `2. cd server\n` +
          `3. npm run dev\n\n` +
          `The server should run on http://localhost:3002`,
          AgentRole.ORCHESTRATOR,
          'error'
        );
        alert(
          'Backend Server Not Running\n\n' +
          'Please start the backend server:\n\n' +
          '1. Open a terminal\n' +
          '2. cd server\n' +
          '3. npm run dev\n\n' +
          'The server should run on http://localhost:3002\n\n' +
          'Check the console for more details.'
        );
        return;
      }
      // Re-throw other errors
      throw error;
    }

    // Stage 3: Assign agents to tasks
    setProcessingProgress(50);
    setProcessingStatusText('Assigning agents to tasks...');
    updateEstimatedTime(50);

    if (result && result.tasks && result.tasks.length > 0) {
      setProcessingLabel("Provisioning Agents & Generating Tasks...");
      setProcessingTaskCount(result.tasks.length);

      const titleToIdMap = new Map<string, string>();
      currentState.tasks.forEach(t => titleToIdMap.set(t.title, t.id));

      const tasksWithIds = result.tasks.map(t => {
        const newId = Math.random().toString(36).substring(7);
        if (t.title) titleToIdMap.set(t.title, newId);
        return { ...t, id: newId };
      });

      // OPTIMIZATION: Process tasks in batches with async breaks to keep UI responsive
      const processTask = async (t: any, index: number) => {
        if (!t.title) return;

        let safeAssignedTo = String(t.assignedTo || AgentRole.ORCHESTRATOR).trim();
        const targetRoleLower = safeAssignedTo.toLowerCase();

        // OPTIMIZATION: Faster agent lookup - simplified matching
        let existingAgent = localAgents.find(a => {
          const roleLower = a.role.toLowerCase();
          const nameLower = a.name.toLowerCase();
          return roleLower === targetRoleLower ||
            nameLower === targetRoleLower ||
            (roleLower.includes(targetRoleLower) && targetRoleLower.length > 3) ||
            (targetRoleLower.includes(roleLower) && roleLower.length > 3);
        });

        // OPTIMIZATION: Skip agent creation if not found - assign to Orchestrator immediately
        // Agent creation can be done later if needed, don't block task generation
        if (!existingAgent) {
          const isGeneric = ['undefined', 'unknown', 'unassigned', 'orchestrator'].includes(targetRoleLower);
          if (!isGeneric && targetRoleLower.length > 3) {
            // Try to create agent but with timeout to avoid blocking
            try {
              setProcessingStatusText(`Assigning agent for task ${index + 1}...`);
              const agentPromise = generateAgentProfile(safeAssignedTo, currentState.description);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Agent creation timeout')), 20000) // Increased to 20s to allow LLM API calls to complete
              );

              const newAgent = await Promise.race([agentPromise, timeoutPromise]) as Agent;
              const duplicate = localAgents.find(a =>
                a.role.toLowerCase() === newAgent.role.toLowerCase() ||
                a.name.toLowerCase() === newAgent.name.toLowerCase()
              );
              if (!duplicate) {
                dispatch({ type: 'ADD_AGENT', payload: newAgent });
                localAgents.push(newAgent);
                safeAssignedTo = newAgent.role;
              } else {
                safeAssignedTo = duplicate.role;
              }
            } catch (e) {
              // Timeout or error - just use Orchestrator, don't block
              console.warn("Agent creation skipped, using Orchestrator", e);
              safeAssignedTo = AgentRole.ORCHESTRATOR;
            }
          } else {
            safeAssignedTo = AgentRole.ORCHESTRATOR;
          }
        } else {
          safeAssignedTo = existingAgent.role;
        }

        // Resolve dependencies quickly
        const resolvedDeps: string[] = [];
        if (t.dependencies && Array.isArray(t.dependencies)) {
          t.dependencies.forEach(depTitle => {
            const depId = titleToIdMap.get(depTitle);
            if (depId) {
              resolvedDeps.push(depId);
            } else {
              const match = Array.from(titleToIdMap.keys()).find(k => k.toLowerCase() === depTitle.toLowerCase());
              if (match) {
                resolvedDeps.push(titleToIdMap.get(match)!);
              }
            }
          });
        }

        // OPTIMIZATION: Add task immediately (optimistic UI update)
        dispatch({
          type: 'ADD_TASK',
          payload: {
            id: t.id,
            title: t.title,
            description: t.description || "Task generated by Orchestrator",
            assignedTo: safeAssignedTo,
            phase: phase,
            status: TaskStatus.PENDING,
            dependencies: resolvedDeps,
            logs: [],
            progress: 0,
            traceRefs: t.traceRefs || [],
            sprint: currentState.currentSprint,
            // Initialize evaluation with pending status (will be calculated when task is executed)
            evaluation: {
              score: 0,
              reasoning: 'Quality score will be calculated when task is executed.',
              criteria: [],
              timestamp: Date.now()
            }
          }
        });
        addLog(`Created task: ${t.title} -> ${safeAssignedTo}`, AgentRole.ORCHESTRATOR);

        // Update progress
        const p = 50 + Math.round(((index + 1) / tasksWithIds.length) * 50);
        setProcessingProgress(Math.min(99, p));
      };
      // Process tasks with async breaks to keep UI responsive
      for (let i = 0; i < tasksWithIds.length; i++) {
        await processTask(tasksWithIds[i], i);
        // Yield to browser every 2 tasks to keep UI responsive
        if ((i + 1) % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    } else {
      addLog(`No new tasks generated. Phase might be complete.`, AgentRole.ORCHESTRATOR, 'info');
    }

    // Complete
    setProcessingProgress(100);
    setProcessingStatusText('Complete!');
    setProcessingEstimatedTime(0);

    setTimeout(() => {
      dispatch({ type: 'SET_PROCESSING', payload: false });
      setProcessingLabel(null);
      setProcessingProgress(0);
      setProcessingStatusText(undefined);
      setProcessingEstimatedTime(undefined);
      setProcessingTaskCount(undefined);
      processingStartTimeRef.current = null;
    }, 500);
  };
  const executeTask = useCallback(async (taskId: string, retryCount = 0) => {
    const currentState = stateRef.current; const task = currentState.tasks.find(t => t.id === taskId); if (!task) return;
    // Prevent duplicate execution: check if task is already executing
    // BUT: Allow retries for FAILED tasks (they need to be able to retry)
    const isRetry = retryCount > 0 || task.status === TaskStatus.FAILED;
    if (activeTaskControllersRef.current.has(taskId) && !isRetry) {
      console.warn(`Task ${taskId} (${task.title}) is already executing - skipping duplicate call`);
      return;
    }
    // Also check if task status is already IN_PROGRESS (race condition protection)
    // BUT: Allow retries for FAILED tasks
    if (task.status === TaskStatus.IN_PROGRESS && !isRetry) {
      console.warn(`Task ${taskId} (${task.title}) is already IN_PROGRESS - skipping duplicate call`);
      return;
    }
    // If this is a retry, clear the old controller first
    if (isRetry && activeTaskControllersRef.current.has(taskId)) {
      const oldController = activeTaskControllersRef.current.get(taskId);
      if (oldController) {
        oldController.abort(); // Abort the old execution
      }
      activeTaskControllersRef.current.delete(taskId);
    }
    const controller = new AbortController(); activeTaskControllersRef.current.set(taskId, controller); dispatch({ type: 'SET_PROCESSING', payload: true }); dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.IN_PROGRESS } }); dispatch({ type: 'UPDATE_TASK_TIMING', payload: { id: taskId, startTime: Date.now() } }); let agent = currentState.agents.find(a => a.role === task.assignedTo || a.name === task.assignedTo); if (!agent) { if (currentState.agents.length === 0) { addLog(`No agents available to execute task: ${task.title}`, AgentRole.ORCHESTRATOR, 'error', taskId); dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.FAILED } }); dispatch({ type: 'SET_PROCESSING', payload: false }); activeTaskControllersRef.current.delete(taskId); return; } agent = currentState.agents[0]; addLog(`Agent ${task.assignedTo} not found, using fallback: ${agent.role}`, AgentRole.ORCHESTRATOR, 'warning', taskId); } addLog(`Starting task execution: ${task.title}`, agent.role, 'action', taskId); let currentProgress = 0; const progressInterval = setInterval(() => { currentProgress += 2 + Math.random() * 6; if (currentProgress > 95) currentProgress = 95; dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: currentProgress } }); }, 300); const handleCollaboration = (event: DialogueEvent) => {
      dispatch({ type: 'UPDATE_TASK_DIALOGUE', payload: { id: taskId, event } });
      addLog(`[Neural Dialogue] ${event.type.toUpperCase()}: ${event.sender} -> ${event.receiver}`, AgentRole.ORCHESTRATOR, 'info', taskId);

      // Fix: Add to global chat messages so it appears in the UI
      if (event.message) {
        const senderAgent = stateRef.current.agents.find(a => a.role === event.sender) || AGENTS.find(a => a.role === event.sender);
        setGlobalMessages(prev => [...prev, {
          id: event.id || Math.random().toString(36),
          sender: 'agent',
          text: event.message,
          timestamp: event.timestamp || Date.now(),
          agentId: senderAgent?.id,
          isLogEvent: false
        }]);
      }
    }; let createdArtifactId: string | null = null; try {
      const result = await executeTaskWithQualityImprovement(agent, task, currentState.description, currentState.artifacts, currentState.useInternet, currentState.mcpServers, handleCollaboration, currentState.selectedStandards, { maxQualityRetries: 3, qualityThreshold: 70, enableHumanInTheLoop: settingsRef.current.enableHumanInTheLoop }, controller.signal); const { output, resources, tokenUsage, modelUsed: actualModel, evaluation, collaboration } = result; if (controller.signal.aborted) throw new Error("Operation cancelled by user."); dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: 100 } }); dispatch({ type: 'UPDATE_TASK_RESOURCES', payload: { id: taskId, resources } }); if (evaluation) { dispatch({ type: 'UPDATE_TASK_EVALUATION', payload: { id: taskId, evaluation } }); } if (collaboration && collaboration.length > 0) { dispatch({ type: 'UPDATE_TASK_COLLABORATION', payload: { id: taskId, collaboration } }); } let artifactType: Artifact['type'] = 'code'; const safeTitle = (task.title || "").toLowerCase(); if (agent.role === AgentRole.NOTEBOOK_AGENT || safeTitle.includes('notebook') || safeTitle.includes('analysis') || safeTitle.includes('data')) artifactType = 'notebook'; else if (task.phase === Phase.REQUIREMENTS) artifactType = 'requirement'; else if (task.phase === Phase.ARCHITECTURE) artifactType = 'design'; else if (task.phase === Phase.TEST_PLANNING) artifactType = 'test-plan'; else if (task.phase === Phase.IMPLEMENTATION) artifactType = 'code'; if (safeTitle.includes('build') || safeTitle.includes('compile')) artifactType = 'build'; else if (safeTitle.includes('audit')) artifactType = 'audit-report'; else if (safeTitle.includes('image')) artifactType = 'image'; const updatedTitle = (artifactType === 'code' || artifactType === 'build') ? task.title : `Output: ${task.title}`; const existingArtifact = currentState.artifacts.find(a => a.title === updatedTitle && a.type === artifactType); if (existingArtifact) { if (artifactType === 'notebook') { try { const existingCells = existingArtifact.notebookCells || (existingArtifact.content ? JSON.parse(existingArtifact.content) : []); const newCells = output.includes('[') ? JSON.parse(output) : [{ id: `cell-${Date.now()}`, type: 'markdown', content: output }]; const mergedCells = [...existingCells, ...newCells]; dispatch({ type: 'UPDATE_ARTIFACT', payload: { id: existingArtifact.id, content: JSON.stringify(mergedCells) } }); } catch (e) { dispatch({ type: 'UPDATE_ARTIFACT', payload: { id: existingArtifact.id, content: output } }); } } else { dispatch({ type: 'UPDATE_ARTIFACT', payload: { id: existingArtifact.id, content: output } }); } addLog(`Artifact updated: ${updatedTitle}`, agent.role, 'success', taskId); } else { const newArtifactId = Math.random().toString(36).substring(7); let notebookCells: any[] | undefined = undefined; let artifactContent = output; if (artifactType === 'notebook') { try { if (output.trim().startsWith('[')) { notebookCells = JSON.parse(output); artifactContent = JSON.stringify(notebookCells); } else { notebookCells = [{ id: `cell-${Date.now()}`, type: 'markdown', content: output }]; artifactContent = JSON.stringify(notebookCells); } } catch (e) { notebookCells = [{ id: `cell-${Date.now()}`, type: 'markdown', content: output }]; artifactContent = JSON.stringify(notebookCells); } } const artifact: Artifact = { id: newArtifactId, title: updatedTitle, content: artifactContent, type: artifactType, phase: task.phase, createdBy: agent.role, timestamp: Date.now(), tags: [task.phase], traceRefs: task.traceRefs, notebookCells: notebookCells }; dispatch({ type: 'ADD_ARTIFACT', payload: artifact }); createdArtifactId = newArtifactId; if (artifactType !== 'image' && artifactType !== 'build' && artifactType !== 'notebook') generateEmbedding(output).then(vector => { if (vector) dispatch({ type: 'UPDATE_ARTIFACT_EMBEDDING', payload: { id: artifact.id, embedding: vector } }); }); } let taskCost = 0; if (tokenUsage) { const pricing = MODEL_PRICING[actualModel] || MODEL_PRICING['unknown']; taskCost = (tokenUsage.promptTokens / 1000000) * pricing.input + (tokenUsage.candidatesTokens / 1000000) * pricing.output; } dispatch({ type: 'UPDATE_TASK_COST', payload: { id: taskId, cost: taskCost, tokenUsage: tokenUsage || { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 }, modelUsed: actualModel } });

      // Quality Gate: Task should only be completed if:
      // 1. Quality score is calculated (not pending, score > 0)
      // 2. Score passes threshold (>= 70) after refinement
      // 3. If score is pending (0) or below threshold, set to REVIEW or keep IN_PROGRESS
      const QUALITY_THRESHOLD = 70;
      const hasEvaluation = evaluation && evaluation.score !== undefined && evaluation.score !== null;
      const scoreIsPending = !hasEvaluation || (evaluation && evaluation.score === 0);
      const scorePassesThreshold = hasEvaluation && evaluation && evaluation.score >= QUALITY_THRESHOLD;

      let finalStatus: TaskStatus;

      if (scoreIsPending) {
        // Quality score is pending (not calculated or score = 0) - don't complete the task
        // Keep it in progress or set to review depending on HITL setting
        finalStatus = settingsRef.current.enableHumanInTheLoop ? TaskStatus.REVIEW : TaskStatus.IN_PROGRESS;
        addLog(`Quality Gate: Task quality score is pending (not yet calculated). Task cannot be completed until score is evaluated.`, AgentRole.QA_AUDIT_AGENT, 'warning', taskId);
      } else if (!scorePassesThreshold && evaluation) {
        // Score is calculated but below threshold - requires review
        finalStatus = settingsRef.current.enableHumanInTheLoop ? TaskStatus.REVIEW : TaskStatus.IN_PROGRESS;
        addLog(`Quality Gate: Task scored ${evaluation.score}/100 after ${result.qualityRetries + 1} attempt(s). Below threshold (${QUALITY_THRESHOLD}). Requires human review or refinement.`, AgentRole.QA_AUDIT_AGENT, 'warning', taskId);
      } else if (result.finalStatus === 'success' && scorePassesThreshold && evaluation) {
        // Score passes threshold and quality improvement succeeded - can complete
        finalStatus = TaskStatus.COMPLETED;
        addLog(`Task completed successfully after ${result.qualityRetries + 1} quality improvement attempt(s). Final score: ${evaluation.score}/100.`, agent.role, 'success', taskId);
      } else {
        // Fallback: evaluation missing or edge case
        // If HITL disabled and result says success, complete it (legacy behavior)
        // Otherwise require review
        finalStatus = (!settingsRef.current.enableHumanInTheLoop && result.finalStatus === 'success') ? TaskStatus.COMPLETED : TaskStatus.REVIEW;
        if (finalStatus === TaskStatus.REVIEW) {
          addLog(`Quality Gate: Task requires review. Score: ${evaluation?.score || 'N/A'}/100.`, AgentRole.QA_AUDIT_AGENT, 'warning', taskId);
        } else {
          addLog(`Task completed. Final score: ${evaluation?.score || 'N/A'}/100.`, agent.role, 'success', taskId);
        }
      }

      dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: finalStatus } });
      dispatch({ type: 'UPDATE_TASK_TIMING', payload: { id: taskId, endTime: Date.now() } });
    } catch (error: any) {
      let errorMessage = error.message || "Unknown error"; if (errorMessage.includes("cancelled")) { addLog(`Task cancelled by user: ${task.title}`, AgentRole.ORCHESTRATOR, 'warning', taskId); if (createdArtifactId) dispatch({ type: 'DELETE_ARTIFACT', payload: createdArtifactId }); dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.PENDING } }); dispatch({ type: 'UPDATE_TASK_PROGRESS', payload: { id: taskId, progress: 0 } }); return; } addLog(`Task failed: ${errorMessage}. Retrying...`, agent.role, 'error', taskId); dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.FAILED } }); // Clear the controller BEFORE retrying to allow the retry to proceed
      activeTaskControllersRef.current.delete(taskId);
      if (retryCount < settingsRef.current.maxRetries) { await new Promise(r => setTimeout(r, 5000)); executeTask(taskId, retryCount + 1); }
    } finally { clearInterval(progressInterval); activeTaskControllersRef.current.delete(taskId); const otherRunning = stateRef.current.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS && t.id !== taskId).length; if (otherRunning === 0 && !isBatchingRef.current && autoPilotStatusRef.current === 'idle') dispatch({ type: 'SET_PROCESSING', payload: false }); }
  }, [addLog]);
  const handleForceBuild = async () => { addLog("Manually triggering Compile Final Build task...", AgentRole.ORCHESTRATOR, 'action'); const newTask: Task = { id: Math.random().toString(36).substring(7), title: "Force Compile Final Build", description: "Manually triggered task to generate the final HTML5 build artifact.", assignedTo: AgentRole.INTEGRATION_AGENT, phase: Phase.INTEGRATION, status: TaskStatus.PENDING, dependencies: [], logs: [], progress: 0, traceRefs: ["MANUAL_OVERRIDE"], sprint: state.currentSprint, evaluation: { score: 0, reasoning: 'Quality score will be calculated when task is executed.', criteria: [], timestamp: Date.now() } }; dispatch({ type: 'ADD_TASK', payload: newTask }); setTimeout(() => executeTask(newTask.id), 100); };
  const handleRunAllTasks = useCallback(async () => {
    // Check if HITL preference has been set this session
    if (!hasHITLPreferenceSet()) {
      // Store the action to execute after user confirms HITL preference
      const runAllTasksInternal = async () => {
        const currentState = stateRef.current;
        if (currentState.budget.used >= currentState.budget.total) {
          alert("Budget Cap Reached!");
          return;
        }
        const pendingTasks = currentState.tasks.filter(t => (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) && t.sprint === currentState.currentSprint);
        if (pendingTasks.length === 0) {
          addLog(`No pending tasks to run.`, AgentRole.ORCHESTRATOR, 'info');
          return;
        }
        addLog(`Initiating batch execution: ${pendingTasks.length} tasks...`, AgentRole.ORCHESTRATOR, 'action');
        isBatchingRef.current = true;
        isStoppingRef.current = false;
        dispatch({ type: 'SET_PROCESSING', payload: true });
        const schedulerInterval = setInterval(() => {
          if (!isBatchingRef.current || isStoppingRef.current || stateRef.current.budget.used >= stateRef.current.budget.total) {
            clearInterval(schedulerInterval);
            dispatch({ type: 'SET_PROCESSING', payload: false });
            return;
          }
          const currentTasks = stateRef.current.tasks;
          const runningCount = currentTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
          const maxParallel = Math.max(1, settingsRef.current.maxParallelTasks || 5);
          if (runningCount >= maxParallel) return;
          const readyCandidates = currentTasks.filter(t =>
            (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) &&
            t.sprint === stateRef.current.currentSprint &&
            (!t.dependencies || t.dependencies.every(dId => currentTasks.find(dt => dt.id === dId)?.status === TaskStatus.COMPLETED)) &&
            !activeTaskControllersRef.current.has(t.id)
          );
          readyCandidates.slice(0, maxParallel - runningCount).forEach(t => executeTask(t.id));
        }, 2000);
      };
      pendingActionRef.current = runAllTasksInternal;
      setShowHITLPrompt(true);
      return;
    } else {
      // Use existing preference
      const enableHITL = getHITLPreference();
      setAppSettings(prev => ({ ...prev, enableHumanInTheLoop: enableHITL }));
    }

    const currentState = stateRef.current;
    if (currentState.budget.used >= currentState.budget.total) {
      alert("Budget Cap Reached!");
      return;
    }
    const pendingTasks = currentState.tasks.filter(t => (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) && t.sprint === currentState.currentSprint);
    if (pendingTasks.length === 0) {
      addLog(`No pending tasks to run.`, AgentRole.ORCHESTRATOR, 'info');
      return;
    }
    addLog(`Initiating batch execution: ${pendingTasks.length} tasks...`, AgentRole.ORCHESTRATOR, 'action');
    isBatchingRef.current = true;
    isStoppingRef.current = false;
    dispatch({ type: 'SET_PROCESSING', payload: true });
    const schedulerInterval = setInterval(() => {
      if (!isBatchingRef.current || isStoppingRef.current || stateRef.current.budget.used >= stateRef.current.budget.total) {
        clearInterval(schedulerInterval);
        dispatch({ type: 'SET_PROCESSING', payload: false });
        return;
      }
      const currentTasks = stateRef.current.tasks;
      const runningCount = currentTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
      const maxParallel = Math.max(1, settingsRef.current.maxParallelTasks || 5);
      if (runningCount >= maxParallel) return;
      const readyCandidates = currentTasks.filter(t =>
        (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) &&
        t.sprint === stateRef.current.currentSprint &&
        (!t.dependencies || t.dependencies.every(dId => currentTasks.find(dt => dt.id === dId)?.status === TaskStatus.COMPLETED)) &&
        !activeTaskControllersRef.current.has(t.id) // Prevent duplicate execution
      );
      readyCandidates.slice(0, maxParallel - runningCount).forEach(t => executeTask(t.id));
      if (runningCount === 0 && readyCandidates.length === 0 && !currentTasks.some(t => t.status === TaskStatus.IN_PROGRESS) && !currentTasks.some(t => (t.status === TaskStatus.PENDING || t.status === TaskStatus.PAUSED) && t.sprint === stateRef.current.currentSprint)) {
        clearInterval(schedulerInterval);
        isBatchingRef.current = false;
        dispatch({ type: 'SET_PROCESSING', payload: false });
        addLog(`Batch execution complete.`, AgentRole.ORCHESTRATOR, 'success');
      }
    }, 1000);
    batchIntervalRef.current = schedulerInterval;
  }, [addLog, executeTask]);
  const advancePhase = async () => { const currentIndex = PHASE_ORDER.indexOf(stateRef.current.currentPhase); if (currentIndex < PHASE_ORDER.length - 1) { const nextPhase = PHASE_ORDER[currentIndex + 1]; dispatch({ type: 'SET_PHASE', payload: nextPhase }); addLog(`Transitioning to phase: ${nextPhase}`, AgentRole.ORCHESTRATOR, 'success'); await orchestratePhase(nextPhase, stateRef.current.description); return true; } return false; };
  const startNextSprint = async () => { addLog(`Initializing Sprint ${stateRef.current.currentSprint + 1}...`, AgentRole.ORCHESTRATOR, 'action'); dispatch({ type: 'START_NEXT_SPRINT' }); await new Promise(r => setTimeout(r, 500)); await orchestratePhase(Phase.REQUIREMENTS, stateRef.current.description); };
  const regressPhase = () => { const currentIndex = PHASE_ORDER.indexOf(stateRef.current.currentPhase); if (currentIndex > 0) { const prevPhase = PHASE_ORDER[currentIndex - 1]; dispatch({ type: 'SET_PHASE', payload: prevPhase }); addLog(`Reverting to phase: ${prevPhase}`, AgentRole.ORCHESTRATOR, 'info'); } };
  const stopExecution = async () => {
    isStoppingRef.current = true;
    isBatchingRef.current = false;
    // Update ref immediately to break the while loop
    autoPilotStatusRef.current = 'idle';
    setAutoPilotStatus('idle');
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
    activeTaskControllersRef.current.forEach(c => c.abort());
    activeTaskControllersRef.current.clear();

    // Stop background HAND-OFF AI if running
    if (user?.id && stateRef.current.id) {
      try {
        const { getApiBaseUrl } = await import('@src/utils/apiUrlNormalizer');
        const API_BASE_URL = getApiBaseUrl();
        const token = localStorage.getItem('authToken') ||
          localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          (user as any)?.token;

        if (token) {
          // Get active background AutoPilots for this project
          const response = await fetch(`${API_BASE_URL}/api/background-autopilot?projectId=${stateRef.current.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.data && result.data.length > 0) {
              // Stop all active background AutoPilots for this project
              for (const autoPilot of result.data) {
                await fetch(`${API_BASE_URL}/api/background-autopilot/stop/${autoPilot.id}`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                }).catch(err => console.warn('Failed to stop background AutoPilot:', err));
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to stop background HAND-OFF AI:', error);
      }
    }

    addLog("Execution stopped.", AgentRole.ORCHESTRATOR, 'info');
    setTimeout(() => dispatch({ type: 'SET_PROCESSING', payload: false }), 500);
  };
  const pauseAutoPilot = () => { if (autoPilotStatus !== 'running') return; activeTaskControllersRef.current.forEach(c => c.abort()); activeTaskControllersRef.current.clear(); setAutoPilotStatus('paused'); addLog("Auto-Pilot paused.", AgentRole.ORCHESTRATOR, 'warning'); };
  // HAND-OFF AI execution loop - only runs when explicitly started by user
  const runAutoPilot = async () => {
    // Small delay to ensure state is set before checking
    await new Promise(r => setTimeout(r, 50));

    // Safety check: Verify we should actually be running
    if (autoPilotStatusRef.current !== 'running') {
      console.warn('runAutoPilot called but status is not "running" - aborting');
      return;
    }

    await new Promise(r => setTimeout(r, 0));
    while (autoPilotStatusRef.current === 'running') {
      // Safety checks at start of each loop iteration
      if (isStoppingRef.current || stateRef.current.budget.used >= stateRef.current.budget.total) {
        stopExecution();
        break;
      }

      // Verify status is still 'running' (prevent stale loops)
      if (autoPilotStatusRef.current !== 'running') {
        console.log('HAND-OFF AI status changed - stopping loop');
        break;
      }

      // Check if we should stop before running tasks
      if (isStoppingRef.current || autoPilotStatusRef.current !== 'running') {
        break;
      }

      const pendingTasks = stateRef.current.tasks.filter(t => (t.status === TaskStatus.PENDING || t.status === TaskStatus.FAILED || t.status === TaskStatus.PAUSED) && t.sprint === stateRef.current.currentSprint);
      if (pendingTasks.length > 0) {
        await handleRunAllTasks();
      }

      // Check again after running tasks
      if (autoPilotStatusRef.current !== 'running' || isStoppingRef.current) {
        break;
      }
      while (isBatchingRef.current) {
        await new Promise(r => setTimeout(r, 1000));
        if (isStoppingRef.current) break;
      }
      const hasActive = stateRef.current.tasks.some(t => t.status === TaskStatus.IN_PROGRESS);
      const hasReview = stateRef.current.tasks.some(t => t.status === TaskStatus.REVIEW);
      if (hasReview) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!hasActive && pendingTasks.length === 0) {
        await new Promise(r => setTimeout(r, 1500));
        if (autoPilotStatusRef.current !== 'running' || isStoppingRef.current) break;
        const advanced = await advancePhase();
        if (!advanced) {
          await startNextSprint();
        }
        await new Promise(r => setTimeout(r, 2000));
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Final safety check - ensure we're stopped when loop exits
    if (autoPilotStatusRef.current === 'running') {
      console.warn('HAND-OFF AI loop exited but status still "running" - forcing stop');
      stopExecution();
    }
  };

  // ... helpers ...
  const determineArtifactType = (phase: Phase): Artifact['type'] => { if (phase === Phase.REQUIREMENTS) return 'requirement'; if (phase === Phase.ARCHITECTURE) return 'design'; if (phase === Phase.IMPLEMENTATION) return 'code'; if (phase === Phase.TEST_PLANNING) return 'test-plan'; return 'audit-report'; };
  const handleSaveArtifact = (id: string, content: string) => { dispatch({ type: 'UPDATE_ARTIFACT', payload: { id, content } }); addLog(`Artifact manually updated via IDE`, AgentRole.IMPLEMENTATION_AGENT, 'info'); };
  const handleArtifactUpload = (file: File, content: string | ArrayBuffer) => { let type: Artifact['type'] = 'code'; const ext = (file.name.split('.').pop() || "").toLowerCase(); if (file.type.startsWith('image/')) type = 'image'; else if (file.type.startsWith('audio/')) type = 'audio'; else if (ext === 'md' || ext === 'txt') type = 'requirement'; else if (ext === 'json') type = 'design'; else if (ext === 'html') type = 'build'; const newArtifact: Artifact = { id: Math.random().toString(36).substring(7), title: file.name, content: content as string, type: type, phase: stateRef.current.currentPhase, createdBy: AgentRole.IMPLEMENTATION_AGENT, timestamp: Date.now(), tags: ['uploaded', stateRef.current.currentPhase] }; dispatch({ type: 'ADD_ARTIFACT', payload: newArtifact }); addLog(`File uploaded: ${file.name}`, AgentRole.ORCHESTRATOR, 'info'); };
  const handleOpenChat = (agent: Agent) => { setActiveChatAgent(agent); };
  const handleSendMessage = async (text: string) => { if (!activeChatAgent) return; const newMessage: ChatMessage = { id: Math.random().toString(36), sender: 'user', text: text, timestamp: Date.now() }; setChatHistory(prev => ({ ...prev, [activeChatAgent.id]: [...(prev[activeChatAgent.id] || []), newMessage] })); setIsChatThinking(true); const responseText = await interrogateAgent(activeChatAgent, text, chatHistory[activeChatAgent.id] || [], stateRef.current.description, stateRef.current.artifacts, stateRef.current.useInternet); const responseMessage: ChatMessage = { id: Math.random().toString(36), sender: 'agent', text: responseText, timestamp: Date.now() }; setChatHistory(prev => ({ ...prev, [activeChatAgent.id]: [...(prev[activeChatAgent.id] || []), responseMessage] })); setIsChatThinking(false); };
  const handleGlobalChatSend = async (e?: React.FormEvent) => { e?.preventDefault(); if (!globalChatInput.trim() || isChatThinking) return; const text = globalChatInput; setGlobalChatInput(""); const newMessage: ChatMessage = { id: Math.random().toString(36), sender: 'user', text: text, timestamp: Date.now(), isLogEvent: false }; setGlobalMessages(prev => [...prev, newMessage]); setIsChatThinking(true); const orchestrator = stateRef.current.agents.find(a => a.role === AgentRole.ORCHESTRATOR) || AGENTS[0]; try { const response = await chatWithOrchestrator(text, globalMessages, stateRef.current); setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'agent', text: response.text, timestamp: Date.now(), agentId: orchestrator.id, isLogEvent: false }]); if (response.action) { const { type, payload } = response.action; if (type === 'CREATE_TASK' && payload.title) { const newTask: Task = { id: Math.random().toString(36).substring(7), title: payload.title, description: payload.description || "Created via chat command", assignedTo: payload.assignedTo || AgentRole.IMPLEMENTATION_AGENT, phase: stateRef.current.currentPhase, status: TaskStatus.PENDING, dependencies: [], logs: [], progress: 0, traceRefs: ["CHAT_CMD"], sprint: stateRef.current.currentSprint, evaluation: { score: 0, reasoning: 'Quality score will be calculated when task is executed.', criteria: [], timestamp: Date.now() } }; dispatch({ type: 'ADD_TASK', payload: newTask }); } else if (type === 'CHANGE_PHASE' && payload) { const targetPhase = Object.values(Phase).find(p => p.toLowerCase() === payload.toLowerCase()); if (targetPhase) dispatch({ type: 'SET_PHASE', payload: targetPhase as Phase }); } else if (type === 'RUN_BATCH') handleRunAllTasks(); } } catch (err: any) { setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'system', text: `Communication Error: ${err.message || "Unable to reach Orchestrator."}`, timestamp: Date.now(), isLogEvent: false }]); } finally { setIsChatThinking(false); } };
  const handleGlobalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; if (file.name.endsWith('.zip')) { setIsProcessingFile(true); try { const zip = await JSZip.loadAsync(file); let combinedContext = `\n\n[USER UPLOADED ARCHIVE: ${file.name}]\n`; zip.forEach(async (relativePath: string, zipEntry: any) => { if (!zipEntry.dir && !relativePath.match(/\.(png|jpg|pdf|exe|dll|bin)$/i)) { const text = await zipEntry.async('string'); combinedContext += `\n--- FILE: ${relativePath} ---\n\`\`\`\n${text.substring(0, 8000)}\n\`\`\`\n`; } }); setTimeout(() => { setGlobalChatInput(prev => prev + combinedContext); setIsProcessingFile(false); }, 1000); } catch (err) { console.error("Zip read error", err); setIsProcessingFile(false); } return; } const reader = new FileReader(); reader.onload = (ev) => { const result = ev.target?.result as string; setGlobalChatInput(prev => prev + `\n\n[USER UPLOADED FILE: ${file.name}]\n\`\`\`\n${result.substring(0, 5000)}...(truncated)\n\`\`\`\n`); }; reader.readAsText(file); if (globalFileInputRef.current) globalFileInputRef.current.value = ''; };

  const TabButton = ({ id, label, icon: Icon, active, onClick, count, className = '' }: { id: string, label: string, icon: any, active: boolean, onClick: () => void, count?: number, className?: string }) => (
    <button onClick={onClick} className={`relative px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1 shrink-0 ${active ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'} ${className}`}>
      <Icon size={12} /> <span className="whitespace-nowrap">{label}</span> {count !== undefined && count > 0 && <span className={`ml-1 px-1 py-0.5 rounded-full text-[8px] font-mono ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
    </button>
  );

  const hasFrontend = useMemo(() => {
    if (!projectPreview?.techStack) return true; // Default to true if unsure
    return projectPreview.techStack.some(t => /react|vue|angular|svelte|html|css|web|ui|frontend|mobile|app/i.test(t));
  }, [projectPreview]);

  // Memoize preview artifacts to prevent unnecessary re-renders
  // Use a stable reference to prevent the artifact from being recreated unnecessarily
  // Store the last valid artifact to prevent it from disappearing
  const architectureDiagramContent = projectPreview?.architectureDiagram;
  const lastValidArtifactRef = useRef<{
    id: string;
    title: string;
    type: 'design';
    content: string;
    phase: Phase;
    createdBy: typeof AgentRole[keyof typeof AgentRole];
    timestamp: number;
    tags: string[];
  } | null>(null);

  const architectureArtifact = useMemo(() => {
    if (!architectureDiagramContent) {
      // If we have a previous valid artifact, keep it to prevent disappearing
      if (lastValidArtifactRef.current) {
        // Debug: Flow tab (reduced console noise)
        // if ((import.meta as any).env?.DEV) {
        //   console.log('[Flow Tab] No architectureDiagram in preview, using cached artifact');
        // }
        return lastValidArtifactRef.current;
      }
      // Silently handle missing architecture diagram - not an error
      // Debug: Flow tab (reduced console noise)
      // if ((import.meta as any).env?.DEV) {
      //   console.debug('[Flow Tab] No architectureDiagram in preview');
      // }
      return null;
    }
    const cleaned = cleanMermaidCode(architectureDiagramContent);
    // Check if cleaned diagram is empty or just whitespace
    if (!cleaned || cleaned.trim().length === 0) {
      // If we have a previous valid artifact, keep it
      if (lastValidArtifactRef.current) {
        // Debug: Flow tab (reduced console noise)
        // if ((import.meta as any).env?.DEV) {
        //   console.log('[Flow Tab] Architecture diagram is empty after cleaning, using cached artifact');
        // }
        return lastValidArtifactRef.current;
      }
      // Debug: Flow tab (reduced console noise)
      // if ((import.meta as any).env?.DEV) {
      //   console.log('[Flow Tab] Architecture diagram is empty after cleaning:', {
      //     original: architectureDiagramContent?.substring(0, 100),
      //     cleaned: cleaned
      //   });
      // }
      return null;
    }
    // Debug: Flow tab (reduced console noise)
    // if ((import.meta as any).env?.DEV) {
    //   console.log('[Flow Tab] Architecture diagram is valid, length:', cleaned.length);
    // }
    // Create new artifact and cache it
    const newArtifact = {
      id: 'preview-arch',
      title: 'Architecture.mermaid',
      type: 'design' as const,
      content: cleaned,
      phase: Phase.INITIATION,
      createdBy: AgentRole.DESIGN_ARCH_AGENT,
      timestamp: Date.now(),
      tags: ['preview']
    };
    lastValidArtifactRef.current = newArtifact;
    return newArtifact;
  }, [architectureDiagramContent]); // Only depend on the diagram content, not the entire preview object

  const wireframeArtifact = useMemo(() => {
    if (!projectPreview?.wireframeCode) return null;
    return {
      id: 'preview-wireframe',
      title: 'Prototype.html',
      type: 'build' as const,
      content: projectPreview.wireframeCode,
      phase: Phase.INITIATION,
      createdBy: AgentRole.UX_DESIGNER,
      timestamp: Date.now(),
      tags: ['preview']
    };
  }, [projectPreview?.wireframeCode]);

  // Demo mode check for non-authenticated users
  const isDemoMode = !user && !isViewOnly && viewMode === 'workspace';

  return (
    <div className={`flex flex-col font-sans selection:bg-primary selection:text-white relative ${isModernView && viewMode === 'workspace' ? 'bg-slate-900 text-slate-50' : 'bg-slate-50 text-slate-900'} ${viewMode === 'landing' ? '' : 'h-screen overflow-hidden'}`}>

      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[300] bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300 shadow-lg">
          <WifiOff size={20} />
          <p className="text-sm font-bold">
            Platform cannot be used offline. Please connect to the internet.
          </p>
        </div>
      )}

      {/* App Router - Handles all view routing */}
      <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
          <AppRouter
            isModernView={isModernView}
            viewMode={viewMode}
            // Landing view props
            onLaunch={handleLaunchApp}
            onLaunchDemo={handleLaunchDemo}
            onSignup={handleSignup}
            // Core state
            state={state}
            dispatch={dispatch}
            // User & Auth
            user={user}
            isViewOnly={isViewOnly}
            dismissedGuestBanner={dismissedGuestBanner}
            setDismissedGuestBanner={setDismissedGuestBanner}
            isRestoring={isRestoring}
            showWorkspaceTutorial={showWorkspaceTutorial}
            // Hub view props
            projectList={projectList}
            sampleProjects={sampleProjects}
            loadingSamples={loadingSamples}
            projectToDelete={projectToDelete}
            canViewSamples={canViewSamples}
            canCreateProjects={canCreateProjects}
            canDeleteProjects={canDeleteProjects}
            canViewAllProjects={canViewAllProjects}
            canUseTemplates={canUseTemplates}
            canImportProjects={canImportProjects}
            handleAdminClick={handleAdminClick}
            handleProfileClick={handleProfileClick}
            handleUserLogout={handleUserLogout}
            handleToggleSampleProject={handleToggleSampleProject}
            handleCreateNewProject={handleCreateNewProject}
            handleLoadProject={handleLoadProject}
            handleLoadDemoProject={handleLoadDemoProject}
            handleDeleteProject={handleDeleteProject}
            setShowUserSignup={setShowUserSignup}
            setShowUserLogin={setShowUserLogin}
            setShowTemplateSelector={setShowTemplateSelector}
            setShowProjectImport={setShowProjectImport}
            isFeatureEnabled={isFeatureEnabled}
            isButtonDisabled={isButtonDisabled}
            shouldShowFeature={shouldShowFeature}
            // Setup view props
            setupMessages={setupMessages}
            setSetupMessages={setSetupMessages}
            setupInput={setupInput}
            setSetupInput={setSetupInput}
            setupFiles={setupFiles}
            setSetupFiles={setSetupFiles}
            setupProjectName={setupProjectName}
            setSetupProjectName={setSetupProjectName}
            hasManuallyEditedProjectName={hasManuallyEditedProjectName}
            setHasManuallyEditedProjectName={setHasManuallyEditedProjectName}
            setupStage={setupStage}
            setSetupStage={setSetupStage}
            projectPreview={projectPreview}
            setProjectPreview={setProjectPreview}
            previewTab={previewTab}
            setPreviewTab={setPreviewTab}
            tempSelectedStandards={tempSelectedStandards}
            setTempSelectedStandards={setTempSelectedStandards}
            showStandards={showStandards}
            setShowStandards={setShowStandards}
            isDraggingSetup={isDraggingSetup}
            setIsDraggingSetup={setIsDraggingSetup}
            isResearching={isResearching}
            setIsResearching={setIsResearching}
            isEnhancingInput={isEnhancingInput}
            setIsEnhancingInput={setIsEnhancingInput}
            isGeneratingSuggestions={isGeneratingSuggestions}
            setIsGeneratingSuggestions={setIsGeneratingSuggestions}
            displayedSuggestions={displayedSuggestions}
            setDisplayedSuggestions={setDisplayedSuggestions}
            selectedTheme={selectedTheme}
            setSelectedTheme={setSelectedTheme}
            availableThemes={availableThemes}
            setAvailableThemes={setAvailableThemes}
            themeInput={themeInput}
            setThemeInput={setThemeInput}
            isGeneratingTheme={isGeneratingTheme}
            setIsGeneratingTheme={setIsGeneratingTheme}
            setupInputRef={setupInputRef}
            setupEndRef={setupEndRef}
            // Workspace view props
            isRenaming={isRenaming}
            tempName={tempName}
            activeTab={activeTab}
            leftTab={leftTab}
            leftWidth={leftWidth}
            logHeight={logHeight}
            isResizingLeft={isResizingLeft}
            isResizingLogs={isResizingLogs}
            isLogsCollapsed={isLogsCollapsed}
            globalMessages={globalMessages}
            globalChatInput={globalChatInput}
            isChatThinking={isChatThinking}
            isProcessingFile={isProcessingFile}
            isEnhancingChat={isEnhancingChat}
            isResearchingChat={isResearchingChat}
            autoPilotStatus={autoPilotStatus}
            apiHealth={apiHealth}
            appSettings={appSettings}
            showExportDataMenu={showExportDataMenu}
            showShareProject={showShareProject}
            showReportExport={showReportExport}
            showTerminal={showTerminal}
            showSettings={showSettings}
            showThemeStudio={showThemeStudio}
            showUserSignup={showUserSignup}
            showUserLogin={showUserLogin}
            showMobileDeploymentWizard={showMobileDeploymentWizard}
            editingTask={editingTask}
            selectedAgentDetail={selectedAgentDetail}
            globalChatEndRef={globalChatEndRef}
            globalFileInputRef={globalFileInputRef}
            globalChatInputRef={globalChatInputRef}
            isProgrammaticHashChangeRef={isProgrammaticHashChangeRef}
            // State setters
            setIsRenaming={setIsRenaming}
            setTempName={setTempName}
            setActiveTab={setActiveTab}
            setLeftTab={setLeftTab}
            setIsResizingLeft={setIsResizingLeft}
            setIsResizingLogs={setIsResizingLogs}
            setIsLogsCollapsed={setIsLogsCollapsed}
            setGlobalMessages={setGlobalMessages}
            setGlobalChatInput={setGlobalChatInput}
            setIsChatThinking={setIsChatThinking}
            setIsProcessingFile={setIsProcessingFile}
            setIsEnhancingChat={setIsEnhancingChat}
            setIsResearchingChat={setIsResearchingChat}
            setShowExportDataMenu={setShowExportDataMenu}
            setShowShareProject={setShowShareProject}
            setShowReportExport={setShowReportExport}
            setShowTerminal={setShowTerminal}
            setShowSettings={setShowSettings}
            setShowThemeStudio={setShowThemeStudio}
            setShowWorkspaceTutorial={setShowWorkspaceTutorial}
            setShowMobileDeploymentWizard={setShowMobileDeploymentWizard}
            setEditingTask={setEditingTask}
            setSelectedAgentDetail={setSelectedAgentDetail}
            setViewMode={setViewMode}
            // Handlers
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            handleRenameProject={handleRenameProject}
            handleAutoPilotClick={handleAutoPilotClick}
            stopExecution={stopExecution}
            handleOpenChat={handleOpenChat}
            handleGlobalChatSend={handleGlobalChatSend}
            handleGlobalFileSelect={handleGlobalFileSelect}
            handleDeepResearch={handleDeepResearch}
            handleEnhanceInput={handleEnhanceInput}
            handleExportProjectData={handleExportProjectData}
            regressPhase={regressPhase}
            advancePhase={advancePhase}
            startNextSprint={startNextSprint}
            orchestratePhase={orchestratePhase}
            executeTask={executeTask}
            handleRunAllTasks={handleRunAllTasks}
            handleDeleteTask={handleDeleteTask}
            handleApproveTask={handleApproveTask}
            handleRejectTask={handleRejectTask}
            handleSaveArtifact={handleSaveArtifact}
            handleArtifactUpload={handleArtifactUpload}
            handleForceBuild={handleForceBuild}
            handleAddStandard={handleAddStandard}
            handleRemoveStandard={handleRemoveStandard}
            handleRunAudit={handleRunAudit}
            handleToggleLogsCollapse={handleToggleLogsCollapse}
            addLog={addLog}
            handleSetupSend={handleSetupSend}
            handleManualLaunch={handleManualLaunch}
            handleLaunchFromBrainstorming={handleLaunchFromBrainstorming}
            handleSuggestionClick={handleSuggestionClick}
            toggleStandard={toggleStandard}
            handleRandomTheme={handleRandomTheme}
            handleAiThemeGen={handleAiThemeGen}
            removeSetupFile={removeSetupFile}
            handleSetupDragOver={handleSetupDragOver}
            handleSetupDragLeave={handleSetupDragLeave}
            handleSetupDrop={handleSetupDrop}
            canProceedToPreview={canProceedToPreview}
            handleJumpToPreview={handleJumpToPreview}
            // Feature flags
            canSwitchEnvironment={canSwitchEnvironment}
            canShareProjects={canShareProjects}
            canExportReports={canExportReports}
            canExportData={canExportData}
            canAccessTerminal={canAccessTerminal}
            canUseAICodeGeneration={canUseAICodeGeneration}
            canUseAITaskAutomation={canUseAITaskAutomation}
            canUseAIChat={canUseAIChat}
            canUseCodeEditor={canUseCodeEditor}
            canUseArtifactViewer={canUseArtifactViewer}
            canDeleteAgents={canDeleteAgents}
            canCustomizeAgents={canCustomizeAgents}
            // Demo mode
            isDemoMode={isDemoMode}
            // Admin props
            adminToken={adminToken}
            adminUser={adminUser}
            isAdminUser={isAdminUser}
            handleAdminLoginSuccess={handleAdminLoginSuccess}
            handleAdminLogout={handleAdminLogout}
          />
        </Suspense>
      </ErrorBoundary>

      {/* User Login Modal */}
      {showUserLogin && (
        <UserLogin
          onLoginSuccess={handleUserLoginSuccess}
          onSwitchToSignup={() => {
            setShowUserLogin(false);
            setShowUserSignup(true);
          }}
          onClose={() => setShowUserLogin(false)}
        />
      )}

      {/* User Signup Modal */}
      {showUserSignup && (
        <UserSignup
          onSignupSuccess={handleUserSignupSuccess}
          onSwitchToLogin={() => {
            setShowUserSignup(false);
            setShowUserLogin(true);
          }}
          onClose={() => setShowUserSignup(false)}
        />
      )}

      {/* Package Selection Modal */}
      {showPackageSelection && pendingUser && (
        <PackageSelection
          onSelectPackage={handlePackageSelect}
          onClose={() => {
            setShowPackageSelection(false);
            setPendingUser(null);
            setSelectedPackage(null);
          }}
          userEmail={pendingUser.email}
          preselectedPackage={selectedPackage}
        />
      )}

      {/* Payment Modal */}
      {showPayment && selectedPackage && pendingUser && (
        <Payment
          selectedPackage={selectedPackage}
          userEmail={pendingUser.email}
          userName={pendingUser.name}
          onPaymentSuccess={handlePaymentSuccess}
          onBack={() => {
            setShowPayment(false);
            setShowPackageSelection(true);
          }}
          onClose={() => {
            setShowPayment(false);
            setPendingUser(null);
            setSelectedPackage(null);
          }}
        />
      )}

      {/* Share Project Modal */}
      <Suspense fallback={null}>
        {showShareProject && viewMode === 'workspace' && (
          <ShareProject
            projectId={state.id}
            projectName={state.name}
            onClose={() => setShowShareProject(false)}
            userToken={user?.token || undefined}
          />
        )}
        {showProjectImport && (
          <ProjectImport
            onImportSuccess={async (projectId) => {
              // Reload project list
              try {
                const metas = await projectStorage.getMetadataList();
                setProjectList(metas);
                // Load the imported project
                await handleLoadProject(projectId);
              } catch (e) {
                console.error('Failed to reload projects after import:', e);
              }
            }}
            onClose={() => setShowProjectImport(false)}
            userRole={userRole}
          />
        )}
        {showReportExport && (
          <ProjectReportExport
            projectId={state.id}
            projectName={state.name}
            onClose={() => setShowReportExport(false)}
            userRole={userRole}
          />
        )}
        {showTerminal && (
          <Terminal
            projectId={state.id}
            onClose={() => setShowTerminal(false)}
            userRole={userRole}
          />
        )}
      </Suspense>
      {showExportDataMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowExportDataMenu(false)}></div>
      )}

      {/* --- Global Modals (Only render if NOT in landing mode) --- */}
      {viewMode !== 'landing' && (
        <>
          {showSubscription && (
            <SubscriptionOverlay
              onLogin={handleLogin}
              onClose={() => setShowSubscription(false)}
              initialMode={subscriptionMode}
              currentPlan={user?.plan}
            />
          )}

          {/* Theme Studio Modal for Workspace - z-index above fullscreen preview */}
          {showThemeStudio && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 p-4" onClick={() => setShowThemeStudio(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Palette size={20} className="text-purple-500" /> Theme Studio
                  </h2>
                  <button onClick={() => setShowThemeStudio(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                  <div className="space-y-6">
                    {/* AI Generator */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">AI Theme Generator</label>
                      <p className="text-xs text-slate-500 mb-3">Describe any theme concept - seasonal, aesthetic, era-based, or creative!</p>
                      <form onSubmit={handleAiThemeGen} className="flex gap-2">
                        <input
                          type="text"
                          value={themeInput}
                          onChange={(e) => setThemeInput(e.target.value)}
                          placeholder="Describe any theme: Halloween, Cyberpunk, 1950s Diner, Ocean, Minimalist..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                          disabled={isGeneratingTheme}
                        />
                        <button
                          type="submit"
                          disabled={!themeInput.trim() || isGeneratingTheme}
                          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                        >
                          {isGeneratingTheme ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                          Generate
                        </button>
                      </form>
                    </div>

                    {/* Presets */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Available Themes</label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                        {availableThemes.map(theme => (
                          <button
                            key={theme.id}
                            onClick={() => {
                              setSelectedTheme(theme.id);
                              dispatch({ type: 'SET_THEME', payload: theme.id });
                            }}
                            className={`aspect-square rounded-xl border-2 transition-all relative group overflow-hidden ${(state.selectedTheme || selectedTheme) === theme.id ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-md border-primary' : 'hover:scale-105 opacity-80 hover:opacity-100 hover:shadow-sm border-slate-200'}`}
                            style={{ backgroundColor: theme.primary }}
                            title={theme.label}
                          >
                            {(state.selectedTheme || selectedTheme) === theme.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 py-0.5 truncate">
                              {theme.label}
                            </div>
                          </button>
                        ))}
                        <button
                          onClick={handleRandomTheme}
                          disabled={isGeneratingTheme}
                          className="aspect-square rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative group"
                          title={isGeneratingTheme ? "Generating..." : "Generate Random Theme"}
                        >
                          {isGeneratingTheme ? (
                            <Loader2 size={20} className="animate-spin text-primary" />
                          ) : (
                            <Dices size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-xs leading-relaxed">
                      <strong>Pro Tip:</strong> Themes are applied instantly to your preview. Changes are saved automatically with your project.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showUserProfile && user && (
            <UserProfileModal
              user={user}
              onClose={() => setShowUserProfile(false)}
              onUpgrade={() => {
                // Open subscription overlay first, then close profile modal
                setSubscriptionMode('pricing');
                setShowSubscription(true);
                // Close profile modal after a brief delay to allow overlay to render
                setTimeout(() => {
                  setShowUserProfile(false);
                }, 150);
              }}
              onLogout={() => {
                setShowUserProfile(false);
                handleUserLogout();
              }}
              isModernView={isModernView}
              onToggleModernView={toggleModernView}
            />
          )}

          {/* ... Rest of the Workspace rendering logic ... */}
          {editingTask && <TaskEditModal task={editingTask} onClose={() => setEditingTask(null)} onSave={handleUpdateTask} onAiModify={handleAiModifyTask} />}
          <HITLPromptModal
            isOpen={showHITLPrompt}
            onConfirm={(enableHITL) => {
              setHITLPreference(enableHITL);
              setShowHITLPrompt(false);
              if (pendingActionRef.current) {
                pendingActionRef.current();
                pendingActionRef.current = null;
              }
            }}
            onClose={() => {
              setShowHITLPrompt(false);
              pendingActionRef.current = null;
            }}
          />

          <Suspense fallback={null}>
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={appSettings} onUpdateSettings={setAppSettings} onResetProject={handleResetProject} apiHealth={apiHealth} projectId={state.id} userRole={userRole} />
            <AgentDetailModal agent={selectedAgentDetail} onClose={() => setSelectedAgentDetail(null)} onEdit={(agent) => { setSelectedAgentDetail(null); setEditingAgent(agent); }} canEdit={isFeatureEnabled(canCustomizeAgents)} />
            {(editingAgent || isCreatingNewAgent) && (
              <AgentEditorModal
                agent={editingAgent}
                isNew={isCreatingNewAgent}
                onClose={() => { setEditingAgent(null); setIsCreatingNewAgent(false); }}
                onSave={(agent) => {
                  if (isCreatingNewAgent) {
                    dispatch({ type: 'ADD_AGENT', payload: agent });
                    addLog(`New agent created: ${agent.name}`, AgentRole.ORCHESTRATOR, 'info');
                  } else {
                    dispatch({ type: 'UPDATE_AGENT', payload: { id: agent.id, agent } });
                    addLog(`Agent updated: ${agent.name}`, AgentRole.ORCHESTRATOR, 'info');
                  }
                  setEditingAgent(null);
                  setIsCreatingNewAgent(false);
                }}
              />
            )}
          </Suspense>
          <Suspense fallback={null}>
            <ProjectTemplateSelector
              isOpen={showTemplateSelector}
              onClose={() => setShowTemplateSelector(false)}
              onSelectTemplate={handleSelectTemplate}
              onSaveAsTemplate={handleSaveAsTemplate}
              currentProject={viewMode === 'workspace' ? state : undefined}
            />
          </Suspense>
          {currentError && (
            <div className="fixed top-4 right-4 z-[100] max-w-md animate-in slide-in-from-top-5 duration-300">
              <ErrorDisplay
                error={currentError}
                onDismiss={() => setCurrentError(null)}
              />
            </div>
          )}
          {state.isProcessing && processingLabel && (
            <ProcessingOverlay
              label={processingLabel}
              progress={processingProgress}
              statusText={processingStatusText}
              estimatedTime={processingEstimatedTime}
              taskCount={processingTaskCount}
            />
          )}
          {projectToDelete && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setProjectToDelete(null)}><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4 border border-slate-200" onClick={e => e.stopPropagation()}><div className="flex flex-col items-center text-center"><div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600"><Trash2 size={24} /></div><h3 className="text-lg font-bold text-slate-800 mb-2">Delete Project?</h3><div className="flex gap-3 w-full"><button onClick={() => setProjectToDelete(null)} className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg">Cancel</button><button onClick={() => projectToDelete && deleteProject(projectToDelete)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button></div></div></div></div>}
          <ConfirmationModal
            isOpen={confirmationModal.isOpen}
            type={confirmationModal.type}
            title={confirmationModal.title}
            message={confirmationModal.message}
            confirmText={confirmationModal.confirmText}
            cancelText={confirmationModal.cancelText}
            onConfirm={confirmationModal.onConfirm}
            onCancel={confirmationModal.onCancel}
            onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
          />
          {taskToDelete && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTaskToDelete(null)}><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4 border border-slate-200" onClick={e => e.stopPropagation()}><div className="flex flex-col items-center text-center"><h3 className="text-lg font-bold text-slate-800 mb-2">Delete Task?</h3><div className="flex gap-3 w-full"><button onClick={() => setTaskToDelete(null)} className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg">Cancel</button><button onClick={confirmDeleteTask} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button></div></div></div></div>}
          {activeChatAgent && <AgentChat agent={activeChatAgent} messages={chatHistory[activeChatAgent.id] || []} onSendMessage={handleSendMessage} onClose={() => setActiveChatAgent(null)} isThinking={isChatThinking} />}
        </>
      )}

      {/* Skip Link for Accessibility */}
      <SkipLink />

      {/* All views are now handled by AppRouter above */}


      {/* User Support Widget - Show for logged in users */}
      {user && viewMode !== 'admin' && (
        <UserSupportWidget
          userId={user.id}
          userName={user.name}
          userEmail={user.email}
          userPlan={user.plan || "Free"}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => toastService.dismiss(id)}
      />
    </div>
  );
};

export default App;
