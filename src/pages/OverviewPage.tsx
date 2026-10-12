import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  Ruler,
  Percent,
  Activity,
  ArrowRight,
  Cpu,
  Wifi,
  Radio,
  Clock,
  AlertCircle,
  HelpCircle,
  Sliders,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useParking } from '../context/ParkingContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { api } from '../services/api';
import { AnalyticsSummary } from '../types';

export const OverviewPage: React.FC = () => {
  const { mode, status, latestReading, events } = useParking();
  const [timeFilter, setTimeFilter] = useState<'1h' | '24h' | '7d'>('24h');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Calculate time range
  const timeRangeMs = useMemo(() => {
    switch (timeFilter) {
      case '1h':
        return 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
    }
  }, [timeFilter]);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalyticsData = async () => {
      setLoadingAnalytics(true);
      try {
        const to = Date.now();
        const from = to - timeRangeMs;
        const res = await api.getAnalytics(mode, from, to);
        if (isMounted) {
          setAnalytics(res);
        }
      } catch {
        if (isMounted) setAnalytics(null);
      } finally {
        if (isMounted) setLoadingAnalytics(false);
      }
    };

    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mode, timeRangeMs]);

  const isHardware = mode === 'hardware';
  const isHardwareOffline = isHardware && (!status?.backend_reachable || !status?.connected);

  const currentDistance = latestReading?.distance_cm ?? null;
  const threshold = status?.threshold_cm ?? 15.0;
  const isOccupied = latestReading?.occupied ?? false;

  // Recent 5 events
  const recentEvents = events.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with Title, Subtitle, and Time Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Parking Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor occupancy, sensor activity, and device health in real time.
          </p>
        </div>

        {/* Time Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto">
          {(['1h', '24h', '7d'] as const).map(period => (
            <button
              key={period}
              onClick={() => setTimeFilter(period)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                timeFilter === period
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {period === '1h' ? 'Last hour' : period === '24h' ? 'Last 24 hours' : 'Last 7 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Hardware Offline Warning Callout if applicable */}
      {isHardwareOffline && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Flask Backend / Arduino Unreachable</h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Cannot connect to serial gateway at <code className="font-mono bg-rose-100/60 px-1 rounded">{api.getBaseUrl()}</code>.
                Make sure <code className="font-mono bg-rose-100/60 px-1 rounded">python app.py</code> is running or switch to Simulation mode.
              </p>
            </div>
          </div>
          <Link
            to="/guide"
            className="px-3 py-1.5 text-xs font-medium bg-rose-900 text-white rounded-lg hover:bg-rose-800 transition-colors whitespace-nowrap shrink-0"
          >
            Setup Guide & Code
          </Link>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current Status */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Current Status</span>
            <Car className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            {isHardwareOffline ? (
              <span className="text-lg font-semibold text-slate-400 font-mono">Offline</span>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-bold tracking-tight ${
                    isOccupied ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {isOccupied ? 'Occupied' : 'Available'}
                </span>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {isHardwareOffline
                ? 'Awaiting hardware telemetry'
                : isOccupied
                ? `Vehicle in bay (< ${threshold} cm)`
                : `Bay vacant (>= ${threshold} cm)`}
            </p>
          </div>
        </div>

        {/* Metric 2: Current Distance */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Current Distance</span>
            <Ruler className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {isHardwareOffline || currentDistance === null ? '—' : currentDistance.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500">cm</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              HC-SR04 sonar · Threshold {threshold} cm
            </p>
          </div>
        </div>

        {/* Metric 3: Occupancy Rate */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Occupancy Rate</span>
            <Percent className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {analytics ? `${analytics.occupancy_rate}%` : '—'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              For {timeFilter === '1h' ? 'last hour' : timeFilter === '24h' ? 'last 24 hours' : 'last 7 days'}
            </p>
          </div>
        </div>

        {/* Metric 4: Parking Events */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Parking Events</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {analytics
                  ? analytics.total_arrivals + analytics.total_departures
                  : events.length}
              </span>
              <span className="text-xs text-slate-500">total</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {analytics
                ? `${analytics.total_arrivals} in · ${analytics.total_departures} out`
                : 'Arrivals & departures'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Sensor Panel & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Sensor Visualizer Panel (1 Column) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-700" />
                Live Sensor Telemetry
              </h3>
              <StatusBadge
                status={isHardwareOffline ? 'offline' : isOccupied ? 'occupied' : 'available'}
                label={isHardwareOffline ? 'Offline' : isOccupied ? 'Occupied' : 'Vacant'}
              />
            </div>

            {/* Ultrasonic Radar / Bay Visual Graphic */}
            <div className="relative h-44 rounded-lg bg-slate-50 border border-slate-200 p-4 flex flex-col items-center justify-between overflow-hidden">
              {/* Sensor emitter symbol at top */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-6 bg-slate-800 rounded-t-md flex items-center justify-around px-1 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-0.5">HC-SR04 SENSOR</span>
              </div>

              {/* Dynamic distance sound waves & vehicle indicator */}
              <div className="flex-1 w-full flex flex-col items-center justify-center relative">
                {isHardwareOffline ? (
                  <p className="text-xs text-slate-400 font-medium">No live stream</p>
                ) : (
                  <>
                    {/* Beam lines */}
                    <div
                      className={`w-full max-w-[200px] border-b-2 transition-all duration-300 ${
                        isOccupied ? 'border-rose-400' : 'border-emerald-400'
                      }`}
                    />
                    <div className="mt-2 text-center">
                      <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                        {currentDistance !== null ? currentDistance.toFixed(1) : '—'}
                      </span>
                      <span className="text-sm text-slate-500 ml-1">cm</span>
                    </div>

                    {/* Threshold distance indicator */}
                    <span className="text-[11px] text-slate-400 mt-1">
                      Detection Threshold: <strong className="text-slate-700 font-mono">{threshold} cm</strong>
                    </span>
                  </>
                )}
              </div>

              {/* Bay floor marker */}
              <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-200 pt-1">
                <span>0 cm</span>
                <span className="text-slate-600 font-semibold">PARKING BAY #01</span>
                <span>200+ cm</span>
              </div>
            </div>
          </div>

          {/* Quick info list */}
          <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-500">Operating Mode:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {status?.firmware_mode || 'AUTO'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-500">Hardware LEDs:</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      latestReading?.red_led ? 'bg-rose-500 shadow-xs' : 'bg-slate-300'
                    }`}
                  />
                  RED
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      latestReading?.green_led ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300'
                    }`}
                  />
                  GREEN
                </span>
              </div>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-500">Telemetry Stream:</span>
              <span className="text-slate-800 font-mono tabular-nums">
                {mode === 'simulation' ? 'Simulated (1s)' : 'Serial USB (9600)'}
              </span>
            </div>
          </div>
        </div>

        {/* Occupancy Timeline Chart (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Ultrasonic Distance & Occupancy Timeline
              </h3>
              <p className="text-xs text-slate-500">
                Historical distance readings (cm) mapped against the {threshold} cm threshold marker.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                <span>Distance (cm)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-rose-500 inline-block border-t border-dashed" />
                <span>Threshold ({threshold} cm)</span>
              </span>
            </div>
          </div>

          {/* Timeline Chart */}
          <div className="h-64 w-full">
            {loadingAnalytics ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading telemetry records...
              </div>
            ) : !analytics || analytics.timeline.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <p>No historical telemetry available for this period.</p>
                <p className="text-[11px] text-slate-400 mt-1">Readings will appear as the sensor streams.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.timeline}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="distanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
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
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-800 space-y-1">
                            <p className="font-mono text-[11px] text-slate-400">{data.time}</p>
                            <p className="font-semibold">
                              Distance: <span className="font-mono">{data.distance_cm} cm</span>
                            </p>
                            <p className="text-[11px]">
                              Status:{' '}
                              <span
                                className={`font-semibold ${
                                  data.occupied ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {data.occupied ? 'Occupied' : 'Vacant'}
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={threshold}
                    stroke="#e11d48"
                    strokeDasharray="4 4"
                    label={{
                      value: `Threshold ${threshold}cm`,
                      fill: '#e11d48',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="distance_cm"
                    stroke="#059669"
                    strokeWidth={1.75}
                    fillOpacity={1}
                    fill="url(#distanceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Device Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Status Card (1 Column) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-600" />
              Hardware & Gateway Diagnostics
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Arduino Controller</span>
                <span className="font-medium text-slate-900 font-mono">
                  {status?.port || 'ATmega328P (Uno)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sensor Model</span>
                <span className="font-medium text-slate-900 font-mono">HC-SR04 Ultrasonic</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Flask REST Gateway</span>
                <span
                  className={`font-semibold ${
                    isHardware
                      ? status?.backend_reachable
                        ? 'text-emerald-700'
                        : 'text-rose-600'
                      : 'text-blue-700'
                  }`}
                >
                  {isHardware
                    ? status?.backend_reachable
                      ? 'Reachable (5000)'
                      : 'Unreachable'
                    : 'In-Browser Mock'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Serial Baud Rate</span>
                <span className="font-mono text-slate-700">9600 8-N-1</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Active Connection Mode</span>
                <span className="font-semibold uppercase tracking-wider text-slate-800 text-[11px] font-mono">
                  {mode}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Link
              to="/settings"
              className="text-xs font-medium text-emerald-800 hover:text-emerald-900 flex items-center gap-1.5"
            >
              <span>Manage hardware configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent Activity Table (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recent Parking Activity</h3>
                <p className="text-xs text-slate-500">The 5 latest arrivals, departures, and state shifts.</p>
              </div>
              <Link
                to="/events"
                className="text-xs font-medium text-emerald-800 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>View all events</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Event Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-2 pr-3 font-medium">Timestamp</th>
                    <th className="py-2 px-3 font-medium">Event</th>
                    <th className="py-2 px-3 font-medium text-right">Distance</th>
                    <th className="py-2 px-3 font-medium">Previous</th>
                    <th className="py-2 pl-3 font-medium">New State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No events logged yet.
                      </td>
                    </tr>
                  ) : (
                    recentEvents.map(evt => (
                      <tr key={evt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pr-3 font-mono text-slate-600 tabular-nums">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block font-medium ${
                              evt.event_type === 'ARRIVAL'
                                ? 'text-rose-700 font-semibold'
                                : evt.event_type === 'DEPARTURE'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-slate-700'
                            }`}
                          >
                            {evt.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-800">
                          {evt.distance_cm.toFixed(1)} cm
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {evt.previous_state}
                        </td>
                        <td className="py-2.5 pl-3 font-semibold text-[11px] font-mono">
                          <span
                            className={
                              evt.new_state === 'OCCUPIED'
                                ? 'text-rose-600'
                                : evt.new_state === 'AVAILABLE'
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                            }
                          >
                            {evt.new_state}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total recorded events: {events.length}</span>
            <span className="font-mono text-[11px]">Audit protocol v1.2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
