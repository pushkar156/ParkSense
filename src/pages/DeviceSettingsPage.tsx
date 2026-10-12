import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  Sliders,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  RefreshCw,
  Terminal,
  Shield,
  Download,
  Info,
} from 'lucide-react';
import { useParking } from '../context/ParkingContext';
import { api } from '../services/api';

export const DeviceSettingsPage: React.FC = () => {
  const {
    mode,
    setMode,
    status,
    apiUrl,
    setApiUrl,
    pollingIntervalMs,
    setPollingIntervalMs,
    restoreDefaults,
    updateThreshold,
    switchOperatingMode,
    refreshNow,
  } = useParking();

  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [thresholdVal, setThresholdVal] = useState<number>(status?.threshold_cm ?? 15.0);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const handleTestBackend = async () => {
    setIsTestingUrl(true);
    setTestResult(null);
    try {
      api.setBaseUrl(inputUrl);
      setApiUrl(inputUrl);
      const res = await api.checkHealth();
      setTestResult({
        ok: true,
        message: `Connected successfully! Flask backend returned status: "${res.status}". Hardware serial: ${
          res.hardware_connected ? 'Connected' : 'Waiting for Arduino'
        }`,
      });
      await refreshNow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setTestResult({
        ok: false,
        message: `Could not reach ${inputUrl}. Make sure 'python app.py' is running on port 5000. Error: ${msg}`,
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingThreshold(true);
    try {
      await updateThreshold(thresholdVal);
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Device & Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Hardware configuration, serial communication parameters, and API gateway routing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Specifications Box (1 Column) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">Hardware Specifications</h3>
          </div>

          <div className="space-y-3 text-xs divide-y divide-slate-100">
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Target Board:</span>
              <span className="font-semibold text-slate-800 font-mono">Arduino Uno R3</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Microcontroller:</span>
              <span className="font-semibold text-slate-800 font-mono">ATmega328P</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Distance Sensor:</span>
              <span className="font-semibold text-slate-800 font-mono">HC-SR04 Ultrasonic</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Sonar Frequency:</span>
              <span className="font-semibold text-slate-800 font-mono">40 kHz Sound Burst</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Pin Assignment:</span>
              <span className="font-mono text-slate-700 text-[11px]">Trig: D9 · Echo: D10</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Indicator Actuators:</span>
              <span className="font-mono text-slate-700 text-[11px]">Red: D7 · Green: D8</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Baud Rate:</span>
              <span className="font-semibold text-slate-800 font-mono">9600 Baud (8-N-1)</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Protocol Version:</span>
              <span className="font-mono text-slate-700">{status?.protocol_version || 'v1.2'}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Safety Architecture
            </div>
            <p>
              Direct raw shell and unsafe serial buffer inputs are disabled. All interactions pass strict validation through the local Python Flask service layer.
            </p>
          </div>
        </div>

        {/* Configuration Forms (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Flask Backend Gateway Configuration */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-700" />
                Flask REST Gateway Integration
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configures the local endpoint where the Python Flask serial bridge is hosted.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Backend API Base URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={e => setInputUrl(e.target.value)}
                    placeholder="http://127.0.0.1:5000/api"
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    onClick={handleTestBackend}
                    disabled={isTestingUrl}
                    className="px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingUrl ? 'animate-spin' : ''}`} />
                    <span>{isTestingUrl ? 'Pinging...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    testResult.ok
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  )}
                  <p className="leading-relaxed">{testResult.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Runtime Parameters & Threshold Tuning */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              Runtime Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Threshold */}
              <form onSubmit={handleSaveThreshold} className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Occupancy Distance Threshold (cm)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="400"
                    step="0.5"
                    value={thresholdVal}
                    onChange={e => setThresholdVal(parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={savingThreshold}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingThreshold ? 'Saving...' : 'Update'}
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Current hardware value: {status?.threshold_cm} cm
                </span>
              </form>

              {/* Polling Interval */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Client Polling Cadence
                </label>
                <select
                  value={pollingIntervalMs}
                  onChange={e => setPollingIntervalMs(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                >
                  <option value={500}>500 ms (Rapid Telemetry)</option>
                  <option value={1000}>1000 ms (Standard)</option>
                  <option value={2000}>2000 ms (Low Bandwidth)</option>
                  <option value={5000}>5000 ms (Conserve Power)</option>
                </select>
                <span className="text-[11px] text-slate-400 block">
                  Automatically pauses when browser tab is inactive.
                </span>
              </div>
            </div>

            {/* Mode selection radio */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700 block mb-2">
                Active Source Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setMode('simulation')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    mode === 'simulation'
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Simulation Mode</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      VIRTUAL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Runs autonomous vehicle arrival/departure physics locally. Great for demonstrations without hardware.
                  </p>
                </div>

                <div
                  onClick={() => setMode('hardware')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    mode === 'hardware'
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Hardware Mode</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      LIVE SERIAL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Connects directly to the Arduino Uno USB port via Python Flask serial proxy.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Defaults */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Reset Firmware to Factory Defaults</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Restores standard 15.0 cm threshold and switches firmware mode to AUTO.
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Reset all parameters to default?')) {
                  restoreDefaults();
                  setThresholdVal(15.0);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Reset Parameters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
