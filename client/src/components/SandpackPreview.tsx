/**
 * SandpackPreview Component
 * 
 * Tier 1 Execution Engine - Instant React/Frontend Preview
 * Uses CodeSandbox's Sandpack for fast, client-side code execution.
 */

import React, { useMemo } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview as SandpackPreviewPane,
    SandpackCodeEditor,
    SandpackConsole,
} from '@codesandbox/sandpack-react';

// Inline dark theme - avoids separate @codesandbox/sandpack-themes dependency
const darkTheme = {
    colors: {
        surface1: '#1e1e2e',
        surface2: '#313244',
        surface3: '#45475a',
        clickable: '#cdd6f4',
        base: '#cdd6f4',
        disabled: '#6c7086',
        hover: '#89b4fa',
        accent: '#89b4fa',
        error: '#f38ba8',
        errorSurface: '#45475a',
    },
    syntax: {
        plain: '#cdd6f4',
        comment: { color: '#6c7086', fontStyle: 'italic' },
        keyword: '#cba6f7',
        tag: '#89b4fa',
        punctuation: '#bac2de',
        definition: '#f9e2af',
        property: '#89dceb',
        static: '#fab387',
        string: '#a6e3a1',
    },
    font: {
        body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        mono: '"Fira Code", "Fira Mono", Menlo, Monaco, monospace',
        size: '13px',
        lineHeight: '20px',
    },
};

export interface SandpackPreviewProps {
    /** The main React/JSX code to render */
    code: string;
    /** Optional additional files (path -> content) */
    files?: Record<string, string>;
    /** Show code editor alongside preview */
    showEditor?: boolean;
    /** Show console output */
    showConsole?: boolean;
    /** Height of the preview container */
    height?: string | number;
    /** Template to use (react, vanilla, vue, etc.) */
    template?: 'react' | 'react-ts' | 'vanilla' | 'vanilla-ts' | 'vue' | 'vue-ts';
    /** Custom dependencies to load */
    customDependencies?: Record<string, string>;
    /** Callback when code changes in editor */
    onCodeChange?: (code: string) => void;
}

/**
 * Wraps raw JSX/React code in a proper App component if needed
 */
function wrapCodeIfNeeded(code: string): string {
    // If it's already a proper React component or full file, return as-is
    if (
        code.includes('export default') ||
        code.includes('ReactDOM.render') ||
        code.includes('createRoot')
    ) {
        return code;
    }

    // If it's just JSX, wrap it in a functional component
    if (code.trim().startsWith('<')) {
        return `export default function App() {
  return (
    ${code}
  );
}`;
    }

    // If it's a function component without export
    if (code.includes('function') || code.includes('const')) {
        // Check if there's an obvious component name
        const componentMatch = code.match(/(?:function|const)\s+(\w+)/);
        if (componentMatch) {
            const componentName = componentMatch[1];
            if (!code.includes('export default')) {
                return `${code}\n\nexport default ${componentName};`;
            }
        }
    }

    return code;
}

/**
 * Extract inline Tailwind CSS if present
 */
function extractStyles(code: string): { cleanCode: string; styles: string } {
    // Check for inline style blocks
    const styleMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
        return {
            cleanCode: code.replace(styleMatch[0], ''),
            styles: styleMatch[1],
        };
    }
    return { cleanCode: code, styles: '' };
}

const SandpackPreview: React.FC<SandpackPreviewProps> = ({
    code,
    files = {},
    showEditor = false,
    showConsole = false,
    height = '100%',
    template = 'react',
    customDependencies = {},
    onCodeChange,
}) => {
    // Process the code to ensure it's renderable
    const processedFiles = useMemo(() => {
        const wrappedCode = wrapCodeIfNeeded(code);
        const { cleanCode, styles } = extractStyles(wrappedCode);

        const baseFiles: Record<string, string> = {
            '/App.js': cleanCode,
            ...files,
        };

        // Add custom styles if extracted
        if (styles) {
            baseFiles['/styles.css'] = `
/* Tailwind base styles */
@import url('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');

${styles}
`;
        } else {
            // Always include Tailwind for styling
            baseFiles['/styles.css'] = `
@import url('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');

/* Reset and base styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`;
        }

        // Add index file that imports styles
        baseFiles['/index.js'] = `
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

        return baseFiles;
    }, [code, files]);

    // Default dependencies for React projects
    const dependencies = useMemo(() => ({
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'lucide-react': '^0.263.1',
        ...customDependencies,
    }), [customDependencies]);

    return (
        <div style={{ height, width: '100%' }}>
            <SandpackProvider
                template={template}
                theme={darkTheme}
                files={processedFiles}
                customSetup={{
                    dependencies,
                }}
                options={{
                    externalResources: [
                        'https://cdn.tailwindcss.com',
                    ],
                    recompileMode: 'delayed',
                    recompileDelay: 300,
                }}
            >
                <SandpackLayout style={{ height: '100%' }}>
                    {showEditor && (
                        <SandpackCodeEditor
                            style={{ height: '100%', flex: 1 }}
                            showTabs
                            showLineNumbers
                            showInlineErrors
                        />
                    )}
                    <SandpackPreviewPane
                        style={{ height: '100%', flex: showEditor ? 1 : 2 }}
                        showOpenInCodeSandbox={false}
                        showRefreshButton={true}
                    />
                    {showConsole && (
                        <SandpackConsole style={{ height: '150px' }} />
                    )}
                </SandpackLayout>
            </SandpackProvider>
        </div>
    );
};

export default SandpackPreview;
export { SandpackPreview };
