import React, { useState, useEffect, useRef } from 'react';
import { RoseExperience } from './components/RoseExperience';
import { RoseConfig } from './types';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Optimal "High Detail" Settings for a Tulip
const CINEMATIC_CONFIG: RoseConfig = {
  color: '#7c00ff', // Rich Purple
  petalCount: 3.0, // Tulips typically show 3 inner + 3 outer
  twist: 0.8,      
  openness: 0.6,   
  detail: 0.5,     
  speed: 0.15,     
  particleSize: 0.022, 
};

// Hand Connections for skeleton drawing
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17], [5, 9], [9, 13], [13, 17] // Palm/Base
];

const App: React.FC = () => {
  const [config] = useState<RoseConfig>(CINEMATIC_CONFIG);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [isPinching, setIsPinching] = useState(false); // UI State for feedback (Hand 1)
  const [isDistorting, setIsDistorting] = useState(false); // UI State for feedback (Hand 2)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Growth state
  const growthRef = useRef<number>(0); 
  // Distortion state (NDC Coordinates: -1 to 1)
  const distortionRef = useRef<{x: number, y: number, active: boolean}>({ x: 0, y: 0, active: false });
  
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  const startCamera = async () => {
    setPermissionError(false);
    setLoading(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', () => {
            setLoading(false);
            predictWebcam();
          });
        }
      }
    } catch (err) {
      console.warn("Camera permission denied or failed:", err);
      setPermissionError(true);
      setLoading(false);
      growthRef.current = 1.0; // Fallback to visible
    }
  };

  const drawHand = (ctx: CanvasRenderingContext2D, landmarks: any[], pinching: boolean, pinchY: number, isDistortHand: boolean) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Config colors based on hand role
    const primaryColor = isDistortHand ? '#facc15' : '#00ffff'; // Yellow vs Cyan
    const activeColor = isDistortHand ? '#facc15' : '#ff00ff';  // Yellow vs Pink
    const dimColor = isDistortHand ? 'rgba(250, 204, 21, 0.3)' : 'rgba(0, 255, 255, 0.3)';

    // Draw Skeleton
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pinching ? activeColor : dimColor;
    
    CONNECTIONS.forEach(([start, end]) => {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    // Draw Joints
    landmarks.forEach((p: any) => {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 2, 0, 2 * Math.PI);
      ctx.fillStyle = pinching ? activeColor : primaryColor;
      ctx.fill();
    });
    
    // --- PINCH VISUALIZATION ---
    const thumb = landmarks[4];
    const index = landmarks[8];
    const tX = thumb.x * width;
    const tY = thumb.y * height;
    const iX = index.x * width;
    const iY = index.y * height;
    const midX = (tX + iX) / 2;
    const midY = (tY + iY) / 2;

    if (pinching) {
        // Locked Target Ring
        ctx.beginPath();
        ctx.arc(midX, midY, isDistortHand ? 10 : 15, 0, Math.PI * 2);
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Label
        ctx.fillStyle = activeColor;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(isDistortHand ? 'DISTORT' : 'LOCKED', midX + 20, midY);
        
        if (!isDistortHand) {
            // Drag Direction Indicator (Only for control hand)
            const zoneY = pinchY * height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(width - 10, 0, 10, height); 
            ctx.fillStyle = activeColor;
            ctx.fillRect(width - 10, zoneY - 5, 10, 10);
        }
    }
  };

  const predictWebcam = () => {
    if (videoRef.current && handLandmarkerRef.current) {
      let startTimeMs = performance.now();
      
      if (canvasRef.current && videoRef.current.videoWidth > 0) {
          if (canvasRef.current.width !== videoRef.current.videoWidth || 
              canvasRef.current.height !== videoRef.current.videoHeight) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
          }
      }

      if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = videoRef.current.currentTime;
        try {
          const detections = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
          const ctx = canvasRef.current?.getContext('2d');
          
          if (ctx) {
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;
            ctx.clearRect(0, 0, width, height);

            // Tech Grid overlay
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            const gridSize = width / 8;
            for(let x=0; x<width; x+=gridSize) { 
                ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); 
            }
            for(let y=0; y<height; y+=gridSize) { 
                ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); 
            }
          }

          if (detections.landmarks) {
            // Hand 0: Control Hand (Growth)
            if (detections.landmarks.length > 0) {
                const landmarks = detections.landmarks[0];
                const thumb = landmarks[4];
                const index = landmarks[8];
                const aspectRatio = 640 / 480; 
                const dist = Math.hypot((thumb.x - index.x) * aspectRatio, thumb.y - index.y);
                const pinching = dist < 0.06;
                setIsPinching(pinching);

                if (pinching) {
                    const pinchY = (thumb.y + index.y) / 2;
                    const minY = 0.2, maxY = 0.8;
                    const rawProgress = (pinchY - minY) / (maxY - minY);
                    let targetGrowth = Math.max(0, Math.min(1, rawProgress));
                    if (targetGrowth > 0.85) targetGrowth = 1.0;
                    if (targetGrowth < 0.15) targetGrowth = 0.0;
                    growthRef.current += (targetGrowth - growthRef.current) * 0.15;
                } else {
                    if (growthRef.current > 0.85) growthRef.current += (1.0 - growthRef.current) * 0.1;
                    else if (growthRef.current < 0.15) growthRef.current += (0.0 - growthRef.current) * 0.1;
                }

                if (ctx) drawHand(ctx, landmarks, pinching, (thumb.y + index.y) / 2, false);
            } else {
                setIsPinching(false);
            }

            // Hand 1: Distortion Hand (Effect)
            if (detections.landmarks.length > 1) {
                const landmarks = detections.landmarks[1];
                const thumb = landmarks[4];
                const index = landmarks[8];
                const aspectRatio = 640 / 480;
                const dist = Math.hypot((thumb.x - index.x) * aspectRatio, thumb.y - index.y);
                const pinching = dist < 0.06;
                setIsDistorting(pinching);

                // Calculate Cursor Position (Midpoint)
                const midX = (thumb.x + index.x) / 2;
                const midY = (thumb.y + index.y) / 2;

                // Update Distortion Ref (NDC Coordinates)
                distortionRef.current = {
                    x: 1 - 2 * midX,
                    y: 1 - 2 * midY, // Invert Y for NDC (Up is +1)
                    active: pinching
                };

                if (ctx) drawHand(ctx, landmarks, pinching, 0, true);
            } else {
                setIsDistorting(false);
                distortionRef.current.active = false;
            }
          }
        } catch (e) {
          // Ignore transient detection errors
        }
      }
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  useEffect(() => {
    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2 // Allow tracking both hands
        });

        startCamera();

      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        setLoading(false); 
        growthRef.current = 1.0; 
      }
    };

    setupMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono">
      
      {/* Full Screen 3D Scene */}
      <div className="absolute inset-0 z-0">
        <RoseExperience config={config} growthRef={growthRef} distortionRef={distortionRef} />
      </div>

      {/* Main Title Overlay */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none select-none">
        <h1 className="text-4xl font-light tracking-[0.2em] text-white/90 drop-shadow-lg">
          DIGITAL FLORA
        </h1>
        <div className="flex items-center gap-3 mt-2">
            <div className={`h-[1px] transition-all duration-300 ${isPinching ? 'w-24 bg-pink-500 shadow-[0_0_15px_#ec4899]' : 'w-12 bg-cyan-500'}`}></div>
            <p className="text-[10px] text-white/60 tracking-widest uppercase">
              {isPinching ? 'System Locked :: Constructing' : 'System Idle'}
            </p>
        </div>
      </div>

      {/* Status Overlay */}
      <div className="absolute top-8 right-8 z-20 text-right space-y-2 pointer-events-none select-none">
          {loading && <div className="text-xs text-cyan-400 animate-pulse">:: INITIALIZING OPTICAL SENSORS ::</div>}
          {permissionError && <div className="text-xs text-red-500 bg-black/50 px-2 py-1">:: SENSOR ERROR - CHECK PERMISSIONS ::</div>}
          {!loading && !permissionError && (
             <div className="text-[10px] text-white/50 tracking-wider space-y-1">
               <p className="flex items-center justify-end gap-2">
                 <span className={`w-1.5 h-1.5 rounded-full ${isPinching ? 'bg-pink-500 animate-ping' : 'bg-green-500'}`}></span>
                 {isPinching ? 'PRIMARY HAND: CONSTRUCT' : 'PRIMARY HAND: READY'}
               </p>
               <p className="flex items-center justify-end gap-2">
                 <span className={`w-1.5 h-1.5 rounded-full ${isDistorting ? 'bg-yellow-400 animate-ping' : 'bg-yellow-900'}`}></span>
                 {isDistorting ? 'SECONDARY HAND: DISTORTING' : 'SECONDARY HAND: IDLE'}
               </p>
               
               <div className="flex flex-col gap-1 mt-2 border-r border-white/20 pr-2">
                   <p className={isPinching ? 'text-white font-bold' : 'text-gray-500'}>1. PINCH R-HAND: BUILD</p>
                   <p className={isDistorting ? 'text-yellow-400 font-bold' : 'text-gray-500'}>2. PINCH L-HAND: DISTORT</p>
                   <p className={!isPinching ? 'text-cyan-400 font-bold' : 'text-gray-500'}>3. RELEASE: AUTO-SNAP</p>
               </div>
             </div>
          )}
      </div>

      {/* Floating HUD: Hand Tracking Feed */}
      <div className={`absolute bottom-8 right-8 z-30 w-64 h-48 bg-gray-900/90 border rounded-sm backdrop-blur-md shadow-2xl overflow-hidden transition-colors duration-300 ${isPinching ? 'border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.2)]' : isDistorting ? 'border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.2)]' : 'border-cyan-500/30'}`}>
         
         {/* HUD Header */}
         <div className="absolute top-0 left-0 w-full h-6 bg-white/5 border-b border-white/5 flex items-center justify-between px-3 z-20 pointer-events-none">
            <span className={`text-[9px] tracking-widest font-bold ${isPinching ? 'text-pink-500' : isDistorting ? 'text-yellow-400' : 'text-cyan-400'}`}>
                {isPinching ? 'CONSTRUCT' : isDistorting ? 'INTERFERE' : 'SCANNING'}
            </span>
            <div className="flex gap-1">
               <div className={`w-1 h-1 rounded-full ${isPinching ? 'bg-pink-500' : 'bg-cyan-400'}`}></div>
               <div className={`w-1 h-1 rounded-full ${isDistorting ? 'bg-yellow-400' : 'bg-gray-600'}`}></div>
            </div>
         </div>
         
         {/* Video/Canvas Container */}
         <div className="relative w-full h-full pt-6">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale contrast-125 scale-x-[-1]"
            />
            <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full object-cover mix-blend-screen scale-x-[-1]"
            />
            
            {/* Scanline Effect Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30"></div>
            
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)] pointer-events-none"></div>
         </div>
      </div>

      {/* Manual Start Button (Error State) */}
      {permissionError && (
        <button 
            onClick={startCamera}
            className="absolute bottom-60 right-8 z-40 px-6 py-2 bg-red-500/10 border border-red-500/50 text-red-400 text-xs tracking-wider hover:bg-red-500/20 transition-all uppercase backdrop-blur-md"
        >
            Retry Connection
        </button>
      )}

    </div>
  );
};

export default App;