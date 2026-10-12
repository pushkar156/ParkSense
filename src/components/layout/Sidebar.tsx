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
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { useParking } from '../../context/ParkingContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { mode, status } = useParking();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/monitoring', label: 'Live Monitoring', icon: Radio },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/events', label: 'Event History', icon: History },
    { to: '/settings', label: 'Device & Settings', icon: Sliders },
    { to: '/guide', label: 'Hardware & Code Guide', icon: Code2 },
  ];

  const isHardware = mode === 'hardware';
  const isConnected = isHardware ? status?.connected && status?.backend_reachable : true;

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

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-0 -translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Brand Header */}
        <div>
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-xs">
                <Radio className="w-4 h-4 text-emerald-100" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-[#1A1F26]">ParkSense</span>
                <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                  IoT Platform
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status & Hardware Footer */}
        <div className="p-3 border-t border-[#E2E8F0] bg-[#FAFAFA]">
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
        </div>
      </aside>
    </>
  );
};
