import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  RefreshCw,
  Cpu,
  Sparkles,
  Car,
  LogOut,
  Sliders,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useParking } from '../../context/ParkingContext';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const {
    mode,
    setMode,
    status,
    latestReading,
    refreshNow,
    triggerArrival,
    triggerDeparture,
    isPollingPaused,
  } = useParking();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Parking Overview', crumb: 'Dashboard' };
      case '/simulation':
        return { title: '3D Simulation Studio', crumb: 'Interactive Model' };
      case '/monitoring':
        return { title: 'Live Monitoring', crumb: 'Telemetry' };
      case '/analytics':
        return { title: 'Analytics & Trends', crumb: 'Reports' };
      case '/events':
        return { title: 'Event History', crumb: 'Audit Log' };
      case '/settings':
        return { title: 'Device & Settings', crumb: 'Configuration' };
      case '/guide':
        return { title: 'Hardware Setup Guide', crumb: 'Arduino & Flask' };
      default:
        return { title: 'ParkSense', crumb: 'Dashboard' };
    }
  };

  const { title, crumb } = getPageInfo();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshNow();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const isHardware = mode === 'hardware';
  const isConnected = isHardware ? status?.connected && status?.backend_reachable : true;

  const lastUpdateFormatted = latestReading?.timestamp
    ? new Date(latestReading.timestamp).toLocaleTimeString()
    : 'Waiting...';

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left zone: Mobile hamburger + breadcrumb title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>ParkSense</span>
            <span>/</span>
            <span className="text-slate-700">{crumb}</span>
          </div>
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right zone: Simulation actions + Mode Switcher + Connection Badge + Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Simulator Test Buttons when in Simulation Mode */}
        {mode === 'simulation' && (
          <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200">
            <button
              onClick={triggerArrival}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-white rounded transition-colors flex items-center gap-1"
              title="Simulate vehicle parking in bay"
            >
              <Car className="w-3 h-3 text-emerald-600" />
              <span>Simulate In</span>
            </button>
            <button
              onClick={triggerDeparture}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-white rounded transition-colors flex items-center gap-1"
              title="Simulate vehicle departing bay"
            >
              <LogOut className="w-3 h-3 text-amber-600" />
              <span>Simulate Out</span>
            </button>
          </div>
        )}

        {/* Mode Selector Segmented Switch */}
        <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/80">
          <button
            onClick={() => setMode('simulation')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              mode === 'simulation'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Simulation
          </button>
          <button
            onClick={() => setMode('hardware')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              mode === 'hardware'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hardware
          </button>
        </div>

        {/* Hardware / Sim status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          />
          <span className="text-slate-700 font-medium">
            {isHardware ? (isConnected ? 'Serial Live' : 'Hardware Offline') : 'Sim Active'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-mono text-[11px] tabular-nums">
            {lastUpdateFormatted}
          </span>
        </div>

        {/* Manual Refresh */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Refresh telemetry"
          aria-label="Refresh telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>

        {/* Station / Profile Identifier */}
        <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-mono text-xs font-bold">
            PS
          </div>
          <div className="hidden xl:block text-left text-xs">
            <span className="block font-semibold text-slate-900 leading-tight">Station Uno-01</span>
            <span className="block text-[11px] text-slate-500 font-mono">COM3 · HC-SR04</span>
          </div>
        </div>
      </div>
    </header>
  );
};
