import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Calendar,
  Clock,
  Car,
  TrendingUp,
  BarChart2,
  PieChart as PieIcon,
  Timer,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { useParking } from '../context/ParkingContext';
import { api } from '../services/api';
import { AnalyticsSummary, SensorReading } from '../types';

export const AnalyticsPage: React.FC = () => {
  const { mode } = useParking();
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const rangeDurationMs = useMemo(() => {
    switch (timeRange) {
      case '1h':
        return 1 * 60 * 60 * 1000;
      case '6h':
        return 6 * 60 * 60 * 1000;
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
    }
  }, [timeRange]);

  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const to = Date.now();
        const from = to - rangeDurationMs;
        const res = await api.getAnalytics(mode, from, to);
        if (mounted) setAnalytics(res);
      } catch {
        if (mounted) setAnalytics(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAnalytics();
    return () => {
      mounted = false;
    };
  }, [mode, rangeDurationMs]);

  // Format seconds into human readable duration
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Export CSV function
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const to = Date.now();
      const from = to - rangeDurationMs;
      const readings = await api.getReadings(mode, from, to, 2000);

      if (readings.length === 0) {
        alert('No historical records found for this period to export.');
        return;
      }

      // Generate CSV content
      const headers = ['ID', 'Timestamp_ISO', 'Timestamp_UNIX', 'Distance_CM', 'Occupied', 'Mode', 'Threshold_CM', 'Source'];
      const rows = readings.map(r => [
        r.id,
        new Date(r.timestamp).toISOString(),
        r.timestamp,
        r.distance_cm,
        r.occupied ? 'TRUE' : 'FALSE',
        r.mode,
        r.threshold_cm,
        r.source,
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `parksense_telemetry_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Failed to generate CSV export.');
    } finally {
      setExporting(false);
    }
  };

  const hasData = analytics && analytics.total_recorded_readings > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Occupancy Analytics & Trends
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Statistical aggregation of ultrasonic sensor observations and bay utilization.
          </p>
        </div>

        {/* Controls: Time Range Selector + CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {(['1h', '6h', '24h', '7d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  timeRange === range
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            disabled={exporting || !hasData}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Occupancy Rate */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Bay Occupancy
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {hasData ? `${analytics?.occupancy_rate}%` : 'Not enough data'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Percent of time occupied</p>
        </div>

        {/* KPI 2: Total Arrivals */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Total Arrivals
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {hasData ? analytics?.total_arrivals : 'Not enough data'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Vehicles parked</p>
        </div>

        {/* KPI 3: Total Departures */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Total Departures
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {hasData ? analytics?.total_departures : 'Not enough data'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Vehicles departed</p>
        </div>

        {/* KPI 4: Avg Dwell Time */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Avg Occupied Duration
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {hasData ? formatDuration(analytics?.avg_occupied_duration_sec || 0) : 'Not enough data'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Average parking duration</p>
        </div>

        {/* KPI 5: Max Dwell Time */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Longest Session
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {hasData ? formatDuration(analytics?.longest_occupied_duration_sec || 0) : 'Not enough data'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Peak stationary duration</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Hourly Activity Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-600" />
              Hourly Traffic & Arrivals (24-Hour Profile)
            </h3>
            <p className="text-xs text-slate-500">
              Distribution of vehicle ingress and egress across daytime hours.
            </p>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aggregating hourly buckets...
              </div>
            ) : !hasData || !analytics?.hourly_distribution.length ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Not enough data yet for hourly distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.hourly_distribution}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-800 space-y-1">
                            <p className="font-mono text-[11px] text-slate-400">Hour: {d.hour}</p>
                            <p className="text-emerald-400">Arrivals: {d.arrivals}</p>
                            <p className="text-amber-400">Departures: {d.departures}</p>
                            <p className="text-slate-300">Occupancy: {d.occupancy_pct}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                  />
                  <Bar dataKey="arrivals" name="Arrivals" fill="#059669" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="departures" name="Departures" fill="#d97706" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Occupancy Timeline Curve */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              Ultrasonic Distance Trend Over Time
            </h3>
            <p className="text-xs text-slate-500">
              Sensor distance (cm) telemetry stream for the selected time horizon.
            </p>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading timeline...
              </div>
            ) : !hasData || !analytics?.timeline.length ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Not enough data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.timeline}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
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
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-lg border border-slate-800 space-y-1">
                            <p className="font-mono text-[11px] text-slate-400">{d.time}</p>
                            <p className="font-semibold">
                              Distance: <span className="font-mono">{d.distance_cm} cm</span>
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
                  <Area
                    type="monotone"
                    dataKey="distance_cm"
                    stroke="#059669"
                    strokeWidth={1.75}
                    fill="url(#analyticsGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Summary Breakdown Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          Bay Availability vs Occupancy Ratio
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Calculated from {analytics?.total_recorded_readings || 0} telemetry readings stored in local SQLite database.
        </p>

        {hasData ? (
          <div className="space-y-3">
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
              <div
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${analytics?.occupied_pct || 0}%` }}
                title={`Occupied: ${analytics?.occupied_pct}%`}
              />
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${analytics?.available_pct || 100}%` }}
                title={`Available: ${analytics?.available_pct}%`}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span className="text-slate-700">Occupied: {analytics?.occupied_pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                <span className="text-slate-700">Available: {analytics?.available_pct}%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Not enough data yet to calculate ratio.</p>
        )}
      </div>
    </div>
  );
};
