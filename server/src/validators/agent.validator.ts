/**
 * Agent Route Validators
 * Using Zod for input validation and sanitization
 */

import { z } from 'zod';

/**
 * Agent role validation schema
 */
const agentRoleSchema = z.enum([
  'Orchestrator',
  'Requirements Agent',
  'UI/UX Designer',
  'QA/Audit Agent',
  'Design/Architecture Agent',
  'Test Requirements Engineer',
  'Implementation Agent',
  'Integration Agent',
  'Test Agent',
  'Remediation/Bug Agent'
], {
  errorMap: () => ({ message: 'Invalid agent role' })
});

/**
 * Agent mode validation schema
 */
const agentModeSchema = z.enum(['Reasoning', 'Deterministic'], {
  errorMap: () => ({ message: 'Invalid agent mode' })
});

/**
 * Execute agent task request validation schema
 */
export const executeAgentTaskSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  taskId: z.string().min(1, 'Task ID is required').optional(),
  projectId: z.string().min(1, 'Project ID is required'),
  prompt: z.string().min(1, 'Prompt is required').max(10000, 'Prompt must not exceed 10000 characters'),
  context: z.string().max(50000, 'Context must not exceed 50000 characters').optional(),
  useInternet: z.boolean().optional(),
  mcpServers: z.array(z.string()).optional(),
  standards: z.array(z.string()).optional(),
}).strict();

/**
 * Agent ID validation schema
 */
export const agentIdSchema = z.string()
  .regex(/^a\d+$/, 'Invalid agent ID format (should be like a1, a2, etc.)');

/**
 * Type exports for TypeScript
 */
export type ExecuteAgentTaskInput = z.infer<typeof executeAgentTaskSchema>;
export type AgentIdInput = z.infer<typeof agentIdSchema>;


