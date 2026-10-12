import { AnalyticsSummary, OperatingMode, ParkingEvent, SensorReading } from '../types';

interface SimulatorState {
  distance_cm: number;
  threshold_cm: number;
  mode: OperatingMode;
  red_led: boolean;
  green_led: boolean;
  occupied: boolean;
  vehicle_state: 'VACANT' | 'APPROACHING' | 'PARKED' | 'DEPARTING';
  state_timer: number;
  last_state_change: number;
}

const STORAGE_KEY_READINGS = 'parksense_sim_readings_v2';
const STORAGE_KEY_EVENTS = 'parksense_sim_events_v2';

export class IoTDeviceSimulator {
  private state: SimulatorState;
  private readings: SensorReading[] = [];
  private events: ParkingEvent[] = [];

  constructor() {
    this.state = {
      distance_cm: 185.2,
      threshold_cm: 15.0,
      mode: 'AUTO',
      red_led: false,
      green_led: true,
      occupied: false,
      vehicle_state: 'VACANT',
      state_timer: 0,
      last_state_change: Date.now() - 3600000,
    };

    this.loadPersistedData();
    if (this.readings.length === 0) {
      this.seedInitialHistory();
    }
  }

  private loadPersistedData() {
    try {
      const storedReadings = localStorage.getItem(STORAGE_KEY_READINGS);
      if (storedReadings) {
        this.readings = JSON.parse(storedReadings);
      }
      const storedEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (storedEvents) {
        this.events = JSON.parse(storedEvents);
      }
    } catch {
      this.readings = [];
      this.events = [];
    }
  }

  private persistData() {
    try {
      // Keep last 1500 readings in localStorage to prevent bloat
      if (this.readings.length > 1500) {
        this.readings = this.readings.slice(-1500);
      }
      localStorage.setItem(STORAGE_KEY_READINGS, JSON.stringify(this.readings));
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events.slice(-500)));
    } catch {
      // Handle quota issues quietly
    }
  }

  /**
   * Generates realistic 24-hour historical parking records for analytics
   */
  private seedInitialHistory() {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const initialEvents: ParkingEvent[] = [];
    const initialReadings: SensorReading[] = [];

    // Simulate day schedule: multiple parking sessions
    let currentTime = twentyFourHoursAgo;
    let isOccupied = false;
    let currentDistance = 190.0;
    const threshold = 15.0;

    // Simulation points every 2 minutes for 24h
    while (currentTime <= now) {
      const date = new Date(currentTime);
      const hour = date.getHours();

      // Higher parking probability during college hours (9 AM - 5 PM)
      const collegeHours = hour >= 9 && hour <= 17;
      const probFlip = collegeHours ? 0.08 : 0.02;

      if (Math.random() < probFlip) {
        const wasOccupied = isOccupied;
        isOccupied = !isOccupied;

        if (isOccupied) {
          // Car arrived
          currentDistance = Number((8.0 + Math.random() * 5.0).toFixed(1));
          initialEvents.push({
            id: `evt-seed-${currentTime}`,
            timestamp: currentTime,
            event_type: 'ARRIVAL',
            distance_cm: currentDistance,
            previous_state: 'AVAILABLE',
            new_state: 'OCCUPIED',
            mode: 'AUTO',
            source: 'simulated',
            details: `Vehicle detected at ${currentDistance} cm (Threshold: ${threshold} cm)`,
          });
        } else {
          // Car departed
          currentDistance = Number((160.0 + Math.random() * 50.0).toFixed(1));
          initialEvents.push({
            id: `evt-seed-${currentTime}`,
            timestamp: currentTime,
            event_type: 'DEPARTURE',
            distance_cm: currentDistance,
            previous_state: 'OCCUPIED',
            new_state: 'AVAILABLE',
            mode: 'AUTO',
            source: 'simulated',
            details: `Bay cleared. Distance: ${currentDistance} cm`,
          });
        }
      } else {
        // Minor ultrasonic sensor noise
        const noise = (Math.random() - 0.5) * 0.4;
        if (isOccupied) {
          currentDistance = Math.max(7.5, Math.min(14.5, Number((currentDistance + noise).toFixed(1))));
        } else {
          currentDistance = Math.max(160, Math.min(240, Number((currentDistance + noise * 2).toFixed(1))));
        }
      }

      initialReadings.push({
        id: `rd-seed-${currentTime}`,
        timestamp: currentTime,
        distance_cm: currentDistance,
        occupied: isOccupied,
        mode: 'AUTO',
        threshold_cm: threshold,
        red_led: isOccupied,
        green_led: !isOccupied,
        source: 'simulated',
      });

      currentTime += 2 * 60 * 1000; // 2 minutes
    }

    this.events = initialEvents;
    this.readings = initialReadings;
    this.persistData();

    // Set simulator current state to match latest reading
    const latest = initialReadings[initialReadings.length - 1];
    if (latest) {
      this.state.distance_cm = latest.distance_cm;
      this.state.occupied = latest.occupied;
      this.state.vehicle_state = latest.occupied ? 'PARKED' : 'VACANT';
      this.updateLeds();
    }
  }

  private updateLeds() {
    if (this.state.mode === 'AUTO') {
      if (this.state.occupied) {
        this.state.red_led = true;
        this.state.green_led = false;
      } else {
        this.state.red_led = false;
        this.state.green_led = true;
      }
    }
  }

  /**
   * Advances the vehicle physics and sensor readings
   */
  public step(): SensorReading {
    this.state.state_timer += 1;

    // Vehicle physics state machine for dynamic realism
    switch (this.state.vehicle_state) {
      case 'VACANT':
        // Ultrasonic bounce on empty bay ground/wall with slight drift
        const emptyNoise = (Math.random() - 0.5) * 0.8;
        this.state.distance_cm = Math.max(170, Math.min(220, Number((this.state.distance_cm + emptyNoise).toFixed(1))));
        break;

      case 'APPROACHING':
        // Car moving closer into bay
        this.state.distance_cm = Math.max(9.5, Number((this.state.distance_cm - 8.5).toFixed(1)));
        if (this.state.distance_cm <= 13.0) {
          this.state.vehicle_state = 'PARKED';
        }
        break;

      case 'PARKED':
        // Stationary car in bay (HC-SR04 reading vehicle bumper)
        const parkedNoise = (Math.random() - 0.5) * 0.3;
        this.state.distance_cm = Math.max(8.0, Math.min(13.8, Number((this.state.distance_cm + parkedNoise).toFixed(1))));
        break;

      case 'DEPARTING':
        // Car backing away
        this.state.distance_cm = Math.min(195.0, Number((this.state.distance_cm + 14.0).toFixed(1)));
        if (this.state.distance_cm >= 180.0) {
          this.state.vehicle_state = 'VACANT';
        }
        break;
    }

    const previousOccupied = this.state.occupied;
    const nowOccupied = this.state.distance_cm < this.state.threshold_cm;

    if (previousOccupied !== nowOccupied) {
      this.state.occupied = nowOccupied;
      this.state.last_state_change = Date.now();
      this.updateLeds();

      // Emit event
      const eventType = nowOccupied ? 'ARRIVAL' : 'DEPARTURE';
      this.addEvent({
        event_type: eventType,
        distance_cm: this.state.distance_cm,
        previous_state: previousOccupied ? 'OCCUPIED' : 'AVAILABLE',
        new_state: nowOccupied ? 'OCCUPIED' : 'AVAILABLE',
        mode: this.state.mode,
        details: nowOccupied
          ? `Vehicle entered bay. Distance ${this.state.distance_cm} cm < ${this.state.threshold_cm} cm`
          : `Vehicle departed. Distance ${this.state.distance_cm} cm >= ${this.state.threshold_cm} cm`,
      });
    }

    const reading: SensorReading = {
      id: `rd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      distance_cm: this.state.distance_cm,
      occupied: this.state.occupied,
      mode: this.state.mode,
      threshold_cm: this.state.threshold_cm,
      red_led: this.state.red_led,
      green_led: this.state.green_led,
      source: 'simulated',
    };

    this.readings.push(reading);
    this.persistData();
    return reading;
  }

  public getLatestReading(): SensorReading {
    if (this.readings.length > 0) {
      return this.readings[this.readings.length - 1];
    }
    return this.step();
  }

  public getReadings(from?: number, to?: number, limit = 100): SensorReading[] {
    let result = [...this.readings];
    if (from) result = result.filter(r => r.timestamp >= from);
    if (to) result = result.filter(r => r.timestamp <= to);
    return result.slice(-limit);
  }

  public getEvents(filter?: { type?: string; from?: number; to?: number; page?: number; limit?: number }) {
    let list = [...this.events].reverse();
    if (filter?.type && filter.type !== 'ALL') {
      list = list.filter(e => e.event_type === filter.type);
    }
    if (filter?.from) list = list.filter(e => e.timestamp >= filter.from!);
    if (filter?.to) list = list.filter(e => e.timestamp <= filter.to!);

    const limit = filter?.limit || 20;
    const page = filter?.page || 1;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    return {
      events: paginated,
      total: list.length,
      page,
      limit,
      totalPages: Math.ceil(list.length / limit),
    };
  }

  public addEvent(params: Omit<ParkingEvent, 'id' | 'timestamp' | 'source'>) {
    const event: ParkingEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      source: 'simulated',
      ...params,
    };
    this.events.push(event);
    this.persistData();
    return event;
  }

  // Simulation Controls
  public triggerCarArrival() {
    this.state.vehicle_state = 'APPROACHING';
    this.state.distance_cm = 85.0;
  }

  public triggerCarDeparture() {
    this.state.vehicle_state = 'DEPARTING';
    this.state.distance_cm = 25.0;
  }

  public setManualDistance(cm: number) {
    this.state.distance_cm = Number(cm.toFixed(1));
    if (cm < this.state.threshold_cm) {
      this.state.vehicle_state = 'PARKED';
    } else {
      this.state.vehicle_state = 'VACANT';
    }
  }

  public setMode(mode: OperatingMode) {
    const prev = this.state.mode;
    this.state.mode = mode;
    this.updateLeds();
    this.addEvent({
      event_type: 'MODE_CHANGE',
      distance_cm: this.state.distance_cm,
      previous_state: prev,
      new_state: mode,
      mode,
      details: `Firmware mode switched to ${mode}`,
    });
    return { success: true, mode };
  }

  public setLed(color: 'RED' | 'GREEN', state: 'ON' | 'OFF') {
    if (this.state.mode === 'AUTO') {
      throw new Error('Cannot manually toggle LEDs while in AUTO mode. Switch to MANUAL mode first.');
    }

    const isOn = state === 'ON';
    if (color === 'RED') {
      this.state.red_led = isOn;
    } else {
      this.state.green_led = isOn;
    }

    this.addEvent({
      event_type: 'LED_TOGGLE',
      distance_cm: this.state.distance_cm,
      previous_state: 'MANUAL',
      new_state: `${color}:${state}`,
      mode: 'MANUAL',
      details: `Hardware ${color} LED turned ${state}`,
    });

    return { success: true, color, state };
  }

  public setThreshold(thresholdCm: number) {
    if (thresholdCm < 2 || thresholdCm > 400) {
      throw new Error('Threshold must be between 2 cm and 400 cm');
    }
    const prev = this.state.threshold_cm;
    this.state.threshold_cm = thresholdCm;
    this.updateLeds();

    this.addEvent({
      event_type: 'THRESHOLD_UPDATE',
      distance_cm: this.state.distance_cm,
      previous_state: `${prev} cm`,
      new_state: `${thresholdCm} cm`,
      mode: this.state.mode,
      details: `Occupancy distance threshold updated to ${thresholdCm} cm`,
    });

    return { success: true, threshold_cm: thresholdCm };
  }

  public resetDefaults() {
    this.state.threshold_cm = 15.0;
    this.state.mode = 'AUTO';
    this.updateLeds();

    this.addEvent({
      event_type: 'DEVICE_RESET',
      distance_cm: this.state.distance_cm,
      previous_state: 'CUSTOM',
      new_state: 'DEFAULT',
      mode: 'AUTO',
      details: 'Arduino and sensor settings restored to default (Threshold: 15 cm, Mode: AUTO)',
    });

    return { success: true };
  }

  public clearHistory() {
    this.readings = [];
    this.events = [];
    localStorage.removeItem(STORAGE_KEY_READINGS);
    localStorage.removeItem(STORAGE_KEY_EVENTS);
    this.seedInitialHistory();
    return { success: true };
  }

  public getAnalytics(from?: number, to?: number): AnalyticsSummary {
    const end = to || Date.now();
    const start = from || (end - 24 * 60 * 60 * 1000);

    const relevantReadings = this.readings.filter(r => r.timestamp >= start && r.timestamp <= end);
    const relevantEvents = this.events.filter(e => e.timestamp >= start && e.timestamp <= end);

    if (relevantReadings.length === 0) {
      return {
        occupancy_rate: 0,
        total_arrivals: 0,
        total_departures: 0,
        avg_occupied_duration_sec: 0,
        longest_occupied_duration_sec: 0,
        total_recorded_readings: 0,
        available_pct: 100,
        occupied_pct: 0,
        hourly_distribution: [],
        timeline: [],
      };
    }

    const occupiedCount = relevantReadings.filter(r => r.occupied).length;
    const occupancyRate = Number(((occupiedCount / relevantReadings.length) * 100).toFixed(1));

    const arrivals = relevantEvents.filter(e => e.event_type === 'ARRIVAL').length;
    const departures = relevantEvents.filter(e => e.event_type === 'DEPARTURE').length;

    // Calculate occupied sessions
    let totalOccupiedDurationMs = 0;
    let longestOccupiedDurationMs = 0;
    let currentSessionStart: number | null = null;

    relevantReadings.forEach((r, idx) => {
      if (r.occupied && currentSessionStart === null) {
        currentSessionStart = r.timestamp;
      } else if (!r.occupied && currentSessionStart !== null) {
        const dur = r.timestamp - currentSessionStart;
        totalOccupiedDurationMs += dur;
        if (dur > longestOccupiedDurationMs) longestOccupiedDurationMs = dur;
        currentSessionStart = null;
      }

      if (idx === relevantReadings.length - 1 && currentSessionStart !== null) {
        const dur = r.timestamp - currentSessionStart;
        totalOccupiedDurationMs += dur;
        if (dur > longestOccupiedDurationMs) longestOccupiedDurationMs = dur;
      }
    });

    const sessionsCount = Math.max(1, arrivals);
    const avgDurationSec = Math.round((totalOccupiedDurationMs / sessionsCount) / 1000);
    const longestDurationSec = Math.round(longestOccupiedDurationMs / 1000);

    // Hourly distribution for 24h
    const hourlyMap: Record<number, { arrivals: number; departures: number; total: number; occupied: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { arrivals: 0, departures: 0, total: 0, occupied: 0 };
    }

    relevantEvents.forEach(e => {
      const h = new Date(e.timestamp).getHours();
      if (hourlyMap[h]) {
        if (e.event_type === 'ARRIVAL') hourlyMap[h].arrivals++;
        if (e.event_type === 'DEPARTURE') hourlyMap[h].departures++;
      }
    });

    relevantReadings.forEach(r => {
      const h = new Date(r.timestamp).getHours();
      if (hourlyMap[h]) {
        hourlyMap[h].total++;
        if (r.occupied) hourlyMap[h].occupied++;
      }
    });

    const hourly_distribution = Object.entries(hourlyMap).map(([hourStr, data]) => {
      const h = Number(hourStr);
      const hourLabel = `${h.toString().padStart(2, '0')}:00`;
      const occPct = data.total > 0 ? Number(((data.occupied / data.total) * 100).toFixed(1)) : 0;
      return {
        hour: hourLabel,
        arrivals: data.arrivals,
        departures: data.departures,
        occupancy_pct: occPct,
      };
    });

    // Subsample timeline for clean Recharts display
    const stepSize = Math.max(1, Math.floor(relevantReadings.length / 50));
    const timeline = relevantReadings
      .filter((_, idx) => idx % stepSize === 0)
      .map(r => {
        const d = new Date(r.timestamp);
        return {
          timestamp: r.timestamp,
          time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
          distance_cm: r.distance_cm,
          occupied: r.occupied,
          threshold_cm: r.threshold_cm,
        };
      });

    return {
      occupancy_rate: occupancyRate,
      total_arrivals: arrivals,
      total_departures: departures,
      avg_occupied_duration_sec: avgDurationSec,
      longest_occupied_duration_sec: longestDurationSec,
      total_recorded_readings: relevantReadings.length,
      available_pct: Number((100 - occupancyRate).toFixed(1)),
      occupied_pct: occupancyRate,
      hourly_distribution,
      timeline,
    };
  }

  public getStatus() {
    return {
      connected: true,
      mode: 'simulation' as const,
      firmware_mode: this.state.mode,
      baud_rate: 9600,
      port: 'SIMULATED_PORT',
      sensor_health: 'healthy' as const,
      backend_reachable: true,
      last_reading_time: Date.now(),
      red_led: this.state.red_led,
      green_led: this.state.green_led,
      threshold_cm: this.state.threshold_cm,
      protocol_version: 'v1.2-sim',
    };
  }
}

export const simulatorInstance = new IoTDeviceSimulator();
