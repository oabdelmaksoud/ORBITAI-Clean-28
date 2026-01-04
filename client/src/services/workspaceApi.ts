/**
 * Workspace Persistence API
 * 
 * Frontend service for saving ephemeral prototypes to persistent workspace.
 * Part of Phase 2.5: "Build & Instantiate"
 */

import { api } from './api';

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

export interface SaveWorkspaceRequest {
    projectId: string;
    files: WorkspaceFile[];
    runtime?: 'sandpack' | 'python' | 'node' | 'custom';
    entryPoint?: string;
    dependencies?: Record<string, string>;
}

export interface SaveWorkspaceResponse {
    success: boolean;
    snapshotId: string;
    workspacePath: string;
    filesWritten: number;
    error?: string;
}

/**
 * Save current prototype code to persistent workspace
 */
export async function saveWorkspaceSnapshot(
    request: SaveWorkspaceRequest
): Promise<SaveWorkspaceResponse> {
    try {
        const response = await api.post('/api/workspace/save', request);
        return response.data;
    } catch (error: any) {
        console.error('[WorkspaceAPI] Save error:', error);
        return {
            success: false,
            snapshotId: '',
            workspacePath: '',
            filesWritten: 0,
            error: error.message || 'Failed to save workspace',
        };
    }
}

/**
 * Get the latest workspace snapshot for a project
 */
export async function getLatestSnapshot(
    projectId: string
): Promise<{ success: boolean; snapshot?: WorkspaceSnapshot; error?: string }> {
    try {
        const response = await api.get(`/api/workspace/${projectId}/latest`);
        return response.data;
    } catch (error: any) {
        console.error('[WorkspaceAPI] Load error:', error);
        return {
            success: false,
            error: error.message || 'Failed to load workspace',
        };
    }
}

/**
 * List all snapshots for a project
 */
export async function listSnapshots(
    projectId: string
): Promise<{ success: boolean; snapshots: string[]; error?: string }> {
    try {
        const response = await api.get(`/api/workspace/${projectId}/snapshots`);
        return response.data;
    } catch (error: any) {
        console.error('[WorkspaceAPI] List error:', error);
        return {
            success: false,
            snapshots: [],
            error: error.message || 'Failed to list snapshots',
        };
    }
}

/**
 * Load a specific snapshot
 */
export async function loadSnapshot(
    projectId: string,
    snapshotId: string
): Promise<{ success: boolean; snapshot?: WorkspaceSnapshot; error?: string }> {
    try {
        const response = await api.get(`/api/workspace/${projectId}/${snapshotId}`);
        return response.data;
    } catch (error: any) {
        console.error('[WorkspaceAPI] Load error:', error);
        return {
            success: false,
            error: error.message || 'Failed to load snapshot',
        };
    }
}

/**
 * Delete a snapshot
 */
export async function deleteSnapshot(
    projectId: string,
    snapshotId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await api.delete(`/api/workspace/${projectId}/${snapshotId}`);
        return response.data;
    } catch (error: any) {
        console.error('[WorkspaceAPI] Delete error:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete snapshot',
        };
    }
}

/**
 * Get workspace path for CUA access
 */
export async function getWorkspacePath(
    projectId: string,
    snapshotId: string
): Promise<{ success: boolean; workspacePath?: string; error?: string }> {
    try {
        const response = await api.get(`/api/workspace/${projectId}/${snapshotId}/path`);
        return response.data;
    } catch (error: any) {
        console.error('[WorkspaceAPI] Path error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get workspace path',
        };
    }
}

/**
 * Helper: Extract files from Sandpack state
 */
export function extractSandpackFiles(
    sandpackFiles: Record<string, { code: string }>
): WorkspaceFile[] {
    return Object.entries(sandpackFiles).map(([path, file]) => ({
        path: path.startsWith('/') ? path.slice(1) : path,
        content: file.code,
        type: 'file' as const,
    }));
}

/**
 * Helper: Create a quick save from current prototype
 */
export async function quickSavePrototype(
    projectId: string,
    code: string,
    runtime: 'sandpack' | 'python' = 'sandpack'
): Promise<SaveWorkspaceResponse> {
    const files: WorkspaceFile[] = runtime === 'sandpack'
        ? [
            { path: 'src/App.tsx', content: code },
            {
                path: 'src/index.tsx', content: `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
` },
            { path: 'src/styles.css', content: '@import "tailwindcss/base";\n@import "tailwindcss/components";\n@import "tailwindcss/utilities";' },
        ]
        : [
            { path: 'main.py', content: code },
            { path: 'requirements.txt', content: '# Python dependencies\n' },
        ];

    return saveWorkspaceSnapshot({
        projectId,
        files,
        runtime,
        entryPoint: runtime === 'sandpack' ? 'src/App.tsx' : 'main.py',
    });
}
