/**
 * ExecutionRoutingService
 * 
 * The "Traffic Cop" that decides which execution tier to use for a project.
 * 
 * Tier 1 (Sandpack): Fast, client-side React/Frontend execution
 * Tier 2 (CoWasm): Free Python/Node/C++ execution in browser
 * Tier 3 (Firecracker): Enterprise Docker/VM for heavy workloads & CUA
 */

export type ExecutionTier = 'SANDPACK' | 'COWASM' | 'FIRECRACKER' | 'HTML_IFRAME';

/**
 * Content format detected from code analysis
 */
export type ContentFormat = 'html' | 'react-jsx' | 'python' | 'unknown';

export interface RoutingDecision {
    tier: ExecutionTier;
    reason: string;
    capabilities: string[];
}

export interface ProjectContext {
    packageJson?: Record<string, any>;
    files?: { path: string; content?: string }[];
    projectType?: 'react' | 'vue' | 'nextjs' | 'vite' | 'python' | 'node-server' | 'cpp' | 'unknown';
    userRequestedCUA?: boolean;
    userRequestedVM?: boolean;
}

// Dependencies that REQUIRE Tier 3 (MicroVM)
const TIER_3_DEPENDENCIES = [
    'docker',
    'docker-compose',
    'postgres',
    'pg',
    'redis',
    'ioredis',
    'mongodb',
    'mongoose',
    'mysql',
    'mysql2',
    'sqlite3',
    'better-sqlite3',
    'prisma',
    '@prisma/client',
    'typeorm',
    'sequelize',
    'bcrypt', // Native module
    'argon2', // Native module
    'sharp', // Native image processing
    'canvas', // Native canvas
    'puppeteer', // Browser automation
    'playwright', // Browser automation
];

// Dependencies that require Tier 2 (CoWasm) - Node.js server features
const TIER_2_DEPENDENCIES = [
    'express',
    'fastify',
    'koa',
    'hapi',
    'nest',
    '@nestjs/core',
    'fs-extra',
    'child_process',
    'cluster',
    'worker_threads',
    'net',
    'dgram',
    'http2',
    'https',
];

// File patterns indicating Tier 2 (Python/C++)
const TIER_2_FILE_PATTERNS = [
    /\.py$/,
    /\.cpp$/,
    /\.c$/,
    /\.h$/,
    /\.hpp$/,
    /requirements\.txt$/,
    /pyproject\.toml$/,
    /CMakeLists\.txt$/,
    /Makefile$/,
];

// File patterns indicating Tier 1 (Frontend-only)
const TIER_1_FRAMEWORKS = [
    'react',
    'react-dom',
    'vue',
    '@vue/core',
    'svelte',
    'solid-js',
    '@angular/core',
    'preact',
];

class ExecutionRoutingService {
    /**
     * Analyze project context and determine the optimal execution tier
     */
    route(context: ProjectContext): RoutingDecision {
        // Priority 1: User explicitly requested CUA or VM
        if (context.userRequestedCUA || context.userRequestedVM) {
            return {
                tier: 'FIRECRACKER',
                reason: context.userRequestedCUA
                    ? 'CUA Verification requires a server-accessible endpoint'
                    : 'User explicitly requested Full VM',
                capabilities: ['docker', 'database', 'native-binaries', 'cua-testing'],
            };
        }

        // Priority 2: Check for Tier 3 dependencies
        const tier3Match = this.checkDependencies(context.packageJson, TIER_3_DEPENDENCIES);
        if (tier3Match) {
            return {
                tier: 'FIRECRACKER',
                reason: `Project requires "${tier3Match}" which needs native execution`,
                capabilities: ['docker', 'database', 'native-binaries'],
            };
        }

        // Priority 3: Check for Python/C++ files (Tier 2)
        const tier2FileMatch = this.checkFilePatterns(context.files, TIER_2_FILE_PATTERNS);
        if (tier2FileMatch) {
            return {
                tier: 'COWASM',
                reason: `Project contains ${tier2FileMatch} files requiring POSIX execution`,
                capabilities: ['python', 'cpp', 'node-server', 'filesystem'],
            };
        }

        // Priority 4: Check for Tier 2 dependencies (Node.js server)
        const tier2DepMatch = this.checkDependencies(context.packageJson, TIER_2_DEPENDENCIES);
        if (tier2DepMatch) {
            return {
                tier: 'COWASM',
                reason: `Project uses "${tier2DepMatch}" which requires server-side Node.js`,
                capabilities: ['node-server', 'filesystem', 'networking'],
            };
        }

        // Priority 5: Check project type
        if (context.projectType === 'python' || context.projectType === 'cpp') {
            return {
                tier: 'COWASM',
                reason: `Project type "${context.projectType}" requires POSIX execution`,
                capabilities: ['python', 'cpp', 'filesystem'],
            };
        }

        if (context.projectType === 'node-server') {
            return {
                tier: 'COWASM',
                reason: 'Node.js server project requires backend execution',
                capabilities: ['node-server', 'filesystem', 'networking'],
            };
        }

        // Default: Tier 1 (Sandpack) for frontend projects
        return {
            tier: 'SANDPACK',
            reason: 'Frontend-only project - using instant browser execution',
            capabilities: ['react', 'vue', 'vite', 'hot-reload', 'instant-preview'],
        };
    }

    /**
     * Detect project type from files and package.json
     */
    detectProjectType(context: ProjectContext): ProjectContext['projectType'] {
        const { packageJson, files } = context;

        // Check for Python files
        if (files?.some(f => /\.py$/.test(f.path))) {
            return 'python';
        }

        // Check for C++ files
        if (files?.some(f => /\.(cpp|c|h|hpp)$/.test(f.path))) {
            return 'cpp';
        }

        // Check package.json dependencies
        if (packageJson?.dependencies) {
            const deps = Object.keys(packageJson.dependencies);

            // Check for frontend frameworks
            if (deps.includes('next') || deps.includes('next/core')) {
                return 'nextjs';
            }
            if (deps.includes('vue') || deps.includes('@vue/core')) {
                return 'vue';
            }
            if (deps.includes('react') || deps.includes('react-dom')) {
                // Check if it's a server (has express/fastify)
                if (deps.some(d => TIER_2_DEPENDENCIES.includes(d))) {
                    return 'node-server';
                }
                return 'react';
            }
            if (deps.includes('vite')) {
                return 'vite';
            }

            // Check for server frameworks
            if (deps.some(d => TIER_2_DEPENDENCIES.includes(d))) {
                return 'node-server';
            }
        }

        return 'unknown';
    }

    /**
     * Check if any dependencies match the target list
     */
    private checkDependencies(
        packageJson: Record<string, any> | undefined,
        targetDeps: string[]
    ): string | null {
        if (!packageJson) return null;

        const allDeps = [
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {}),
        ];

        for (const dep of allDeps) {
            if (targetDeps.includes(dep)) {
                return dep;
            }
        }

        return null;
    }

    /**
     * Check if any files match the target patterns
     */
    private checkFilePatterns(
        files: { path: string }[] | undefined,
        patterns: RegExp[]
    ): string | null {
        if (!files) return null;

        for (const file of files) {
            for (const pattern of patterns) {
                if (pattern.test(file.path)) {
                    return file.path.split('/').pop() || file.path;
                }
            }
        }

        return null;
    }

    /**
     * Detect content format from the code content itself
     * This is critical for routing to the correct renderer
     */
    detectContentFormat(code: string | undefined): ContentFormat {
        if (!code || code.trim().length === 0) {
            return 'unknown';
        }

        const trimmedCode = code.trim();

        // Check for full HTML document (contains DOCTYPE or html tag)
        if (
            trimmedCode.includes('<!DOCTYPE') ||
            trimmedCode.includes('<html') ||
            (trimmedCode.startsWith('<') && trimmedCode.includes('<head') && trimmedCode.includes('<body'))
        ) {
            return 'html';
        }

        // Check for Python code
        if (
            trimmedCode.includes('def ') ||
            trimmedCode.includes('import ') ||
            trimmedCode.includes('from ') ||
            trimmedCode.includes('class ') && trimmedCode.includes(':\n')
        ) {
            return 'python';
        }

        // Check for React/JSX patterns
        if (
            trimmedCode.includes('export default') ||
            trimmedCode.includes('React.') ||
            trimmedCode.includes('import React') ||
            trimmedCode.includes('useState') ||
            trimmedCode.includes('useEffect') ||
            (trimmedCode.includes('function') && trimmedCode.includes('return') && trimmedCode.includes('<'))
        ) {
            return 'react-jsx';
        }

        // If it starts with JSX-like markup but no HTML document markers
        if (trimmedCode.startsWith('<') && !trimmedCode.includes('<html') && !trimmedCode.includes('<!DOCTYPE')) {
            return 'react-jsx';
        }

        return 'unknown';
    }

    /**
     * Route based on content format (for wireframe code)
     */
    routeByContent(code: string | undefined): RoutingDecision {
        const format = this.detectContentFormat(code);

        switch (format) {
            case 'html':
                return {
                    tier: 'HTML_IFRAME',
                    reason: 'Full HTML document detected - using iframe renderer',
                    capabilities: ['html', 'css', 'javascript', 'tailwind'],
                };
            case 'python':
                return {
                    tier: 'COWASM',
                    reason: 'Python code detected - using WASM Python runtime',
                    capabilities: ['python', 'filesystem'],
                };
            case 'react-jsx':
                return {
                    tier: 'SANDPACK',
                    reason: 'React/JSX code detected - using Sandpack preview',
                    capabilities: ['react', 'typescript', 'tailwind', 'hot-reload'],
                };
            default:
                // Default to HTML_IFRAME as it's the most permissive
                return {
                    tier: 'HTML_IFRAME',
                    reason: 'Unknown format - defaulting to iframe renderer',
                    capabilities: ['html', 'css', 'javascript'],
                };
        }
    }

    /**
     * Get human-readable tier description
     */
    getTierDescription(tier: ExecutionTier): string {
        switch (tier) {
            case 'SANDPACK':
                return 'Instant Preview (Browser)';
            case 'COWASM':
                return 'Universal Runtime (Python/Node/C++)';
            case 'FIRECRACKER':
                return 'Full VM (Docker/Database/CUA)';
            case 'HTML_IFRAME':
                return 'HTML Preview (Iframe)';
        }
    }

    /**
     * Check if a tier supports a specific capability
     */
    tierSupports(tier: ExecutionTier, capability: string): boolean {
        const capabilities: Record<ExecutionTier, string[]> = {
            SANDPACK: ['react', 'vue', 'vite', 'nextjs', 'typescript', 'tailwind', 'hot-reload'],
            COWASM: ['python', 'node', 'cpp', 'filesystem', 'networking', 'process-spawn'],
            FIRECRACKER: ['docker', 'database', 'native-binaries', 'cua-testing', 'full-linux'],
            HTML_IFRAME: ['html', 'css', 'javascript', 'tailwind', 'babel'],
        };

        return capabilities[tier]?.includes(capability) ?? false;
    }
}

// Export singleton instance
export const executionRoutingService = new ExecutionRoutingService();
export { ExecutionRoutingService };
