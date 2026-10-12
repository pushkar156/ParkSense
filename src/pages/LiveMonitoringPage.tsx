import React, { useState } from 'react';
import {
  Radio,
  Sliders,
  RotateCcw,
  Lightbulb,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useParking } from '../context/ParkingContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { api } from '../services/api';

export const LiveMonitoringPage: React.FC = () => {
  const {
    mode,
    status,
    latestReading,
    recentReadings,
    switchOperatingMode,
    toggleLed,
    updateThreshold,
    restoreDefaults,
    pollingIntervalMs,
    setPollingIntervalMs,
    isPollingPaused,
    setIsPollingPaused,
    setManualSimDistance,
  } = useParking();

  const [thresholdInput, setThresholdInput] = useState<number>(
    status?.threshold_cm ?? 15.0
  );
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [sliderSimVal, setSliderSimVal] = useState<number>(
    latestReading?.distance_cm ?? 180
  );

  const isHardware = mode === 'hardware';
  const isHardwareOffline = isHardware && (!status?.backend_reachable || !status?.connected);
  const isAutoMode = status?.firmware_mode === 'AUTO';
  const currentThreshold = status?.threshold_cm ?? 15.0;
  const isOccupied = latestReading?.occupied ?? false;

  const handleApplyThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingThreshold(true);
    await updateThreshold(thresholdInput);
    setIsUpdatingThreshold(false);
  };

  const handleRestoreDefaults = async () => {
    if (window.confirm('Restore default hardware parameters (Threshold: 15 cm, Mode: AUTO)?')) {
      setIsResetting(true);
      await restoreDefaults();
      setThresholdInput(15.0);
      setIsResetting(false);
    }
  };

  const handleSimSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSliderSimVal(val);
    setManualSimDistance(val);
  };

  // Prepare chart series from rolling buffer
  const chartData = recentReadings.map((r, i) => ({
    index: i,
    time: new Date(r.timestamp).toLocaleTimeString(),
    distance: r.distance_cm,
    threshold: currentThreshold,
    occupied: r.occupied,
  }));

  return (
    <div className="space-y-6">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Live Monitoring & Telemetry
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time ultrasonic measurement stream, actuator control, and threshold tuning.
          </p>
        </div>

        {/* Polling controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPollingPaused(!isPollingPaused)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
              isPollingPaused
                ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isPollingPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-amber-600" />
                <span>Resume Stream</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-500" />
                <span>Pause Polling</span>
              </>
            )}
          </button>

          <select
            value={pollingIntervalMs}
            onChange={e => setPollingIntervalMs(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
            aria-label="Polling interval"
          >
            <option value={500}>500 ms (Fast)</option>
            <option value={1000}>1000 ms (Default)</option>
            <option value={2000}>2000 ms (Conserve)</option>
            <option value={5000}>5000 ms (Low)</option>
          </select>
        </div>
      </div>

      {/* Main Sensor Readout & LED Actuators Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Readout (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ultrasonic Telemetry
              </span>
              <StatusBadge
                status={isHardwareOffline ? 'offline' : isOccupied ? 'occupied' : 'available'}
                label={isHardwareOffline ? 'No Stream' : isOccupied ? 'Bay Occupied' : 'Bay Available'}
                size="lg"
              />
            </div>

            {isHardwareOffline ? (
              <div className="py-12 text-center space-y-2">
                <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
                <h4 className="text-base font-semibold text-slate-900">Hardware Telemetry Paused</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The Flask backend at <code className="bg-slate-100 px-1 rounded">{api.getBaseUrl()}</code> is not reporting live serial frames.
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 py-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-extrabold font-mono tabular-nums tracking-tight text-slate-900">
                      {latestReading?.distance_cm !== undefined ? latestReading.distance_cm.toFixed(1) : '—'}
                    </span>
                    <span className="text-xl font-semibold text-slate-400">cm</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Sonar flight time · Valid detection range: 2 cm to 400 cm
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Active Threshold:</span>
                    <span className="font-mono font-semibold text-slate-800">{currentThreshold} cm</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">State Decision:</span>
                    <span
                      className={`font-semibold ${
                        isOccupied ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {isOccupied ? 'OCCUPIED (< threshold)' : 'AVAILABLE (>= threshold)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Visual meter bar */}
            {!isHardwareOffline && (
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span>0 cm</span>
                  <span className="text-rose-600 font-semibold">
                    Threshold: {currentThreshold} cm
                  </span>
                  <span>200 cm (Max)</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
                  {/* Threshold mark */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-10"
                    style={{ left: `${Math.min(100, (currentThreshold / 200) * 100)}%` }}
                  />
                  {/* Value bar */}
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOccupied ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(2, ((latestReading?.distance_cm || 0) / 200) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Simulation Distance Slider (when in Simulation mode) */}
          {mode === 'simulation' && (
            <div className="mt-5 p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-blue-950">
                  Interactive Distance Test Slider
                </span>
                <span className="font-mono font-semibold text-blue-900">
                  {sliderSimVal.toFixed(1)} cm
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="200"
                step="0.5"
                value={sliderSimVal}
                onChange={handleSimSliderChange}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-blue-700 mt-1">
                <span>Slide &lt; {currentThreshold} cm to test Occupied state</span>
                <span>Slide &gt; {currentThreshold} cm to test Available state</span>
              </div>
            </div>
          )}
        </div>

        {/* LED Actuators & Operating Mode (1 Column) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-slate-700" />
                Physical LED Indicators
              </h3>
              <span
                className={`text-[11px] font-mono uppercase font-semibold px-2 py-0.5 rounded ${
                  isAutoMode ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {status?.firmware_mode || 'AUTO'}
              </span>
            </div>

            {/* Mode Switcher Toggle */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-700 block">
                Firmware Operating Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => switchOperatingMode('AUTO')}
                  className={`py-1.5 text-xs font-medium rounded-md border transition-all ${
                    isAutoMode
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  AUTO
                </button>
                <button
                  onClick={() => switchOperatingMode('MANUAL')}
                  className={`py-1.5 text-xs font-medium rounded-md border transition-all ${
                    !isAutoMode
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  MANUAL
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                {isAutoMode
                  ? 'Arduino microcontroller autonomous logic controls LEDs based on ultrasonic threshold.'
                  : 'Manual override engaged. LEDs can now be actuated via direct commands.'}
              </p>
            </div>

            {/* LED Status & Manual Controls */}
            <div className="space-y-3">
              {/* Red LED */}
              <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full border transition-all ${
                      latestReading?.red_led
                        ? 'bg-rose-600 border-rose-700 shadow-sm shadow-rose-500/50'
                        : 'bg-slate-200 border-slate-300'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block leading-tight">
                      Red LED (Pin D7)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {latestReading?.red_led ? 'STATE: HIGH (ON)' : 'STATE: LOW (OFF)'}
                    </span>
                  </div>
                </div>

                {/* Manual toggle buttons */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={isAutoMode}
                    onClick={() => toggleLed('RED', 'ON')}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                      isAutoMode
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                        : latestReading?.red_led
                        ? 'bg-rose-700 text-white border-rose-800'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ON
                  </button>
                  <button
                    disabled={isAutoMode}
                    onClick={() => toggleLed('RED', 'OFF')}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                      isAutoMode
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                        : !latestReading?.red_led
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>

              {/* Green LED */}
              <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full border transition-all ${
                      latestReading?.green_led
                        ? 'bg-emerald-600 border-emerald-700 shadow-sm shadow-emerald-500/50'
                        : 'bg-slate-200 border-slate-300'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block leading-tight">
                      Green LED (Pin D8)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {latestReading?.green_led ? 'STATE: HIGH (ON)' : 'STATE: LOW (OFF)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={isAutoMode}
                    onClick={() => toggleLed('GREEN', 'ON')}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                      isAutoMode
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                        : latestReading?.green_led
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ON
                  </button>
                  <button
                    disabled={isAutoMode}
                    onClick={() => toggleLed('GREEN', 'OFF')}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                      isAutoMode
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                        : !latestReading?.green_led
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isAutoMode && (
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
              Note: Manual LED buttons are locked in AUTO mode. Switch to MANUAL to override.
            </p>
          )}
        </div>
      </div>

      {/* Sliding Window Chart (Real-time telemetry) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Live Sensor Waveform (Last 40 Telemetry Packets)
            </h3>
            <p className="text-xs text-slate-500">
              Continuous distance tracking over time. Real-time updates every {pollingIntervalMs} ms.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <span className="w-2.5 h-0.5 bg-emerald-600 inline-block" />
              <span>Distance (cm)</span>
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <span className="w-2.5 h-0.5 bg-rose-500 inline-block border-t border-dashed" />
              <span>Threshold ({currentThreshold} cm)</span>
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Awaiting sensor data stream...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  domain={[0, 220]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-800 space-y-1">
                          <p className="font-mono text-[11px] text-slate-400">{d.time}</p>
                          <p className="font-semibold">
                            Distance: <span className="font-mono">{d.distance.toFixed(1)} cm</span>
                          </p>
                          <p className="text-[11px]">
                            Status:{' '}
                            <span
                              className={`font-semibold ${
                                d.occupied ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {d.occupied ? 'Occupied' : 'Vacant'}
                            </span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={currentThreshold}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="distance"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Threshold Configuration & Safe Defaults Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Set Detection Threshold */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-slate-600" />
            Calibrate Occupancy Threshold
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Distances strictly below this cutoff will classify the parking bay as Occupied.
          </p>

          <form onSubmit={handleApplyThreshold} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Threshold Distance (cm)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="2"
                  max="400"
                  step="0.5"
                  value={thresholdInput}
                  onChange={e => setThresholdInput(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono font-semibold focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                />
                <button
                  type="submit"
                  disabled={isUpdatingThreshold || thresholdInput === currentThreshold}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isUpdatingThreshold ? 'Applying...' : 'Apply Threshold'}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Sends <code className="font-mono bg-slate-100 px-1 rounded">THRESHOLD:{thresholdInput}</code> over serial to Arduino EEPROM/RAM.
            </p>
          </form>
        </div>

        {/* Restore Defaults */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-slate-600" />
              Restore Firmware Defaults
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Resets Arduino controller to factory mini-project parameters: 15.0 cm threshold and AUTO mode.
            </p>
          </div>

          <div>
            <button
              onClick={handleRestoreDefaults}
              disabled={isResetting}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              {isResetting ? 'Restoring...' : 'Restore Default Settings'}
            </button>
            <p className="text-[11px] text-slate-400 mt-2">
              Sends <code className="font-mono bg-slate-100 px-1 rounded">RESET</code> command to firmware.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
