import React, { useState, useCallback, useMemo } from 'react';
import {
    Check, Circle, Loader2, ChevronDown, ChevronUp, AlertCircle,
    Play, Pause, RefreshCw, X, Clock, CheckCircle2, XCircle,
    ListTodo, Target, Zap, ArrowRight
} from 'lucide-react';

export interface Task {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    description?: string;
    subtasks?: Task[];
    output?: string;
    error?: string;
    progress?: number;
}

export interface TaskPanelProps {
    tasks: Task[];
    currentTaskId?: string;
    mode?: 'planning' | 'execution' | 'verification';
    onTaskClick?: (taskId: string) => void;
    onRetry?: (taskId: string) => void;
    onSkip?: (taskId: string) => void;
    onPause?: () => void;
    onResume?: () => void;
    isPaused?: boolean;
    title?: string;
    summary?: string;
}

// Calculate duration
const formatDuration = (startTime?: number, endTime?: number): string => {
    if (!startTime) return '-';
    const end = endTime || Date.now();
    const duration = end - startTime;

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
};

// Get status styling
const getStatusStyles = (status: Task['status']) => {
    switch (status) {
        case 'running':
            return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: Loader2 };
        case 'completed':
            return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', icon: CheckCircle2 };
        case 'failed':
            return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: XCircle };
        case 'skipped':
            return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-400', icon: X };
        default:
            return { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-500', icon: Circle };
    }
};

// Mode badge component
const ModeBadge: React.FC<{ mode: TaskPanelProps['mode'] }> = ({ mode }) => {
    const modeStyles = {
        planning: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Target },
        execution: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Zap },
        verification: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Check },
    };

    const style = modeStyles[mode || 'execution'];
    const Icon = style.icon;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
            <Icon size={12} />
            {mode?.toUpperCase() || 'EXECUTION'}
        </span>
    );
};

// Individual task item
const TaskItem: React.FC<{
    task: Task;
    isActive: boolean;
    depth?: number;
    onClick?: () => void;
    onRetry?: () => void;
    onSkip?: () => void;
}> = ({ task, isActive, depth = 0, onClick, onRetry, onSkip }) => {
    const [isExpanded, setIsExpanded] = useState(task.status === 'running' || task.status === 'failed');
    const styles = getStatusStyles(task.status);
    const StatusIcon = styles.icon;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const hasDetails = task.output || task.error || task.description;

    return (
        <div className={`${depth > 0 ? 'ml-4 border-l-2 border-slate-200 pl-3' : ''}`}>
            {/* Task Header */}
            <div
                className={`
          flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer
          ${styles.bg} ${styles.border}
          ${isActive ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
          hover:shadow-sm
        `}
                onClick={() => {
                    if (hasDetails || hasSubtasks) {
                        setIsExpanded(!isExpanded);
                    }
                    onClick?.();
                }}
            >
                {/* Status Icon */}
                <div className={`shrink-0 ${styles.text}`}>
                    {task.status === 'running' ? (
                        <StatusIcon size={16} className="animate-spin" />
                    ) : (
                        <StatusIcon size={16} />
                    )}
                </div>

                {/* Task Name */}
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${task.status === 'completed' ? 'text-slate-600' : 'text-slate-800'}`}>
                        {task.name}
                    </div>
                    {task.progress !== undefined && task.status === 'running' && (
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${task.progress}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Duration */}
                {task.startTime && (
                    <div className="shrink-0 text-xs text-slate-400 font-mono">
                        {formatDuration(task.startTime, task.endTime)}
                    </div>
                )}

                {/* Actions */}
                {task.status === 'failed' && onRetry && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRetry(); }}
                        className="shrink-0 p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Retry task"
                    >
                        <RefreshCw size={14} />
                    </button>
                )}
                {task.status === 'pending' && onSkip && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSkip(); }}
                        className="shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Skip task"
                    >
                        <X size={14} />
                    </button>
                )}

                {/* Expand/Collapse */}
                {(hasDetails || hasSubtasks) && (
                    <div className="shrink-0 text-slate-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Description */}
                    {task.description && (
                        <div className="text-xs text-slate-500 px-2 py-1 bg-slate-50 rounded-md mt-1">
                            {task.description}
                        </div>
                    )}

                    {/* Output */}
                    {task.output && (
                        <div className="mt-1 p-2 bg-slate-800 rounded-md">
                            <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-32">
                                {task.output}
                            </pre>
                        </div>
                    )}

                    {/* Error */}
                    {task.error && (
                        <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                <pre className="text-xs text-red-700 whitespace-pre-wrap overflow-x-auto">
                                    {task.error}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Subtasks */}
                    {hasSubtasks && (
                        <div className="mt-2 space-y-1">
                            {task.subtasks!.map((subtask) => (
                                <TaskItem
                                    key={subtask.id}
                                    task={subtask}
                                    isActive={false}
                                    depth={depth + 1}
                                    onRetry={onRetry ? () => onRetry : undefined}
                                    onSkip={onSkip ? () => onSkip : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const TaskPanel: React.FC<TaskPanelProps> = ({
    tasks,
    currentTaskId,
    mode = 'execution',
    onTaskClick,
    onRetry,
    onSkip,
    onPause,
    onResume,
    isPaused = false,
    title,
    summary,
}) => {
    // Calculate stats
    const stats = useMemo(() => {
        const completed = tasks.filter(t => t.status === 'completed').length;
        const failed = tasks.filter(t => t.status === 'failed').length;
        const running = tasks.filter(t => t.status === 'running').length;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const total = tasks.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { completed, failed, running, pending, total, progress };
    }, [tasks]);

    return (
        <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-full">
            {/* Header */}
            <div className="shrink-0 p-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <ListTodo size={18} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">{title || 'Task Progress'}</h3>
                        <ModeBadge mode={mode} />
                    </div>

                    {/* Pause/Resume */}
                    {(onPause || onResume) && stats.running > 0 && (
                        <button
                            onClick={isPaused ? onResume : onPause}
                            className={`p-1.5 rounded-lg transition-colors ${isPaused
                                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                    : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                }`}
                            title={isPaused ? 'Resume' : 'Pause'}
                        >
                            {isPaused ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${stats.failed > 0 ? 'bg-red-500' : 'bg-emerald-500'
                                }`}
                            style={{ width: `${stats.progress}%` }}
                        />
                    </div>
                    <span className="text-sm font-medium text-slate-600 tabular-nums">
                        {stats.completed}/{stats.total}
                    </span>
                </div>

                {/* Summary */}
                {summary && (
                    <p className="text-xs text-slate-500 mt-2">{summary}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                    {stats.running > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                            <Loader2 size={12} className="animate-spin" />
                            {stats.running} running
                        </span>
                    )}
                    {stats.completed > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 size={12} />
                            {stats.completed} done
                        </span>
                    )}
                    {stats.failed > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                            <XCircle size={12} />
                            {stats.failed} failed
                        </span>
                    )}
                    {stats.pending > 0 && (
                        <span className="flex items-center gap-1 text-slate-400">
                            <Circle size={12} />
                            {stats.pending} pending
                        </span>
                    )}
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <ListTodo size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">No tasks yet</p>
                        <p className="text-xs mt-1">Tasks will appear here as they are planned</p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            isActive={task.id === currentTaskId}
                            onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
                            onRetry={onRetry ? () => onRetry(task.id) : undefined}
                            onSkip={onSkip ? () => onSkip(task.id) : undefined}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {stats.total > 0 && (
                <div className="shrink-0 px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Estimated: {Math.max(1, stats.pending * 2)}min remaining
                        </span>
                        {stats.progress === 100 && stats.failed === 0 && (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <Check size={12} />
                                All tasks complete
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskPanel;
