/**
 * MicroVM Frontend API
 * 
 * Phase 3: Enterprise Fallback (Tier 3)
 * Frontend service for spawning and managing MicroVMs.
 */

import { api } from './api';

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

export interface SpawnVMRequest {
    projectId: string;
    snapshotId?: string;
    runtime?: 'node' | 'python';
    config?: {
        image?: string;
        cpus?: number;
        memoryMb?: number;
    };
}

export interface SpawnVMResponse {
    success: boolean;
    instance?: MicroVMInstance;
    publicUrl?: string;
    error?: string;
}

/**
 * Check if MicroVM service is available
 */
export async function checkVMAvailability(): Promise<{
    available: boolean;
    tier: number;
    description: string;
}> {
    try {
        const response = await api.get('/api/vm/status');
        return response.data;
    } catch (error: any) {
        console.error('[VM API] Status check error:', error);
        return {
            available: false,
            tier: 3,
            description: 'MicroVM service unavailable',
        };
    }
}

/**
 * Spawn a MicroVM for a project
 */
export async function spawnVM(request: SpawnVMRequest): Promise<SpawnVMResponse> {
    try {
        const response = await api.post('/api/vm/spawn', request);
        return response.data;
    } catch (error: any) {
        console.error('[VM API] Spawn error:', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || 'Failed to spawn VM',
        };
    }
}

/**
 * Get status of a MicroVM
 */
export async function getVMStatus(
    instanceId: string
): Promise<{ success: boolean; instance?: MicroVMInstance; publicUrl?: string; error?: string }> {
    try {
        const response = await api.get(`/api/vm/${instanceId}`);
        return response.data;
    } catch (error: any) {
        console.error('[VM API] Status error:', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || 'Failed to get VM status',
        };
    }
}

/**
 * List all VMs for a project
 */
export async function listProjectVMs(
    projectId: string
): Promise<{ success: boolean; instances: MicroVMInstance[]; error?: string }> {
    try {
        const response = await api.get(`/api/vm/project/${projectId}`);
        return response.data;
    } catch (error: any) {
        console.error('[VM API] List error:', error);
        return {
            success: false,
            instances: [],
            error: error.response?.data?.error || error.message || 'Failed to list VMs',
        };
    }
}

/**
 * Destroy a MicroVM
 */
export async function destroyVM(
    instanceId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await api.delete(`/api/vm/${instanceId}`);
        return response.data;
    } catch (error: any) {
        console.error('[VM API] Destroy error:', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || 'Failed to destroy VM',
        };
    }
}

/**
 * Spawn a VM for CUA testing
 * This is the main entry point for the "Verify with CUA" action
 */
export async function spawnForCUA(
    projectId: string,
    snapshotId?: string
): Promise<SpawnVMResponse> {
    return spawnVM({
        projectId,
        snapshotId,
        runtime: 'node',
        config: {
            cpus: 2,
            memoryMb: 1024, // More resources for CUA testing
        },
    });
}
