export type ConnectionMode = 'simulation' | 'hardware' | 'simulated';

export type OperatingMode = 'AUTO' | 'MANUAL';

export type LedColor = 'RED' | 'GREEN';
export type LedState = 'ON' | 'OFF';

export interface SensorReading {
  id: string;
  timestamp: number;
  distance_cm: number;
  occupied: boolean;
  mode: OperatingMode;
  threshold_cm: number;
  red_led: boolean;
  green_led: boolean;
  source: ConnectionMode;
}

export type EventType =
  | 'ARRIVAL'
  | 'DEPARTURE'
  | 'MODE_CHANGE'
  | 'LED_TOGGLE'
  | 'THRESHOLD_UPDATE'
  | 'DEVICE_RESET'
  | 'CONNECTION_CHANGE';

export interface ParkingEvent {
  id: string;
  timestamp: number;
  event_type: EventType;
  distance_cm: number;
  previous_state: string;
  new_state: string;
  mode: OperatingMode;
  source: ConnectionMode;
  details: string;
}

export interface DeviceStatus {
  connected: boolean;
  mode: ConnectionMode;
  firmware_mode: OperatingMode;
  baud_rate: number;
  port: string;
  sensor_health: 'healthy' | 'warning' | 'offline';
  backend_reachable: boolean;
  last_reading_time: number | null;
  red_led: boolean;
  green_led: boolean;
  threshold_cm: number;
  protocol_version: string;
}

export interface AnalyticsSummary {
  occupancy_rate: number;
  total_arrivals: number;
  total_departures: number;
  avg_occupied_duration_sec: number;
  longest_occupied_duration_sec: number;
  total_recorded_readings: number;
  available_pct: number;
  occupied_pct: number;
  hourly_distribution: {
    hour: string;
    arrivals: number;
    departures: number;
    occupancy_pct: number;
  }[];
  timeline: {
    timestamp: number;
    time: string;
    distance_cm: number;
    occupied: boolean;
    threshold_cm: number;
  }[];
}

export interface AppSettings {
  apiUrl: string;
  pollingIntervalMs: number;
  defaultThresholdCm: number;
  connectionMode: ConnectionMode;
  simulationNoise: boolean;
  autoReconnect: boolean;
}
