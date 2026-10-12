import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  History,
  Sliders,
  Code2,
  Cpu,
  ChevronRight,
  Boxes,
  Menu,
  SlidersHorizontal,
} from 'lucide-react';
import { useParking } from '../../context/ParkingContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { mode, status } = useParking();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/simulation', label: '3D Simulator', icon: Boxes },
    { to: '/monitoring', label: 'Live Monitoring', icon: Radio },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/events', label: 'Event History', icon: History },
    { to: '/settings', label: 'Device & Settings', icon: Sliders },
    { to: '/guide', label: 'Hardware & Code Guide', icon: Code2 },
  ];

  const isHardware = mode === 'hardware';
  const isConnected = isHardware ? status?.connected && status?.backend_reachable : true;

  const handleHamburgerClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    } else if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: Fixed on mobile, Sticky on desktop, NEVER scrolls with the page */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-screen bg-white border-r border-[#E2E8F0] flex flex-col justify-between transition-all duration-200 ease-in-out lg:sticky lg:top-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'w-64'}`}
      >
        {/* Top Brand Header with Integrated Hamburger Button */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className={`h-16 flex items-center border-b border-[#E2E8F0] px-4 transition-all ${
              isCollapsed ? 'justify-center gap-1.5' : 'justify-between'
            }`}
          >
            {/* Expanded Brand Title */}
            <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'hidden' : 'flex'}`}>
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-xs shrink-0">
                <Radio className="w-4 h-4 text-emerald-100" />
              </div>
              <div className="min-w-0 truncate">
                <span className="font-bold text-base tracking-tight text-[#1A1F26] block truncate">
                  ParkSense
                </span>
                <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400 truncate">
                  IoT Platform
                </span>
              </div>
            </div>

            {/* Collapsed Brand Icon */}
            {isCollapsed && (
              <div
                className="w-8 h-8 rounded-lg bg-emerald-700 hidden lg:flex items-center justify-center text-white shadow-xs shrink-0"
                title="ParkSense IoT Platform"
              >
                <Radio className="w-4 h-4 text-emerald-100" />
              </div>
            )}

            {/* Hamburger Button on the Sidebar */}
            <button
              onClick={handleHamburgerClick}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label="Toggle Navigation Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links (Independent Scroll if Viewport is Short) */}
          <nav className="p-3 space-y-1 overflow-y-auto flex-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center text-xs font-medium rounded-lg transition-colors group ${
                      isCollapsed
                        ? 'justify-center p-3'
                        : 'justify-between px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
                    <Icon className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-800 transition-colors" />
                    {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status & Hardware Footer */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#FAFAFA]">
          {isCollapsed ? (
            /* Collapsed Compact Status Pill */
            <div
              className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-[#E2E8F0] shadow-2xs"
              title={`${isHardware ? 'Hardware Mode: ' + (isConnected ? 'Serial Live' : 'Offline') : 'Simulation Mode Active'}`}
            >
              <span
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              />
              <span className="text-[9px] font-mono font-semibold text-slate-500 mt-1 uppercase">
                {isHardware ? 'HW' : 'SIM'}
              </span>
            </div>
          ) : (
            /* Full Detailed Status Card */
            <>
              <div className="p-3 rounded-lg border border-[#E2E8F0] bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Telemetry Link
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">9600 BAUD</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    Arduino Uno
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      isConnected ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                    {isHardware ? (isConnected ? 'Serial Active' : 'Offline') : 'Simulated'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500 text-[11px]">Mode</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 font-mono">
                    {mode === 'simulation' ? 'Simulation' : 'Hardware'}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-slate-500">
                <NavLink
                  to="/settings"
                  className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Config</span>
                </NavLink>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-[10px] text-slate-400">HC-SR04 v1.2</span>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
