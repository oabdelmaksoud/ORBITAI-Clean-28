// Server Entry Point - Updated for DB Fix
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { rateLimiter, adminRateLimiter, featureFlagsCheckRateLimiter } from './middleware/rateLimiter.js';
import { performanceMonitor } from './middleware/performanceMonitor.js';
import { swaggerSpec } from './config/swagger.js';
import { apiVersioning } from './middleware/apiVersioning.js';
import { redisService } from './services/redis.service.js';
import { queueService } from './services/queue.service.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requestTimeout } from './middleware/timeout.js';
import { webSocketService } from './services/websocket.service.js';
import { forceJsonResponse } from './middleware/forceJsonResponse.js';
import { offlineModeMiddleware } from './middleware/offlineMode.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
import agentRoutes from './routes/agent.routes.js';
import taskRoutes from './routes/task.routes.js';
import artifactRoutes from './routes/artifact.routes.js';
import healthRoutes from './routes/health.routes.js';
import configRoutes from './routes/config.routes.js';
import testRoutes from './routes/test.routes.js';
import llmRoutes from './routes/llm.routes.js';
import adminRoutes from './routes/admin.routes.js';
import adminAuthRoutes from './routes/adminAuth.routes.js';
import packagesRoutes from './routes/packages.routes.js';
import publicPackagesRoutes from './routes/publicPackages.routes.js';
import llmManagementRoutes from './routes/llmManagement.routes.js';
import llmUsageRoutes, { userRouter as llmUsageUserRoutes } from './routes/llmUsage.routes.js';
import featureFlagsRoutes from './routes/featureFlags.routes.js';
import llmAnalyticsRoutes from './routes/llmAnalytics.routes.js';
import financialLiveRoutes from './routes/financialLive.routes.js';
import pageContentRoutes from './routes/pageContent.routes.js';
import publicPageContentRoutes from './routes/publicPageContent.routes.js';
import pageBuilderRoutes from './routes/pageBuilder.routes.js';
import agentKnowledgeRoutes from './routes/agentKnowledge.routes.js';
import agentKnowledgeLearningRoutes from './routes/agentKnowledgeLearning.routes.js';
import processImprovementRoutes from './routes/processImprovement.routes.js';
import neo4jRoutes from './routes/neo4j.routes.js';
import processMiningRoutes from './routes/processMining.routes.js';
import nlpRoutes from './routes/nlp.routes.js';
import processAnalyticsRoutes from './routes/processAnalytics.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import collaborativeWikiRoutes from './routes/collaborativeWiki.routes.js';
import aiOptimizationRoutes from './routes/aiOptimization.routes.js';
import processSimulationRoutes from './routes/processSimulation.routes.js';
import complianceAuditRoutes from './routes/complianceAudit.routes.js';
import communitySharingRoutes from './routes/communitySharing.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import securityRoutes from './routes/security.routes.js';
import backupRoutes from './routes/backup.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import activityRoutes from './routes/activity.routes.js';
import mcpRoutes from './routes/mcp.routes.js';
import mcpServerRoutes from './routes/mcpServer.routes.js';
import backgroundTasksRoutes from './routes/backgroundTasks.routes.js';
import backgroundAutoPilotRoutes from './routes/backgroundAutoPilot.routes.js';
import { config } from './config/env.js';
import adminSystemDetailsRoutes from './routes/adminSystemDetails.routes.js';
import userSettingsRoutes from './routes/userSettings.routes.js';
import userAnalyticsRoutes from './routes/userAnalytics.routes.js';
import financialAdvancedRoutes from './routes/financialAdvanced.routes.js';
import performanceRoutes from './routes/performance.routes.js';
import reportBuilderRoutes from './routes/reportBuilder.routes.js';
import codebaseRoutes from './routes/codebase.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import llamaindexRoutes from './routes/llamaindex.routes.js';
import knowledgeGraphRoutes from './routes/knowledgeGraph.routes.js';
import langchainRoutes from './routes/langchain.routes.js';
import crewaiRoutes from './routes/crewai.routes.js';
import langgraphRoutes from './routes/langgraph.routes.js';
import autogenRoutes from './routes/autogen.routes.js';
import standardsRoutes from './routes/standards.routes.js';
import standardsResearchRoutes from './routes/standardsResearch.routes.js';
import sdlcRoutes from './routes/sdlc.routes.js';
import integrationsRoutes from './routes/integrations.routes.js';
import slackRoutes from './routes/slack.routes.js';
import googleDriveRoutes from './routes/googleDrive.routes.js';
import githubRoutes from './routes/github.routes.js';
import collaborationRoutes from './routes/collaboration.routes.js';
import fileUploadRoutes from './routes/fileUpload.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import terminalRoutes from './routes/terminal.routes.js';
import chatRoutes from './routes/chat.routes.js';
import projectFolderRoutes from './routes/projectFolder.routes.js';
import brainstormingRoomRoutes from './routes/brainstormingRoom.routes.js';
import aiSuggestionsRoutes from './routes/aiSuggestions.routes.js';
import ideationMapRoutes from './routes/ideationMap.routes.js';
import syncRoutes from './routes/sync.routes.js';
import notebookRoutes from './routes/notebook.routes.js';
import deploymentsRoutes from './routes/deployments.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import hostingRoutes from './routes/hosting.routes.js';
import requirementsRoutes from './routes/requirements.routes.js';
import issueTaskCreationRoutes from './routes/issueTaskCreation.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import technicalDebtRoutes from './routes/technicalDebt.routes.js';
import adminDatabaseRoutes from './routes/adminDatabase.routes.js';
import adminSystemControlRoutes from './routes/adminSystemControl.routes.js';
import adminMonitoringRoutes from './routes/adminMonitoring.routes.js';
import adminModerationRoutes from './routes/adminModeration.routes.js';
import adminIntegrationsRoutes from './routes/adminIntegrations.routes.js';
import adminRateLimitingRoutes from './routes/adminRateLimiting.routes.js';
import adminSystemCostsRoutes from './routes/adminSystemCosts.routes.js';
import adminLLMRouterRoutes from './routes/adminLLMRouter.routes.js';
import adminLLMRouterAIRoutes from './routes/adminLLMRouterAI.routes.js';
import routerABTestRoutes from './routes/routerABTest.routes.js';
import modelBenchmarkRoutes from './routes/modelBenchmark.routes.js';
import quotaRoutes from './routes/quota.routes.js';
import adminInternalRouterRoutes from './routes/adminInternalRouter.routes.js';
import modelSyncRoutes from './routes/modelSync.routes.js';
import internalRoutingRoutes from './routes/internalRouting.routes.js';
import anomalyDetectionRoutes from './routes/anomalyDetection.routes.js';
import autoConfigurationRoutes from './routes/autoConfiguration.routes.js';
import supportTicketsRoutes from './routes/supportTickets.routes.js';
import supportChatRoutes from './routes/supportChat.routes.js';
import imageGenerationRoutes from './routes/imageGeneration.routes.js';
import gameAssetsRoutes from './routes/gameAssets.routes.js';
import gameMechanicsRoutes from './routes/gameMechanics.routes.js';

import dynamicToolingRoutes from './routes/dynamicTooling.routes.js';
import grapesPagesRoutes from './routes/grapesPages.routes.js';
import customAgentRoutes from './routes/customAgent.routes.js';
import { codeGeneratorRoutes } from './routes/codeGenerator.routes.js';
import { frontendCodeGeneratorRoutes } from './routes/frontendCodeGenerator.routes.js';
import { codeValidationRoutes } from './routes/codeValidation.routes.js';
import projectExportRoutes from './routes/projectExport.routes.js';
import { mobileDeploymentRoutes } from './routes/mobileDeployment.routes.js';
import speechRoutes from './routes/speech.routes.js';
import maturityAssessmentRoutes from './routes/maturityAssessment.routes.js';
import demoRoutes from './routes/demo.routes.js';
import cuaRoutes from './routes/cua.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';

import { multiCloudRoutes } from './routes/multiCloud.routes.js';
import { deploymentRoutes } from './routes/deploymentOrchestrator.routes.js';
import { maintenanceModeMiddleware } from './middleware/maintenanceMode.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Sentry error tracking (before other imports that might throw)
try {
  const { initSentry } = await import('./services/monitoring/sentry.js');
  initSentry();
} catch (error) {
  logger.warn('Sentry initialization failed (optional):', error);
}

const app = express();
const httpServer = createServer(app);
const PORT = config.port;

// Trust proxy to get correct IP addresses (important for rate limiting)
// In development, this helps detect localhost correctly
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(securityHeaders); // Additional security headers

// Security Headers for WebContainer Support (SharedArrayBuffer)
app.use((req, res, next) => {
  // Use credentialless to allow loading resources (images, scripts) without explicit CORP headers
  // This fixes Tailwind CDN and external image blocking
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// CORS Configuration - configurable per environment
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (origin) {
      logger.info(`[CORS DEBUG] Request Origin: ${origin}, Is Allowed: ${config.corsOrigins.includes(origin)}`);
    }

    if (config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, log warning but allow
      if (config.nodeEnv === 'development') {
        logger.warn(`CORS: Origin ${origin} not in allowed list, but allowing in development mode`);
        callback(null, true);
      } else {
        // In production, reject unauthorized origins
        logger.warn(`CORS: Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: config.corsCredentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'bypass-tunnel-reminder', 'ngrok-skip-browser-warning'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static project assets (from public/projects)
// This ensures assets generated by PrototypeAssetGenerator are accessible
// path: server/src/index.ts -> ../../public/projects
app.use('/projects', express.static(path.join(__dirname, '../../public/projects')));

// Serve CUA video recordings (from public/cua-recordings)
app.use('/cua-recordings', express.static(path.join(__dirname, '../../public/cua-recordings')));

// Offline Mode Middleware - specific for handling DB disconnects
app.use(offlineModeMiddleware);

// Request timeout middleware (360 seconds default for most routes, can be overridden per route)
// Note: generate-preview route has its own 360s timeout, so global timeout should be at least that
// Note: generate-preview route has its own timeout requirements, so global timeout should be generous
app.use(requestTimeout(1200000)); // 20 minutes to allow for long-running LLM chains

// Force JSON responses for all API routes (must be before routes)
app.use(forceJsonResponse);

// API Versioning middleware (must be before routes)
app.use(apiVersioning);

// Performance monitoring middleware (track all requests)
app.use(performanceMonitor);

// Swagger/OpenAPI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ORBITAI API Documentation',
}));

// Maintenance mode middleware (before routes)
app.use(maintenanceModeMiddleware);

// Health check (before rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes with higher rate limit (register before global limiter)
app.use('/api/admin-auth', adminRateLimiter, adminAuthRoutes);

// Audit routes
import auditRoutes from './routes/audit.routes.js';
app.use('/api/admin/audit', adminRateLimiter, auditRoutes);

// Feature flags routes - MUST be registered BEFORE general /api/admin routes
// so the public /check/:key endpoint works without auth
// Use lenient rate limiter for public check endpoint (allows many simultaneous checks on app load)
app.use('/api/admin/feature-flags', featureFlagsCheckRateLimiter, featureFlagsRoutes);

// Enhanced admin routes (export, bulk actions, financial, analytics)
import adminEnhancedRoutes from './routes/adminEnhanced.routes.js';
app.use('/api/admin', adminRateLimiter, adminEnhancedRoutes);
app.use('/api/admin/system', adminRateLimiter, adminSystemDetailsRoutes);

app.use('/api/admin/packages', adminRateLimiter, packagesRoutes);
app.use('/api/admin/llm', adminRateLimiter, llmManagementRoutes);
app.use('/api/admin/llm-usage', adminRateLimiter, llmUsageRoutes);
app.use('/api/admin/llm-analytics', adminRateLimiter, llmAnalyticsRoutes);
app.use('/api/admin/api-keys', apiKeysRoutes);
app.use('/api/admin/financial', adminRateLimiter, financialLiveRoutes);
app.use('/api/admin/page-content', adminRateLimiter, pageContentRoutes);
app.use('/api/admin/page-builder', adminRateLimiter, pageBuilderRoutes);
app.use('/api/admin/agent-knowledge', adminRateLimiter, agentKnowledgeRoutes);
app.use('/api/admin/agent-knowledge', adminRateLimiter, agentKnowledgeLearningRoutes);
app.use('/api/admin/process-improvements', adminRateLimiter, processImprovementRoutes);
app.use('/api/admin/neo4j', adminRateLimiter, neo4jRoutes);
app.use('/api/admin/process-mining', adminRateLimiter, processMiningRoutes);
app.use('/api/admin/nlp', adminRateLimiter, nlpRoutes);
app.use('/api/admin/process-analytics', adminRateLimiter, processAnalyticsRoutes);
app.use('/api/admin/workflows', adminRateLimiter, workflowRoutes);
app.use('/api/admin/collaborative-wiki', adminRateLimiter, collaborativeWikiRoutes);
app.use('/api/admin/ai-optimization', adminRateLimiter, aiOptimizationRoutes);
app.use('/api/admin/process-simulation', adminRateLimiter, processSimulationRoutes);
app.use('/api/admin/compliance', adminRateLimiter, complianceAuditRoutes);
app.use('/api/admin/community', adminRateLimiter, communitySharingRoutes);
app.use('/api/admin/notifications', adminRateLimiter, notificationsRoutes);
app.use('/api/admin/security', adminRateLimiter, securityRoutes);
app.use('/api/admin/backups', adminRateLimiter, backupRoutes);
app.use('/api/admin/alerts', adminRateLimiter, alertsRoutes);
app.use('/api/admin/activity', adminRateLimiter, activityRoutes);
app.use('/api/admin/analytics/users', adminRateLimiter, userAnalyticsRoutes);
app.use('/api/admin/financial', adminRateLimiter, financialAdvancedRoutes);
app.use('/api/admin/performance', adminRateLimiter, performanceRoutes);
app.use('/api/admin/reports', adminRateLimiter, reportBuilderRoutes);
app.use('/api/admin/database', adminRateLimiter, adminDatabaseRoutes);
app.use('/api/admin/system', adminRateLimiter, adminSystemControlRoutes);
app.use('/api/admin/monitoring', adminRateLimiter, adminMonitoringRoutes);
app.use('/api/admin/moderation', adminRateLimiter, adminModerationRoutes);
app.use('/api/admin/integrations', adminRateLimiter, adminIntegrationsRoutes);
app.use('/api/admin/rate-limits', adminRateLimiter, adminRateLimitingRoutes);
app.use('/api/admin/system-costs', adminRateLimiter, adminSystemCostsRoutes);
app.use('/api/admin/llm-router', adminRateLimiter, adminLLMRouterRoutes);
app.use('/api/admin/llm-router/ai', adminRateLimiter, adminLLMRouterAIRoutes);
app.use('/api/admin/llm-router', adminRateLimiter, routerABTestRoutes);
app.use('/api/admin/llm-router', adminRateLimiter, modelBenchmarkRoutes);
app.use('/api/admin/llm-router/quotas', adminRateLimiter, quotaRoutes);
app.use('/api/admin/internal-router', adminRateLimiter, adminInternalRouterRoutes);
app.use('/api/admin/models', adminRateLimiter, modelSyncRoutes);
app.use('/api/admin/internal-routing', adminRateLimiter, internalRoutingRoutes);
app.use('/api/pages', grapesPagesRoutes);
app.use('/api/support', supportTicketsRoutes);
app.use('/api/support', supportChatRoutes);
app.use('/api/admin', adminRateLimiter, adminRoutes);

// Public routes (no rate limit)
app.use('/api/packages/public', publicPackagesRoutes);
app.use('/api/page-content/public', publicPageContentRoutes);
app.use('/api/demo', demoRoutes); // Demo prototype for CUA testing (no auth)
app.use('/api/cua', cuaRoutes); // CUA (Computer Using Agent) testing API

// Apply global rate limiter to all other routes
app.use(rateLimiter);

// API v1 routes (with rate limiting)
// Support both /api/v1/* and /api/* for backward compatibility
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user/settings', userSettingsRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/artifacts', artifactRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/test', testRoutes);
app.use('/api/v1/llm', llmRoutes);
app.use('/api/v1/llm-usage', llmUsageUserRoutes);
app.use('/api/v1/anomalies', anomalyDetectionRoutes);
app.use('/api/v1/auto-config', autoConfigurationRoutes);
app.use('/api/v1/codebase', codebaseRoutes);
app.use('/api/v1/code-generation', codeGeneratorRoutes);
app.use('/api/v1/deployments', deploymentRoutes);

// Legacy routes (backward compatibility - redirect to v1)
app.use('/api/auth', authRoutes);
app.use('/api/user/settings', userSettingsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/artifacts', artifactRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/test', testRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/llm-usage', llmUsageUserRoutes);
app.use('/api/anomalies', anomalyDetectionRoutes);
app.use('/api/auto-config', autoConfigurationRoutes);
app.use('/api/codebase', codebaseRoutes);
app.use('/api/code-generation', codeGeneratorRoutes);
app.use('/api/frontend-generation', frontendCodeGeneratorRoutes);
app.use('/api/code-validation', codeValidationRoutes);
app.use('/api/project-export', projectExportRoutes);
app.use('/api/mobile-deployment', mobileDeploymentRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/mcp-servers', mcpServerRoutes);

// Sync Routes
app.use('/api/sync', syncRoutes);

app.use('/api/custom-agents', customAgentRoutes);
app.use('/api/background-tasks', backgroundTasksRoutes);
app.use('/api/background-autopilot', backgroundAutoPilotRoutes);
app.use('/api/llamaindex', llamaindexRoutes);
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
app.use('/api/langchain', langchainRoutes);
app.use('/api/crewai', crewaiRoutes);
app.use('/api/langgraph', langgraphRoutes);
app.use('/api/autogen', autogenRoutes);
app.use('/api/standards', standardsRoutes);
app.use('/api/standards-research', standardsResearchRoutes);
app.use('/api/sdlc', sdlcRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/project-folders', projectFolderRoutes);
app.use('/api/brainstorming-rooms', brainstormingRoomRoutes);
app.use('/api/v1/brainstorming-rooms', brainstormingRoomRoutes);
app.use('/api/ideation-map', ideationMapRoutes);
app.use('/api/v1/ideation-map', ideationMapRoutes);
import transcriptionRoutes from './routes/transcription.routes.js';
app.use('/api/transcriptions', transcriptionRoutes);
app.use('/api/v1/requirements', requirementsRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/technical-debt', technicalDebtRoutes);
app.use('/api/v1/issues', issueTaskCreationRoutes);
app.use('/api/issues', issueTaskCreationRoutes);
app.use('/api/ai', aiSuggestionsRoutes);
app.use('/api/notebook', notebookRoutes);

// AI Agent Assignment (Orchestrator reasoning for team composition)
import aiAgentAssignmentRoutes from './routes/aiAgentAssignment.routes.js';
app.use('/api/ai-agents', aiAgentAssignmentRoutes);

app.use('/api/deployments', deploymentsRoutes);
app.use('/api/payment', paymentRoutes);

// Multi-Cloud Orchestration API
app.use('/api/multi-cloud', multiCloudRoutes);
app.use('/api/hosting', hostingRoutes);
app.use('/api/images', imageGenerationRoutes);
app.use('/api/game-assets', gameAssetsRoutes);
app.use('/api/game-mechanics', gameMechanicsRoutes);

app.use('/api/tools', dynamicToolingRoutes);

// Third-party integrations
app.use('/api/integrations', integrationsRoutes);
app.use('/api/integrations/slack', slackRoutes); // OAuth callback doesn't need auth
app.use('/api/integrations/google-drive', googleDriveRoutes); // OAuth callback doesn't need auth
app.use('/api/integrations/github', githubRoutes); // OAuth callback doesn't need auth
import msteamsRoutes from './routes/msteams.routes.js';
app.use('/api/integrations/msteams', msteamsRoutes); // OAuth callback doesn't need auth

// Team collaboration and share links
app.use('/api/collaboration', collaborationRoutes);

// File upload for large files (Gemini File API)
app.use('/api/files', fileUploadRoutes);
app.use('/api/speech', speechRoutes);
app.use('/api/maturity-assessment', maturityAssessmentRoutes);

// Workspace persistence for Tier 1/2 -> Tier 3 transition
app.use('/api/workspace', workspaceRoutes);

// MicroVM management for Tier 3 (Firecracker/Fly.io)
import vmRoutes from './routes/vm.routes.js';
app.use('/api/vm', vmRoutes);

// 404 handler for API routes (must be before error handler)
app.use('/api/*', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({
    success: false,
    error: {
      message: `API endpoint not found: ${req.method} ${req.path}`
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Startup timing helper
const startupTimings: { name: string; duration: number }[] = [];
const startupStart = Date.now();

function trackTiming(name: string, startTime: number) {
  const duration = Date.now() - startTime;
  startupTimings.push({ name, duration });
  return duration;
}

// Start server with optimized parallel initialization
async function startServer() {
  const serverStartTime = Date.now();

  try {
    // PHASE 1: Critical path - Database connection (required for everything)
    const dbStart = Date.now();
    logger.info(`Connecting to MongoDB at: ${config.mongodbUri.replace(/:([^:@]+)@/, ':****@')}`); // Mask password
    await connectDatabase();
    trackTiming('Database connection', dbStart);
    logger.info('Database connected successfully');

    // PHASE 2: Start HTTP server IMMEDIATELY after DB (accept connections early)
    // Initialize WebSocket service
    webSocketService.initialize(httpServer);

    // Connect GenerationStatus service to WebSocket for real-time Mission Control updates
    const { generationStatusService } = await import('./services/GenerationStatus.service.js');
    generationStatusService.setSocketEmitter(webSocketService.getGenerationStatusEmitter());
    logger.info('[GenerationStatus] Real-time generation status enabled');

    // Initialize Voice WebSocket service (must be before httpServer.listen)
    const { voiceWebSocketService } = await import('./services/voiceWebSocket.service.js');
    voiceWebSocketService.initialize(httpServer);
    logger.info('[VoiceWebSocket] Voice WebSocket service initialized on /ws/voice');

    httpServer.listen(PORT, () => {
      const listenTime = Date.now() - serverStartTime;
      logger.info(`🚀 OrbitAI Backend Server running on port ${PORT} (${listenTime}ms)`);
      logger.info(`📡 Environment: ${config.nodeEnv}`);
    });

    // PHASE 3: Non-blocking parallel initialization (fire and forget)
    // These run in background and don't block server startup

    // Redis & Queue - non-blocking
    redisService.connect().catch((error) => {
      logger.warn('Redis initialization failed, continuing without cache:', error.message);
    });

    queueService.initialize().catch((error) => {
      logger.warn('Queue service initialization failed, continuing without queues:', error.message);
    });

    // PHASE 4: Parallel service initialization (all independent services at once)
    const parallelStart = Date.now();

    const parallelInitPromises = [
      // Feature flag service (important for app behavior)
      import('./services/featureFlagAdapter.js')
        .then(({ initializeFeatureFlags }) => initializeFeatureFlags())
        .then(() => logger.info('✅ Feature Flag Service initialized'))
        .catch((error) => logger.warn('Failed to initialize feature flag service:', error.message)),

      // LLM Router Settings
      import('./services/llmRouterSettings.service.js')
        .then(({ llmRouterSettingsService }) => llmRouterSettingsService.initializeDefaultSettings())
        .then(() => logger.info('✅ LLM Router Settings initialized'))
        .catch((error) => logger.warn('Failed to initialize LLM router settings:', error.message)),

      // Model Registry - Load models from database (including synced models)
      import('./services/llm/models/ModelRegistry.js')
        .then(async ({ modelRegistry }) => {
          await modelRegistry.initialize();
          logger.info('✅ Model Registry initialized from database');
        })
        .catch((error) => logger.warn('Failed to initialize model registry:', error.message)),

      // Model Sync Service - Load sync status and start monthly scheduler
      import('./services/modelSync.service.js')
        .then(async ({ modelSyncService }) => {
          // Load persisted sync status from database
          await modelSyncService.loadSyncStatus();
          // Start monthly scheduler
          modelSyncService.startMonthlySync();
          logger.info('✅ Model Sync monthly scheduler started');
        })
        .catch((error) => logger.warn('Failed to start model sync scheduler:', error.message)),

      // Service imports (just verify they load, no initialization needed)
      import('./services/processMining.service.js')
        .then(() => logger.info('✅ Process Mining service ready'))
        .catch((error) => logger.warn('Process Mining service failed:', error.message)),

      import('./services/nlp.service.js')
        .then(() => logger.info('✅ NLP service ready'))
        .catch((error) => logger.warn('NLP service failed:', error.message)),

      import('./services/processAnalytics.service.js')
        .then(() => logger.info('✅ Process Analytics service ready'))
        .catch((error) => logger.warn('Process Analytics service failed:', error.message)),

      import('./services/workflowEngine.service.js')
        .then(() => logger.info('✅ Workflow Engine service ready'))
        .catch((error) => logger.warn('Workflow Engine service failed:', error.message)),

      import('./services/collaborativeWiki.service.js')
        .then(() => logger.info('✅ Collaborative Wiki service ready'))
        .catch((error) => logger.warn('Collaborative Wiki service failed:', error.message)),

      import('./services/aiOptimization.service.js')
        .then(() => logger.info('✅ AI Optimization service ready'))
        .catch((error) => logger.warn('AI Optimization service failed:', error.message)),

      import('./services/processSimulation.service.js')
        .then(() => logger.info('✅ Process Simulation service ready'))
        .catch((error) => logger.warn('Process Simulation service failed:', error.message)),

      import('./services/complianceAudit.service.js')
        .then(() => logger.info('✅ Compliance & Audit service ready'))
        .catch((error) => logger.warn('Compliance & Audit service failed:', error.message)),

      import('./services/communitySharing.service.js')
        .then(() => logger.info('✅ Community Sharing service ready'))
        .catch((error) => logger.warn('Community Sharing service failed:', error.message)),

      import('./services/processImprovement.service.js')
        .then(({ processImprovementService }) => {
          logger.info('✅ Process Improvement service ready');

          // First, cleanup any stuck improvements
          setTimeout(() => {
            processImprovementService.cleanupStuckImprovements(5).catch((error: any) => {
              logger.warn('Failed to cleanup stuck improvements:', error.message);
            });
          }, 2000);

          // Defer assessment to after startup (with longer delay to allow cleanup)
          // Only assess truly pending improvements (not stuck ones)
          setTimeout(() => {
            processImprovementService.assessAllPendingImprovements().catch((error: any) => {
              logger.warn('Failed to assess pending improvements:', error.message);
            });
          }, 10000); // Increased delay to 10 seconds

          // Schedule periodic cleanup every 10 minutes to prevent stuck improvements
          setInterval(() => {
            processImprovementService.cleanupStuckImprovements(5).catch((error: any) => {
              logger.warn('Periodic cleanup of stuck improvements failed:', error.message);
            });
          }, 10 * 60 * 1000); // Every 10 minutes
        })
        .catch((error) => logger.warn('Process Improvement service failed:', error.message)),

      // Backup scheduler
      import('./services/backupScheduler.service.js')
        .then(({ backupScheduler }) => backupScheduler.start())
        .then(() => logger.info('✅ Backup scheduler initialized'))
        .catch((error) => logger.warn('Backup scheduler failed:', error.message)),
    ];

    // Wait for all parallel initializations
    await Promise.allSettled(parallelInitPromises);
    trackTiming('Parallel service init', parallelStart);

    // PHASE 5: Deferred initialization (non-critical, run after server is ready)
    setTimeout(async () => {
      // Check if DB is connected before running seeds to avoid race conditions
      if (mongoose.connection.readyState !== 1) {
        logger.warn('⚠️  Skipping deferred initialization steps - Database not connected');
        return;
      }

      const deferredStart = Date.now();

      // Agent Knowledge Aggregator - defer to avoid blocking startup
      try {
        const { agentKnowledgeAggregator } = await import('./services/agentKnowledgeAggregator.js');
        // Start with skipInitialRun to avoid immediate aggregation
        agentKnowledgeAggregator.start(1, true); // 1 hour interval, skip initial run
        logger.info('✅ Agent Knowledge Aggregator scheduled (runs every hour)');
      } catch (error) {
        logger.warn('Failed to start agent knowledge aggregator');
      }

      // Neo4j - optional, only initialize if configured
      if (process.env.NEO4J_URI) {
        try {
          const { neo4jService } = await import('./services/neo4j.service.js');
          await neo4jService.initialize();
          logger.info('✅ Neo4j Knowledge Graph service initialized');
        } catch (error: any) {
          logger.debug('Neo4j service skipped: ' + error.message);
        }
      } else {
        logger.debug('Neo4j service skipped (NEO4J_URI not configured)');
      }

      // MCP health checks - defer to after startup
      try {
        const { mcpService } = await import('./services/mcp.service.js');
        const mcpHealth = await mcpService.checkAllSystemServersHealth();

        logger.info('\n📡 MCP Server Configuration Status:');
        mcpHealth.forEach(health => {
          const statusIcon = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌';
          logger.info(`   ${statusIcon} ${health.name} (${health.serverId}): ${health.status.toUpperCase()}`);
        });

        mcpService.startHealthChecks(5 * 60 * 1000);
      } catch (error: any) {
        logger.warn('MCP health check failed:', error.message);
      }

      // Seed operations - run in background, don't log failures prominently
      const seedPromises = [
        // import('./services/seedFeatureFlags.service.js').catch(() => { }), // File missing
        // import('./services/seedPackages.service.js').catch(() => { }), // File missing

        import('./services/seedHomepageContent.service.js')
          .then(({ seedHomepageContent }) => seedHomepageContent())
          .catch(() => { }),
        // import('./services/seedStandards.service.js').catch(() => { }), // File missing
        // import('./services/seedAgentKnowledge.service.js').catch(() => { }), // File missing
        // import('./services/ensureDefaultAdmin.service.js').catch(() => { }), // File missing
      ];

      await Promise.allSettled(seedPromises);
      trackTiming('Deferred initialization', deferredStart);

      // Log API key status
      try {
        const { apiKeyProvider } = await import('./services/apiKeyProvider.service.js');
        const geminiConfigured = await apiKeyProvider.hasApiKey('gemini');
        const geminiSource = await apiKeyProvider.getApiKeySource('gemini');
        const e2bConfigured = await apiKeyProvider.hasApiKey('e2b');
        const e2bSource = await apiKeyProvider.getApiKeySource('e2b');

        logger.info(`\n🔑 API Keys:`);
        logger.info(`   Gemini: ${geminiConfigured ? `✅ (${geminiSource})` : '❌ Not configured'}`);
        logger.info(`   E2B: ${e2bConfigured ? `✅ (${e2bSource})` : '❌ Not configured'}`);
      } catch { }

      // Print startup timing summary
      const totalTime = Date.now() - serverStartTime;
      logger.info(`\n⏱️  Startup Performance:`);
      startupTimings.forEach(t => logger.info(`   ${t.name}: ${t.duration}ms`));
      logger.info(`   Total startup time: ${totalTime}ms`);

    }, 100); // Small delay to let server start accepting connections first

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;


