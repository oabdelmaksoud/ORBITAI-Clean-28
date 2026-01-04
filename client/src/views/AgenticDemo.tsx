/**
 * AgenticDemo - Demo page to showcase agentic chat components
 * 
 * Access at: /agentic-demo
 */

import React, { useState, useCallback } from 'react';
import AgenticChatManager, { AgenticState, createInitialAgenticState, AgentMode } from '../components/AgenticChatManager';
import { Task } from '../components/TaskPanel';
import EnhancedChatMessage from '../components/EnhancedChatMessage';
import { ChatMessage } from '@orbitai/shared';
import { Play, RotateCcw, Sparkles } from 'lucide-react';

// Sample tasks for demo
const sampleTasks: Task[] = [
    {
        id: 'task-1',
        name: 'Analyze Requirements',
        status: 'completed',
        startTime: Date.now() - 5000,
        endTime: Date.now() - 3000,
        description: 'Parse user requirements and identify key features',
    },
    {
        id: 'task-2',
        name: 'Generate Implementation Plan',
        status: 'completed',
        startTime: Date.now() - 3000,
        endTime: Date.now() - 1000,
        description: 'Create detailed implementation steps',
    },
    {
        id: 'task-3',
        name: 'Set Up Project Structure',
        status: 'running',
        startTime: Date.now() - 1000,
        progress: 65,
        description: 'Initialize project with required dependencies',
        subtasks: [
            { id: 'task-3-1', name: 'Create package.json', status: 'completed', startTime: Date.now() - 800, endTime: Date.now() - 600 },
            { id: 'task-3-2', name: 'Install dependencies', status: 'running', startTime: Date.now() - 500, progress: 50 },
            { id: 'task-3-3', name: 'Configure TypeScript', status: 'pending' },
        ]
    },
    {
        id: 'task-4',
        name: 'Implement Core Components',
        status: 'pending',
        description: 'Build the main application components',
    },
    {
        id: 'task-5',
        name: 'Run Tests',
        status: 'pending',
        description: 'Execute test suite and verify functionality',
    },
];

// Sample messages
const sampleMessages: ChatMessage[] = [
    {
        id: 'msg-1',
        sender: 'user',
        text: 'Create a todo app with React and TypeScript',
        timestamp: Date.now() - 10000,
    },
    {
        id: 'msg-2',
        sender: 'agent',
        text: `I'll help you create a todo app! Let me break this down into steps:

## Planning Phase

I'll create a modern todo application with the following features:

- Add, edit, and delete todos
- Mark todos as complete
- Filter by status (all, active, completed)
- Persist data to localStorage

\`\`\`typescript
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}
\`\`\`

Let me start implementing this...`,
        timestamp: Date.now() - 8000,
    },
    {
        id: 'msg-3',
        sender: 'agent',
        text: `✅ Created \`package.json\` with React 18 and TypeScript 5
✅ Set up project structure with src/components, src/hooks, src/types
🔄 Installing dependencies...`,
        timestamp: Date.now() - 2000,
    },
];

const AgenticDemo: React.FC = () => {
    const [agenticState, setAgenticState] = useState<AgenticState>(() => ({
        ...createInitialAgenticState(),
        mode: 'execution',
        taskName: 'Creating Todo Application',
        taskSummary: 'Building a React + TypeScript todo app with modern features',
        taskStatus: 'Setting up project structure...',
        tasks: sampleTasks,
        currentTaskId: 'task-3',
        toolCalls: [
            {
                id: 'tool-1',
                name: 'write_to_file',
                status: 'completed',
                startTime: Date.now() - 4000,
                endTime: Date.now() - 3500,
                input: { path: 'package.json', content: '...' },
                output: 'File created successfully',
            },
            {
                id: 'tool-2',
                name: 'run_command',
                status: 'running',
                startTime: Date.now() - 500,
                input: { command: 'npm install' },
            },
        ],
        isPaused: false,
    }));

    const [showPanel, setShowPanel] = useState(true);

    // Handle mode change
    const handleModeChange = useCallback((mode: AgentMode) => {
        setAgenticState(prev => ({
            ...prev,
            mode,
            taskStatus: mode === 'planning' ? 'Analyzing requirements...'
                : mode === 'execution' ? 'Executing tasks...'
                    : 'Verifying implementation...',
        }));
    }, []);

    // Handle pause/resume
    const handlePause = useCallback(() => {
        setAgenticState(prev => ({ ...prev, isPaused: true }));
    }, []);

    const handleResume = useCallback(() => {
        setAgenticState(prev => ({ ...prev, isPaused: false }));
    }, []);

    // Reset demo
    const handleReset = useCallback(() => {
        setAgenticState({
            ...createInitialAgenticState(),
            mode: 'planning',
            taskName: '',
            tasks: [],
            toolCalls: [],
        });
    }, []);

    // Start demo
    const handleStartDemo = useCallback(() => {
        setAgenticState({
            ...createInitialAgenticState(),
            mode: 'execution',
            taskName: 'Creating Todo Application',
            taskSummary: 'Building a React + TypeScript todo app with modern features',
            taskStatus: 'Setting up project structure...',
            tasks: sampleTasks,
            currentTaskId: 'task-3',
            toolCalls: [
                {
                    id: 'tool-1',
                    name: 'write_to_file',
                    status: 'completed',
                    startTime: Date.now() - 4000,
                    endTime: Date.now() - 3500,
                    input: { path: 'package.json', content: '...' },
                    output: 'File created successfully',
                },
                {
                    id: 'tool-2',
                    name: 'run_command',
                    status: 'running',
                    startTime: Date.now() - 500,
                    input: { command: 'npm install' },
                },
            ],
            isPaused: false,
        });
    }, []);

    return (
        <div className="h-screen bg-slate-100">
            {/* Demo Controls */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-indigo-500" size={20} />
                    <h1 className="font-semibold text-slate-800">Agentic Chat Demo</h1>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        Preview
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <RotateCcw size={14} />
                        Reset
                    </button>
                    <button
                        onClick={handleStartDemo}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg transition-colors"
                    >
                        <Play size={14} />
                        Start Demo
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="h-[calc(100vh-48px)]">
                <AgenticChatManager
                    state={agenticState}
                    onStateChange={setAgenticState}
                    onModeChange={handleModeChange}
                    onPause={handlePause}
                    onResume={handleResume}
                    showPanel={showPanel}
                    onTogglePanel={() => setShowPanel(!showPanel)}
                >
                    {/* Chat Messages */}
                    <div className="p-4 space-y-4">
                        {sampleMessages.map(msg => (
                            <EnhancedChatMessage
                                key={msg.id}
                                message={msg}
                                showTimestamp
                            />
                        ))}
                    </div>
                </AgenticChatManager>
            </div>
        </div>
    );
};

export default AgenticDemo;
