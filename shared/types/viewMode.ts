export type ViewMode = 'landing' | 'hub' | 'setup' | 'workspace' | 'admin' | 'shared' | 'agentic-demo';

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
  description: string;
  phase: string;
  userId?: string;
}






