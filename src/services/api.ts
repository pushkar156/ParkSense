import {
  AnalyticsSummary,
  ConnectionMode,
  DeviceStatus,
  LedColor,
  LedState,
  OperatingMode,
  ParkingEvent,
  SensorReading,
} from '../types';
import { simulatorInstance } from './simulator';

const DEFAULT_API_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:5000/api';
const STORAGE_KEY_API_URL = 'parksense_api_base_url';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_API_URL;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEY_API_URL, this.baseUrl);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Server returned HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody.error) errorMsg = errBody.error;
          else if (errBody.message) errorMsg = errBody.message;
        } catch {
          // ignore parsing error
        }
        throw new Error(errorMsg);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Connection timed out. Flask backend at ' + this.baseUrl + ' did not respond.');
        }
        throw err;
      }
      throw new Error('Network error connecting to Flask backend.');
    }
  }

  // Check backend server health
  public async checkHealth(): Promise<{ status: string; hardware_connected: boolean }> {
    return this.request<{ status: string; hardware_connected: boolean }>('/health');
  }

  // Get status
  public async getStatus(mode: ConnectionMode): Promise<DeviceStatus> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      const data = await this.request<DeviceStatus>(`/status?mode=${queryMode}`);
      return {
        ...data,
        mode: queryMode,
        backend_reachable: true,
      };
    } catch {
      if (mode === 'simulation') {
        return simulatorInstance.getStatus();
      }
      return {
        connected: false,
        mode: 'hardware',
        firmware_mode: 'AUTO',
        baud_rate: 9600,
        port: 'Disconnected',
        sensor_health: 'offline',
        backend_reachable: false,
        last_reading_time: null,
        red_led: false,
        green_led: false,
        threshold_cm: 15.0,
        protocol_version: 'Unknown',
      };
    }
  }

  // Get latest reading
  public async getLatestReading(mode: ConnectionMode): Promise<SensorReading> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      return await this.request<SensorReading>(`/readings/latest?mode=${queryMode}`);
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.step();
      }
      throw err;
    }
  }

  // Get historical readings
  public async getReadings(
    mode: ConnectionMode,
    from?: number,
    to?: number,
    limit = 100
  ): Promise<SensorReading[]> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      const params = new URLSearchParams();
      params.set('mode', queryMode);
      if (from) params.set('from', from.toString());
      if (to) params.set('to', to.toString());
      params.set('limit', limit.toString());
      return await this.request<SensorReading[]>(`/readings?${params.toString()}`);
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.getReadings(from, to, limit);
      }
      throw err;
    }
  }

  // Get analytics summary
  public async getAnalytics(
    mode: ConnectionMode,
    from?: number,
    to?: number
  ): Promise<AnalyticsSummary> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      const params = new URLSearchParams();
      params.set('mode', queryMode);
      if (from) params.set('from', from.toString());
      if (to) params.set('to', to.toString());
      return await this.request<AnalyticsSummary>(`/analytics?${params.toString()}`);
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.getAnalytics(from, to);
      }
      throw err;
    }
  }

  // Get event logs
  public async getEvents(
    mode: ConnectionMode,
    options?: { type?: string; from?: number; to?: number; page?: number; limit?: number }
  ): Promise<{ events: ParkingEvent[]; total: number; page: number; limit: number; totalPages: number }> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      const params = new URLSearchParams();
      params.set('mode', queryMode);
      if (options?.type && options.type !== 'ALL') params.set('type', options.type);
      if (options?.from) params.set('from', options.from.toString());
      if (options?.to) params.set('to', options.to.toString());
      if (options?.page) params.set('page', options.page.toString());
      if (options?.limit) params.set('limit', options.limit.toString());
      return await this.request(`/events?${params.toString()}`);
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.getEvents(options);
      }
      throw err;
    }
  }

  // Send Mode command: AUTO or MANUAL
  public async setMode(
    mode: ConnectionMode,
    firmwareMode: OperatingMode
  ): Promise<{ success: boolean; mode: OperatingMode }> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      return await this.request<{ success: boolean; mode: OperatingMode }>(`/commands/mode?mode=${queryMode}`, {
        method: 'POST',
        body: JSON.stringify({ mode: firmwareMode }),
      });
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.setMode(firmwareMode);
      }
      throw err;
    }
  }

  // Send LED command in MANUAL mode
  public async setLed(
    mode: ConnectionMode,
    color: LedColor,
    state: LedState
  ): Promise<{ success: boolean; color: LedColor; state: LedState }> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      return await this.request<{ success: boolean; color: LedColor; state: LedState }>(`/commands/led?mode=${queryMode}`, {
        method: 'POST',
        body: JSON.stringify({ color, state }),
      });
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.setLed(color, state);
      }
      throw err;
    }
  }

  // Set Threshold
  public async setThreshold(
    mode: ConnectionMode,
    thresholdCm: number
  ): Promise<{ success: boolean; threshold_cm: number }> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      return await this.request<{ success: boolean; threshold_cm: number }>(`/settings?mode=${queryMode}`, {
        method: 'PATCH',
        body: JSON.stringify({ threshold_cm: thresholdCm }),
      });
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.setThreshold(thresholdCm);
      }
      throw err;
    }
  }

  // Restore defaults
  public async resetDevice(mode: ConnectionMode): Promise<{ success: boolean }> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      return await this.request<{ success: boolean }>(`/commands/reset?mode=${queryMode}`, {
        method: 'POST',
      });
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.resetDefaults();
      }
      throw err;
    }
  }

  // Clear events history
  public async clearHistory(mode: ConnectionMode): Promise<{ success: boolean }> {
    const queryMode = mode === 'simulation' ? 'simulation' : 'hardware';
    try {
      return await this.request<{ success: boolean }>(`/events/clear?mode=${queryMode}`, {
        method: 'POST',
      });
    } catch (err) {
      if (mode === 'simulation') {
        return simulatorInstance.clearHistory();
      }
      throw err;
    }
  }

  public async triggerSimArrival(): Promise<void> {
    try {
      await this.request('/commands/simulation', {
        method: 'POST',
        body: JSON.stringify({ action: 'arrival' }),
      });
    } catch {
      // offline simulation fallback
    }
  }

  public async triggerSimDeparture(): Promise<void> {
    try {
      await this.request('/commands/simulation', {
        method: 'POST',
        body: JSON.stringify({ action: 'departure' }),
      });
    } catch {
      // offline simulation fallback
    }
  }

  public async setSimDistance(val: number): Promise<void> {
    try {
      await this.request('/commands/simulation', {
        method: 'POST',
        body: JSON.stringify({ action: 'distance', value: val }),
      });
    } catch {
      // offline simulation fallback
    }
  }
}

export const api = new ApiClient();
