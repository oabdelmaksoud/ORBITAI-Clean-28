/**
 * Unified LLM Routes - All LLM requests go through the intelligent router
 * Replaces provider-specific routes (e.g., /api/gemini/*) with unified /api/llm/*
 */

import express from 'express';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { usageTracker } from '../services/llm/UsageTracker.js';
import { evaluationService } from '../services/evaluation.service.js';
import { learnFromTaskExecution } from '../middleware/agentKnowledgeLearning.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { sdlcMatchingService } from '../services/sdlcMatching.service.js';
import { standardsMatchingService } from '../services/standardsMatching.service.js';
import { functionCallProcessor, LLMResponseWithFunctionCalls } from '../services/llm/FunctionCallProcessor.js';
import { Project } from '../models/Project.model.js';
import { routeTimeout } from '../middleware/timeout.js';
import { embeddingService } from '../services/embedding.service.js';
import { Type, Schema } from '@google/genai';
import { geminiService } from '../services/gemini.service.js';
import { responseCache } from '../services/llm/ResponseCache.js';
import { modelRegistry } from '../services/llm/models/ModelRegistry.js';
import { EnhancedPreviewGenerator } from '../services/enhancedPreviewGenerator.service.js';
import { previewTemplatesService } from '../services/previewTemplates.service.js';
import { coverageAnalyzer } from '../services/coverageAnalyzer.service.js';
import designInspirationService from '../services/designInspirationService.js';
import crypto from 'crypto';

const router = express.Router();

// Optional authentication - allows unauthenticated requests but extracts user if available
router.use((req: AuthRequest, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authenticateToken(req, res, () => next());
  } else {
    next();
  }
});

/**
 * Map SDLC service methodology recommendations to supported project methodologies
 */
function mapToSupportedMethodology(sdlcMethodology: string): 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD' {
  if (sdlcMethodology === 'LangGraph') {
    return 'Agile';
  }
  const supportedMethodologies = ['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Iterative', 'Prototyping', 'RAD', 'Scrum', 'Lean', 'ASD'];
  if (supportedMethodologies.includes(sdlcMethodology)) {
    return sdlcMethodology as 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD';
  }
  return 'V-Model';
}

/**
 * Fallback standards matching based on keywords when database matching fails
 */
function getFallbackStandards(description: string, userGoal: string): string[] {
  const text = `${description} ${userGoal}`.toLowerCase();
  const standards: string[] = [];

  if (text.includes('web') || text.includes('website') || text.includes('frontend')) {
    standards.push('wcag', 'w3c');
  }
  if (text.includes('api') || text.includes('rest') || text.includes('graphql')) {
    standards.push('rest', 'openapi');
  }
  if (text.includes('mobile') || text.includes('ios') || text.includes('android')) {
    standards.push('mobile-accessibility');
  }
  if (text.includes('data') || text.includes('privacy') || text.includes('personal information')) {
    if (text.includes('eu') || text.includes('europe')) {
      standards.push('gdpr');
    }
    if (text.includes('california') || text.includes('ca')) {
      standards.push('ccpa');
    }
  }
  if (text.includes('security') || text.includes('secure') || text.includes('encryption') ||
    text.includes('authentication') || text.includes('cyber')) {
    standards.push('owasp', 'iso27001');
  }

  return Array.from(new Set(standards)).slice(0, 5);
}

/**
 * Detect project type from project context/description
 */
function detectProjectType(projectContext: string): string {
  if (!projectContext) return 'unknown';

  const context = projectContext.toLowerCase();

  // STRICTER Game Keywords to avoid false positives (e.g. "player" could be media player)
  const gameKeywords = [
    'video game', 'gaming', 'rpg', 'board game', 'card game', 'arcade',
    'unity', 'unreal engine', 'godot', 'pygame', 'multiplayer game',
    'platformer', 'fps', 'mmo', 'battle royale', 'pixel art game'
  ];
  // Only match "game" if it's a distinct word, to avoid "gamification" etc if needed, 
  // but "game" token is usually strong enough if we exclude common non-game contexts.
  // Better to look for specific genres.

  if (gameKeywords.some(keyword => context.includes(keyword))) {
    return 'game';
  }

  // Check for "app" vs "game" explicitly
  if (context.includes('game') && !context.includes('gamification')) {
    return 'game';
  }

  const websiteKeywords = ['website', 'web app', 'web application', 'site', 'webpage', 'landing page', 'portfolio', 'blog', 'e-commerce', 'ecommerce', 'shop', 'store', 'marketplace', 'saas', 'dashboard', 'crm', 'cms'];
  if (websiteKeywords.some(keyword => context.includes(keyword))) {
    return 'website';
  }

  const mobileKeywords = ['mobile app', 'mobile application', 'ios app', 'android app', 'react native', 'flutter', 'swift', 'kotlin', 'ionic'];
  if (mobileKeywords.some(keyword => context.includes(keyword))) {
    return 'mobile-app';
  }

  const apiKeywords = ['api', 'backend', 'server', 'rest api', 'graphql', 'microservice', 'database', 'cloud'];
  if (apiKeywords.some(keyword => context.includes(keyword))) {
    return 'api';
  }

  return 'unknown';
}

// ============================================================================
// UNIFIED LLM ENDPOINTS - All requests go through intelligent router
// ============================================================================

/**
 * Generate project preview (for wizard)
 * Uses LLM router to select best model for this task
 * Note: Uses structured output which requires specific model support
 */
router.post('/generate-preview', async (req: AuthRequest, res, _next) => {
  try {
    const { userGoal, conversationHistory, useInternet = false, useEnhanced = true, isRegeneration = false, conversationId, runInBackground = true, regenerateSection, brainstormingContext } = req.body;

    if (!userGoal) {
      res.status(400).json({
        success: false,
        message: 'userGoal is required'
      });
      return;
    }

    // Allow guest users with a generated guest ID
    const userId = req.user?.id || `guest-${crypto.randomUUID()}`;

    // ------------------------------------------------------------------
    // PARSE STRUCTURED GOAL (Move to top to be available for all paths)
    // ------------------------------------------------------------------
    // Parse structured data from userGoal if it contains structured sections
    const structuredSections = userGoal.match(/^(PROJECT TOPIC|INITIAL REQUEST|ADDITIONAL REQUIREMENTS|PROJECT IDEAS|UPDATED PROJECT IDEAS|KEY INSIGHTS|NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT):/m);
    const isStructured = !!structuredSections;

    // Extract structured sections if present
    let projectTopic = '';
    let initialRequest = '';
    let additionalRequirements = '';
    let projectIdeas = '';
    let keyInsights = '';
    let nextSteps = '';
    let selectedStandards = '';
    let currentContext = '';

    if (isStructured) {
      const topicMatch = userGoal.match(/PROJECT TOPIC:\s*(.+?)(?=\n\n|$)/s);
      const initialMatch = userGoal.match(/INITIAL REQUEST:\s*(.+?)(?=\n\nADDITIONAL|$)/s);
      const additionalMatch = userGoal.match(/ADDITIONAL REQUIREMENTS:\s*(.+?)(?=\n\n(?:PROJECT IDEAS|UPDATED PROJECT IDEAS|KEY INSIGHTS|NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/s);
      const ideasMatch = userGoal.match(/(?:PROJECT IDEAS|UPDATED PROJECT IDEAS) & REQUIREMENTS[^:]*:\s*(.+?)(?=\n\n(?:KEY INSIGHTS|NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/s);
      const insightsMatch = userGoal.match(/KEY INSIGHTS:\s*(.+?)(?=\n\n(?:NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/s);
      const stepsMatch = userGoal.match(/NEXT STEPS:\s*(.+?)(?=\n\n(?:SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/s);
      const standardsMatch = userGoal.match(/SELECTED STANDARDS:\s*(.+?)(?=\n\nCURRENT PROJECT CONTEXT|$)/s);
      const contextMatch = userGoal.match(/CURRENT PROJECT CONTEXT[^:]*:\s*(.+?)$/s);

      if (topicMatch) projectTopic = topicMatch[1].trim();
      if (initialMatch) initialRequest = initialMatch[1].trim();
      if (additionalMatch) additionalRequirements = additionalMatch[1].trim();
      if (ideasMatch) projectIdeas = ideasMatch[1].trim();
      if (insightsMatch) keyInsights = insightsMatch[1].trim();
      if (stepsMatch) nextSteps = stepsMatch[1].trim();
      if (standardsMatch) selectedStandards = standardsMatch[1].trim();
      if (contextMatch) currentContext = contextMatch[1].trim();
    }
    // ------------------------------------------------------------------

    // If conversationId is provided and runInBackground is true, start background job
    if (conversationId && runInBackground) {
      const { backgroundPrototypeGenerationService } = await import('../services/backgroundPrototypeGeneration.service.js');

      const jobId = await backgroundPrototypeGenerationService.startGeneration(
        conversationId,
        userId,
        userGoal,
        conversationHistory || [],
        useInternet,
        useEnhanced,
        isRegeneration,
        brainstormingContext
      );

      logger.info(`[LLMRouter] Started background prototype generation job ${jobId} for conversation ${conversationId}`);

      return res.json({
        success: true,
        jobId,
        status: 'pending',
        message: 'Prototype generation started in background'
      });
    }

    // Fallback to synchronous execution (for backward compatibility or if runInBackground is false)
    logger.info(`[LLMRouter] Generating project preview synchronously...${useInternet ? ' (with internet research)' : ''}${useEnhanced ? ' [ENHANCED MODE]' : ''}`);

    // Use enhanced preview generator if enabled
    if (useEnhanced !== false) {
      try {
        const enhancedGenerator = new EnhancedPreviewGenerator();
        const startTime = Date.now();

        // Optional: Send progress updates via headers if client supports it
        // For now, we'll log progress and return results at the end
        const progressCallback = (stage: string, progress: number, message: string) => {
          logger.info(`[EnhancedPreview] ${stage}: ${progress}% - ${message}`);
          // In future: Could use SSE or WebSocket for real-time progress
        };

        // Check if this is a regeneration request (should bypass cache)
        const isRegeneration = req.body.isRegeneration === true || req.body.regenerate === true;

        // Check if we have refinement context (for fast updates)
        const { refinementContext } = req.body;

        const isRefinement = !!refinementContext && !isRegeneration;

        // Define common variables for generation
        const projectName = userGoal.substring(0, 50).trim() || 'New Project';
        const fullDescription = `${userGoal}\n\n${(conversationHistory || []).map((m: any) => `${m.sender}: ${m.text}`).join('\n').substring(0, 1500)}`;
        // Cache key for storing/retrieving generated previews
        const cacheKey = `${userGoal.substring(0, 200)}|${(conversationHistory || []).length}`;

        // Declare variables that will be populated either from refinementContext or by generation
        let requirements: any;
        let researchContext: string;
        let summary: string;
        let techStack: string[];
        let architecture: string;

        if (isRefinement) {
          logger.info(`[EnhancedPreview] Refinement mode active - skipping generic generation steps`);

          // Use existing context for these stages
          requirements = refinementContext.requirements || { requirements: [], features: [], projectType: 'unknown' };
          researchContext = refinementContext.researchContext || '';
          summary = refinementContext.summary || '';
          techStack = refinementContext.techStack || [];
          architecture = refinementContext.architectureDiagram || '';

          // Check if we specifically want to regenerate architecture
          if (regenerateSection === 'architecture') {
            logger.info(`[EnhancedPreview] Regenerating architecture while keeping requirements/summary/tech...`);
            progressCallback('Stage 3', 50, 'Regenerating architecture...');
            architecture = await enhancedGenerator.retryWithBackoff(
              () => enhancedGenerator.generateArchitecture(userGoal, requirements, techStack, fullDescription, projectIdeas),
              3,
              'Architecture generation'
            );
          } else {
            progressCallback('Stage 3a', 100, 'Using existing architecture...');
          }

          // Just log progress for skipped stages
          progressCallback('Stage 1', 100, 'Using existing requirements and research context...');
          progressCallback('Stage 2', 100, 'Using existing summary and tech stack...');
        } else {
          // Check semantic cache first (for similar projects) - but skip if regenerating
          let semanticCache = null;
          if (!isRegeneration) {
            semanticCache = responseCache.findSimilar(
              cacheKey,
              'gemini-3-pro-preview',
              0.85 // 85% similarity threshold for previews
            );
          }

          if (semanticCache) {
            try {
              const cachedPreview = JSON.parse(semanticCache.response);
              logger.info(`[EnhancedPreview] Semantic cache HIT - using similar preview (similarity: 85%+)`);

              // Validate cached preview still has all required fields
              if (cachedPreview.summary && cachedPreview.techStack &&
                cachedPreview.architectureDiagram && cachedPreview.wireframeCode) {

                // Track usage
                await usageTracker.trackUsage({
                  userId: (req as any).user?.userId,
                  projectId: (req.body as any).projectId,
                  modelId: semanticCache.modelId,
                  provider: semanticCache.provider,
                  modelIdentifier: semanticCache.modelId,
                  inputTokens: semanticCache.tokens.input,
                  outputTokens: semanticCache.tokens.output,
                  requestType: 'project-preview-enhanced-cached',
                  context: 'wizard',
                  success: true,
                  latencyMs: 100 // Cached responses are fast
                });

                return res.json({
                  success: true,
                  data: cachedPreview,
                  latency: 100,
                  qualityScore: 1.0,
                  cached: true
                });
              }
            } catch (cacheError) {
              logger.warn('[EnhancedPreview] Failed to use cached preview, generating new one:', cacheError);
            }
          }

          // Stage 1: Extract requirements and perform research in parallel (0-20%)
          progressCallback('Stage 1', 0, 'Extracting requirements and performing research...');
          logger.info('[EnhancedPreview] Stage 1: Extracting requirements...');
          [requirements, researchContext] = await Promise.all([
            enhancedGenerator.extractRequirements(conversationHistory || [], userGoal),
            useInternet ? (async () => {
              try {
                const researchPrompt = `Research the latest information about building a project like: "${userGoal}"

Focus on:
1. Current industry best practices
2. Recommended technologies and frameworks (latest versions)
3. Common implementation patterns
4. Important considerations and potential challenges
5. Relevant standards or compliance requirements

Keep the research concise and focused on actionable insights.`;

                const researchResult = await llmRouter.executeWithFallback({
                  prompt: researchPrompt,
                  context: { agentRole: 'Research Agent', taskType: 'research' },
                  routingContext: { userId: (req as any).user?.id },
                  requestType: 'research',
                  contextType: 'wizard',
                  useInternet: true
                });

                return (researchResult.text || '').substring(0, 2000);
              } catch (error: any) {
                logger.warn('[EnhancedPreview] Research failed:', error.message);
                return '';
              }
            })() : Promise.resolve('')
          ]);

          progressCallback('Stage 2', 20, 'Generating summary and tech stack...');
          // Stage 2: Generate simple components in parallel using fast model (20-50%)
          logger.info('[EnhancedPreview] Stage 2: Generating summary and tech stack...');
          [summary, techStack] = await Promise.all([
            enhancedGenerator.retryWithBackoff(
              () => enhancedGenerator.generateSummary(userGoal, requirements, researchContext),
              3,
              'Summary generation'
            ),
            enhancedGenerator.retryWithBackoff(
              () => enhancedGenerator.generateTechStack(userGoal, requirements, researchContext),
              3,
              'Tech stack generation'
            )
          ]);

          // Stage 3: Generate complex components in parallel using powerful model (50-90%)
          logger.info('[EnhancedPreview] Stage 3: Generating architecture and wireframe...');
          // First generate architecture (wireframe depends on it)
          architecture = await enhancedGenerator.retryWithBackoff(
            () => enhancedGenerator.generateArchitecture(userGoal, requirements, techStack, fullDescription, projectIdeas, brainstormingContext),
            3,
            'Architecture generation'
          );
        }

        // Calculate limited conversation text for analysis
        const limitedConversationText = conversationHistory && conversationHistory.length > 15
          ? conversationHistory.slice(-15).map((m: any) => `${m.sender}: ${m.text}`).join('\n').substring(0, 1500)
          : (conversationHistory || []).map((m: any) => `${m.sender}: ${m.text}`).join('\n').substring(0, 1500);

        // Perform full architecture analysis (Stage 3b)
        logger.info('[EnhancedPreview] Performing full architecture analysis...');
        let architectureAnalysis: any = null;
        try {
          const { fullProjectArchitectureAnalyzer } = await import('../services/fullProjectArchitectureAnalyzer.service.js');

          // Helper to detect project type (duplicated from buildFullPrompt, will cleanup later)
          const detectProjectType = (desc: string): string => {
            const lower = desc.toLowerCase();
            if (lower.includes('mobile') || lower.includes('app') || lower.includes('ios') || lower.includes('android')) return 'mobile-app';
            if (lower.includes('api') || lower.includes('backend') || lower.includes('microservice')) return 'api';
            if (lower.includes('game')) return 'game';
            if (lower.includes('desktop') || lower.includes('windows') || lower.includes('macos')) return 'desktop';
            return 'website';
          };

          const detectedType = detectProjectType(fullDescription);
          const projectTypeMap: Record<string, 'web' | 'mobile' | 'api' | 'desktop' | 'hybrid' | undefined> = {
            'website': 'web',
            'mobile-app': 'mobile',
            'api': 'api',
            'game': 'web',
            'unknown': undefined
          };

          architectureAnalysis = await fullProjectArchitectureAnalyzer.analyzeArchitecture({
            projectDescription: userGoal,
            researchFindings: researchContext,
            userRequirements: limitedConversationText,
            projectType: projectTypeMap[detectedType] || undefined
          });

          logger.info('[EnhancedPreview] Architecture analysis completed');
        } catch (archError: any) {
          logger.warn('[EnhancedPreview] Architecture analysis failed, continuing:', archError.message);
        }

        // Run SDLC and Standards matching in parallel (these are always re-evaluated or refined)
        // Variables defined at top of scope

        const [sdlcResult, standardsResult] = await Promise.allSettled([
          (async () => {
            try {
              await sdlcMatchingService.initialize();
              const sdlcRecommendation = await sdlcMatchingService.recommendMethodology({
                name: projectName,
                description: fullDescription,
                requirements: requirements.requirements
              });
              return {
                methodology: mapToSupportedMethodology(sdlcRecommendation.methodology),
                reasoning: sdlcRecommendation.reasoning
              };
            } catch (error: any) {
              logger.warn('SDLC matching failed:', error.message);
              return null;
            }
          })(),
          (async () => {
            try {
              await standardsMatchingService.initialize();
              const enrolledStandards = await standardsMatchingService.autoEnrollStandards({
                name: projectName,
                description: fullDescription,
                methodology: 'V-Model',
                requirements: requirements.requirements
              }, {
                autoEnrollRequired: true,
                autoEnrollRecommended: true,
                maxStandards: 5
              });
              return enrolledStandards.length > 0 ? enrolledStandards : null;
            } catch (error: any) {
              logger.warn('Standards matching failed:', error.message);
              return null;
            }
          })()
        ]);

        let recommendedMethodology = 'V-Model';
        let recommendedStandards: string[] = [];

        if (sdlcResult.status === 'fulfilled' && sdlcResult.value) {
          recommendedMethodology = sdlcResult.value.methodology;
        }

        if (standardsResult.status === 'fulfilled' && standardsResult.value) {
          recommendedStandards = standardsResult.value;
        } else {
          recommendedStandards = getFallbackStandards(fullDescription, userGoal);
        }

        // Helper function to build full prompt for wireframe generation
        const buildFullPrompt = async (
          userGoal: string,
          conversationHistory: any[],
          requirements: any,
          researchContext: string,
          methodology: string,
          standards: string[],
          architectureAnalysis: any
        ): Promise<string> => {
          const conversationText = (conversationHistory || [])
            .map((m: any) => `${m.sender}: ${m.text}`)
            .join('\n')
            .substring(0, 1500);

          const researchSection = researchContext
            ? `\n\n**INTERNET RESEARCH RESULTS**:\n${researchContext}\n`
            : '';

          return `Generate production-ready React code for: "${userGoal}"
          
          **CRITICAL: PLATFORM SELECTION**
          Review the CONVERSATION history below to identify the **Target Platforms** (e.g., Web, Mobile, iOS, Android) agreed upon by the agents.
          - If **Mobile** (React Native/Flutter/iOS/Android) is selected, generate a specialized Mobile Web App that looks and feels like a native app (bottom navigation, touch-optimized).
          - If **Web** is selected, generate a responsive Web Dashboard.
          
          REQUIREMENTS: ${requirements.requirements.join(', ')}
          FEATURES: ${requirements.features.join(', ')}
          PROJECT TYPE: ${requirements.projectType}
          CONVERSATION: ${conversationText}
          ${researchSection}
          METHODOLOGY: ${methodology}
          STANDARDS: ${standards.join(', ')}

          Generate a complete, functional HTML file with React 18, Tailwind CSS, and all necessary assets.`;
        };

        // Then generate wireframe (uses architecture)
        const wireframe = await enhancedGenerator.retryWithBackoff(async () => {
          // Build the full prompt for wireframe generation
          const fullPrompt = await buildFullPrompt(userGoal, conversationHistory, requirements, researchContext, recommendedMethodology, recommendedStandards, architectureAnalysis);
          return enhancedGenerator.generateWireframeV2(userGoal, requirements, fullPrompt, isRegeneration, brainstormingContext);
        }, 2, 'Wireframe generation'); // Only 2 retries for wireframe (it's expensive)

        progressCallback('Stage 4', 90, 'Finalizing and validating preview...');
        // Stage 4: Generate risks and validate (90-100%)
        logger.info('[EnhancedPreview] Stage 4: Finalizing preview...');
        const risks = await enhancedGenerator.retryWithBackoff(async () => {
          const prompt = `Identify the top 3 technical risks for this project:

PROJECT: "${userGoal}"
TECH STACK: ${techStack.join(', ')}
ARCHITECTURE: ${architecture.substring(0, 500)}

Return a JSON array of 3 risk strings.`;

          const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
              risks: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['risks']
          };

          const result = await enhancedGenerator.getGeminiService().generateContent(
            prompt,
            'gemini-2.5-flash',
            {
              systemInstruction: 'You are a risk analyst. Identify technical risks. Respond only with valid JSON.',
              responseMimeType: 'application/json',
              responseSchema
            }
          );

          const parsed = JSON.parse(result.text || '{}');
          return parsed.risks || ['Technical complexity', 'Integration challenges', 'Performance requirements'];
        }, 2, 'Risk identification');

        // Generate Admin Console if required
        let adminWireframe: string | undefined;
        let adminViews: any | undefined;

        // GAME PROJECTS: Always generate admin console for game management
        const isGame = requirements.projectType === 'game';

        // Check if admin console is required based on architecture analysis OR if it's a game
        if (architectureAnalysis?.adminConsole?.required || isGame) {
          logger.info(`[EnhancedPreview] Admin Console ${isGame ? 'required for game project' : 'required by architecture'} - generating wireframe...`);
          progressCallback('Stage 4b', 93, 'Generating Admin Console/Game Dashboard...');

          try {
            adminWireframe = await enhancedGenerator.retryWithBackoff(async () => {
              return enhancedGenerator.generateAdminWireframe(
                userGoal,
                requirements,
                techStack,
                architecture,
                '',
                isRegeneration,
                brainstormingContext
              );
            }, 2, 'Admin Wireframe generation');

            if (adminWireframe) {
              adminViews = {
                preview: adminWireframe,
                wireframe: adminWireframe
              };
              logger.info(`[EnhancedPreview] ${isGame ? 'Game Dashboard' : 'Admin Console'} generated successfully`);
            }
          } catch (adminError) {
            logger.warn('[EnhancedPreview] Failed to generate Admin Console:', adminError);
          }
        }

        // Analyze feature coverage with AI if we have brainstorming context with ideas
        let featureCoverage;
        if (brainstormingContext?.ideas && wireframe) {
          logger.info('[EnhancedPreview] Analyzing feature coverage with AI...');
          try {
            featureCoverage = await coverageAnalyzer.analyzePrototypeCoverageWithAI(
              wireframe,
              brainstormingContext.ideas
            );
            logger.info(`[EnhancedPreview] AI Coverage: ${featureCoverage.coveragePercentage}% (${featureCoverage.coveredFeatures}/${featureCoverage.totalFeatures} features, method: ${featureCoverage.analysisMethod})`);
          } catch (coverageError) {
            logger.warn('[EnhancedPreview] Failed to analyze coverage:', coverageError);
          }
        }

        // Build final preview (including featureCoverage inside for frontend access)
        const preview = {
          projectName: projectName,
          summary: summary,
          techStack: techStack,
          architectureDiagram: architecture,
          wireframeCode: wireframe,
          risks: risks,
          recommendedMethodology: recommendedMethodology,
          recommendedStandards: recommendedStandards,
          requirements: requirements, // Include requirements for frontend projectType access
          // New structured views
          views: {
            endUser: {
              preview: wireframe,
              wireframe: wireframe
            },
            adminConsole: adminViews
          },
          // Pass full analysis details
          backendArchitecture: architectureAnalysis?.backendArchitecture,
          adminConsole: architectureAnalysis?.adminConsole,
          infrastructure: architectureAnalysis?.infrastructure,
          securityArchitecture: architectureAnalysis?.securityArchitecture,
          databaseArchitecture: architectureAnalysis?.databaseArchitecture,
          apiDesign: architectureAnalysis?.apiDesign,
          // Feature coverage for frontend display
          featureCoverage: featureCoverage
        };

        progressCallback('Validation', 95, 'Validating preview quality...');
        // Validate preview quality
        const validation = await enhancedGenerator.validatePreview(preview);
        logger.info(`[EnhancedPreview] Validation score: ${validation.score.toFixed(2)}`);

        if (validation.score < 0.7 && validation.issues.some(i => i.severity === 'critical')) {
          logger.warn('[EnhancedPreview] Preview quality issues detected, attempting to fix...');

          // Regenerate critical fields
          for (const issue of validation.issues.filter(i => i.severity === 'critical')) {
            try {
              if (issue.field === 'summary' && (!preview.summary || preview.summary.length < 50)) {
                preview.summary = await enhancedGenerator.generateSummary(userGoal, requirements, researchContext);
              } else if (issue.field === 'techStack' && (!preview.techStack || preview.techStack.length === 0)) {
                preview.techStack = await enhancedGenerator.generateTechStack(userGoal, requirements, researchContext);
              } else if (issue.field === 'architectureDiagram' && (!preview.architectureDiagram || preview.architectureDiagram.length < 50)) {
                preview.architectureDiagram = await enhancedGenerator.generateArchitecture(userGoal, requirements, techStack, fullDescription, projectIdeas);
              }
            } catch (regenerateError) {
              logger.warn(`[EnhancedPreview] Failed to regenerate ${issue.field}:`, regenerateError);
            }
          }
        }

        const latency = Date.now() - startTime;

        // Track usage
        try {
          await usageTracker.trackUsage({
            userId: (req as any).user?.userId,
            projectId: (req.body as any).projectId,
            modelId: 'enhanced-multi-model',
            provider: 'gemini',
            modelIdentifier: 'enhanced-multi-model',
            inputTokens: 0,
            outputTokens: 0,
            requestType: 'project-preview-enhanced',
            context: 'wizard',
            success: true,
            latencyMs: latency
          });
        } catch (trackError) {
          logger.error('Failed to track usage:', trackError);
        }

        progressCallback('Complete', 100, 'Preview generation complete');
        logger.info(`[EnhancedPreview] Preview generated successfully in ${latency}ms (quality score: ${validation.score.toFixed(2)})`);

        // Cache the result for future similar requests
        try {
          const estimatedInputTokens = Math.ceil(cacheKey.length / 4);
          const estimatedOutputTokens = Math.ceil(JSON.stringify(preview).length / 4);
          const totalTokens = estimatedInputTokens + estimatedOutputTokens;
          const model = modelRegistry.getModel('gemini-3-pro-preview');
          const inputCost = model ? (estimatedInputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens : 0;
          const outputCost = model ? (estimatedOutputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens : 0;
          const totalCost = inputCost + outputCost;

          responseCache.set(
            cacheKey,
            'gemini-3-pro-preview',
            JSON.stringify(preview),
            { input: estimatedInputTokens, output: estimatedOutputTokens, total: totalTokens },
            totalCost,
            'gemini',
            undefined,
            { type: 'preview-enhanced', projectName: preview.projectName },
            3600000 // 1 hour TTL for previews
          );
        } catch (cacheError) {
          logger.warn('[EnhancedPreview] Failed to cache preview result:', cacheError);
        }

        return res.json({
          success: true,
          data: preview,
          latency: latency,
          qualityScore: validation.score
        });
      } catch (enhancedError: any) {
        logger.error('[EnhancedPreview] Enhanced generation failed, falling back to standard:', enhancedError);
        // Fall through to standard generation
      }
    }

    // Standard generation (original code) - fallback or if useEnhanced is false

    const conversationText = (conversationHistory || [])
      .map((m: any) => `${m.sender}: ${m.text}`)
      .join('\n');

    const projectName = userGoal.substring(0, 50).trim() || 'New Project';
    const fullDescription = `${userGoal}\n\n${conversationText.substring(0, 1500)}`;

    const extractedRequirements = conversationHistory
      ?.map((m: any) => m.text)
      .filter((t: string) => t && t.length > 10) || [];

    // Run SDLC and Standards matching in parallel
    let recommendedMethodology = 'V-Model';
    let estimatedSprints = 8;
    let sdlcReasoning = '';
    let recommendedStandards: string[] = [];
    let standardsReasoning = '';

    const [sdlcResult, standardsResult] = await Promise.allSettled([
      (async () => {
        try {
          await sdlcMatchingService.initialize();
          const sdlcRecommendation = await sdlcMatchingService.recommendMethodology({
            name: projectName,
            description: fullDescription,
            requirements: extractedRequirements
          });
          return {
            methodology: mapToSupportedMethodology(sdlcRecommendation.methodology),
            originalMethodology: sdlcRecommendation.methodology,
            estimatedSprints: sdlcRecommendation.estimatedSprints,
            reasoning: sdlcRecommendation.methodology !== mapToSupportedMethodology(sdlcRecommendation.methodology)
              ? `${sdlcRecommendation.reasoning} (Mapped from ${sdlcRecommendation.methodology} to ${mapToSupportedMethodology(sdlcRecommendation.methodology)} for compatibility)`
              : sdlcRecommendation.reasoning
          };
        } catch (error: any) {
          logger.warn('SDLC matching failed:', error.message);
          return null;
        }
      })(),
      (async () => {
        try {
          await standardsMatchingService.initialize();
          const enrolledStandards = await standardsMatchingService.autoEnrollStandards({
            name: projectName,
            description: fullDescription,
            methodology: 'V-Model',
            requirements: extractedRequirements
          }, {
            autoEnrollRequired: true,
            autoEnrollRecommended: true,
            maxStandards: 5
          });
          return enrolledStandards.length > 0 ? enrolledStandards : null;
        } catch (error: any) {
          logger.warn('Standards matching failed:', error.message);
          return null;
        }
      })()
    ]);

    if (sdlcResult.status === 'fulfilled' && sdlcResult.value) {
      recommendedMethodology = sdlcResult.value.methodology;
      estimatedSprints = sdlcResult.value.estimatedSprints;
      sdlcReasoning = sdlcResult.value.reasoning;
    }

    if (standardsResult.status === 'fulfilled' && standardsResult.value) {
      recommendedStandards = standardsResult.value;
      standardsReasoning = `Auto-selected ${recommendedStandards.length} quality standard(s) based on project characteristics`;
    } else {
      try {
        const fallbackStandards = getFallbackStandards(fullDescription, userGoal);
        if (fallbackStandards.length > 0) {
          recommendedStandards = fallbackStandards;
          standardsReasoning = `Auto-selected ${fallbackStandards.length} quality standard(s) based on project keywords`;
        }
      } catch (fallbackError) {
        logger.error('Fallback standards matching failed:', fallbackError);
      }
    }

    const limitedConversationText = conversationHistory && conversationHistory.length > 15
      ? conversationHistory.slice(-15).map((m: any) => `${m.sender}: ${m.text}`).join('\n').substring(0, 1500)
      : conversationText.substring(0, 1500);

    // If internet is enabled, perform research first to enhance the prompt
    let researchContext = '';
    if (useInternet) {
      try {
        logger.info(`[Preview] Performing internet research for project: ${userGoal.substring(0, 100)}...`);

        const researchPrompt = `Research the latest information about building a project like: "${userGoal}"

Focus on:
1. Current industry best practices
2. Recommended technologies and frameworks (latest versions)
3. Common implementation patterns
4. Important considerations and potential challenges
5. Relevant standards or compliance requirements

Keep the research concise and focused on actionable insights.`;

        const researchResult = await llmRouter.executeWithFallback({
          prompt: researchPrompt,
          context: {
            agentRole: 'Research Agent',
            taskType: 'research'
          },
          routingContext: {
            userId: (req as any).user?.id
          },
          requestType: 'research',
          contextType: 'wizard',
          useInternet: true // Enable internet search
        });

        researchContext = researchResult.text || '';
        if (researchContext) {
          researchContext = researchContext.substring(0, 2000); // Limit research context
          logger.info(`[Preview] Internet research completed (${researchContext.length} chars)`);
        }
      } catch (researchError: any) {
        logger.warn('[Preview] Internet research failed, continuing without it:', researchError.message);
        // Continue without research if it fails
      }
    }

    // Perform full architecture analysis
    let architectureAnalysis: Awaited<ReturnType<typeof import('../services/fullProjectArchitectureAnalyzer.service.js').fullProjectArchitectureAnalyzer.analyzeArchitecture>> | null = null;
    try {
      logger.info(`[Preview] Performing full architecture analysis for project: ${userGoal.substring(0, 100)}...`);
      const { fullProjectArchitectureAnalyzer } = await import('../services/fullProjectArchitectureAnalyzer.service.js');

      // Helper to detect project type (duplicated locally for legacy path)
      const detectProjectType = (desc: string): string => {
        const lower = desc.toLowerCase();
        if (lower.includes('mobile') || lower.includes('app') || lower.includes('ios') || lower.includes('android')) return 'mobile-app';
        if (lower.includes('api') || lower.includes('backend') || lower.includes('microservice')) return 'api';
        if (lower.includes('game')) return 'game';
        if (lower.includes('desktop') || lower.includes('windows') || lower.includes('macos')) return 'desktop';
        return 'website';
      };

      const detectedType = detectProjectType(fullDescription);
      const projectTypeMap: Record<string, 'web' | 'mobile' | 'api' | 'desktop' | 'hybrid' | undefined> = {
        'website': 'web',
        'mobile-app': 'mobile',
        'api': 'api',
        'game': 'web', // Games are typically web-based
        'unknown': undefined
      };

      architectureAnalysis = await fullProjectArchitectureAnalyzer.analyzeArchitecture({
        projectDescription: userGoal,
        researchFindings: researchContext,
        userRequirements: limitedConversationText,
        projectType: projectTypeMap[detectedType] || undefined
      });

      logger.info('[Preview] Full architecture analysis completed');
    } catch (archError: any) {
      logger.warn('[Preview] Architecture analysis failed, continuing without it:', archError.message);
      // Continue without architecture analysis if it fails
    }


    // Build comprehensive prompt (full version from gemini.routes.ts)
    const researchSection = researchContext
      ? `\n\n**INTERNET RESEARCH RESULTS** (Latest information and best practices):\n${researchContext}\n\nUse this research to inform your recommendations, especially for tech stack selection and best practices.`
      : '';

    const architectureSection = architectureAnalysis
      ? `\n\n**FULL PROJECT ARCHITECTURE ANALYSIS** (Complete component breakdown):
      
**Backend Architecture**: ${architectureAnalysis.backendArchitecture.description}
- API Server: ${architectureAnalysis.backendArchitecture.apiServer}
- Architecture Pattern: ${architectureAnalysis.backendArchitecture.architecture}
- Framework: ${architectureAnalysis.backendArchitecture.framework}

**Admin Console**: ${architectureAnalysis.adminConsole.required ? 'Required' : 'Not Required'}
${architectureAnalysis.adminConsole.required ? `- Features: ${architectureAnalysis.adminConsole.features.join(', ')}` : ''}
${architectureAnalysis.adminConsole.description}

**Infrastructure**: ${architectureAnalysis.infrastructure.description}
- Application Servers: ${architectureAnalysis.infrastructure.applicationServers}
- Database: ${architectureAnalysis.infrastructure.databaseServers}
- Caching: ${architectureAnalysis.infrastructure.caching}
- Deployment: ${architectureAnalysis.infrastructure.deployment}

**Security**: ${architectureAnalysis.securityArchitecture.description}
- Authentication: ${architectureAnalysis.securityArchitecture.authentication}
- Authorization: ${architectureAnalysis.securityArchitecture.authorization}

**Database**: ${architectureAnalysis.databaseArchitecture.description}
- Primary Database: ${architectureAnalysis.databaseArchitecture.primaryDatabase}
- Type: ${architectureAnalysis.databaseArchitecture.databaseType}

**API Design**: ${architectureAnalysis.apiDesign.description}
- Style: ${architectureAnalysis.apiDesign.apiStyle}
- Key Endpoints: ${architectureAnalysis.apiDesign.endpoints.join(', ') || 'To be determined'}

Use this architecture analysis to inform your project preview generation, ensuring all identified components are considered.`
      : '';

    // Structured data extraction moved to top of function

    const prompt = `
    ROLE: Elite Solutions Architect & Creative Technologist.
    
    MISSION: 
    Analyze the user's request and perform two key actions:
    1. **Deep Analysis**: Infer specific domain requirements, user flows, and technical needs based on your knowledge${useInternet ? ' and the latest internet research' : ''} and the provided context.
    2. **Generate Assets**: Create a structured project brief AND a **FULLY FUNCTIONAL** interactive prototype.

    ${isStructured ? `PROJECT INFORMATION (Structured):
    
    ${projectTopic ? `**PROJECT TOPIC**: ${projectTopic}` : ''}
    
    ${initialRequest ? `**INITIAL REQUEST**:\n${initialRequest}` : `**USER GOAL**: "${userGoal.substring(0, 500)}"`}
    
    ${additionalRequirements ? `**ADDITIONAL REQUIREMENTS**:\n${additionalRequirements}` : ''}
    
    ${projectIdeas ? `**PROJECT IDEAS & REQUIREMENTS**:\n${projectIdeas}` : ''}
    
    ${keyInsights ? `**KEY INSIGHTS**:\n${keyInsights}` : ''}
    
    ${nextSteps ? `**NEXT STEPS**:\n${nextSteps}` : ''}
    
    ${selectedStandards ? `**SELECTED STANDARDS**:\n${selectedStandards}` : ''}
    
    ${currentContext ? `**CURRENT PROJECT CONTEXT** (for reference during regeneration):\n${currentContext}` : ''}
    
    ` : `**USER GOAL**: "${userGoal}"`}
    
    **CONVERSATION HISTORY** (CRITICAL - This conversation refines and enhances the project requirements. All refinements, clarifications, and new ideas from this conversation MUST be incorporated into the Blueprint, Architecture, Prototype, and Code):
    ${limitedConversationText}
    
    ${limitedConversationText.length > 0 ? `**IMPORTANT**: The conversation above contains user refinements, clarifications, and enhancements to the project. These MUST be reflected in:
    - Blueprint: Update project structure, features, and requirements based on conversation
    - Architecture: Adjust system design based on conversation insights
    - Prototype: Incorporate all discussed features and refinements
    - Code: Implement all requirements mentioned in the conversation
    
    Pay special attention to:
    - Any new features or requirements mentioned
    - Changes to existing requirements
    - User preferences and constraints discussed
    - Technical decisions made during the conversation
    - Any clarifications or corrections provided` : ''}
    
    ${researchSection}${architectureSection}
    
    **SELECTED SDLC METHODOLOGY**: ${recommendedMethodology}
    ${sdlcReasoning ? `**REASONING**: ${sdlcReasoning}` : ''}
    
    OBJECTIVES & FORMAT:
    
    1. **Project Name**: Generate a concise, descriptive project name (max 50 characters)
    2. **Executive Summary**: A strategic, professional summary of the project${useInternet ? ' (incorporate latest best practices from research)' : ''}.
    3. **Tech Stack**: Best modern stack based on project type${useInternet ? ' and latest research' : ''}. Return as list of strings.
    4. **Architecture**: A MermaidJS "C4 Container" diagram code string (raw mermaid code, no markdown blocks)
    5. **Prototype (PRODUCTION-LEVEL CODE)**:
       **CRITICAL**: Generate enterprise-grade, production-ready code that follows industry best practices:
       
       **Framework & Structure**:
       - Use React 18+ with modern hooks (useState, useEffect, useCallback, useMemo)
       - Implement component-based architecture with proper separation of concerns
       - Use TypeScript-style type annotations in JSDoc comments for type safety
       - Organize code into logical modules/functions
       
       **Code Quality**:
       - Implement comprehensive error handling with try-catch blocks
       - Add input validation and sanitization
       - Use defensive programming patterns
       - Include loading states and error boundaries
       - Add proper null/undefined checks
       - Implement graceful degradation for unsupported features
       
       **State Management**:
       - Use React state patterns (useState for local, useReducer for complex)
       - Implement proper state normalization for data structures
       - Add state persistence where appropriate (localStorage)
       - Handle async state updates correctly
       
       **Performance**:
       - Implement React.memo() or useMemo() for expensive computations
       - Use useCallback() for event handlers passed to children
       - Lazy load heavy components/features
       - Optimize re-renders with proper dependency arrays
       - Implement virtual scrolling for long lists
       - Add debouncing/throttling for user inputs
       
       **User Experience**:
       - Implement proper loading indicators
       - Add skeleton screens for content loading
       - Show meaningful error messages to users
       - Implement optimistic UI updates where appropriate
       - Add keyboard navigation support
       - Ensure responsive design (mobile-first approach)
       
       **Accessibility**:
       - Use semantic HTML5 elements
       - Add ARIA labels and roles where needed
       - Ensure keyboard navigation works
       - Maintain proper focus management
       - Add alt text for images
       - Ensure color contrast meets WCAG standards
       
       **Security**:
       - Sanitize user inputs
       - Implement CSRF protection patterns
       - Use secure data handling practices
       - Avoid XSS vulnerabilities (no innerHTML without sanitization)
       - Implement proper authentication patterns if needed
       
       **API Integration**:
       - Implement proper fetch/axios patterns with error handling
       - Add request cancellation for cleanup
       - Implement retry logic with exponential backoff
       - Handle network errors gracefully
       - Show appropriate loading/error states
       
       **Styling**:
       - Use Tailwind CSS utility classes
       - Implement consistent design system (spacing, colors, typography)
       - Add dark mode support using CSS variables
       - Ensure responsive breakpoints (sm, md, lg, xl)
       - Use CSS Grid/Flexbox for layouts
       
       **ASSETS GENERATION - CRITICAL REQUIREMENT**:
       The prototype MUST include high-quality visual and audio assets. DO NOT use placeholder text or empty spaces.
       
       **Graphics & Images** (REQUIRED for all prototypes):
       - Generate actual visual assets: icons, illustrations, product images, UI graphics
       - Use high-quality image sources:
         * Unsplash API: https://source.unsplash.com/ (e.g., https://source.unsplash.com/800x600/?keyword)
         * Pexels API: https://images.pexels.com/photos/ (with proper photo IDs)
         * Or embed SVG graphics directly in the HTML (for icons, logos, illustrations)
         * Or use base64-encoded images for small graphics (logos, icons)
       - For e-commerce: Include actual product images with proper alt text
       - For dashboards: Include charts, graphs, and data visualizations (use Chart.js CDN or similar)
       - For games: Include sprite graphics, backgrounds, UI elements (use Canvas drawing or SVG)
       - For social media: Include profile pictures, post images, cover photos
       - For portfolios: Include project screenshots, work samples
       - NEVER use placeholder text like "Image here" or empty divs - always include actual visual content
       - Ensure all images are responsive and properly sized
       
       **Audio Assets** (REQUIRED for games, music apps, or apps with sound):
       - **GAMES**: Include sound effects (button clicks, game actions, background music)
         * Use Web Audio API or HTML5 Audio elements
         * Include actual audio files via:
           - Base64-encoded audio data URIs for small sound effects
           - CDN URLs from free audio sources (freesound.org, zapsplat.com API, etc.)
           - Or generate procedural audio using Web Audio API oscillators
       - **MUSIC APPS**: Include sample audio tracks for playback
         * Use high-quality audio sources (CDN URLs or embedded audio players)
         * Include playlist with multiple tracks
         * Add waveform visualizations using Canvas or Web Audio API
       - **NOTIFICATIONS/ALERTS**: Include notification sounds, alert tones
       - For all audio: Add play/pause controls, volume controls, and proper state management
       - Handle audio loading errors gracefully with fallbacks
       
       **Video Assets** (REQUIRED for video platforms, tutorials, or media apps):
       - Include actual video content:
         * Use embedded videos from YouTube, Vimeo, or other CDN sources
         * Or use HTML5 <video> elements with CDN video URLs
         * Include video thumbnails and preview images
       - For video platforms: Include sample videos in playlists
       - For tutorials: Include instructional video content
       - Ensure videos are responsive and have proper controls
       
       **Gaming Features** (if applicable):
       - Write the COMPLETE game loop in JS (Canvas/WebGL)
       - Add controls (Arrow keys/Mouse/Touch) with proper event handling
       - Implement game state management
       - Add collision detection and physics
       - Include score tracking and game over logic
       - Include visual game assets: sprites, backgrounds, particle effects, UI elements
       - Include audio: background music, sound effects for all game actions
       - Make the game visually appealing with animations and effects
       
       **Asset Quality Standards**:
       - All graphics must be professional, high-quality, and relevant to the project
       - Audio must be clear and appropriate for the context
       - Videos must be relevant and properly formatted
       - Use actual content, not placeholders or lorem ipsum for images
       - Ensure assets enhance the user experience and demonstrate the app's purpose
       
       **Functionality Requirements**:
       - All interactive elements must work (buttons, forms, navigation)
       - Forms must have proper validation and submission handling
       - Navigation/routing must be functional
       - Data must persist appropriately (localStorage/IndexedDB)
       - Real-time features should use proper patterns (WebSockets/polling)
       
       **Code Style**:
       - Follow ESLint/Prettier conventions
       - Use meaningful variable/function names
       - Add JSDoc comments for complex functions
       - Keep components small and focused (Single Responsibility)
       - Use proper indentation and formatting
       
       **Output Format**:
       - Return a SINGLE HTML file with embedded <script> and <style> tags
       - Use CDN links for React 18 (unpkg.com/react@18/umd/react.production.min.js, react-dom)
       - Include Tailwind CSS via CDN (cdn.tailwindcss.com)
       - The code MUST be immediately functional when loaded in a browser
       - **CRITICAL**: Use React.createElement() instead of JSX to avoid Babel dependency. This is preferred for production code.
       - Format code with proper line breaks and indentation (not minified single-line code)
       - Only include Babel standalone if absolutely necessary for JSX, but React.createElement() is strongly recommended.
       - Do NOT wrap in markdown code blocks - return RAW HTML string
       
       **Example Structure**:
       \`\`\`html
       <!DOCTYPE html>
       <html lang="en">
       <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title>Project Name</title>
         <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
         <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
         <script src="https://cdn.tailwindcss.com"></script>
         <style>
           /* Production-grade CSS with proper organization */
         </style>
       </head>
       <body>
         <div id="root"></div>
         <script>
           const { useState, useEffect, useCallback, useMemo, useRef, createElement: h, Fragment } = React;
           // Production-level React code here
         </script>
       </body>
       </html>
       \`\`\`
       
       **Quality Checklist**:
       - [ ] All features are fully functional
       - [ ] Error handling is comprehensive
       - [ ] Code follows React best practices
       - [ ] Performance optimizations are in place
       - [ ] Accessibility standards are met
       - [ ] Responsive design works on all screen sizes
       - [ ] Security best practices are followed
       - [ ] Code is clean, readable, and maintainable
       - [ ] State management is properly implemented
       - [ ] User experience is polished and professional
       - [ ] **INCLUDE HIGH-QUALITY ASSETS**: Graphics, images, audio, and video as needed
       - [ ] **NO PLACEHOLDERS**: All visual elements must have actual content, not placeholder text
       - [ ] **PROFESSIONAL APPEARANCE**: Assets must be professional, relevant, and enhance UX
       
       REMEMBER: This must be PRODUCTION-READY code that could be deployed to users, not a basic prototype. The prototype should look and feel like a real, polished application with proper graphics, audio, and video assets where appropriate.
       
    6. **Risks**: Top 3 technical risks.
    7. **Methodology**: Use the methodology "${recommendedMethodology}"
    
    **IMPORTANT**: This is an agentic AI system that works autonomously. DO NOT include human effort estimates, time estimates, sprint estimates, or duration estimates (e.g., "~24 weeks", "8 sprints", "6 months", "estimated timeline") in any field, including the summary. Focus on technical specifications, architecture, and implementation details only.
    
    Return a valid JSON object with these fields.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
        wireframeCode: { type: Type.STRING },
        architectureDiagram: { type: Type.STRING },
        risks: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendedMethodology: { type: Type.STRING },
        recommendedStandards: { type: Type.ARRAY, items: { type: Type.STRING } },
        // estimatedSprints: { type: Type.NUMBER }, // Removed - agentic AI system doesn't use human effort estimates
        projectName: { type: Type.STRING },
        mobileCode: {
          type: Type.OBJECT,
          properties: {
            reactNative: { type: Type.STRING },
            flutter: { type: Type.STRING },
            iosSwift: { type: Type.STRING },
            androidKotlin: { type: Type.STRING }
          }
        }
      },
      required: ["summary", "techStack", "wireframeCode", "architectureDiagram", "risks", "recommendedMethodology", "projectName"]
    };

    // Check cache
    const cachedPreview = responseCache.get(
      `${userGoal}\n\n${limitedConversationText.substring(0, 500)}`,
      'preview-generation',
      undefined,
      { type: 'preview', projectName }
    );

    let result: any;
    let modelUsed = 'gemini-3-pro-preview';
    let provider = 'gemini';
    const startTime = Date.now();

    if (cachedPreview) {
      try {
        result = JSON.parse(cachedPreview.response);
        modelUsed = cachedPreview.modelId;
        provider = cachedPreview.provider;
        logger.info(`[Preview Cache] Cache HIT - saved $${cachedPreview.cost.toFixed(6)}`);
      } catch (parseError) {
        logger.warn('[Preview Cache] Failed to parse cached response, generating new preview');
      }
    }

    // Generate new preview if not cached
    if (!result) {
      try {
        // Use LLM router to select best model, then use structured output
        // For structured output, we need models that support it
        const { taskAnalyzer } = await import('../services/llm/TaskAnalyzer.js');
        const taskAnalysis = taskAnalyzer.analyzeTask(
          prompt.substring(0, 500),
          'structured-output',
          { agentRole: 'Design/Architecture Agent' }
        );

        // Whitelist of Gemini models that definitely support JSON mode (structured output)
        // Note: gemini-2.5-flash does NOT support JSON mode, so it's excluded
        const JSON_MODE_SUPPORTED_MODELS = [
          'gemini-2.5-pro',
          'gemini-3-pro-preview',
          'gemini-3-pro',
          'gemini-2.0-flash-exp',
          'gemini-1.5-pro', // Deprecated but still supports JSON mode
          'gemini-2.0-flash-thinking-exp'
        ];

        // Get Gemini models that support structured output
        // Exclude TTS (text-to-speech) models as they only support audio output
        const allModels = modelRegistry.getActiveModels();
        const geminiStructuredModels = allModels.filter(m => {
          const modelId = m.modelIdentifier.toLowerCase();
          // Must be Gemini provider
          if (m.provider !== 'gemini') return false;
          // Must have structuredOutput capability
          if (!m.capabilities.structuredOutput) return false;
          // Must be in the whitelist of models that actually support JSON mode
          const isWhitelisted = JSON_MODE_SUPPORTED_MODELS.some(whitelisted =>
            modelId.includes(whitelisted.toLowerCase())
          );
          if (!isWhitelisted) return false;
          // Exclude TTS and audio-only models
          if (modelId.includes('tts') || modelId.includes('audio-only')) return false;
          return true;
        });

        let selectedModel;
        if (geminiStructuredModels.length > 0) {
          // Select cost-optimized model
          const scoredModels = geminiStructuredModels.map(model => {
            const estimatedCost = (taskAnalysis.estimatedTokens / 1_000_000) *
              (model.pricing.inputCostPer1MTokens + model.pricing.outputCostPer1MTokens);
            return { model, cost: estimatedCost, latency: model.performance.avgLatencyMs };
          });

          scoredModels.sort((a, b) => {
            if (Math.abs(a.cost - b.cost) < 0.0001) {
              return a.latency - b.latency;
            }
            return a.cost - b.cost;
          });

          selectedModel = scoredModels[0].model;
          logger.info(`[Preview] Selected model via LLM router: ${selectedModel.modelIdentifier}`);
        } else {
          // Fallback to a known working model that supports structured output
          // Prefer gemini-2.5-pro or gemini-3-pro-preview over gemini-2.5-flash for structured output
          logger.warn(`[Preview] No structured output models found, using fallback: gemini-2.5-pro`);
          selectedModel = { modelIdentifier: 'gemini-2.5-pro' };
        }

        // Use Gemini's structured output with selected model
        // This is still routing through LLM router's model selection, just using structured output API
        result = await geminiService.generateStructuredOutput(prompt, responseSchema, selectedModel.modelIdentifier);
        modelUsed = selectedModel.modelIdentifier;
        provider = 'gemini';

        // Cache the result
        try {
          const estimatedInputTokens = Math.ceil(prompt.length / 4);
          const estimatedOutputTokens = Math.ceil(JSON.stringify(result).length / 4);
          const totalTokens = estimatedInputTokens + estimatedOutputTokens;
          const model = modelRegistry.getModel(modelUsed);
          const inputCost = model ? (estimatedInputTokens / 1_000_000) * model.pricing.inputCostPer1MTokens : 0;
          const outputCost = model ? (estimatedOutputTokens / 1_000_000) * model.pricing.outputCostPer1MTokens : 0;
          const totalCost = inputCost + outputCost;

          responseCache.set(
            `${userGoal}\n\n${limitedConversationText.substring(0, 500)}`,
            'preview-generation',
            JSON.stringify(result),
            { input: estimatedInputTokens, output: estimatedOutputTokens, total: totalTokens },
            totalCost,
            provider,
            undefined,
            { type: 'preview', projectName },
            3600000
          );
        } catch (cacheError) {
          logger.warn('Failed to cache preview result:', cacheError);
        }
      } catch (error: any) {
        logger.error('Preview generation failed:', error);
        throw new Error(`Preview generation failed: ${error.message || 'Model unavailable'}`);
      }
    }

    const latency = Date.now() - startTime;

    // Validate result
    if (!result || typeof result !== 'object') {
      throw new Error('Preview generation failed: Invalid response format');
    }

    // Validate required fields are present and not empty
    const missingFields: string[] = [];
    if (!result.summary || typeof result.summary !== 'string' || result.summary.trim() === '') {
      missingFields.push('summary');
    }
    if (!result.architectureDiagram || typeof result.architectureDiagram !== 'string' || result.architectureDiagram.trim() === '') {
      missingFields.push('architectureDiagram');
    }
    if (!result.wireframeCode || typeof result.wireframeCode !== 'string' || result.wireframeCode.trim() === '') {
      missingFields.push('wireframeCode');
    }

    if (missingFields.length > 0) {
      logger.error('[Preview] Missing or empty required fields:', missingFields);
      logger.error('[Preview] Result structure:', {
        hasSummary: !!result.summary,
        summaryLength: result.summary?.length || 0,
        hasArchitectureDiagram: !!result.architectureDiagram,
        architectureDiagramLength: result.architectureDiagram?.length || 0,
        hasWireframeCode: !!result.wireframeCode,
        wireframeCodeLength: result.wireframeCode?.length || 0,
        hasMobileCode: !!result.mobileCode
      });
      throw new Error(`Preview generation failed: Missing or empty required fields: ${missingFields.join(', ')}. The LLM may not have generated complete content.`);
    }

    // Ensure arrays
    if (!Array.isArray(result.techStack)) {
      result.techStack = result.techStack ? [result.techStack] : [];
    }
    if (!Array.isArray(result.risks)) {
      result.risks = result.risks ? [result.risks] : [];
    }

    // Override with SDLC service recommendations
    result.recommendedMethodology = recommendedMethodology;
    // Note: estimatedSprints removed - this is an agentic AI system, not human effort estimation
    // result.estimatedSprints = estimatedSprints;

    if (recommendedStandards.length > 0) {
      result.recommendedStandards = recommendedStandards;
    } else if (!Array.isArray(result.recommendedStandards)) {
      result.recommendedStandards = getFallbackStandards(fullDescription, userGoal);
    }

    // Add architecture analysis to result if available
    if (architectureAnalysis) {
      result.backendArchitecture = architectureAnalysis.backendArchitecture;
      result.adminConsole = architectureAnalysis.adminConsole;
      result.infrastructure = architectureAnalysis.infrastructure;
      result.securityArchitecture = architectureAnalysis.securityArchitecture;
      result.databaseArchitecture = architectureAnalysis.databaseArchitecture;
      result.apiDesign = architectureAnalysis.apiDesign;
    }

    // Track usage
    try {
      await usageTracker.trackUsage({
        userId: (req as any).user?.userId,
        projectId: (req.body as any).projectId,
        modelId: modelUsed,
        provider: 'gemini',
        modelIdentifier: modelUsed,
        inputTokens: 0, // Structured output doesn't provide exact tokens
        outputTokens: 0,
        requestType: 'project-preview',
        context: 'wizard',
        success: true,
        latencyMs: latency
      });
    } catch (trackError) {
      logger.error('Failed to track usage for project preview:', trackError);
    }

    res.json({
      success: true,
      data: result,
      latency: latency
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Generate preview failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate project preview',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    });
  }
});

/**
 * Chat endpoint - routes through LLM router
 * Optimized for fast responses with 30 second timeout
 */
router.post('/chat', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
  try {
    const { message, history, projectState, contextType, agentRole, systemContext } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        message: 'message is required'
      });
      return;
    }

    logger.info(`[LLMRouter] Chat request received for agent: ${agentRole || 'Orchestrator'}`);

    // Build chat prompt from history
    let chatPrompt = history && history.length > 0
      ? `${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\nuser: ${message}`
      : message;

    // INTERNET RESEARCH INJECTION
    // If enabled, perform research first and inject context
    const useInternet = req.body.useInternet === true;
    const researchTopic = req.body.researchTopic || message;

    if (useInternet) {
      try {
        logger.info(`[LLMRouter] Performing internet research for chat topic: ${researchTopic.substring(0, 50)}...`);
        const researchPrompt = `Find the latest trends, technologies, and innovative examples for: "${researchTopic}"
        
        Focus on:
        1. Current market trends (2024-2025)
        2. Innovative features/mechanics
        3. Popular examples/competitors
        4. Technical best practices
        
        Keep concise/bulleted.`;

        const researchResult = await llmRouter.executeWithFallback({
          prompt: researchPrompt,
          context: { agentRole: 'Research Agent', taskType: 'research' },
          routingContext: { userId: (req as any).user?.id },
          requestType: 'research',
          contextType: 'wizard',
          useInternet: true
        });

        if (researchResult.text) {
          const researchContext = `\n\n[REAL-TIME RESEARCH CONTEXT]\nThe following information was just retrieved from the internet to help with this request:\n${researchResult.text}\n[END RESEARCH CONTEXT]\n\n`;
          chatPrompt = researchContext + chatPrompt;
          logger.info(`[LLMRouter] Research injected (${researchResult.text.length} chars)`);
        }
      } catch (err) {
        logger.warn('[LLMRouter] Chat research failed, proceeding without it:', err);
      }
    }

    // Determine system instruction
    let systemInstruction = systemContext;

    // Add wizard-specific context to help AI decide when ready if not provided
    const isWizardContext = contextType === 'wizard' || (!projectState?.id && !systemContext);

    if (isWizardContext && !systemInstruction) {
      const conversationLength = history?.length || 0;
      const collectedInfo = conversationLength >= 4;

      const wizardInstructions = `\n\n[WIZARD MODE - Project Setup Assistant]
You are an engaging, friendly AI assistant helping a user describe their project idea. Your goal is to have a natural, conversational dialogue that helps them think through their project.

RESPONSE LENGTH:
- **Give SHORT, concise answers by default** (1-3 sentences)
- Only provide longer, detailed answers if the user explicitly asks for more detail, explanation, or a "long answer"
- Keep responses brief and focused to maintain a natural brainstorming flow
- This is a brainstorming session - be quick and conversational, not verbose

YOUR APPROACH:
1. **Be conversational and curious** - Ask follow-up questions based on what they tell you. Show genuine interest in their idea.
2. **Dig deeper** - When they mention something, ask "why" or "how" to understand their motivations and goals better.
3. **Be specific** - Instead of generic questions, ask targeted questions based on their previous answers.
4. **Show enthusiasm** - Use emojis sparingly, be encouraging, and celebrate their ideas.
5. **Guide the conversation** - Make sure to cover: project type, target audience, key features, technical preferences (if any), timeline, and any constraints.
6. **Keep it brief** - Short answers help maintain brainstorming momentum. Only elaborate if asked.

INFORMATION TO GATHER:
- What type of project (web app, mobile app, API, etc.)
- Who is the target audience
- What are the main features/functionality
- Any technology preferences
- Timeline expectations
- Budget considerations (if relevant)
- Special requirements (accessibility, performance, security, etc.)

WHEN TO INDICATE READINESS:
After you have gathered sufficient information (typically after 6-8 meaningful exchanges with the user), you can indicate readiness by saying phrases like:
- "I have enough information to generate your project blueprint"
- "I can now generate your project preview"
- "Perfect! I have everything I need to get started"
- "I'm ready to generate your project architecture"

IMPORTANT: Only indicate readiness after having a substantial conversation (6+ exchanges). Don't indicate readiness too early - continue asking questions to understand their project better.

CONVERSATION STYLE:
- Ask ONE question at a time (don't overwhelm)
- Build on their previous answers
- If they give a short answer, ask for more details
- If they're vague, ask for specifics
- Be warm, helpful, and encouraging

Current conversation length: ${conversationLength} messages
${conversationLength >= 6 ? 'NOTE: You have had a substantial conversation. Consider if you have enough information to proceed.' : ''}
${conversationLength < 3 ? 'NOTE: This is early in the conversation. Ask engaging, specific questions to understand their project better.' : ''}
${conversationLength >= 4 && conversationLength < 6 ? 'NOTE: You have good information. Consider asking 1-2 more clarifying questions, then indicate readiness.' : ''}

User's latest message: ${message}`;
    }

    // Optimize for fast responses - prefer fast models for conversation analysis
    const preferFastModel = req.body.preferFastModel === true;
    const maxTokens = req.body.maxTokens;

    const result = await llmRouter.executeWithFallback({
      prompt: chatPrompt,
      context: {
        agentRole: agentRole || 'Orchestrator',
        taskType: preferFastModel ? 'prompt-enhancement' : 'chat', // Use 'prompt-enhancement' to target Flash models which are recommended for this type
        maxTokens: maxTokens, // Limit tokens for faster responses
        systemInstruction: systemInstruction
      },
      routingContext: {
        userId: (req as any).user?.id,
        projectId: projectState?.id,
        userPreferences: preferFastModel ? {
          costPreference: 'low' // Prefer cheaper/faster models
        } : undefined
      },
      requestType: 'chat',
      contextType: isWizardContext ? 'wizard' : 'general'
    });

    res.json({
      success: true,
      response: result.text,
      usage: result.usage,
      modelUsed: result.modelUsed,
      provider: result.provider
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Chat failed:', error);
    res.status(500).json({
      success: false,
      message: 'Chat request failed',
      error: error.message
    });
  }
});

/**
 * Streaming chat endpoint - routes through LLM router with Server-Sent Events
 */
router.post('/chat/stream', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
  try {
    const { message, history, projectState, contextType, preferFastModel, maxTokens, systemContext, useInternet } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        message: 'message is required'
      });
      return;
    }

    logger.info('[LLMRouter] Streaming chat request received');

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Build chat prompt from history
    let chatPrompt = history && history.length > 0
      ? `${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\nuser: ${message}`
      : message;

    // Use custom system context if provided (overrides default wizard context)
    let systemInstruction = systemContext;

    // Determine context type
    const isWizardContext = contextType === 'wizard' || (!projectState?.id && !systemContext);

    if (!systemContext && isWizardContext) {
      const conversationLength = history?.length || 0;

      systemInstruction = `[WIZARD MODE - Project Setup Assistant]
  You are an engaging, friendly AI assistant helping a user describe their project idea. Your goal is to have a natural, conversational dialogue that helps them think through their project.
  
  RESPONSE LENGTH:
  - **Give SHORT, concise answers by default** (1-3 sentences)
  - Only provide longer, detailed answers if the user explicitly asks for more detail, explanation, or a "long answer"
  - Keep responses brief and focused to maintain a natural brainstorming flow
  - This is a brainstorming session - be quick and conversational, not verbose
  
  YOUR APPROACH:
  1. **Be conversational and curious** - Ask follow-up questions based on what they tell you. Show genuine interest in their idea.
  2. **Dig deeper** - When they mention something, ask "why" or "how" to understand their motivations and goals better.
  3. **Be specific** - Instead of generic questions, ask targeted questions based on their previous answers.
  4. **Show enthusiasm** - Use emojis sparingly, be encouraging, and celebrate their ideas.
  5. **Guide the conversation** - Make sure to cover: project type, target audience, key features, technical preferences (if any), timeline, and any constraints.
  6. **Keep it brief** - Short answers help maintain brainstorming momentum. Only elaborate if asked.
  
  INFORMATION TO GATHER:
  - What type of project (web app, mobile app, API, etc.)
  - Who is the target audience
  - What are the main features/functionality
  - Any technology preferences
  - Timeline expectations
  - Budget considerations (if relevant)
  - Special requirements (accessibility, performance, security, etc.)
  - **PROJECT AGNOSTIC**: You handle ANY software project (Web, Mobile, Game, data, etc.). Do not assume one type unless the user specifies.
  
  WHEN TO INDICATE READINESS:
  After you have gathered sufficient information (typically after 6-8 meaningful exchanges with the user), you can indicate readiness by saying phrases like:
  - "I have enough information to generate your project blueprint"
  - "I can now generate your project preview"
  - "Perfect! I have everything I need to get started"
  - "I'm ready to generate your project architecture"
  
  IMPORTANT: Only indicate readiness after having a substantial conversation (6+ exchanges). Don't indicate readiness too early - continue asking questions to understand their project better.
  
  CONVERSATION STYLE:
  - Ask ONE question at a time (don't overwhelm)
  - Build on their previous answers
  - If they give a short answer, ask for more details
  - If they're vague, ask for specifics
  - Be warm, helpful, and encouraging
  
  Current conversation length: ${conversationLength} messages
  ${conversationLength >= 6 ? 'NOTE: You have had a substantial conversation. Consider if you have enough information to proceed.' : ''}
  ${conversationLength < 3 ? 'NOTE: This is early in the conversation. Ask engaging, specific questions to understand their project better.' : ''}
  ${conversationLength >= 4 && conversationLength < 6 ? 'NOTE: You have good information. Consider asking 1-2 more clarifying questions, then indicate readiness.' : ''}
  
  User's latest message: ${message}`;
    }


    try {
      // Stream the response
      const stream = llmRouter.executeWithFallbackStream({
        prompt: chatPrompt,
        context: {
          agentRole: 'Orchestrator',
          taskType: preferFastModel ? 'analysis' : 'chat',
          maxTokens: maxTokens,
          systemInstruction: systemInstruction // Pass explicitly here!
        },
        routingContext: {
          userId: (req as any).user?.id,
          projectId: projectState?.id,
          userPreferences: preferFastModel ? {
            costPreference: 'low'
          } : undefined
        },
        requestType: 'chat',
        contextType: isWizardContext ? 'wizard' : 'general',
        useInternet: useInternet === true // Pass internet research flag
      });

      // Send chunks as they arrive
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (streamError: any) {
      logger.error('[LLMRouter] Streaming error:', streamError);
      res.write(`data: ${JSON.stringify({ error: streamError.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    logger.error('[LLMRouter] Streaming chat setup failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Streaming chat request failed',
        error: error.message
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  }
});

/**
 * Generate embedding - uses LLM router
 */
router.post('/generate-embedding', async (req: AuthRequest, res, _next) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        message: 'text is required'
      });
      return;
    }

    // Embeddings typically use specific models, but route through router for consistency
    const embedding = await embeddingService.generateEmbedding(text);

    res.json({
      success: true,
      embedding
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Embedding generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate embedding',
      error: error.message
    });
  }
});

/**
 * Enhance prompt - routes through LLM router
 */
router.post('/enhance-prompt', async (req: AuthRequest, res, _next) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({
        success: false,
        message: 'prompt is required'
      });
      return;
    }

    const enhancementPrompt = `Enhance and improve the following prompt to be more clear, specific, and effective:\n\n${prompt}\n\nReturn only the enhanced prompt, no additional explanation.`;

    const result = await llmRouter.executeWithFallback({
      prompt: enhancementPrompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'text-generation'
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'prompt-enhancement',
      contextType: 'other'
    });

    res.json({
      success: true,
      enhancedPrompt: result.text,
      modelUsed: result.modelUsed,
      provider: result.provider
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Prompt enhancement failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enhance prompt',
      error: error.message
    });
  }
});

/**
 * Execute task - routes through LLM router with function calling support
 */
router.post('/execute-task', routeTimeout(300000), async (req: AuthRequest, res, _next) => {
  try {
    const { task, projectState, useInternet, mcpServers, selectedStandards } = req.body;

    if (!task) {
      res.status(400).json({
        success: false,
        message: 'task is required'
      });
      return;
    }

    logger.info(`[LLMRouter] Executing task: ${task.title}`);

    // Build tools for function calling
    const tools = []; // Function definitions would be built here

    const result = await llmRouter.executeWithFallback({
      prompt: task.description || task.title,
      context: {
        agentRole: task.assignedTo || 'Implementation Agent',
        taskType: 'code-generation',
        tools: tools.length > 0 ? tools : undefined,
        systemInstruction: `You are executing a task: ${task.title}`
      },
      routingContext: {
        userId: (req as any).user?.id,
        projectId: projectState?.id
      },
      requestType: 'task-execution',
      contextType: 'workspace',
      useInternet: useInternet || false
    });

    // Process function calls if present
    const responseWithFunctionCalls = result as LLMResponseWithFunctionCalls;
    if (responseWithFunctionCalls.functionCalls && responseWithFunctionCalls.functionCalls.length > 0) {
      const processedResult = await functionCallProcessor.processFunctionCalls(
        responseWithFunctionCalls.functionCalls,
        projectState,
        mcpServers || []
      );

      res.json({
        success: true,
        output: processedResult.output,
        resources: result.resources || [], // URLs from Google Search grounding
        functionCalls: processedResult.functionCalls,
        modelUsed: result.modelUsed,
        provider: result.provider
      });
      return;
    }

    // Parse output for detected issues and create tasks
    let createdTasks: any[] = [];
    const outputText = result.text || result.content || '';

    // ⭐ CALCULATE QUALITY SCORE ⭐
    // This is where the AI Quality Score is calculated
    let evaluation;
    if (outputText && outputText.trim().length >= 50) {
      try {
        evaluation = await evaluationService.evaluateTaskOutput({
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          agentRole: task.assignedTo || 'Implementation Agent',
          output: outputText,
          standards: selectedStandards || [],
          projectContext: projectState?.description || ''
        });
        logger.info(`[LLMRouter] Evaluation completed for task "${task.title}" - Score: ${evaluation.score}/100`);
      } catch (evalError: any) {
        logger.warn('[LLMRouter] Evaluation failed, using quick evaluate:', evalError);
        try {
          evaluation = await evaluationService.quickEvaluate(outputText, task.description || '');
        } catch (quickEvalError: any) {
          logger.error('[LLMRouter] Quick evaluation also failed:', quickEvalError);
          // Return pending evaluation if both fail
          evaluation = {
            score: 0,
            reasoning: 'Evaluation service encountered an error. Quality score will be calculated on retry.',
            criteria: ['Evaluation Error'],
            timestamp: Date.now()
          };
        }
      }
    } else {
      // Output too short - return pending evaluation
      evaluation = {
        score: 0,
        reasoning: 'Output is too short to evaluate meaningfully. Please provide more substantial output.',
        criteria: ['Output Length'],
        timestamp: Date.now()
      };
    }

    if (outputText && projectState?.id && (req as any).user?.id) {
      try {
        const { issueParserService } = await import('../services/issueParser.service.js');
        const { issueTaskCreationService } = await import('../services/issueTaskCreation.service.js');

        // Parse issues from agent output
        const detectedIssues = issueParserService.parseIssuesFromOutput(
          outputText,
          task.assignedTo || 'Implementation Agent',
          task.id // Use task ID as artifact reference
        );

        // Create tasks for detected issues (only critical/high severity to avoid spam)
        const importantIssues = detectedIssues.filter(
          issue => issue.severity === 'critical' || issue.severity === 'high'
        );

        if (importantIssues.length > 0) {
          const taskResults = await issueTaskCreationService.createTasksForIssues(
            projectState.id,
            importantIssues,
            (req as any).user.id
          );

          createdTasks = taskResults
            .filter(r => r.created)
            .map(r => ({ taskId: r.taskId, message: r.message }));

          if (createdTasks.length > 0) {
            logger.info(`[LLMRouter] Created ${createdTasks.length} tasks for detected issues`);
          }
        }
      } catch (issueError: any) {
        // Log but don't fail the task execution if issue parsing fails
        logger.warn('[LLMRouter] Failed to parse issues or create tasks:', issueError);
      }
    }

    res.json({
      success: true,
      data: {
        output: outputText,
        evaluation: evaluation, // ⭐ Quality score calculated here
        resources: result.resources || [], // URLs from Google Search grounding
        usage: result.usage,
        modelUsed: result.modelUsed,
        provider: result.provider,
        createdTasks: createdTasks.length > 0 ? createdTasks : undefined
      },
      // Also include at top level for backward compatibility
      output: outputText,
      evaluation: evaluation, // ⭐ Quality score at top level too
      resources: result.resources || [], // URLs from Google Search grounding
      usage: result.usage,
      modelUsed: result.modelUsed,
      provider: result.provider
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Task execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Task execution failed',
      error: error.message
    });
  }
});

/**
 * Generate agent profile - routes through LLM router
 */
router.post('/generate-agent-profile', async (req: AuthRequest, res, _next) => {
  try {
    const { role, context: projectContext } = req.body;

    if (!role || !projectContext) {
      res.status(400).json({
        success: false,
        message: 'role and context are required'
      });
      return;
    }

    logger.info(`[LLMRouter] Generating agent profile for role: ${role}`);

    const prompt = `Generate a detailed profile for a ${role} agent working on this project: ${projectContext}

Return a JSON object with:
- name: A professional name for this agent
- role: The exact role (use: ${role})
- description: A brief description of the agent's expertise (2-3 sentences)
- goal: The agent's primary goal (1 sentence)
- backstory: A brief backstory explaining the agent's experience (2-3 sentences)

Be specific to the project context and role.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        role: { type: Type.STRING },
        description: { type: Type.STRING },
        goal: { type: Type.STRING },
        backstory: { type: Type.STRING }
      },
      required: ['name', 'role', 'description', 'goal', 'backstory']
    };

    const startTime = Date.now();

    // Use LLM router with structured output support
    // For structured output, we need to use a model that supports it
    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'structured',
        model: 'gemini-2.5-pro' // Use model that supports structured output
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'agent-profile-generation',
      contextType: 'other'
    });

    // Parse structured output from text response
    let agentProfile;
    try {
      agentProfile = JSON.parse(result.text);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        agentProfile = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse agent profile JSON');
      }
    }

    const finalProfile = {
      id: Math.random().toString(36).substring(7),
      name: agentProfile.name || role.split(' ')[0],
      role: agentProfile.role || role,
      mode: 'deterministic',
      avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${role}`,
      description: agentProfile.description || "Specialist Agent",
      goal: agentProfile.goal || "Execute tasks efficiently.",
      backstory: agentProfile.backstory || "Experienced AI agent."
    };

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Agent profile generated in ${latency}ms`);

    res.json({
      success: true,
      data: finalProfile,
      latency: latency,
      modelUsed: result.modelUsed,
      provider: result.provider
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Agent profile generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate agent profile',
      error: { message: error.message || 'Unknown error' }
    });
  }
});

/**
 * Quick suggestions endpoint - optimized for speed
 */
router.post('/quick-suggestions', async (req: AuthRequest, res, _next) => {
  try {
    const { input, history } = req.body;

    if (!input || input.trim().length < 3) {
      res.json({
        success: true,
        data: []
      });
      return;
    }

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              prompt: { type: Type.STRING }
            },
            required: ['label', 'prompt']
          }
        }
      },
      required: ['suggestions']
    };

    const conversationText = (history || [])
      .slice(-5)
      .map((m: any) => `${m.sender}: ${m.text}`)
      .join('\n')
      .substring(0, 800);

    const prompt = `You are an AI assistant helping a user refine their project idea. The user has typed: "${input}"

${conversationText ? `Previous conversation context:\n${conversationText}\n\n` : ""}Your task is to generate 3-5 ENHANCED and RELEVANT versions of their project idea. Each suggestion must:

1. **Build directly on their input** - Don't create unrelated ideas. Enhance what they wrote, don't replace it.
2. **Add relevant specifics** - Include:
   - Key features that make sense for this type of project
   - Technical considerations (platform, architecture, integrations)
   - User experience elements
   - Business/functional requirements
3. **Stay focused** - Each suggestion should be a variation/improvement of their core idea, not a completely different project.
4. **Be actionable** - Ready to use as a complete project description (2-4 sentences).

Examples:
- If user says "todo app" → suggest variations like "Todo app with categories and due dates", "Collaborative team todo app", "Todo app with calendar integration"
- If user says "e-commerce site" → suggest "E-commerce platform with payment integration", "E-commerce with inventory management", "E-commerce with customer reviews"

DO NOT suggest completely unrelated projects. Each suggestion must be clearly connected to their original idea.

Return a JSON array with label (short 2-4 words) and prompt (enhanced description).`;

    const startTime = Date.now();

    // Use LLM router with fast model for quick suggestions
    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'structured',
        model: 'gemini-2.5-pro' // Use model that supports structured output
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'quick-suggestions',
      contextType: 'wizard'
    });

    // Parse structured output
    let parsedResult;
    try {
      parsedResult = JSON.parse(result.text);
    } catch (parseError) {
      const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[1]);
      } else {
        parsedResult = { suggestions: [] };
      }
    }

    const suggestions = parsedResult.suggestions || [];
    const latency = Date.now() - startTime;

    // Track usage
    try {
      await usageTracker.trackUsage({
        userId: (req as any).user?.userId,
        modelId: result.modelUsed,
        provider: result.provider,
        modelIdentifier: result.modelUsed,
        inputTokens: result.usage?.promptTokens || result.usage?.promptTokenCount || 0,
        outputTokens: result.usage?.candidatesTokens || result.usage?.candidatesTokenCount || 0,
        requestType: 'quick-suggestions',
        context: 'wizard',
        success: true,
        latencyMs: latency
      });
    } catch (trackError) {
      logger.error('Failed to track usage for quick suggestions:', trackError);
    }

    res.json({
      success: true,
      data: suggestions,
      latency: latency
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Quick suggestions failed:', error);
    // Don't fail - return empty array so UI doesn't break
    res.json({
      success: true,
      data: [],
      error: error.message
    });
  }
});

/**
 * Generate app theme (for theme studio)
 */
router.post('/generate-theme', async (req: AuthRequest, res, _next) => {
  try {
    const { description, projectContext } = req.body;

    if (!description || !description.trim()) {
      res.status(400).json({
        success: false,
        message: 'description is required'
      });
      return;
    }

    logger.info('[LLMRouter] Generating comprehensive theme with assets:', description);

    const projectType = detectProjectType(projectContext || '');
    const isGame = projectType === 'game';
    const isWebsite = projectType === 'website' || projectType === 'web-app';
    const isMobile = projectType === 'mobile-app';

    // Build the comprehensive theme prompt (simplified version - full version is very long)
    const prompt = `You are a creative UI/UX designer and game artist specializing in comprehensive theme design. Generate a complete, immersive theme with full assets based on this user request: "${description}".

IMPORTANT: This can be ANY type of theme - seasonal (Halloween, Christmas), aesthetic (Cyberpunk, Minimalist, Retro), era-based (1950s Diner, Victorian, Futuristic), nature-based (Ocean, Forest, Desert), or any creative concept the user describes.

${projectContext ? `PROJECT CONTEXT: ${projectContext.substring(0, 2000)}\n\n` : ''}
${projectType ? `PROJECT TYPE DETECTED: ${projectType.toUpperCase()}\n\n` : ''}

You must generate a COMPLETE SKIN TRANSFORMATION that includes:
1. Complete Theme Object with colors, fonts, graphics, styles
2. Interactive Prototype HTML (wireframeHtml)
3. Theme CSS (themeCss)
4. Asset Description
5. Character Designs (for games only)
6. Game Mechanics (for games only)
7. UI Assets (for websites/web apps only)

Be creative, immersive, and ensure ALL elements work together cohesively!`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        primary: { type: Type.STRING },
        secondary: { type: Type.STRING },
        accent: { type: Type.STRING },
        background: { type: Type.STRING },
        textColor: { type: Type.STRING },
        fontFamily: { type: Type.STRING },
        graphics: { type: Type.STRING },
        styles: { type: Type.STRING },
        wireframeHtml: { type: Type.STRING },
        themeCss: { type: Type.STRING },
        assetDescription: { type: Type.STRING },
        characterDesigns: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              spriteCss: { type: Type.STRING },
              animations: { type: Type.STRING },
              themeIntegration: { type: Type.STRING },
              mechanics: { type: Type.STRING },
              physics: { type: Type.STRING }
            }
          }
        },
        gameMechanics: {
          type: Type.OBJECT,
          properties: {
            movement: { type: Type.STRING },
            controls: { type: Type.STRING },
            physics: { type: Type.STRING },
            gameplay: { type: Type.STRING },
            progression: { type: Type.STRING },
            interactions: { type: Type.STRING },
            code: { type: Type.STRING }
          }
        },
        uiAssets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              name: { type: Type.STRING },
              svgCode: { type: Type.STRING },
              cssClass: { type: Type.STRING },
              usage: { type: Type.STRING }
            }
          }
        }
      },
      required: ['id', 'label', 'primary', 'secondary', 'accent', 'background', 'textColor', 'fontFamily', 'graphics', 'styles', 'wireframeHtml', 'themeCss', 'assetDescription', 'characterDesigns', 'gameMechanics', 'uiAssets']
    };

    const startTime = Date.now();

    // Use LLM router with structured output model
    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'UX Designer',
        taskType: 'structured',
        model: 'gemini-2.0-flash-exp' // Use model that supports structured output
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'theme-generation',
      contextType: 'other'
    });

    // Parse structured output with robust cleaning
    let theme;

    // Helper to clean malformed JSON from LLM
    const cleanJsonString = (str: string): string => {
      let cleaned = str.trim();
      // Remove markdown code fences
      cleaned = cleaned.replace(/^```(?:json)?[\s\n]*/gi, '').replace(/[\s\n]*```$/gi, '');
      // Fix single quotes to double quotes (but not in strings)
      cleaned = cleaned.replace(/'/g, '"');
      // Fix unquoted keys: { key: value } -> { "key": value }
      cleaned = cleaned.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      // Remove trailing commas before } or ]
      cleaned = cleaned.replace(/,(\s*[\}\]])/g, '$1');
      // Fix "undefined" to null
      cleaned = cleaned.replace(/:\s*undefined\b/g, ': null');
      return cleaned;
    };

    try {
      // First try direct parse
      theme = typeof result.text === 'string' ? JSON.parse(result.text) : result.text;
    } catch (parseError) {
      // Try to extract and clean JSON from response
      let jsonText = result.text;
      const jsonMatch = result.text.match(/```(?:json)?[\s\n]*([\s\S]*?)[\s\n]*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const cleanedJson = cleanJsonString(jsonText);
      try {
        theme = JSON.parse(cleanedJson);
        logger.info('[LLMRouter] Theme JSON parsed after cleaning');
      } catch (cleanParseError) {
        logger.error('[LLMRouter] Failed to parse cleaned theme JSON:', cleanParseError);
        logger.debug('[LLMRouter] Raw JSON text:', jsonText.substring(0, 500));
        // Return a default theme instead of throwing
        theme = {
          id: 'fallback-' + Math.random().toString(36).substring(7),
          label: themeDescription || 'Generated Theme',
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#ec4899',
          background: '#f8fafc',
          textColor: '#1e293b'
        };
        logger.warn('[LLMRouter] Using fallback theme due to JSON parse failure');
      }
    }

    const finalTheme = {
      id: theme.id || 'generated-' + Math.random().toString(36).substring(7),
      label: theme.label || 'AI Generated Theme',
      primary: theme.primary || '#6366f1',
      secondary: theme.secondary || '#8b5cf6',
      accent: theme.accent || '#ec4899',
      background: theme.background || '#f8fafc',
      textColor: theme.textColor || '#1e293b',
      fontFamily: theme.fontFamily || 'system-ui, -apple-system, sans-serif',
      graphics: theme.graphics || '',
      styles: theme.styles || '',
      wireframeHtml: theme.wireframeHtml || '',
      themeCss: theme.themeCss || '',
      assetDescription: theme.assetDescription || '',
      characterDesigns: Array.isArray(theme.characterDesigns) ? theme.characterDesigns : [],
      gameMechanics: theme.gameMechanics || (isGame ? {
        movement: 'Platformer movement with arrow keys/WASD',
        controls: 'Keyboard and touch controls',
        physics: 'Gravity-based physics with collision detection',
        gameplay: 'Collect items, avoid enemies, reach goal',
        progression: 'Score-based progression with level completion',
        interactions: 'Jump, collect, defeat enemies',
        code: '// Game mechanics code will be in wireframeHtml'
      } : null),
      uiAssets: Array.isArray(theme.uiAssets) ? theme.uiAssets : []
    };

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Comprehensive theme with assets generated in ${latency}ms`);

    res.json({
      success: true,
      data: finalTheme,
      latency: latency
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Theme generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate theme',
      error: error.message
    });
  }
});

/**
 * Orchestrate next steps (task generation) - OPTIMIZED FOR SPEED
 */
router.post('/orchestrate', async (req: AuthRequest, res, _next) => {
  try {
    const { phase, description, completedTasks, useInternet, mcpServers, maxTasks, agents } = req.body;

    if (!phase || !description || !agents) {
      res.status(400).json({ success: false, message: 'phase, description, and agents are required' });
      return;
    }

    logger.info(`[LLMRouter] Orchestrating tasks for phase: ${phase}${useInternet ? ' (with internet research)' : ''}`);

    // RESEARCH-BASED: Perform online research if internet is enabled
    let researchContext = '';
    if (useInternet) {
      try {
        logger.info(`[Orchestration] Performing online research for project: ${description.substring(0, 100)}...`);

        const projectKeywords = description
          .split(/\s+/)
          .filter(word => word.length > 4)
          .slice(0, 10)
          .join(' ');

        const researchPrompt = `Research the following project concept and provide current best practices, technologies, and implementation approaches:

Project Description: ${description.substring(0, 1000)}
Key Concepts: ${projectKeywords}

Provide:
1. Current industry best practices for this type of project
2. Recommended technologies and frameworks
3. Common implementation patterns
4. Important considerations and potential challenges
5. Relevant standards or compliance requirements

Keep the research concise and focused on actionable insights for task generation.`;

        // Use LLM router with internet search enabled
        const researchResult = await llmRouter.executeWithFallback({
          prompt: researchPrompt,
          context: {
            agentRole: 'Research Agent',
            taskType: 'research'
          },
          routingContext: {
            userId: (req as any).user?.id
          },
          requestType: 'research',
          contextType: 'workspace',
          useInternet: true
        });

        researchContext = researchResult.text || '';
        if (researchContext) {
          researchContext = researchContext.substring(0, 2000);
        }
        logger.info(`[Orchestration] Research completed: ${researchContext.length} characters`);
      } catch (researchError: any) {
        logger.warn(`[Orchestration] Research failed, continuing without it: ${researchError.message}`);
      }
    }

    // Limit completed tasks to last 3 to reduce prompt size
    const recentCompletedTasks = (completedTasks || []).slice(-3);

    // Use enhanced prompt engineering
    const { enhanceOrchestrationPrompt } = await import('../services/promptEngineering.service.js');
    const enhancedPromptResult = enhanceOrchestrationPrompt(
      phase,
      description,
      recentCompletedTasks,
      agents,
      researchContext,
      maxTasks || 8
    );
    const prompt = enhancedPromptResult.prompt;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        tasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              assignedTo: { type: Type.STRING },
              dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
              traceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "description", "assignedTo"]
          }
        }
      },
      required: ["tasks"]
    };

    // Smart model selection based on complexity
    const complexPhases = ['ARCHITECTURE', 'INTEGRATION', 'TEST_PLANNING'];
    const isComplexPhase = complexPhases.includes(phase.toUpperCase());
    const isLargeTaskCount = (maxTasks || 8) > 12;
    const hasManyAgents = agents.length > 5;
    const shouldUseBetterModel = isComplexPhase || isLargeTaskCount || hasManyAgents;

    const startTime = Date.now();
    let result: any;
    let modelUsed = shouldUseBetterModel ? 'gemini-3-pro-preview' : 'gemini-2.5-pro';
    let attempt = 0;
    const maxRetries = 2;

    while (attempt <= maxRetries) {
      try {
        // Use LLM router with structured output
        const llmResult = await llmRouter.executeWithFallback({
          prompt,
          context: {
            agentRole: 'Orchestrator',
            taskType: 'structured',
            model: modelUsed
          },
          routingContext: {
            userId: (req as any).user?.id
          },
          requestType: 'orchestration',
          contextType: 'workspace'
        });

        // Parse structured output
        try {
          result = JSON.parse(llmResult.text);
        } catch (parseError) {
          const jsonMatch = llmResult.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[1]);
          } else {
            throw new Error('Failed to parse orchestration JSON');
          }
        }

        modelUsed = llmResult.modelUsed;
        break; // Success - exit retry loop
      } catch (error: any) {
        attempt++;
        const isLastAttempt = attempt > maxRetries;

        if (isLastAttempt) {
          logger.error(`[Orchestration] Failed after ${maxRetries + 1} attempts:`, error);
          const errorMsg = error.message?.includes('timeout')
            ? `The orchestration request timed out after ${maxRetries + 1} attempts. This can happen with complex projects or slow API responses. Please try again or reduce the number of tasks.`
            : `Failed to orchestrate tasks: ${error.message || 'Unknown error'}`;
          throw new Error(errorMsg);
        }

        // Switch to fallback model on retry
        modelUsed = shouldUseBetterModel ? 'gemini-2.5-pro' : 'gemini-3-pro-preview';
        logger.warn(`[Orchestration] Attempt ${attempt} failed, retrying with ${modelUsed}...`);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 2000)));
      }
    }

    const latency = Date.now() - startTime;
    const taskCount = result.tasks?.length || 0;

    logger.info(`[LLMRouter] Orchestration completed in ${latency}ms using ${modelUsed}, generated ${taskCount} tasks`);

    // Track usage
    try {
      const userId = (req as AuthRequest).user?.id;
      if (userId) {
        usageTracker.trackUsage({
          userId,
          modelId: modelUsed,
          provider: 'gemini',
          modelIdentifier: modelUsed,
          inputTokens: 0, // Will be tracked by LLM router
          outputTokens: 0,
          requestType: 'orchestration',
          context: 'workspace',
          success: true,
          latencyMs: latency,
          metadata: { phase, tasksGenerated: taskCount }
        }).catch((trackErr) => {
          logger.debug('Usage tracking failed (non-critical):', trackErr);
        });
      }
    } catch (trackErr) {
      logger.debug('Usage tracking setup failed (non-critical):', trackErr);
    }

    res.json({
      success: true,
      data: { tasks: result.tasks || [] },
      latency,
      metrics: {
        latencyMs: latency,
        tasksGenerated: taskCount,
        phase,
        modelUsed,
        attempt: attempt + 1
      }
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Orchestration failed:', error);
    const errorMessage = error.message || 'Unknown error';
    const userMessage = errorMessage.includes('timeout')
      ? 'The orchestration request timed out. This can happen with complex projects. Please try again or reduce the number of tasks requested.'
      : errorMessage.includes('API key') || errorMessage.includes('authentication')
        ? 'API configuration error. Please check your API key settings in the backend configuration.'
        : 'Failed to generate tasks. Please try again or check your project settings.';
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json({
      success: false,
      message: userMessage,
      error: isDev ? { message: errorMessage, stack: error.stack } : { message: errorMessage }
    });
  }
});

/**
 * Deep research endpoint (Research button)
 */
/**
 * Interrogate Agent - Ask agent questions about their work
 */
router.post('/interrogate', async (req: AuthRequest, res, _next) => {
  try {
    const { agentRole, question, context } = req.body;

    if (!agentRole || !question) {
      res.status(400).json({
        success: false,
        message: 'agentRole and question are required'
      });
      return;
    }

    logger.info(`[LLMRouter] Interrogating agent: ${agentRole}`);

    const prompt = `You are a ${agentRole} agent. Answer the following question based on your expertise and the project context:

Question: ${question}

Project Context: ${context || 'No context provided'}

Provide a clear, concise answer based on your role and expertise.`;

    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole,
        taskType: 'chat'
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'agent-interrogation',
      contextType: 'other'
    });

    res.json({
      success: true,
      data: {
        text: result.text
      }
    });
  } catch (error: any) {
    logger.error('Failed to interrogate agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to interrogate agent'
    });
  }
});

/**
 * Modify Task with AI - Use AI to modify task based on instruction
 */
router.post('/modify-task', async (req: AuthRequest, res, _next) => {
  try {
    const { task, instruction } = req.body;

    if (!task || !instruction) {
      res.status(400).json({
        success: false,
        message: 'task and instruction are required'
      });
      return;
    }

    logger.info(`[LLMRouter] Modifying task: ${task.title || task.id}`);

    const prompt = `Modify the following task based on the instruction:

Original Task:
Title: ${task.title}
Description: ${task.description || ''}
Assigned To: ${task.assignedTo || ''}
Phase: ${task.phase || ''}

Instruction: ${instruction}

Return a JSON object with the modified task fields:
{
  "title": "modified title",
  "description": "modified description",
  "assignedTo": "agent role (if changed)",
  "phase": "phase (if changed)",
  "dependencies": ["dependency ids if changed"]
}

Only include fields that should be modified. Keep other fields unchanged.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        assignedTo: { type: Type.STRING },
        phase: { type: Type.STRING },
        dependencies: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    };

    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Orchestrator',
        taskType: 'structured'
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'task-modification',
      contextType: 'workspace'
    });

    // Parse structured output
    let modifications;
    try {
      modifications = JSON.parse(result.text);
    } catch (parseError) {
      // Fallback: extract JSON from text if not pure JSON
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        modifications = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse modifications from response');
      }
    }

    // Merge modifications with original task
    // Merge modifications with original task
    const modifiedTask = {
      ...task,
      ...modifications
    };

    res.json({
      success: true,
      data: {
        task: modifiedTask
      }
    });
  } catch (error: any) {
    logger.error('Failed to modify task:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to modify task'
    });
  }
});

/**
 * Generate project research (Feasibility, Market, Business Analysis)
 */
router.post('/generate-research', async (req: AuthRequest, res) => {
  try {
    const { topic, ideas } = req.body;

    if (!topic) {
      res.status(400).json({ success: false, message: 'Topic is required' });
      return;
    }

    logger.info(`[Research] Generating research for topic: ${topic}`);

    const prompt = `
      You are a senior market research analyst. Create a comprehensive, professional research report for the following project idea.
      Be specific with numbers, percentages, and market data. Provide realistic estimates based on industry standards.
      Include citations and data sources where applicable.
      
      TOPIC: "${topic}"
      
      KEY IDEAS:
      ${ideas?.map((i: any) => `- ${i.text} (${i.category})`).join('\n') || 'No specific ideas provided yet.'}
      
      Generate a JSON response with this comprehensive structure:
      {
        "executiveSummary": {
          "overview": "2-3 sentence overview of the opportunity",
          "keyPoints": ["Point 1: opportunity insight", "Point 2: market potential", "Point 3: key risk", "Point 4: main conclusion", "Point 5: recommended action"]
        },
        "overallScore": 75,
        "objectivesAndScope": {
          "researchQuestions": ["Is there market demand?", "Who is the target user?", "Who are the main competitors?", "What is the pricing strategy?"],
          "geography": "Global with focus on North America and Europe",
          "segments": "B2B SaaS, SMB to Enterprise",
          "timeframe": "Current market with 3-5 year projections"
        },
        "methodology": {
          "dataSources": ["Industry reports (Gartner, Forrester)", "Competitor analysis", "Market trend data", "User behavior patterns"],
          "timeWindow": "2023-2024 data",
          "limitations": "Based on publicly available data and AI analysis"
        },
        "marketOverview": {
          "definition": "Clear definition of the market category",
          "size": "$X billion",
          "sizeValue": 5000000000,
          "growthStage": "Growth/Mature/Emerging",
          "growthRate": "15% CAGR",
          "macroTrends": ["Macro trend 1 shaping the market", "Macro trend 2", "Macro trend 3"]
        },
        "targetAudience": {
          "description": "Overall target customer description",
          "segments": [
            {"name": "Segment 1", "size": "40%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"},
            {"name": "Segment 2", "size": "35%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"},
            {"name": "Segment 3", "size": "25%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"}
          ]
        },
        "demandAndBehavior": {
          "demandEvidence": ["Evidence 1: search trends", "Evidence 2: review volume", "Evidence 3: community activity"],
          "searchInterest": "Growing/Stable/Declining with X% change",
          "buyingJourney": "Typical customer journey description",
          "adoptionBarriers": ["Barrier 1", "Barrier 2", "Barrier 3"]
        },
        "competitorLandscape": [
          {"name": "Competitor 1", "offering": "Product description", "pricing": "$X/month", "marketShare": "35%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"},
          {"name": "Competitor 2", "offering": "Product description", "pricing": "$X/month", "marketShare": "25%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"},
          {"name": "Competitor 3", "offering": "Product description", "pricing": "$X/month", "marketShare": "15%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"}
        ],
        "pricingSnapshot": {
          "typicalRange": "$X - $Y per month",
          "models": ["Subscription", "Freemium", "Usage-based"],
          "priceSensitivity": "Description of price sensitivity in the market",
          "recommendedStrategy": "Recommended pricing approach"
        },
        "swotAnalysis": {
          "strengths": ["Strength 1", "Strength 2", "Strength 3"],
          "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
          "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
          "threats": ["Threat 1", "Threat 2", "Threat 3"]
        },
        "keyInsights": {
          "topPains": ["Pain 1 from reviews/research", "Pain 2", "Pain 3"],
          "desiredFeatures": ["Feature 1 users want", "Feature 2", "Feature 3"],
          "commonObjections": ["Objection 1", "Objection 2"],
          "trendingUp": ["Rising trend 1", "Rising trend 2"],
          "trendingDown": ["Declining pattern 1"],
          "surprisingFindings": ["Unexpected insight 1", "Unexpected insight 2"]
        },
        "validationChecklist": {
          "targetMarketClarity": {"status": "pass", "notes": "Clear target market identified"},
          "realProblem": {"status": "pass", "notes": "Evidence of genuine pain point"},
          "demandEvidence": {"status": "caution", "notes": "Moderate evidence of demand"},
          "competitionIntensity": {"status": "pass", "notes": "Manageable competition level"},
          "feasibleDifferentiation": {"status": "pass", "notes": "Clear differentiation possible"}
        },
        "feasibility": {
          "technical": "Technical feasibility assessment...",
          "technicalScore": 80,
          "financial": "Financial viability assessment...",
          "financialScore": 70,
          "estimatedCosts": {"development": 50000, "marketing": 25000, "operationsPerYear": 15000},
          "operational": "Operational requirements...",
          "operationalScore": 75,
          "timeToMarket": "6-12 months"
        },
        "keyMetrics": {
          "breakEvenMonths": 18,
          "projectedROI": "150%",
          "customerAcquisitionCost": 50,
          "lifetimeValue": 500
        },
        "recommendations": ["Strategic recommendation 1", "Strategic recommendation 2", "Strategic recommendation 3"]
      }
      
      Be realistic and professional. Use actual market data patterns for similar projects.
      All numeric values should be realistic estimates. Do not include markdown formatting in JSON values.
    `;

    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Business Analyst',
        taskType: 'analysis'
      },
      routingContext: { userId: req.user?.id },
      requestType: 'research',
      contextType: 'analysis'
    });

    let researchData;
    try {
      // Clean up potential markdown formatting in response
      const cleanJson = result.text.replace(/```json\n?|\n?```/g, '').trim();
      researchData = JSON.parse(cleanJson);
    } catch (parseError) {
      logger.warn('[Research] Failed to parse JSON, returning structure with text content', parseError);
      // Fallback structure
      researchData = {
        executiveSummary: result.text.substring(0, 500) + '...',
        feasibility: { technical: 'Analysis included in full report.', financial: 'Analysis included in full report.', operational: 'Analysis included in full report.' },
        marketAnalysis: { targetAudience: 'Analysis included in full report.', marketSize: 'Analysis included in full report.', trends: [] },
        competitors: [],
        challenges: []
      };
    }

    res.json({
      success: true,
      data: researchData
    });

  } catch (error: any) {
    logger.error('Error generating research:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate research',
      error: error.message
    });
  }
});

router.post('/deep-research', async (req: AuthRequest, res, _next) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'query is required and must be a string'
      });
      return;
    }

    logger.info('[LLMRouter] Performing deep research using best practices...');

    // Build comprehensive research prompt (simplified - full version is very long)
    const researchPrompt = `You are a senior software architect and technical researcher with 20+ years of experience. Conduct thorough, evidence-based research on the provided project topic using online sources and deliver a comprehensive technical specification document.

Research Topic: ${query}

Follow a structured chain-of-thought research process:
1. Topic Decomposition & Analysis
2. Information Gathering & Validation (using online sources)
3. Critical Analysis & Evaluation
4. Synthesis & Recommendation

Provide comprehensive technical specifications covering:
- Core Features & Functionality
- Technical Architecture (including full-stack considerations)
- Backend Architecture Requirements (API design, server architecture, microservices vs monolith)
- Admin Console & Management Interfaces (if needed)
- Infrastructure Needs (deployment, containerization, CI/CD, monitoring, logging)
- Security & Compliance Requirements (authentication, authorization, data protection)
- Database Architecture (SQL/NoSQL selection, schema design, caching)
- API Design & Integrations (REST/GraphQL, external APIs, third-party services)
- Frontend Architecture (client-side architecture, state management, routing)
- DevOps & Deployment Strategy
- Testing Strategy (unit, integration, E2E, performance)
- Technical Requirements
- Implementation Details
- Best Practices & Industry Standards
- Recommendations & Next Steps

**IMPORTANT**: Consider the complete project scope, not just the frontend. Think about what backend services, admin panels, infrastructure, security measures, and other components are needed to create a production-ready, full-stack application.

Use clear, professional technical language. Include specific technologies with versions, concrete examples, measurable metrics, and industry standards. Structure content for easy scanning and implementation. This research will be used for subsequent full architecture analysis, so be thorough and comprehensive.`;

    const startTime = Date.now();

    // Use LLM router with internet search enabled for deep research
    const result = await llmRouter.executeWithFallback({
      prompt: researchPrompt,
      context: {
        agentRole: 'Research Agent',
        taskType: 'research'
      },
      routingContext: {
        userId: (req as any).user?.id
      },
      requestType: 'deep-research',
      contextType: 'other',
      useInternet: true // Enable internet search for comprehensive research
    });

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Deep research completed in ${latency}ms`);

    // Track usage
    try {
      await usageTracker.trackUsage({
        userId: (req as any).user?.userId,
        modelId: result.modelUsed,
        provider: result.provider,
        modelIdentifier: result.modelUsed,
        inputTokens: result.usage?.promptTokens || result.usage?.promptTokenCount || 0,
        outputTokens: result.usage?.candidatesTokens || result.usage?.candidatesTokenCount || 0,
        requestType: 'deep-research',
        success: true,
        latencyMs: latency
      });
    } catch (trackError) {
      logger.error('Failed to track usage for deep-research:', trackError);
    }

    res.json({
      success: true,
      data: {
        research: result.text || ''
      },
      latency: latency
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Deep research failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform deep research',
      error: {
        message: error.message || 'Unknown error'
      }
    });
  }
});

/**
 * Full Project Architecture Analysis
 * Analyzes project requirements and identifies all necessary components for a complete project
 */
router.post('/full-architecture-analysis', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
  try {
    const { projectDescription, researchFindings, userRequirements, projectType } = req.body;

    if (!projectDescription || typeof projectDescription !== 'string') {
      res.status(400).json({
        success: false,
        message: 'projectDescription is required and must be a string'
      });
      return;
    }

    logger.info('[LLMRouter] Performing full project architecture analysis...');

    const { fullProjectArchitectureAnalyzer } = await import('../services/fullProjectArchitectureAnalyzer.service.js');

    const startTime = Date.now();

    const analysis = await fullProjectArchitectureAnalyzer.analyzeArchitecture({
      projectDescription,
      researchFindings,
      userRequirements,
      projectType
    });

    const latency = Date.now() - startTime;
    logger.info(`[LLMRouter] Full architecture analysis completed in ${latency}ms`);

    res.json({
      success: true,
      data: {
        analysis
      },
      latency: latency
    });
  } catch (error: any) {
    logger.error('[LLMRouter] Full architecture analysis failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform full architecture analysis',
      error: {
        message: error.message || 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/llm/prototype-generation/:jobId/status
 * Get status of a prototype generation job
 */
router.get('/prototype-generation/:jobId/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { backgroundPrototypeGenerationService } = await import('../services/backgroundPrototypeGeneration.service.js');
    const job = await backgroundPrototypeGenerationService.getJobStatus(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found'
      });
      return;
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    res.json({
      success: true,
      job: {
        id: job._id.toString(),
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
        result: job.result,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/llm/prototype-generation/conversation/:conversationId
 * Get the latest prototype generation job for a conversation
 */
router.get('/prototype-generation/conversation/:conversationId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { backgroundPrototypeGenerationService } = await import('../services/backgroundPrototypeGeneration.service.js');
    const job = await backgroundPrototypeGenerationService.getJobByConversation(conversationId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'No job found for this conversation'
      });
      return;
    }

    // Verify user owns this job
    if (job.userId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    res.json({
      success: true,
      job: {
        id: job._id.toString(),
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
        result: job.result,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

