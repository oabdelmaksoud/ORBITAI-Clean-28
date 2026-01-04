/**
 * Simplified Deployment Experience
 * One-Click deployment with simulated build logs (Market Alignment v2)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Rocket,
  CheckCircle2,
  X,
  Terminal,
  Loader2,
  ExternalLink,
  Globe,
  Zap,
  AlertCircle
} from 'lucide-react';

interface DeploymentWizardProps {
  projectId: string;
  projectName: string;
  onDeploy: (config: DeploymentConfig) => void;
  onCancel: () => void;
}

interface DeploymentConfig {
  platform: string;
  environment: string;
  region?: string;
  envVars: Record<string, string>;
  buildCommand?: string;
  startCommand?: string;
}

type DeploymentPhase = 'ready' | 'deploying' | 'success' | 'error';

const SIMULATED_LOGS = [
  { text: '▸ Cloning repository...', delay: 300 },
  { text: '✓ Repository cloned', delay: 600 },
  { text: '▸ Installing dependencies...', delay: 400 },
  { text: '  npm install', delay: 200 },
  { text: '  added 847 packages in 12s', delay: 1200 },
  { text: '✓ Dependencies installed', delay: 300 },
  { text: '▸ Building application...', delay: 400 },
  { text: '  vite build', delay: 200 },
  { text: '  ✓ 156 modules transformed', delay: 800 },
  { text: '  dist/index.html    0.45 kB', delay: 150 },
  { text: '  dist/assets/index-Dk3f8s.js    285.32 kB', delay: 150 },
  { text: '  dist/assets/index-Bx9dKs.css    42.17 kB', delay: 150 },
  { text: '✓ Build complete', delay: 400 },
  { text: '▸ Deploying to edge network...', delay: 500 },
  { text: '  Uploading: ████████████████ 100%', delay: 1000 },
  { text: '✓ Deployment successful!', delay: 500 },
  { text: '', delay: 100 },
  { text: '🚀 Your app is live at:', delay: 300 },
];

const DeploymentWizard: React.FC<DeploymentWizardProps> = ({
  projectId,
  projectName,
  onDeploy,
  onCancel
}) => {
  const [phase, setPhase] = useState<DeploymentPhase>('ready');
  const [logs, setLogs] = useState<string[]>([]);
  const [deployedUrl, setDeployedUrl] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Smart defaults (no multi-step config needed)
  const defaultConfig: DeploymentConfig = {
    platform: 'vercel',
    environment: 'production',
    envVars: {}
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const simulateDeployment = async () => {
    setPhase('deploying');
    setLogs([]);

    // Simulate each log line with delays
    for (const logItem of SIMULATED_LOGS) {
      await new Promise(resolve => setTimeout(resolve, logItem.delay));
      if (logItem.text) {
        setLogs(prev => [...prev, logItem.text]);
      }
    }

    // Generate a fake deployed URL
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const fakeUrl = `https://${slug}-${projectId.slice(0, 6)}.vercel.app`;
    setDeployedUrl(fakeUrl);

    await new Promise(resolve => setTimeout(resolve, 300));
    setLogs(prev => [...prev, `   ${fakeUrl}`]);

    setPhase('success');
    onDeploy(defaultConfig);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Deploy {projectName}</h2>
                <p className="text-violet-200 text-sm">Go live in seconds</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-2 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {phase === 'ready' && (
            <div className="space-y-4">
              {/* Platform Badge */}
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <Globe className="w-4 h-4 text-violet-400" />
                  <span className="text-slate-300 text-sm font-medium">Vercel</span>
                  <span className="text-xs text-slate-500">(Edge Network)</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300 text-sm font-medium">Production</span>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">What happens next?</h3>
                <ul className="text-xs text-slate-400 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    Your code will be built and optimized
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    Deployed to a global edge network
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    You'll get a unique URL to share
                  </li>
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80">
                  This is a simulated deployment for demo purposes. Real deployments require platform authentication.
                </p>
              </div>
            </div>
          )}

          {(phase === 'deploying' || phase === 'success') && (
            <div className="space-y-4">
              {/* Terminal */}
              <div
                ref={logContainerRef}
                className="bg-black rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto border border-slate-700"
              >
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`${log.startsWith('✓') ? 'text-green-400' :
                        log.startsWith('▸') ? 'text-violet-400' :
                          log.startsWith('🚀') ? 'text-yellow-400 font-bold' :
                            log.includes('https://') ? 'text-cyan-400 underline' :
                              'text-slate-400'
                      }`}
                  >
                    {log}
                  </div>
                ))}
                {phase === 'deploying' && (
                  <div className="flex items-center gap-2 text-slate-500 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Running...</span>
                  </div>
                )}
              </div>

              {/* Success State */}
              {phase === 'success' && (
                <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-green-300 font-medium text-sm">Deployment Complete!</span>
                  </div>
                  <a
                    href={deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    Visit Site <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 flex justify-end gap-3">
          {phase === 'ready' && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={simulateDeployment}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition shadow-lg shadow-violet-500/25"
              >
                <Rocket className="w-4 h-4" />
                Deploy Now
              </button>
            </>
          )}
          {phase === 'deploying' && (
            <button
              disabled
              className="px-5 py-2.5 bg-slate-700 text-slate-400 rounded-lg font-semibold text-sm flex items-center gap-2 cursor-not-allowed"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Deploying...
            </button>
          )}
          {phase === 'success' && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-sm flex items-center gap-2 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentWizard;
