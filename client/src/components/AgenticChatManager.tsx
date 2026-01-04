/**
 * AgenticChatManager - Orchestrates agentic task execution in chat
 * 
 * This component manages the state and UI for an agentic workflow:
 * 1. PLANNING: User describes task, AI creates implementation plan
 * 2. EXECUTION: AI executes tasks, shows progress, handles errors
 * 3. VERIFICATION: AI verifies work, shows results
 */

import React, { useState, useCallback, useMemo } from 'react';
import TaskPanel, { Task, TaskPanelProps } from './TaskPanel';
import ToolCallCard, { ToolCall } from './ToolCallCard';
import {
    ListChecks, MessageSquare, Code, Check, Play, Pause,
    ChevronLeft, ChevronRight, Settings2, Sparkles
} from 'lucide-react';

export type AgentMode = 'planning' | 'execution' | 'verification';

export interface AgenticState {
    mode: AgentMode;
    taskName: string;
    taskSummary: string;
    taskStatus: string;
    tasks: Task[];
    currentTaskId?: string;
    toolCalls: ToolCall[];
    isPaused: boolean;
}

interface AgenticChatManagerProps {
    state: AgenticState;
    onStateChange?: (state: AgenticState) => void;
    onModeChange?: (mode: AgentMode) => void;
    onTaskRetry?: (taskId: string) => void;
    onTaskSkip?: (taskId: string) => void;
    onPause?: () => void;
    onResume?: () => void;
    onCancel?: () => void;
    showPanel?: boolean;
    onTogglePanel?: () => void;
    children?: React.ReactNode; // Chat messages
}

// Initial empty state
export const createInitialAgenticState = (): AgenticState => ({
    mode: 'planning',
    taskName: '',
    taskSummary: '',
    taskStatus: '',
    tasks: [],
    toolCalls: [],
    isPaused: false,
});

// Mode transition helpers
const modeOrder: AgentMode[] = ['planning', 'execution', 'verification'];
const getModeIndex = (mode: AgentMode) => modeOrder.indexOf(mode);

const AgenticChatManager: React.FC<AgenticChatManagerProps> = ({
    state,
    onStateChange,
    onModeChange,
    onTaskRetry,
    onTaskSkip,
    onPause,
    onResume,
    onCancel,
    showPanel = true,
    onTogglePanel,
    children,
}) => {
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());

    // Toggle tool call expansion
    const handleToggleToolCall = useCallback((id: string) => {
        setExpandedToolCalls(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Calculate progress
    const progress = useMemo(() => {
        const { tasks, mode } = state;
        if (tasks.length === 0) return { percent: 0, isComplete: false };

        const completed = tasks.filter(t => t.status === 'completed').length;
        const percent = Math.round((completed / tasks.length) * 100);
        const isComplete = completed === tasks.length;

        return { percent, isComplete };
    }, [state.tasks, state.mode]);

    // Mode colors
    const modeColors = {
        planning: 'from-purple-500 to-indigo-500',
        execution: 'from-blue-500 to-cyan-500',
        verification: 'from-emerald-500 to-teal-500',
    };

    const modeIcons = {
        planning: ListChecks,
        execution: Code,
        verification: Check,
    };

    const ModeIcon = modeIcons[state.mode];

    return (
        <div className="flex h-full bg-slate-50">
            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${showPanel ? 'mr-0' : ''}`}>
                {/* Agentic Header */}
                {state.taskName && (
                    <div className={`shrink-0 bg-gradient-to-r ${modeColors[state.mode]} text-white`}>
                        <div className="px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Mode Icon */}
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <ModeIcon size={20} />
                                    </div>

                                    {/* Task Info */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-semibold text-lg">{state.taskName}</h2>
                                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium uppercase">
                                                {state.mode}
                                            </span>
                                        </div>
                                        {state.taskStatus && (
                                            <p className="text-sm text-white/80 mt-0.5">{state.taskStatus}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-2">
                                    {state.mode === 'execution' && state.tasks.length > 0 && (
                                        <button
                                            onClick={state.isPaused ? onResume : onPause}
                                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                            title={state.isPaused ? 'Resume' : 'Pause'}
                                        >
                                            {state.isPaused ? <Play size={16} /> : <Pause size={16} />}
                                        </button>
                                    )}
                                    {onCancel && (
                                        <button
                                            onClick={onCancel}
                                            className="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    {onTogglePanel && (
                                        <button
                                            onClick={onTogglePanel}
                                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                            title={showPanel ? 'Hide panel' : 'Show panel'}
                                        >
                                            {showPanel ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {state.tasks.length > 0 && (
                                <div className="mt-3 flex items-center gap-3">
                                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white transition-all duration-500"
                                            style={{ width: `${progress.percent}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium tabular-nums">
                                        {progress.percent}%
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Mode Tabs */}
                        <div className="flex border-t border-white/20">
                            {modeOrder.map((m, idx) => {
                                const isCurrent = m === state.mode;
                                const isPast = getModeIndex(m) < getModeIndex(state.mode);
                                const Icon = modeIcons[m];

                                return (
                                    <button
                                        key={m}
                                        onClick={() => onModeChange?.(m)}
                                        disabled={!isPast && !isCurrent}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
                      ${isCurrent ? 'bg-white/20' : isPast ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'}`}
                                    >
                                        {isPast ? <Check size={14} /> : <Icon size={14} />}
                                        {m.charAt(0).toUpperCase() + m.slice(1)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>

                {/* Tool Calls (inline, collapsible) */}
                {state.toolCalls.length > 0 && (
                    <div className="shrink-0 border-t border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Tool Calls
                            </h4>
                            <span className="text-xs text-slate-400">
                                {state.toolCalls.filter(t => t.status === 'completed').length}/{state.toolCalls.length} completed
                            </span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {state.toolCalls.map(tool => (
                                <ToolCallCard
                                    key={tool.id}
                                    toolCall={tool}
                                    isExpanded={expandedToolCalls.has(tool.id)}
                                    onExpand={handleToggleToolCall}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Side Panel (Tasks) */}
            {showPanel && state.tasks.length > 0 && (
                <div className="w-80 border-l border-slate-200 shrink-0">
                    <TaskPanel
                        tasks={state.tasks}
                        currentTaskId={state.currentTaskId}
                        mode={state.mode}
                        title={state.taskName || 'Task Progress'}
                        summary={state.taskSummary}
                        onTaskClick={(id) => console.log('Task clicked:', id)}
                        onRetry={onTaskRetry}
                        onSkip={onTaskSkip}
                        onPause={onPause}
                        onResume={onResume}
                        isPaused={state.isPaused}
                    />
                </div>
            )}
        </div>
    );
};

export default AgenticChatManager;
