import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Rose } from './Rose';
import { RoseConfig } from '../types';

interface RoseExperienceProps {
  config: RoseConfig;
  growthRef?: React.MutableRefObject<number>;
  distortionRef?: React.MutableRefObject<number>;
}

// Camera Controller component to handle target tracking
const CameraController: React.FC<{ 
  growthRef?: React.MutableRefObject<number>;
}> = ({ growthRef }) => {
  const controlsRef = useRef<any>(null);

  useFrame(() => {
    if (controlsRef.current) {
      
      // --- TRACKING TARGET (Follow Lasers) ---
      if (growthRef) {
        const growth = growthRef.current;
        const scanY = THREE.MathUtils.lerp(10.0, -12.0, growth);
        let targetY = scanY;

        if (growth > 0.9) {
            targetY = 2.0; 
        } else if (growth < 0.05) {
            targetY = 5.0;
        }

        const currentTarget = controlsRef.current.target;
        currentTarget.y = THREE.MathUtils.lerp(currentTarget.y, targetY, 0.08);
      }
      
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        enableZoom={false} // Manual zoom disabled
        autoRotate 
        autoRotateSpeed={0.8}
    />
  );
};

export const RoseExperience: React.FC<RoseExperienceProps> = ({ config, growthRef, distortionRef }) => {

  return (
    <Canvas
      camera={{ position: [0, 5, 35], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      shadows
    >
      <color attach="background" args={['#111']} />
      
      {/* Lighting Setup */}
      <ambientLight intensity={0.5} />
      <spotLight 
        position={[5, 10, 5]} 
        angle={0.5} 
        penumbra={1} 
        intensity={2} 
        color="#ffffff" 
        castShadow 
      />
      <pointLight position={[-5, 0, -5]} intensity={0.5} color="#e6ccff" />
      
      {/* Environment for nice reflections */}
      <Suspense fallback={null}>
        <Environment preset="studio" blur={1} />
      </Suspense>

      {/* Transparent Cube (Edges Only) */}
      <group position={[0, 2, 0]}>
        <mesh>
          <boxGeometry args={[25, 25, 25]} />
          <meshBasicMaterial visible={false} /> 
          <Edges 
            scale={1} 
            threshold={15} 
            color="#ffffff" 
          />
        </mesh>
      </group>

      {/* The Procedural Rose - Scaled Up */}
      <group position={[0, 2, 0]} scale={[1.5, 1.5, 1.5]}>
        <Rose 
            config={config} 
            growthRef={growthRef} 
            distortionRef={distortionRef} 
        />
      </group>

      {/* Shadows on the floor */}
      <ContactShadows 
        position={[0, -8, 0]}
        opacity={0.6} 
        scale={20} 
        blur={2} 
        far={4.5} 
        resolution={512} 
        color="#000000" 
      />

      <CameraController growthRef={growthRef} />
    </Canvas>
  );
};
