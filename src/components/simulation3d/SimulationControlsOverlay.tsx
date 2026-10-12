import React from 'react';
import {
  Car,
  LogOut,
  Sliders,
  Camera,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Radio,
  Eye,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import { CameraPreset } from './ParkingScene3D';

interface SimulationControlsOverlayProps {
  distanceCm: number;
  thresholdCm: number;
  isOccupied: boolean;
  onApproach: () => void;
  onLeave: () => void;
  onSliderChange: (cm: number) => void;
  cameraPreset: CameraPreset;
  onCameraChange: (preset: CameraPreset) => void;
  onReset: () => void;
  isAutoAnimating?: boolean;
}

export const SimulationControlsOverlay: React.FC<SimulationControlsOverlayProps> = ({
  distanceCm,
  thresholdCm,
  isOccupied,
  onApproach,
  onLeave,
  onSliderChange,
  cameraPreset,
  onCameraChange,
  onReset,
  isAutoAnimating = false,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        {/* Left: Distance Gauge & Occupancy State */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-xl flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-lg transition-colors ${
                isOccupied
                  ? 'bg-rose-600 shadow-rose-900/50'
                  : 'bg-emerald-600 shadow-emerald-900/50'
              }`}
            >
              <Car className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Telemetry Distance
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    isOccupied
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isOccupied ? 'Bay Occupied' : 'Bay Available'}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                  {distanceCm.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-slate-400">cm</span>
                <span className="text-xs text-slate-500 font-mono ml-1">
                  (Threshold: {thresholdCm.toFixed(1)} cm)
                </span>
              </div>
            </div>
          </div>

          {/* Mini 3D LED Status indicators */}
          <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-700/80">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                  isOccupied
                    ? 'bg-rose-500 shadow-[0_0_12px_#ef4444]'
                    : 'bg-rose-950 border border-rose-900/50 opacity-40'
                }`}
              />
              <span className="text-[9px] font-semibold text-rose-400">RED</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                  !isOccupied
                    ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]'
                    : 'bg-emerald-950 border border-emerald-900/50 opacity-40'
                }`}
              />
              <span className="text-[9px] font-semibold text-emerald-400">GRN</span>
            </div>
          </div>
        </div>

        {/* Right: Camera Angle Selector */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 shadow-xl flex items-center gap-1">
          <div className="px-2 py-1 text-[11px] font-medium text-slate-400 hidden md:flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>Angle:</span>
          </div>
          {(
            [
              { id: 'isometric', label: '3D Orbit', icon: Eye },
              { id: 'driver', label: 'Driver POV', icon: Car },
              { id: 'sensor', label: 'Sensor Macro', icon: Crosshair },
              { id: 'topdown', label: 'Top Down', icon: Gauge },
            ] as const
          ).map(cam => {
            const Icon = cam.icon;
            const active = cameraPreset === cam.id;
            return (
              <button
                key={cam.id}
                onClick={() => onCameraChange(cam.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{cam.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Main Game Action Control Deck */}
      <div className="space-y-3 pointer-events-auto max-w-2xl mx-auto w-full">
        {/* Interactive Scrubbing Slider */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Manual Sonar Distance Control:</span>
              <span className="font-mono font-bold text-blue-400">{distanceCm.toFixed(1)} cm</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">5 cm — 200 cm</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min="5"
              max="200"
              step="1"
              value={Math.round(distanceCm)}
              onChange={e => onSliderChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-hidden"
            />
            {/* Threshold Pin Marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none"
              style={{ left: `${((thresholdCm - 5) / 195) * 100}%` }}
              title={`Threshold: ${thresholdCm} cm`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
            <span className="text-rose-400">Parked &lt; 15 cm</span>
            <span className="text-amber-400">Threshold: {thresholdCm} cm</span>
            <span className="text-emerald-400">Vacant &gt; 100 cm</span>
          </div>
        </div>

        {/* Primary Game Buttons Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Button 1: Approach & Park */}
          <button
            onClick={onApproach}
            className="group px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2.5 transition-all border border-emerald-400/30"
          >
            <div className="p-1 rounded-lg bg-white/20 group-hover:scale-110 transition-transform">
              <Car className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <span className="block leading-tight">Car Approach</span>
              <span className="block text-[10px] font-normal text-emerald-100 opacity-90">
                Drive into bay
              </span>
            </div>
          </button>

          {/* Button 2: Car Leave */}
          <button
            onClick={onLeave}
            className="group px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2.5 transition-all border border-amber-400/30"
          >
            <div className="p-1 rounded-lg bg-white/20 group-hover:scale-110 transition-transform">
              <LogOut className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <span className="block leading-tight">Car Leave</span>
              <span className="block text-[10px] font-normal text-amber-100 opacity-90">
                Depart bay
              </span>
            </div>
          </button>

          {/* Button 3: Reset Scene */}
          <button
            onClick={onReset}
            className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-semibold text-sm rounded-xl shadow-lg border border-slate-700/80 flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Reset Position</span>
          </button>
        </div>
      </div>
    </div>
  );
};
