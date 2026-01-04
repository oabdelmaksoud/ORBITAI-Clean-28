import React, { useState, useEffect } from 'react';
import { Loader2, Check, X, ChevronDown, ChevronUp, Terminal, FileSearch, Code, Globe, Wrench } from 'lucide-react';

export interface ToolCall {
    id: string;
    name: string;
    status: 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    input?: Record<string, any>;
    output?: string;
    error?: string;
}

interface ToolCallCardProps {
    toolCall: ToolCall;
    onExpand?: (id: string) => void;
    isExpanded?: boolean;
}

// Map tool names to icons
const getToolIcon = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('search') || nameLower.includes('find') || nameLower.includes('grep')) {
        return FileSearch;
    }
    if (nameLower.includes('read') || nameLower.includes('view') || nameLower.includes('file')) {
        return FileSearch;
    }
    if (nameLower.includes('write') || nameLower.includes('edit') || nameLower.includes('replace')) {
        return Code;
    }
    if (nameLower.includes('command') || nameLower.includes('run') || nameLower.includes('terminal')) {
        return Terminal;
    }
    if (nameLower.includes('web') || nameLower.includes('url') || nameLower.includes('browser')) {
        return Globe;
    }
    return Wrench;
};

// Format tool name for display
const formatToolName = (name: string): string => {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

// Format duration
const formatDuration = (startTime: number, endTime?: number): string => {
    const end = endTime || Date.now();
    const duration = end - startTime;

    if (duration < 1000) {
        return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(1)}s`;
};

const ToolCallCard: React.FC<ToolCallCardProps> = ({
    toolCall,
    onExpand,
    isExpanded = false
}) => {
    const [elapsed, setElapsed] = useState(0);
    const Icon = getToolIcon(toolCall.name);

    // Update elapsed time for running tools
    useEffect(() => {
        if (toolCall.status !== 'running') return;

        const interval = setInterval(() => {
            setElapsed(Date.now() - toolCall.startTime);
        }, 100);

        return () => clearInterval(interval);
    }, [toolCall.status, toolCall.startTime]);

    const statusColors = {
        running: 'border-blue-300 bg-blue-50',
        completed: 'border-emerald-300 bg-emerald-50',
        failed: 'border-red-300 bg-red-50'
    };

    const statusIcons = {
        running: <Loader2 size={14} className="animate-spin text-blue-500" />,
        completed: <Check size={14} className="text-emerald-500" />,
        failed: <X size={14} className="text-red-500" />
    };

    return (
        <div
            className={`rounded-lg border ${statusColors[toolCall.status]} transition-all duration-200 overflow-hidden`}
        >
            {/* Header */}
            <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/50 transition-colors"
                onClick={() => onExpand?.(toolCall.id)}
            >
                {/* Status Icon */}
                <div className="shrink-0">
                    {statusIcons[toolCall.status]}
                </div>

                {/* Tool Icon */}
                <div className="shrink-0 w-6 h-6 rounded-md bg-white/80 flex items-center justify-center">
                    <Icon size={14} className="text-slate-600" />
                </div>

                {/* Tool Name */}
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700 truncate block">
                        {formatToolName(toolCall.name)}
                    </span>
                </div>

                {/* Duration */}
                <div className="shrink-0 text-xs text-slate-500 font-mono">
                    {formatDuration(toolCall.startTime, toolCall.endTime)}
                </div>

                {/* Expand/Collapse */}
                <div className="shrink-0">
                    {isExpanded ? (
                        <ChevronUp size={14} className="text-slate-400" />
                    ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-200/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Input Parameters */}
                    {toolCall.input && Object.keys(toolCall.input).length > 0 && (
                        <div className="mb-2">
                            <div className="text-xs font-medium text-slate-500 mb-1">Input</div>
                            <div className="bg-white/80 rounded-md p-2 font-mono text-xs text-slate-600 overflow-x-auto">
                                {Object.entries(toolCall.input).map(([key, value]) => (
                                    <div key={key} className="truncate">
                                        <span className="text-purple-600">{key}:</span>{' '}
                                        <span className="text-slate-700">
                                            {typeof value === 'string'
                                                ? (value.length > 100 ? value.substring(0, 100) + '...' : value)
                                                : JSON.stringify(value).substring(0, 100)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Output/Result */}
                    {toolCall.output && (
                        <div className="mb-2">
                            <div className="text-xs font-medium text-slate-500 mb-1">Output</div>
                            <div className="bg-white/80 rounded-md p-2 font-mono text-xs text-slate-600 max-h-32 overflow-y-auto">
                                {toolCall.output.substring(0, 500)}
                                {toolCall.output.length > 500 && '...'}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {toolCall.error && (
                        <div>
                            <div className="text-xs font-medium text-red-500 mb-1">Error</div>
                            <div className="bg-red-50 rounded-md p-2 font-mono text-xs text-red-600">
                                {toolCall.error}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ToolCallCard;
