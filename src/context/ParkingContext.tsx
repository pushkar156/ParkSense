import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  ConnectionMode,
  DeviceStatus,
  LedColor,
  LedState,
  OperatingMode,
  ParkingEvent,
  SensorReading,
} from '../types';
import { api } from '../services/api';
import { simulatorInstance } from '../services/simulator';

interface CommandFeedback {
  id: string;
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: number;
}

interface ParkingContextType {
  mode: ConnectionMode;
  setMode: (mode: ConnectionMode) => void;
  status: DeviceStatus | null;
  latestReading: SensorReading | null;
  recentReadings: SensorReading[];
  events: ParkingEvent[];
  pollingIntervalMs: number;
  setPollingIntervalMs: (ms: number) => void;
  feedback: CommandFeedback | null;
  clearFeedback: () => void;
  isPollingPaused: boolean;
  setIsPollingPaused: (paused: boolean) => void;
  // Commands
  switchOperatingMode: (mode: OperatingMode) => Promise<void>;
  toggleLed: (color: LedColor, state: LedState) => Promise<void>;
  updateThreshold: (cm: number) => Promise<void>;
  restoreDefaults: () => Promise<void>;
  clearEventHistory: () => Promise<void>;
  // Simulator specific helpers
  triggerArrival: () => void;
  triggerDeparture: () => void;
  setManualSimDistance: (cm: number) => void;
  refreshNow: () => Promise<void>;
  apiUrl: string;
  setApiUrl: (url: string) => void;
}

const ParkingContext = createContext<ParkingContextType | undefined>(undefined);

export const ParkingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ConnectionMode>(() => {
    return (localStorage.getItem('parksense_mode') as ConnectionMode) || 'simulation';
  });

  const [pollingIntervalMs, setPollingIntervalMs] = useState<number>(1000);
  const [isPollingPaused, setIsPollingPaused] = useState<boolean>(false);
  const [apiUrl, setApiUrlState] = useState<string>(api.getBaseUrl());

  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [recentReadings, setRecentReadings] = useState<SensorReading[]>([]);
  const [events, setEvents] = useState<ParkingEvent[]>([]);
  const [feedback, setFeedback] = useState<CommandFeedback | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestInProgress = useRef<boolean>(false);

  const setApiUrl = (url: string) => {
    api.setBaseUrl(url);
    setApiUrlState(api.getBaseUrl());
  };

  const showFeedback = (type: 'info' | 'success' | 'error', message: string) => {
    setFeedback({
      id: Math.random().toString(),
      type,
      message,
      timestamp: Date.now(),
    });
  };

  const clearFeedback = () => setFeedback(null);

  const setMode = (newMode: ConnectionMode) => {
    setModeState(newMode);
    localStorage.setItem('parksense_mode', newMode);
    showFeedback(
      'info',
      newMode === 'simulation'
        ? 'Switched to Simulation Mode. Using local IoT ultrasonic model.'
        : 'Switched to Hardware Mode. Polling local Flask serial gateway.'
    );
  };

  // Fetch cycle
  const fetchCycle = useCallback(async () => {
    if (isRequestInProgress.current) return;
    isRequestInProgress.current = true;

    try {
      // 1. Get status
      const devStatus = await api.getStatus(mode);
      setStatus(devStatus);

      // 2. If hardware mode is offline, don't generate fake reading
      if (mode === 'hardware' && (!devStatus.backend_reachable || !devStatus.connected)) {
        // Backend or Arduino is offline
        setLatestReading(null);
      } else {
        // 3. Get latest reading
        const reading = await api.getLatestReading(mode);
        setLatestReading(reading);

        // Keep rolling buffer of recent readings
        setRecentReadings(prev => {
          const next = [...prev, reading];
          return next.slice(-40);
        });
      }

      // 4. Fetch recent events
      const evtData = await api.getEvents(mode, { limit: 15 });
      setEvents(evtData.events);
    } catch (err: unknown) {
      if (mode === 'hardware') {
        setStatus(prev =>
          prev
            ? { ...prev, backend_reachable: false, sensor_health: 'offline', connected: false }
            : null
        );
      }
    } finally {
      isRequestInProgress.current = false;
    }
  }, [mode]);

  // Page visibility API listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPollingPaused(true);
      } else {
        setIsPollingPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Polling loop
  useEffect(() => {
    if (isPollingPaused) return;

    fetchCycle();

    pollingRef.current = setInterval(() => {
      fetchCycle();
    }, pollingIntervalMs);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchCycle, pollingIntervalMs, isPollingPaused]);

  // Commands
  const switchOperatingMode = async (newMode: OperatingMode) => {
    showFeedback('info', `Sending MODE:${newMode} command to firmware...`);
    try {
      await api.setMode(mode, newMode);
      showFeedback('success', `Operating mode switched to ${newMode}`);
      await fetchCycle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to switch mode';
      showFeedback('error', msg);
    }
  };

  const toggleLed = async (color: LedColor, state: LedState) => {
    if (status?.firmware_mode === 'AUTO') {
      showFeedback('error', 'Cannot manually control LEDs in AUTO mode. Switch to MANUAL mode first.');
      return;
    }
    showFeedback('info', `Sending LED:${color}:${state} command...`);
    try {
      await api.setLed(mode, color, state);
      showFeedback('success', `Turned ${color} LED ${state}`);
      await fetchCycle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Command rejected by hardware';
      showFeedback('error', msg);
    }
  };

  const updateThreshold = async (cm: number) => {
    showFeedback('info', `Updating detection threshold to ${cm} cm...`);
    try {
      await api.setThreshold(mode, cm);
      showFeedback('success', `Threshold updated to ${cm} cm`);
      await fetchCycle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update threshold';
      showFeedback('error', msg);
    }
  };

  const restoreDefaults = async () => {
    showFeedback('info', 'Restoring Arduino firmware defaults...');
    try {
      await api.resetDevice(mode);
      showFeedback('success', 'Reset complete: Mode set to AUTO, Threshold restored to 15.0 cm');
      await fetchCycle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      showFeedback('error', msg);
    }
  };

  const clearEventHistory = async () => {
    showFeedback('info', 'Purging event history...');
    try {
      await api.clearHistory(mode);
      showFeedback('success', 'Event history cleared successfully');
      await fetchCycle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear events';
      showFeedback('error', msg);
    }
  };

  const triggerArrival = () => {
    if (mode === 'simulation') {
      simulatorInstance.triggerCarArrival();
      api.triggerSimArrival().catch(() => {});
      showFeedback('info', 'Simulated vehicle approaching parking bay...');
    }
  };

  const triggerDeparture = () => {
    if (mode === 'simulation') {
      simulatorInstance.triggerCarDeparture();
      api.triggerSimDeparture().catch(() => {});
      showFeedback('info', 'Simulated vehicle departing parking bay...');
    }
  };

  const setManualSimDistance = (cm: number) => {
    if (mode === 'simulation') {
      simulatorInstance.setManualDistance(cm);
      api.setSimDistance(cm).catch(() => {});
    }
  };

  const refreshNow = async () => {
    await fetchCycle();
  };

  return (
    <ParkingContext.Provider
      value={{
        mode,
        setMode,
        status,
        latestReading,
        recentReadings,
        events,
        pollingIntervalMs,
        setPollingIntervalMs,
        feedback,
        clearFeedback,
        isPollingPaused,
        setIsPollingPaused,
        switchOperatingMode,
        toggleLed,
        updateThreshold,
        restoreDefaults,
        clearEventHistory,
        triggerArrival,
        triggerDeparture,
        setManualSimDistance,
        refreshNow,
        apiUrl,
        setApiUrl,
      }}
    >
      {children}
    </ParkingContext.Provider>
  );
};

export const useParking = () => {
  const context = useContext(ParkingContext);
  if (!context) {
    throw new Error('useParking must be used within a ParkingProvider');
  }
  return context;
};
