/**
 * PythonPreview Component
 * 
 * Tier 2 Execution Engine - Zero-Cost Python Execution
 * Uses Pyodide to run Python code in the browser via WebAssembly.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Terminal, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export interface PythonPreviewProps {
    /** The Python code to execute */
    code: string;
    /** Height of the container */
    height?: string | number;
    /** Auto-run code on mount */
    autoRun?: boolean;
    /** Callback when output changes */
    onOutput?: (output: string) => void;
    /** Callback when error occurs */
    onError?: (error: string) => void;
}

interface PyodideInstance {
    runPythonAsync: (code: string) => Promise<any>;
    loadPackage: (packages: string[]) => Promise<void>;
    globals: any;
}

type ExecutionStatus = 'idle' | 'loading' | 'ready' | 'running' | 'success' | 'error';

const PythonPreview: React.FC<PythonPreviewProps> = ({
    code,
    height = '400px',
    autoRun = false,
    onOutput,
    onError,
}) => {
    const [pyodide, setPyodide] = useState<PyodideInstance | null>(null);
    const [status, setStatus] = useState<ExecutionStatus>('idle');
    const [output, setOutput] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const outputRef = useRef<HTMLDivElement>(null);

    // Load Pyodide on mount
    useEffect(() => {
        const loadPyodide = async () => {
            setStatus('loading');
            setOutput(['📦 Loading Python runtime...']);

            try {
                // Load Pyodide from CDN
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                script.async = true;

                await new Promise<void>((resolve, reject) => {
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Failed to load Pyodide'));
                    document.head.appendChild(script);
                });

                // Initialize Pyodide
                const pyodideInstance = await (window as any).loadPyodide({
                    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
                });

                // Redirect stdout/stderr
                pyodideInstance.runPython(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self, callback):
        self.callback = callback
        self.buffer = []
    
    def write(self, text):
        if text.strip():
            self.buffer.append(text)
            self.callback(text)
    
    def flush(self):
        pass

def set_output_callback(callback):
    sys.stdout = OutputCapture(callback)
    sys.stderr = OutputCapture(callback)
`);

                setPyodide(pyodideInstance);
                setStatus('ready');
                setOutput(prev => [...prev, '✅ Python runtime ready!']);

                // Auto-run if enabled
                if (autoRun && code) {
                    await runCode(pyodideInstance, code);
                }
            } catch (err: any) {
                setStatus('error');
                setError(`Failed to load Python: ${err.message}`);
                setOutput(prev => [...prev, `❌ ${err.message}`]);
            }
        };

        loadPyodide();
    }, []);

    // Run Python code
    const runCode = useCallback(async (py: PyodideInstance, pythonCode: string) => {
        if (!py) return;

        setStatus('running');
        setError(null);
        setOutput(prev => [...prev, '▶️ Running...', '']);

        try {
            // Set up output callback
            py.globals.set('js_output_callback', (text: string) => {
                setOutput(prev => [...prev, text]);
                onOutput?.(text);
            });

            py.runPython('set_output_callback(js_output_callback)');

            // Run the user's code
            const result = await py.runPythonAsync(pythonCode);

            // If there's a return value, display it
            if (result !== undefined && result !== null) {
                const resultStr = String(result);
                setOutput(prev => [...prev, `→ ${resultStr}`]);
                onOutput?.(resultStr);
            }

            setStatus('success');
            setOutput(prev => [...prev, '', '✅ Execution complete']);
        } catch (err: any) {
            setStatus('error');
            const errorMsg = err.message || String(err);
            setError(errorMsg);
            setOutput(prev => [...prev, `❌ Error: ${errorMsg}`]);
            onError?.(errorMsg);
        }
    }, [onOutput, onError]);

    // Handle run button click
    const handleRun = useCallback(() => {
        if (pyodide && code) {
            runCode(pyodide, code);
        }
    }, [pyodide, code, runCode]);

    // Handle stop (clear output)
    const handleClear = useCallback(() => {
        setOutput([]);
        setError(null);
        setStatus('ready');
    }, []);

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    // Status indicator
    const StatusIcon = () => {
        switch (status) {
            case 'loading':
                return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            case 'ready':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'running':
                return <Loader2 className="w-4 h-4 animate-spin text-amber-500" />;
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Terminal className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div style={{ height }} className="flex flex-col bg-slate-900 rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <StatusIcon />
                    <span className="text-sm font-medium text-slate-300">
                        Python (Pyodide)
                    </span>
                    <span className="text-xs text-slate-500">
                        {status === 'loading' ? 'Loading...' :
                            status === 'running' ? 'Running...' :
                                status === 'ready' ? 'Ready' :
                                    status === 'success' ? 'Complete' :
                                        status === 'error' ? 'Error' : 'Idle'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRun}
                        disabled={status === 'loading' || status === 'running'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
                    >
                        <Play className="w-4 h-4" />
                        Run
                    </button>
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
                    >
                        <Square className="w-4 h-4" />
                        Clear
                    </button>
                </div>
            </div>

            {/* Code Display */}
            <div className="flex-1 flex">
                {/* Code Editor (read-only display) */}
                <div className="w-1/2 border-r border-slate-700 overflow-auto">
                    <pre className="p-4 text-sm font-mono text-slate-300 leading-relaxed">
                        {code || '# No Python code provided'}
                    </pre>
                </div>

                {/* Output Console */}
                <div
                    ref={outputRef}
                    className="w-1/2 p-4 overflow-auto bg-slate-950"
                >
                    <div className="font-mono text-sm leading-relaxed">
                        {output.map((line, i) => (
                            <div
                                key={i}
                                className={`${line.startsWith('❌') ? 'text-red-400' :
                                        line.startsWith('✅') ? 'text-green-400' :
                                            line.startsWith('▶️') ? 'text-blue-400' :
                                                line.startsWith('📦') ? 'text-amber-400' :
                                                    line.startsWith('→') ? 'text-purple-400' :
                                                        'text-slate-300'
                                    }`}
                            >
                                {line || '\u00A0'}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="px-4 py-2 bg-red-900/50 border-t border-red-800 text-red-300 text-sm">
                    <span className="font-medium">Error:</span> {error}
                </div>
            )}
        </div>
    );
};

export default PythonPreview;
export { PythonPreview };
