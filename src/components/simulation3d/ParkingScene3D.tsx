import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CameraPreset = 'isometric' | 'driver' | 'sensor' | 'topdown';

interface ParkingScene3DProps {
  currentDistanceCm: number;
  thresholdCm: number;
  isOccupied: boolean;
  onDistanceChange?: (cm: number) => void;
  cameraPreset?: CameraPreset;
}

export const ParkingScene3D: React.FC<ParkingScene3DProps> = ({
  currentDistanceCm,
  thresholdCm,
  isOccupied,
  onDistanceChange,
  cameraPreset = 'isometric',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // References to mutable 3D objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Animated objects
  const carGroupRef = useRef<THREE.Group | null>(null);
  const wheelsRef = useRef<THREE.Mesh[]>([]);
  const sonarWavesRef = useRef<THREE.Mesh[]>([]);
  const redLedLightRef = useRef<THREE.PointLight | null>(null);
  const greenLedLightRef = useRef<THREE.PointLight | null>(null);
  const redLedMeshRef = useRef<THREE.Mesh | null>(null);
  const greenLedMeshRef = useRef<THREE.Mesh | null>(null);
  const headlightLeftRef = useRef<THREE.SpotLight | null>(null);
  const headlightRightRef = useRef<THREE.SpotLight | null>(null);
  const distanceLineRef = useRef<THREE.Line | null>(null);

  // Smooth interpolation state for car position
  // In our 3D world:
  // Sensor is at (0, 0.45, -2.5)
  // 10 cm in real world = Z: -1.7 (Parked right at bumper stopper)
  // 180 cm in real world = Z: 6.0 (Out of bay on the access lane)
  // Linear formula: Z = -1.7 + ((cm - 10) / 170) * 7.7
  const targetZRef = useRef<number>(2.0);
  const currentZRef = useRef<number>(2.0);

  // Convert distance in cm to 3D Z position
  const cmToZ = useCallback((cm: number): number => {
    const clampedCm = Math.max(5, Math.min(200, cm));
    return -1.8 + ((clampedCm - 5) / 195) * 8.5;
  }, []);

  // Convert 3D Z position to cm
  const zToCm = useCallback((z: number): number => {
    const norm = (z - (-1.8)) / 8.5;
    return Math.max(5, Math.min(200, Math.round(5 + norm * 195)));
  }, []);

  // Update target Z when prop changes
  useEffect(() => {
    targetZRef.current = cmToZ(currentDistanceCm);
  }, [currentDistanceCm, cmToZ]);

  // Adjust camera to preset
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (cameraPreset) {
      case 'isometric':
        camera.position.set(6.5, 6.0, 7.5);
        controls.target.set(0, 0.5, 1.5);
        break;
      case 'driver':
        if (carGroupRef.current) {
          const carZ = carGroupRef.current.position.z;
          camera.position.set(0, 2.2, carZ + 3.2);
          controls.target.set(0, 0.6, carZ - 2.0);
        } else {
          camera.position.set(0, 2.5, 6.0);
          controls.target.set(0, 0.5, 0);
        }
        break;
      case 'sensor':
        camera.position.set(0, 1.2, -3.8);
        controls.target.set(0, 0.45, 1.0);
        break;
      case 'topdown':
        camera.position.set(0, 12.0, 1.5);
        controls.target.set(0, 0, 1.5);
        break;
    }
    controls.update();
  }, [cameraPreset]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a); // Deep slate-900 background
    scene.fog = new THREE.FogExp2(0x0f172a, 0.035);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(6.5, 6.0, 7.5);
    cameraRef.current = camera;

    // 3. Renderer with hardware antialiasing & shadow map
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't dip below floor
    controls.minDistance = 2.5;
    controls.maxDistance = 20.0;
    controls.target.set(0, 0.5, 1.5);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 8;
    dirLight.shadow.camera.bottom = -8;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Cool blue rim light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-6, 4, -4);
    scene.add(rimLight);

    // 6. Environment: Asphalt Ground & Parking Bay
    createEnvironment(scene);

    // 7. Sensor & LEDs Station
    createSensorStation(scene);

    // 8. 3D Car
    createCar(scene);

    // 9. Ultrasonic Sonar Pulse Wave Rings
    createSonarWaves(scene);

    // 10. Distance Measuring Laser Beam Line
    createDistanceLine(scene);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smoothly interpolate car position towards targetZ
      const diffZ = targetZRef.current - currentZRef.current;
      if (Math.abs(diffZ) > 0.005) {
        const step = diffZ * Math.min(1.0, delta * 6.5);
        currentZRef.current += step;

        if (carGroupRef.current) {
          carGroupRef.current.position.z = currentZRef.current;

          // Rotate wheels proportionally to movement
          const wheelRotationSpeed = -step * 2.8;
          wheelsRef.current.forEach(wheel => {
            wheel.rotation.x += wheelRotationSpeed;
          });
        }

        // Notify parent if continuous tracking is enabled
        if (onDistanceChange && Math.abs(diffZ) > 0.02) {
          onDistanceChange(zToCm(currentZRef.current));
        }
      }

      // Animate Sonar Wave Rings
      sonarWavesRef.current.forEach((wave, idx) => {
        const phase = (elapsed * 1.8 + idx * 0.35) % 1.0;
        // Expand wave outwards along +Z towards car
        wave.position.z = -2.3 + phase * 3.8;
        const scale = 0.4 + phase * 1.6;
        wave.scale.set(scale, scale, 1);
        const mat = wave.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1.0 - phase) * 0.65);
      });

      // Update distance line endpoint from sensor to car front bumper
      if (distanceLineRef.current && carGroupRef.current) {
        const positions = distanceLineRef.current.geometry.attributes.position.array as Float32Array;
        // Start: sensor face
        positions[0] = 0;
        positions[1] = 0.42;
        positions[2] = -2.25;
        // End: car front bumper
        positions[3] = 0;
        positions[4] = 0.38;
        positions[5] = currentZRef.current - 1.35;
        distanceLineRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Update LED Lights & Emissive states based on occupancy
      const occupied = currentZRef.current < cmToZ(thresholdCm);
      if (redLedLightRef.current && greenLedLightRef.current && redLedMeshRef.current && greenLedMeshRef.current) {
        if (occupied) {
          // RED ON, GREEN OFF
          redLedLightRef.current.intensity = 2.2;
          greenLedLightRef.current.intensity = 0.05;
          (redLedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0xef4444);
          (redLedMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.0;
          (greenLedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x064e3b);
          (greenLedMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        } else {
          // GREEN ON, RED OFF
          redLedLightRef.current.intensity = 0.05;
          greenLedLightRef.current.intensity = 2.2;
          (redLedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x450a0a);
          (redLedMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
          (greenLedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x10b981);
          (greenLedMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.0;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [cmToZ, thresholdCm, onDistanceChange, zToCm]);

  // ------------------ Procedural 3D Mesh Builders ------------------

  const createEnvironment = (scene: THREE.Scene) => {
    // 1. Asphalt Ground
    const groundGeo = new THREE.PlaneGeometry(16, 22);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // slate-800 asphalt
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. Concrete Bay Border / Curbs
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const backCurb = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 0.3), curbMat);
    backCurb.position.set(0, 0.1, -2.6);
    backCurb.castShadow = true;
    backCurb.receiveShadow = true;
    scene.add(backCurb);

    // Wheel Stopper Bar (Rubber parking curb inside bay)
    const stopperMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 }); // Amber rubber
    const stopper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.22), stopperMat);
    stopper.position.set(0, 0.06, -1.8);
    stopper.castShadow = true;
    stopper.receiveShadow = true;
    scene.add(stopper);

    // 3. Painted Parking Lines (Bright Yellow)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    // Left boundary line
    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6.0), lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-1.5, 0.005, 0.5);
    scene.add(leftLine);

    // Right boundary line
    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6.0), lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(1.5, 0.005, 0.5);
    scene.add(rightLine);

    // End cross line
    const crossLine = new THREE.Mesh(new THREE.PlaneGeometry(3.12, 0.12), lineMat);
    crossLine.rotation.x = -Math.PI / 2;
    crossLine.position.set(0, 0.005, -2.4);
    scene.add(crossLine);

    // Bay ID Painted Text Stencil "BAY-01"
    const baySignGeo = new THREE.PlaneGeometry(1.6, 0.6);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BAY 01', 128, 48);
    }
    const signTexture = new THREE.CanvasTexture(canvas);
    const baySignMat = new THREE.MeshBasicMaterial({ map: signTexture });
    const baySign = new THREE.Mesh(baySignGeo, baySignMat);
    baySign.rotation.x = -Math.PI / 2;
    baySign.position.set(0, 0.006, 2.5);
    scene.add(baySign);
  };

  const createSensorStation = (scene: THREE.Scene) => {
    const stationGroup = new THREE.Group();
    stationGroup.position.set(0, 0, -2.5);

    // 1. Steel Post / Pedestal
    const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 16), postMat);
    post.position.set(0, 0.25, 0);
    post.castShadow = true;
    stationGroup.add(post);

    // 2. HC-SR04 PCB Breakout Board (Blue Board)
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.04), pcbMat);
    pcb.position.set(0, 0.48, 0.02);
    pcb.castShadow = true;
    stationGroup.add(pcb);

    // 3. HC-SR04 Transducer Cylinders (Metallic Sonar Barrels: Trig & Echo)
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
    });
    const barrelInnerMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    // Left Transducer (Trig)
    const trigCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 24), barrelMat);
    trigCylinder.rotation.x = Math.PI / 2;
    trigCylinder.position.set(-0.16, 0.48, 0.09);
    trigCylinder.castShadow = true;
    stationGroup.add(trigCylinder);

    const trigHole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.01, 16), barrelInnerMat);
    trigHole.rotation.x = Math.PI / 2;
    trigHole.position.set(-0.16, 0.48, 0.151);
    stationGroup.add(trigHole);

    // Right Transducer (Echo)
    const echoCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 24), barrelMat);
    echoCylinder.rotation.x = Math.PI / 2;
    echoCylinder.position.set(0.16, 0.48, 0.09);
    echoCylinder.castShadow = true;
    stationGroup.add(echoCylinder);

    const echoHole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.01, 16), barrelInnerMat);
    echoHole.rotation.x = Math.PI / 2;
    echoHole.position.set(0.16, 0.48, 0.151);
    stationGroup.add(echoHole);

    // 4. Physical LED Indicators (Pin 4 Red & Pin 5 Green)
    // Red LED (Left top of station)
    const redLedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x450a0a,
      emissiveIntensity: 0.2,
      roughness: 0.1,
    });
    const redLedMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), redLedMat);
    redLedMesh.position.set(-0.35, 0.48, 0.02);
    stationGroup.add(redLedMesh);
    redLedMeshRef.current = redLedMesh;

    const redLight = new THREE.PointLight(0xef4444, 0.1, 3.5, 2);
    redLight.position.set(-0.35, 0.48, 0.12);
    stationGroup.add(redLight);
    redLedLightRef.current = redLight;

    // Green LED (Right top of station)
    const greenLedMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    const greenLedMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), greenLedMat);
    greenLedMesh.position.set(0.35, 0.48, 0.02);
    stationGroup.add(greenLedMesh);
    greenLedMeshRef.current = greenLedMesh;

    const greenLight = new THREE.PointLight(0x10b981, 2.0, 3.5, 2);
    greenLight.position.set(0.35, 0.48, 0.12);
    stationGroup.add(greenLight);
    greenLedLightRef.current = greenLight;

    scene.add(stationGroup);
  };

  const createCar = (scene: THREE.Scene) => {
    const car = new THREE.Group();
    car.position.set(0, 0, currentZRef.current);
    carGroupRef.current = car;

    // 1. Lower Body Chassis
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // Royal Electric Blue
      metalness: 0.65,
      roughness: 0.25,
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 3.1), chassisMat);
    chassis.position.set(0, 0.35, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    car.add(chassis);

    // Front Bumper accent
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.18, 0.15), bumperMat);
    frontBumper.position.set(0, 0.22, -1.52);
    car.add(frontBumper);

    // 2. Cabin Glass Roof
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Tinted glass
      metalness: 0.9,
      roughness: 0.1,
    });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.4, 1.7), cabinMat);
    cabin.position.set(0, 0.68, 0.15);
    cabin.castShadow = true;
    car.add(cabin);

    // Windshield frame
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.6,
      roughness: 0.3,
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 1.4), roofMat);
    roof.position.set(0, 0.89, 0.25);
    roof.castShadow = true;
    car.add(roof);

    // 3. Headlights (Bright White LEDs)
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.05), headlightMat);
    hlLeft.position.set(-0.55, 0.42, -1.56);
    car.add(hlLeft);

    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.05), headlightMat);
    hlRight.position.set(0.55, 0.42, -1.56);
    car.add(hlRight);

    // Front headlight spot beams
    const spotLeft = new THREE.SpotLight(0xffffff, 2.5, 8.0, Math.PI / 6, 0.4);
    spotLeft.position.set(-0.55, 0.42, -1.56);
    spotLeft.target.position.set(-0.55, 0, -4.5);
    car.add(spotLeft);
    car.add(spotLeft.target);
    headlightLeftRef.current = spotLeft;

    const spotRight = new THREE.SpotLight(0xffffff, 2.5, 8.0, Math.PI / 6, 0.4);
    spotRight.position.set(0.55, 0.42, -1.56);
    spotRight.target.position.set(0.55, 0, -4.5);
    car.add(spotRight);
    car.add(spotRight.target);
    headlightRightRef.current = spotRight;

    // 4. Taillights (Red)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.05), tailMat);
    tlLeft.position.set(-0.55, 0.42, 1.56);
    car.add(tlLeft);

    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.05), tailMat);
    tlRight.position.set(0.55, 0.42, 1.56);
    car.add(tlRight);

    // 5. Wheels & Tires
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.2 });

    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 24);
    const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.19, 16);

    const wheelPositions = [
      [-0.82, 0.3, -1.0], // Front Left
      [0.82, 0.3, -1.0],  // Front Right
      [-0.82, 0.3, 1.0],  // Rear Left
      [0.82, 0.3, 1.0],   // Rear Right
    ];

    wheelsRef.current = [];
    wheelPositions.forEach(([x, y, z]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      car.add(wheelGroup);
      wheelsRef.current.push(tire);
    });

    scene.add(car);
  };

  const createSonarWaves = (scene: THREE.Scene) => {
    sonarWavesRef.current = [];
    // Create 4 translucent wave arc rings radiating outward
    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.RingGeometry(0.35, 0.42, 32, 1, 0, Math.PI);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8, // Sky-blue sonar frequency
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.48, -2.4 + i * 0.7);
      scene.add(ring);
      sonarWavesRef.current.push(ring);
    }
  };

  const createDistanceLine = (scene: THREE.Scene) => {
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([0, 0.45, -2.3, 0, 0.45, 1.0]);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.2,
      gapSize: 0.1,
      linewidth: 2,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    distanceLineRef.current = line;
  };

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden bg-slate-950 shadow-inner">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
