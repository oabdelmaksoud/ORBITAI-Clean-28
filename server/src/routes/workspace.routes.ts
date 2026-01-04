/**
 * Project Persistence API Routes
 * 
 * Phase 2.5: "Build & Instantiate"
 * API endpoints for saving ephemeral prototypes to persistent workspace.
 */

import { Router, Request, Response } from 'express';
import { projectPersistenceService, WorkspaceFile } from '../services/projectPersistence.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/workspace/save
 * Save a prototype snapshot to persistent storage
 */
router.post('/save', async (req: Request, res: Response) => {
    try {
        const { projectId, files, runtime, entryPoint, dependencies } = req.body;

        if (!projectId || !files || !Array.isArray(files)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, files (array)',
            });
        }

        const result = await projectPersistenceService.saveSnapshot({
            projectId,
            files: files as WorkspaceFile[],
            metadata: {
                createdAt: new Date(),
                runtime: runtime || 'sandpack',
                entryPoint,
                dependencies,
            },
        });

        if (result.success) {
            logger.info(`Workspace saved: ${projectId}/${result.snapshotId}`);
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }
    } catch (error: any) {
        logger.error(`Workspace save error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/workspace/:projectId/latest
 * Get the latest snapshot for a project
 */
router.get('/:projectId/latest', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const snapshot = await projectPersistenceService.getLatestSnapshot(projectId);

        if (snapshot) {
            return res.json({ success: true, snapshot });
        } else {
            return res.status(404).json({
                success: false,
                error: 'No snapshots found for this project',
            });
        }
    } catch (error: any) {
        logger.error(`Workspace load error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/workspace/:projectId/snapshots
 * List all snapshots for a project
 */
router.get('/:projectId/snapshots', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const snapshots = await projectPersistenceService.listSnapshots(projectId);

        return res.json({
            success: true,
            projectId,
            snapshots,
            count: snapshots.length,
        });
    } catch (error: any) {
        logger.error(`Workspace list error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/workspace/:projectId/:snapshotId
 * Load a specific snapshot
 */
router.get('/:projectId/:snapshotId', async (req: Request, res: Response) => {
    try {
        const { projectId, snapshotId } = req.params;
        const snapshot = await projectPersistenceService.loadSnapshot(projectId, snapshotId);

        if (snapshot) {
            return res.json({ success: true, snapshot });
        } else {
            return res.status(404).json({
                success: false,
                error: 'Snapshot not found',
            });
        }
    } catch (error: any) {
        logger.error(`Workspace load error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * DELETE /api/workspace/:projectId/:snapshotId
 * Delete a snapshot
 */
router.delete('/:projectId/:snapshotId', async (req: Request, res: Response) => {
    try {
        const { projectId, snapshotId } = req.params;
        const success = await projectPersistenceService.deleteSnapshot(projectId, snapshotId);

        if (success) {
            return res.json({ success: true, message: 'Snapshot deleted' });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Failed to delete snapshot',
            });
        }
    } catch (error: any) {
        logger.error(`Workspace delete error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/workspace/:projectId/:snapshotId/path
 * Get the filesystem path for CUA access
 */
router.get('/:projectId/:snapshotId/path', async (req: Request, res: Response) => {
    try {
        const { projectId, snapshotId } = req.params;
        const workspacePath = projectPersistenceService.getWorkspacePath(projectId, snapshotId);

        return res.json({
            success: true,
            projectId,
            snapshotId,
            workspacePath,
        });
    } catch (error: any) {
        logger.error(`Workspace path error: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
