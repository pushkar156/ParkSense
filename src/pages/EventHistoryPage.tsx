import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Car,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Lightbulb,
} from 'lucide-react';
import { useParking } from '../context/ParkingContext';
import { api } from '../services/api';
import { ParkingEvent } from '../types';

export const EventHistoryPage: React.FC = () => {
  const { mode, clearEventHistory } = useParking();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [eventsList, setEventsList] = useState<ParkingEvent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const typeParam = filterType === 'ALL' ? undefined : filterType;
      const res = await api.getEvents(mode, {
        type: typeParam,
        page: currentPage,
        limit: pageSize,
      });

      let filtered = res.events;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          e =>
            e.event_type.toLowerCase().includes(query) ||
            e.details.toLowerCase().includes(query) ||
            e.previous_state.toLowerCase().includes(query) ||
            e.new_state.toLowerCase().includes(query)
        );
      }

      setEventsList(filtered);
      setTotalCount(res.total);
      setTotalPages(Math.max(1, Math.ceil(res.total / pageSize)));
    } catch {
      setEventsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [mode, filterType, currentPage, pageSize]);

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await clearEventHistory();
      setIsConfirmingClear(false);
      setCurrentPage(1);
      await fetchEvents();
    } finally {
      setIsClearing(false);
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'ARRIVAL':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'DEPARTURE':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'MODE_CHANGE':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'LED_TOGGLE':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'THRESHOLD_UPDATE':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'DEVICE_RESET':
        return 'text-slate-700 bg-slate-100 border-slate-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Event Audit History
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable log of detected vehicle movements, threshold triggers, and hardware commands.
          </p>
        </div>

        {/* Clear History Button */}
        <button
          onClick={() => setIsConfirmingClear(true)}
          className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      {/* Confirmation Modal for Clear History */}
      {isConfirmingClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm History Purge</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete all historical parking logs? This operation cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                disabled={isClearing}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {isClearing ? 'Purging...' : 'Yes, Delete All Events'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'ARRIVAL', label: 'Arrival' },
            { id: 'DEPARTURE', label: 'Departure' },
            { id: 'MODE_CHANGE', label: 'Mode Changes' },
            { id: 'LED_TOGGLE', label: 'LED Commands' },
            { id: 'THRESHOLD_UPDATE', label: 'Threshold Updates' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterType(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search details or state..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Events Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Event Type</th>
                <th className="py-3 px-4 font-semibold text-right">Distance (cm)</th>
                <th className="py-3 px-4 font-semibold">Previous State</th>
                <th className="py-3 px-4 font-semibold">New State</th>
                <th className="py-3 px-4 font-semibold">Mode</th>
                <th className="py-3 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                // Skeletons
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-200 rounded w-24" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-200 rounded w-16" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-3.5 bg-slate-200 rounded w-12 ml-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-200 rounded w-16" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-200 rounded w-16" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-200 rounded w-12" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-200 rounded w-48" />
                    </td>
                  </tr>
                ))
              ) : eventsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-medium">No events match your current filter.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try selecting "All Events" or clearing your search term.
                    </p>
                  </td>
                </tr>
              ) : (
                eventsList.map(evt => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>

                    {/* Event Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getEventBadge(
                          evt.event_type
                        )}`}
                      >
                        {evt.event_type}
                      </span>
                    </td>

                    {/* Distance */}
                    <td className="py-3 px-4 font-mono text-right tabular-nums text-slate-800 font-semibold whitespace-nowrap">
                      {evt.distance_cm.toFixed(1)}
                    </td>

                    {/* Previous State */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {evt.previous_state}
                    </td>

                    {/* New State */}
                    <td className="py-3 px-4 font-mono text-[11px] font-semibold whitespace-nowrap">
                      <span
                        className={
                          evt.new_state === 'OCCUPIED'
                            ? 'text-rose-600'
                            : evt.new_state === 'AVAILABLE'
                            ? 'text-emerald-700'
                            : 'text-slate-800'
                        }
                      >
                        {evt.new_state}
                      </span>
                    </td>

                    {/* Mode */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {evt.mode}
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-slate-600 text-xs max-w-xs truncate">
                      {evt.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing{' '}
            <strong className="text-slate-900 font-mono">
              {eventsList.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-900 font-mono">
              {Math.min(currentPage * pageSize, totalCount)}
            </strong>{' '}
            of <strong className="text-slate-900 font-mono">{totalCount}</strong> recorded events
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
