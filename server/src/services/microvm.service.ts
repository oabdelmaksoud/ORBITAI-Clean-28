/**
 * MicroVM Service
 * 
 * Phase 3: Enterprise Fallback (Tier 3)
 * Spawns Firecracker MicroVMs via Fly.io Machines API for:
 * - Docker container execution
 * - Database access (PostgreSQL, Redis)
 * - CUA (Computer Use Agent) testing with reachable IPs
 */

import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Fly.io Machines API Configuration
const FLY_API_BASE = process.env.FLY_API_BASE || 'https://api.machines.dev';
const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_APP_NAME = process.env.FLY_APP_NAME || 'orbitai-workspaces';

export interface MicroVMConfig {
    projectId: string;
    image?: string;
    command?: string[];
    env?: Record<string, string>;
    cpus?: number;
    memoryMb?: number;
    ports?: { internal: number; external: number; protocol: 'tcp' | 'udp' }[];
    region?: string;
}

export interface MicroVMInstance {
    id: string;
    projectId: string;
    machineId: string;
    status: 'starting' | 'running' | 'stopped' | 'error';
    ipAddress?: string;
    hostname?: string;
    ports: { internal: number; external: number }[];
    createdAt: Date;
    metadata: {
        region: string;
        image: string;
        cpus: number;
        memoryMb: number;
    };
}

export interface SpawnResult {
    success: boolean;
    instance?: MicroVMInstance;
    error?: string;
}

// In-memory store for active VMs (in production, use Redis/DB)
const activeVMs = new Map<string, MicroVMInstance>();

class MicroVMService {
    private isConfigured: boolean;

    constructor() {
        this.isConfigured = !!FLY_API_TOKEN;
        if (!this.isConfigured) {
            logger.warn('[MicroVM] Fly.io API token not configured. Tier 3 execution unavailable.');
        }
    }

    /**
     * Check if MicroVM service is available
     */
    isAvailable(): boolean {
        return this.isConfigured;
    }

    /**
     * Spawn a new MicroVM for a project
     */
    async spawn(config: MicroVMConfig): Promise<SpawnResult> {
        const instanceId = uuidv4();

        if (!this.isConfigured) {
            logger.warn('[MicroVM] Spawn requested but Fly.io not configured');
            return {
                success: false,
                error: 'MicroVM service not configured. Set FLY_API_TOKEN environment variable.',
            };
        }

        try {
            logger.info(`[MicroVM] Spawning VM for project: ${config.projectId}`);

            const machineConfig = {
                name: `orbitai-${config.projectId.slice(0, 8)}-${instanceId.slice(0, 8)}`,
                region: config.region || 'ewr', // Default to Newark (US East)
                config: {
                    image: config.image || 'node:20-slim',
                    guest: {
                        cpus: config.cpus || 1,
                        memory_mb: config.memoryMb || 256,
                    },
                    init: {
                        exec: config.command || ['npm', 'start'],
                    },
                    env: {
                        NODE_ENV: 'production',
                        PROJECT_ID: config.projectId,
                        ...config.env,
                    },
                    services: (config.ports || [{ internal: 3000, external: 443, protocol: 'tcp' as const }]).map(p => ({
                        ports: [{ port: p.external, handlers: ['http'] }],
                        internal_port: p.internal,
                        protocol: p.protocol,
                    })),
                },
            };

            const response = await fetch(`${FLY_API_BASE}/v1/apps/${FLY_APP_NAME}/machines`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${FLY_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(machineConfig),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Fly.io API error: ${response.status} - ${errorText}`);
            }

            const machineData = await response.json();

            const instance: MicroVMInstance = {
                id: instanceId,
                projectId: config.projectId,
                machineId: machineData.id,
                status: 'starting',
                hostname: `${machineData.id}.vm.${FLY_APP_NAME}.internal`,
                ipAddress: machineData.private_ip,
                ports: config.ports || [{ internal: 3000, external: 443 }],
                createdAt: new Date(),
                metadata: {
                    region: machineConfig.region,
                    image: machineConfig.config.image,
                    cpus: machineConfig.config.guest.cpus,
                    memoryMb: machineConfig.config.guest.memory_mb,
                },
            };

            activeVMs.set(instanceId, instance);

            // Wait for machine to be ready
            await this.waitForReady(machineData.id);
            instance.status = 'running';

            logger.info(`[MicroVM] VM spawned: ${instance.machineId} -> ${instance.hostname}`);

            return { success: true, instance };
        } catch (error: any) {
            logger.error(`[MicroVM] Spawn failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Wait for machine to be in 'started' state
     */
    private async waitForReady(machineId: string, maxWaitMs = 30000): Promise<void> {
        const startTime = Date.now();
        const pollInterval = 1000;

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const response = await fetch(`${FLY_API_BASE}/v1/apps/${FLY_APP_NAME}/machines/${machineId}`, {
                    headers: {
                        'Authorization': `Bearer ${FLY_API_TOKEN}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.state === 'started') {
                        return;
                    }
                }
            } catch {
                // Ignore polling errors
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('VM startup timeout');
    }

    /**
     * Stop and destroy a MicroVM
     */
    async destroy(instanceId: string): Promise<boolean> {
        const instance = activeVMs.get(instanceId);
        if (!instance) {
            logger.warn(`[MicroVM] Instance not found: ${instanceId}`);
            return false;
        }

        try {
            // Stop the machine
            await fetch(`${FLY_API_BASE}/v1/apps/${FLY_APP_NAME}/machines/${instance.machineId}/stop`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${FLY_API_TOKEN}`,
                },
            });

            // Delete the machine
            await fetch(`${FLY_API_BASE}/v1/apps/${FLY_APP_NAME}/machines/${instance.machineId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${FLY_API_TOKEN}`,
                },
            });

            activeVMs.delete(instanceId);
            logger.info(`[MicroVM] Destroyed: ${instanceId}`);
            return true;
        } catch (error: any) {
            logger.error(`[MicroVM] Destroy failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Get status of a MicroVM
     */
    async getStatus(instanceId: string): Promise<MicroVMInstance | null> {
        const instance = activeVMs.get(instanceId);
        if (!instance) {
            return null;
        }

        try {
            const response = await fetch(`${FLY_API_BASE}/v1/apps/${FLY_APP_NAME}/machines/${instance.machineId}`, {
                headers: {
                    'Authorization': `Bearer ${FLY_API_TOKEN}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                instance.status = data.state === 'started' ? 'running' :
                    data.state === 'stopped' ? 'stopped' : 'starting';
                instance.ipAddress = data.private_ip;
            }
        } catch {
            instance.status = 'error';
        }

        return instance;
    }

    /**
     * List all active VMs for a project
     */
    listByProject(projectId: string): MicroVMInstance[] {
        return Array.from(activeVMs.values()).filter(vm => vm.projectId === projectId);
    }

    /**
     * Get the public URL for CUA access
     */
    getPublicUrl(instance: MicroVMInstance): string {
        // Fly.io machines can be accessed via .fly.dev domain
        return `https://${instance.machineId}.${FLY_APP_NAME}.fly.dev`;
    }

    /**
     * Spawn a Node.js workspace for CUA testing
     */
    async spawnNodeWorkspace(projectId: string, workspacePath: string): Promise<SpawnResult> {
        return this.spawn({
            projectId,
            image: 'node:20-slim',
            command: ['sh', '-c', 'cd /app && npm install && npm start'],
            env: {
                WORKSPACE_PATH: workspacePath,
            },
            cpus: 1,
            memoryMb: 512,
            ports: [{ internal: 3000, external: 443, protocol: 'tcp' }],
        });
    }

    /**
     * Spawn a Python workspace for CUA testing
     */
    async spawnPythonWorkspace(projectId: string, workspacePath: string): Promise<SpawnResult> {
        return this.spawn({
            projectId,
            image: 'python:3.11-slim',
            command: ['sh', '-c', 'cd /app && pip install -r requirements.txt && python main.py'],
            env: {
                WORKSPACE_PATH: workspacePath,
            },
            cpus: 1,
            memoryMb: 512,
            ports: [{ internal: 8000, external: 443, protocol: 'tcp' }],
        });
    }
}

// Export singleton
export const microVMService = new MicroVMService();
export { MicroVMService };
