import React from 'react';
import { ViewMode } from '@orbitai/shared';
import AdminDashboard from './AdminDashboard';
import AdminLogin from './AdminLogin';
import ErrorBoundary from './ErrorBoundary';

// Import views directly to debug rendering issue
import LandingView from '../views/LandingView';
// import HubView from '../views/HubView'; // Removed
import SetupView from '../views/SetupView';
import WorkspaceView from '../views/WorkspaceView';
import AgenticDemo from '../views/AgenticDemo';

interface AppRouterProps {
  viewMode: ViewMode;
  isModernView?: boolean;
  // Add other props that views might need
  [key: string]: any;
}

/**
 * AppRouter - Central routing component that handles view mode switching
 * This replaces the large conditional rendering logic in App.tsx
 * 
 * NOW UPDATED: Uses granular ErrorBoundaries to isolate failures.
 */
export const AppRouter: React.FC<AppRouterProps> = ({ viewMode, ...props }) => {
  // Helper to wrap views in ErrorBoundary with custom context
  const renderView = (Component: React.FC<any>, viewName: string, extraProps: any = {}) => (
    <ErrorBoundary>
      <Component {...props} {...extraProps} />
    </ErrorBoundary>
  );

  switch (viewMode) {
    case 'landing':
      return (
        <ErrorBoundary>
          <LandingView
            onLaunch={props.onLaunch || (() => { })}
            onLaunchDemo={props.onLaunchDemo || (() => { })}
            onSignup={props.onSignup || (() => { })}
          />
        </ErrorBoundary>
      );

    // case 'hub': // Removed
    //   return renderView(HubView, 'Project Hub');

    case 'setup':
      return renderView(SetupView, 'Setup');

    case 'workspace':
      return renderView(WorkspaceView, 'Workspace');

    case 'admin':
      // Admin Login doesn't typically need a boundary as simple UI, but harmless to add
      if (!props.adminToken) {
        return (
          <ErrorBoundary>
            <AdminLogin onLoginSuccess={props.handleAdminLoginSuccess} />
          </ErrorBoundary>
        );
      }
      return (
        <ErrorBoundary>
          <AdminDashboard onExit={props.handleAdminLogout} token={props.adminToken} {...props} />
        </ErrorBoundary>
      );

    case 'shared':
      // Shared projects use workspace view with view-only mode
      return renderView(WorkspaceView, 'Shared Workspace', { isViewOnly: true });

    case 'agentic-demo':
      // Demo page for agentic chat components
      return renderView(AgenticDemo, 'Agentic Demo');

    default:
      return (
        <ErrorBoundary>
          <LandingView
            onLaunch={props.onLaunch || (() => { })}
            onLaunchDemo={props.onLaunchDemo || (() => { })}
            onSignup={props.onSignup || (() => { })}
          />
        </ErrorBoundary>
      );
  }
};

