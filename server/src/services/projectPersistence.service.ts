/**
 * Project Persistence Service
 * 
 * Phase 2.5: "Build & Instantiate"
 * Saves ephemeral prototype code (from Sandpack/Python) to a persistent workspace
 * so the CUA can access it in Phase 3 (Verification).
 */

import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface WorkspaceFile {
    path: string;
    content: string;
    type?: 'file' | 'directory';
}

export interface WorkspaceSnapshot {
    projectId: string;
    snapshotId: string;
    files: WorkspaceFile[];
    metadata: {
        createdAt: Date;
        runtime: 'sandpack' | 'python' | 'node' | 'custom';
        entryPoint?: string;
        dependencies?: Record<string, string>;
    };
}

export interface PersistenceResult {
    success: boolean;
    snapshotId: string;
    workspacePath: string;
    filesWritten: number;
    error?: string;
}

// Base directory for persisted workspaces
const WORKSPACE_BASE = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'workspaces');

class ProjectPersistenceService {
    /**
     * Initialize workspace directory
     */
    async initialize(): Promise<void> {
        try {
            await fs.mkdir(WORKSPACE_BASE, { recursive: true });
            logger.info(`📁 Workspace directory initialized: ${WORKSPACE_BASE}`);
        } catch (error: any) {
            logger.error(`Failed to initialize workspace directory: ${error.message}`);
        }
    }

    /**
     * Save ephemeral prototype to persistent workspace
     */
    async saveSnapshot(snapshot: Omit<WorkspaceSnapshot, 'snapshotId'>): Promise<PersistenceResult> {
        const snapshotId = uuidv4();
        const workspacePath = path.join(WORKSPACE_BASE, snapshot.projectId, snapshotId);

        try {
            logger.info(`📦 Saving workspace snapshot: ${snapshot.projectId}/${snapshotId}`);

            // Create workspace directory
            await fs.mkdir(workspacePath, { recursive: true });

            // Write all files
            let filesWritten = 0;
            for (const file of snapshot.files) {
                const filePath = path.join(workspacePath, file.path);
                const fileDir = path.dirname(filePath);

                // Ensure directory exists
                await fs.mkdir(fileDir, { recursive: true });

                // Write file content
                await fs.writeFile(filePath, file.content, 'utf-8');
                filesWritten++;
            }

            // Write metadata
            const metadataPath = path.join(workspacePath, '.orbitai-meta.json');
            await fs.writeFile(metadataPath, JSON.stringify({
                ...snapshot.metadata,
                snapshotId,
                projectId: snapshot.projectId,
                filesCount: filesWritten,
            }, null, 2), 'utf-8');

            // Create package.json if dependencies provided
            if (snapshot.metadata.dependencies && Object.keys(snapshot.metadata.dependencies).length > 0) {
                const packageJson = {
                    name: `orbitai-workspace-${snapshot.projectId.slice(0, 8)}`,
                    version: '1.0.0',
                    private: true,
                    dependencies: snapshot.metadata.dependencies,
                };
                await fs.writeFile(
                    path.join(workspacePath, 'package.json'),
                    JSON.stringify(packageJson, null, 2),
                    'utf-8'
                );
                filesWritten++;
            }

            logger.info(`✅ Workspace saved: ${filesWritten} files written`);

            return {
                success: true,
                snapshotId,
                workspacePath,
                filesWritten,
            };
        } catch (error: any) {
            logger.error(`❌ Failed to save workspace: ${error.message}`);
            return {
                success: false,
                snapshotId,
                workspacePath,
                filesWritten: 0,
                error: error.message,
            };
        }
    }

    /**
     * Load a workspace snapshot
     */
    async loadSnapshot(projectId: string, snapshotId: string): Promise<WorkspaceSnapshot | null> {
        const workspacePath = path.join(WORKSPACE_BASE, projectId, snapshotId);

        try {
            // Read metadata
            const metadataPath = path.join(workspacePath, '.orbitai-meta.json');
            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);

            // Read all files recursively
            const files = await this.readDirectoryRecursive(workspacePath);

            return {
                projectId,
                snapshotId,
                files: files.filter(f => !f.path.startsWith('.orbitai-')),
                metadata: {
                    createdAt: new Date(metadata.createdAt),
                    runtime: metadata.runtime,
                    entryPoint: metadata.entryPoint,
                    dependencies: metadata.dependencies,
                },
            };
        } catch (error: any) {
            logger.error(`Failed to load snapshot: ${error.message}`);
            return null;
        }
    }

    /**
     * List all snapshots for a project
     */
    async listSnapshots(projectId: string): Promise<string[]> {
        const projectPath = path.join(WORKSPACE_BASE, projectId);

        try {
            const entries = await fs.readdir(projectPath, { withFileTypes: true });
            return entries
                .filter(e => e.isDirectory())
                .map(e => e.name);
        } catch {
            return [];
        }
    }

    /**
     * Get latest snapshot for a project
     */
    async getLatestSnapshot(projectId: string): Promise<WorkspaceSnapshot | null> {
        const snapshots = await this.listSnapshots(projectId);
        if (snapshots.length === 0) return null;

        // Sort by creation time (most recent first)
        const snapshotsWithMeta = await Promise.all(
            snapshots.map(async (snapshotId) => {
                const metadataPath = path.join(WORKSPACE_BASE, projectId, snapshotId, '.orbitai-meta.json');
                try {
                    const content = await fs.readFile(metadataPath, 'utf-8');
                    const meta = JSON.parse(content);
                    return { snapshotId, createdAt: new Date(meta.createdAt) };
                } catch {
                    return { snapshotId, createdAt: new Date(0) };
                }
            })
        );

        snapshotsWithMeta.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return this.loadSnapshot(projectId, snapshotsWithMeta[0].snapshotId);
    }

    /**
     * Delete a snapshot
     */
    async deleteSnapshot(projectId: string, snapshotId: string): Promise<boolean> {
        const workspacePath = path.join(WORKSPACE_BASE, projectId, snapshotId);

        try {
            await fs.rm(workspacePath, { recursive: true, force: true });
            logger.info(`🗑️ Deleted snapshot: ${projectId}/${snapshotId}`);
            return true;
        } catch (error: any) {
            logger.error(`Failed to delete snapshot: ${error.message}`);
            return false;
        }
    }

    /**
     * Get workspace path for CUA access
     */
    getWorkspacePath(projectId: string, snapshotId: string): string {
        return path.join(WORKSPACE_BASE, projectId, snapshotId);
    }

    /**
     * Read directory recursively
     */
    private async readDirectoryRecursive(dir: string, basePath = ''): Promise<WorkspaceFile[]> {
        const files: WorkspaceFile[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const relativePath = path.join(basePath, entry.name);
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await this.readDirectoryRecursive(fullPath, relativePath);
                files.push(...subFiles);
            } else {
                const content = await fs.readFile(fullPath, 'utf-8');
                files.push({ path: relativePath, content, type: 'file' });
            }
        }

        return files;
    }
}

// Export singleton
export const projectPersistenceService = new ProjectPersistenceService();
export { ProjectPersistenceService };
