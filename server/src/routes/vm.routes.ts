/**
 * MicroVM API Routes
 * 
 * Phase 3: Enterprise Fallback (Tier 3)
 * API endpoints for spawning and managing Firecracker MicroVMs.
 */

import { Router, Request, Response } from 'express';
import { microVMService, MicroVMConfig } from '../services/microvm.service.js';
import { projectPersistenceService } from '../services/projectPersistence.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/vm/status
 * Check if MicroVM service is available
 */
router.get('/status', (_req: Request, res: Response) => {
    res.json({
        success: true,
        available: microVMService.isAvailable(),
        tier: 3,
        description: 'Firecracker MicroVM (Fly.io)',
    });
});

/**
 * POST /api/vm/spawn
 * Spawn a new MicroVM for a project
 */
router.post('/spawn', async (req: Request, res: Response) => {
    try {
        const { projectId, snapshotId, runtime, config } = req.body;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: projectId',
            });
        }

        // Check if MicroVM service is available
        if (!microVMService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'MicroVM service not configured. Set FLY_API_TOKEN.',
            });
        }

        // Get workspace path for the project
        let workspacePath: string | undefined;
        if (snapshotId) {
            workspacePath = projectPersistenceService.getWorkspacePath(projectId, snapshotId);
        } else {
            // Get latest snapshot
            const latestSnapshot = await projectPersistenceService.getLatestSnapshot(projectId);
            if (latestSnapshot) {
                workspacePath = projectPersistenceService.getWorkspacePath(projectId, latestSnapshot.snapshotId);
            }
        }

        // Spawn the appropriate type of VM based on runtime
        let result;
        if (runtime === 'python') {
            result = await microVMService.spawnPythonWorkspace(projectId, workspacePath || '');
        } else {
            result = await microVMService.spawnNodeWorkspace(projectId, workspacePath || '');
        }

        if (result.success && result.instance) {
            const publicUrl = microVMService.getPublicUrl(result.instance);

            logger.info(`[VM API] Spawned VM for project ${projectId}: ${publicUrl}`);

            return res.json({
                success: true,
                instance: result.instance,
                publicUrl,
            });
        } else {
            return res.status(500).json(result);
        }
    } catch (error: any) {
        logger.error(`[VM API] Spawn error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/vm/:instanceId
 * Get status of a MicroVM
 */
router.get('/:instanceId', async (req: Request, res: Response) => {
    try {
        const { instanceId } = req.params;
        const instance = await microVMService.getStatus(instanceId);

        if (instance) {
            return res.json({
                success: true,
                instance,
                publicUrl: microVMService.getPublicUrl(instance),
            });
        } else {
            return res.status(404).json({
                success: false,
                error: 'Instance not found',
            });
        }
    } catch (error: any) {
        logger.error(`[VM API] Status error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/vm/project/:projectId
 * List all VMs for a project
 */
router.get('/project/:projectId', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const instances = microVMService.listByProject(projectId);

        return res.json({
            success: true,
            projectId,
            instances,
            count: instances.length,
        });
    } catch (error: any) {
        logger.error(`[VM API] List error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * DELETE /api/vm/:instanceId
 * Stop and destroy a MicroVM
 */
router.delete('/:instanceId', async (req: Request, res: Response) => {
    try {
        const { instanceId } = req.params;
        const success = await microVMService.destroy(instanceId);

        if (success) {
            return res.json({ success: true, message: 'VM destroyed' });
        } else {
            return res.status(404).json({
                success: false,
                error: 'Instance not found or already destroyed',
            });
        }
    } catch (error: any) {
        logger.error(`[VM API] Destroy error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/vm/:instanceId/exec
 * Execute a command in a running VM (for CUA)
 */
router.post('/:instanceId/exec', async (req: Request, res: Response) => {
    try {
        const { instanceId } = req.params;
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: command',
            });
        }

        const instance = await microVMService.getStatus(instanceId);
        if (!instance) {
            return res.status(404).json({
                success: false,
                error: 'Instance not found',
            });
        }

        // Note: Actual exec implementation would require SSH or Fly.io exec API
        // For now, return the connection info for external tools
        return res.json({
            success: true,
            message: 'Command execution not implemented directly. Use SSH or CUA browser automation.',
            instance,
            publicUrl: microVMService.getPublicUrl(instance),
        });
    } catch (error: any) {
        logger.error(`[VM API] Exec error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
