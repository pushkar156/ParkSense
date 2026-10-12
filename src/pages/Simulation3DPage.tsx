import React, { useState, useEffect, useRef } from 'react';
import {
  ParkingScene3D,
  CameraPreset,
} from '../components/simulation3d/ParkingScene3D';
import { SimulationControlsOverlay } from '../components/simulation3d/SimulationControlsOverlay';
import { useParking } from '../context/ParkingContext';
import {
  Cpu,
  Radio,
  Sliders,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

export const Simulation3DPage: React.FC = () => {
  const {
    mode,
    setMode,
    status,
    latestReading,
    triggerArrival,
    triggerDeparture,
    setManualSimDistance,
  } = useParking();

  // Active simulated distance in centimeters (defaults to latest reading or 185 cm)
  const [distanceCm, setDistanceCm] = useState<number>(() => {
    return latestReading?.distance_cm ?? 185.0;
  });

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const threshold = status?.threshold_cm ?? 15.0;
  const isOccupied = distanceCm < threshold;

  // Sync with context if external changes occur and we're not actively animating
  useEffect(() => {
    if (!isAnimating && latestReading?.distance_cm !== undefined) {
      setDistanceCm(latestReading.distance_cm);
    }
  }, [latestReading?.distance_cm, isAnimating]);

  // Clean up animation timers on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    };
  }, []);

  // Approach Animation Handler
  const handleCarApproach = () => {
    if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    setIsAnimating(true);
    triggerArrival();

    let current = 185.0;
    const target = 9.0;
    const stepDuration = 50; // ms
    const totalSteps = 45; // ~2.2 seconds total drive-in time
    let stepCount = 0;

    animationIntervalRef.current = setInterval(() => {
      stepCount++;
      const progress = stepCount / totalSteps;
      // Smooth ease-out cubic deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      current = 185.0 - easeProgress * (185.0 - target);

      setDistanceCm(current);
      setManualSimDistance(current);

      if (stepCount >= totalSteps) {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        setDistanceCm(target);
        setManualSimDistance(target);
        setIsAnimating(false);
      }
    }, stepDuration);
  };

  // Departure Animation Handler
  const handleCarLeave = () => {
    if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    setIsAnimating(true);
    triggerDeparture();

    let current = distanceCm;
    const target = 185.0;
    const stepDuration = 50;
    const totalSteps = 40;
    let stepCount = 0;

    animationIntervalRef.current = setInterval(() => {
      stepCount++;
      const progress = stepCount / totalSteps;
      const easeProgress = 1 - Math.pow(1 - progress, 2);
      current = distanceCm + easeProgress * (target - distanceCm);

      setDistanceCm(current);
      setManualSimDistance(current);

      if (stepCount >= totalSteps) {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        setDistanceCm(target);
        setManualSimDistance(target);
        setIsAnimating(false);
      }
    }, stepDuration);
  };

  // Slider change
  const handleSliderChange = (cm: number) => {
    if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    setIsAnimating(false);
    setDistanceCm(cm);
    setManualSimDistance(cm);
  };

  // Reset Scene
  const handleReset = () => {
    if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    setIsAnimating(false);
    setDistanceCm(185.0);
    setManualSimDistance(185.0);
    setCameraPreset('isometric');
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              3D Interactive Parking Studio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
              WebGL 60 FPS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time physics model of an Arduino Uno, HC-SR04 sonar sensor, and vehicle bay interaction.
          </p>
        </div>

        {/* Quick Mode Toggle */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Mode:</span>
          <div className="p-1 bg-slate-100 rounded-lg border border-slate-200 flex items-center">
            <button
              onClick={() => setMode('simulation')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                mode === 'simulation'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simulation
            </button>
            <button
              onClick={() => setMode('hardware')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                mode === 'hardware'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hardware
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D Canvas Stage Container */}
      <div className="relative w-full h-[540px] sm:h-[620px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
        <ParkingScene3D
          currentDistanceCm={distanceCm}
          thresholdCm={threshold}
          isOccupied={isOccupied}
          cameraPreset={cameraPreset}
        />

        <SimulationControlsOverlay
          distanceCm={distanceCm}
          thresholdCm={threshold}
          isOccupied={isOccupied}
          onApproach={handleCarApproach}
          onLeave={handleCarLeave}
          onSliderChange={handleSliderChange}
          cameraPreset={cameraPreset}
          onCameraChange={setCameraPreset}
          onReset={handleReset}
          isAutoAnimating={isAnimating}
        />
      </div>

      {/* Hardware Component Legend & Interactive Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: HC-SR04 Sonar Component */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-600" />
              HC-SR04 Ultrasonic Sonar
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Trig: 9 · Echo: 10
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Transmits 40 kHz ultrasonic pulses at 1000ms intervals. Pulses reflect off the approaching vehicle front bumper and calculate distance in real time.
          </p>
        </div>

        {/* Card 2: LED Actuator Indicators */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Dual LED Indicators
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Red: Pin 4 · Grn: Pin 5
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOccupied ? 'bg-rose-500 shadow-sm shadow-rose-400' : 'bg-slate-300'
                }`}
              />
              <span className="text-slate-600">Red (Occupied)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  !isOccupied ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-slate-300'
                }`}
              />
              <span className="text-slate-600">Green (Available)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Camera & Interaction Tips */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Camera Controls
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Interactive</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Drag with left mouse button to rotate around the bay. Scroll wheel to zoom in/out. Right-click drag to pan the view. Switch camera presets on top-right.
          </p>
        </div>
      </div>
    </div>
  );
};
