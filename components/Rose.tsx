import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoseConfig } from '../types';

interface RoseProps {
  config: RoseConfig;
  growthRef?: React.MutableRefObject<number>;
}

// --- Shader Definitions ---

const vertexShader = `
  attribute float aRandom;
  attribute float aType; // 0: Flower, 1: Stem, 2: Leaf
  attribute vec3 aDirection;
  
  varying vec3 vPosition;
  varying float vDisplacement;
  varying float vRandom;
  varying float vType;
  varying float vProgress;

  uniform float uTime;
  uniform float uPetalCount;
  uniform float uTwist;
  uniform float uOpenness;
  uniform float uDetail;
  uniform float uParticleSize;
  
  // uScanY controls the vertical construction plane.
  // Values: Top (+10.0) -> Bottom (-12.0)
  uniform float uScanY; 

  // Pseudo-random noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Value Noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // --- Tulip Logic ---
  float getTulipDisplacement(vec3 position) {
    vec3 spherePos = normalize(position);
    float r = 1.0; 
    float theta = atan(spherePos.z, spherePos.x);
    float phi = acos(spherePos.y); 

    float twistedTheta = theta + phi * uTwist;
    float petals = sin(twistedTheta * uPetalCount);
    float shape = petals;
    float bloom = smoothstep(0.0, 1.5, 1.5 - phi) * uOpenness * petals;
    float surfaceNoise = noise(position.xz * 4.0 + uTime * 0.05) * 0.05 * uDetail;

    return shape * 0.15 + bloom + surfaceNoise;
  }

  void main() {
    vRandom = aRandom;
    vType = aType;
    vec3 pos = position;
    float disp = 0.0;
    
    // --- SHAPE GENERATION ---
    if (aType < 0.5) { 
      // === FLOWER HEAD ===
      disp = getTulipDisplacement(pos);
      vec3 normal = normalize(vec3(pos.x, pos.y * 0.5, pos.z)); 
      pos = pos + normal * disp;
      pos.x += sin(uTime * 0.3) * 0.1;
    } else {
      // === STEM & LEAVES ===
      float bendFactor = (pos.y + 6.0) / 6.0;
      bendFactor = pow(bendFactor, 2.0);
      float windX = sin(uTime * 0.4) * 0.2 * bendFactor;
      float windZ = cos(uTime * 0.3) * 0.1 * bendFactor;
      pos.x += windX;
      pos.z += windZ;
      if (aType > 1.5) {
         pos += aDirection * sin(uTime * 0.8 + pos.y) * 0.02;
      }
    }

    vec3 finalPos = pos;

    // --- CONSTRUCTION SCAN LOGIC ---
    // We scan from Top (+10) to Bottom (-12).
    // If uScanY < finalPos.y, the scanner has passed this point (it is built).
    
    // Calculate progress based on vertical distance from scan plane
    float verticalDist = finalPos.y - uScanY;
    
    // Add randomness to the edge so it's not a perfect flat plane cut
    float edgeNoise = (aRandom - 0.5) * 2.0; 
    
    // When verticalDist is large positive (particle is above scan plane), it's built (1.0).
    // When verticalDist is negative (particle is below scan plane), it's hidden (0.0).
    // The transition happens in a narrow band around the scan plane.
    
    float activation = smoothstep(-1.0, 1.0, verticalDist + edgeNoise);
    vProgress = activation;
    
    // "Making" Effect: Fly in from Corners
    float boxSize = 12.5; 
    float cornerID = floor(aRandom * 4.0);
    vec3 cornerPos;
    if (cornerID < 0.5) cornerPos = vec3(boxSize, boxSize, boxSize);
    else if (cornerID < 1.5) cornerPos = vec3(-boxSize, boxSize, boxSize);
    else if (cornerID < 2.5) cornerPos = vec3(-boxSize, boxSize, -boxSize);
    else cornerPos = vec3(boxSize, boxSize, -boxSize);
    
    // Spread source slightly
    cornerPos += (vec3(hash(vec2(aRandom, 0.1)), hash(vec2(aRandom, 0.2)), hash(vec2(aRandom, 0.3))) - 0.5) * 0.5;

    // Interpolate: 
    // t=0 (Hidden/At Corner) -> t=1 (At Final)
    // We only want particles to start moving when they are near the scan line (activation > 0)
    // Use ease out for impact
    float t = 1.0 - pow(1.0 - activation, 4.0);
    
    pos = mix(cornerPos, finalPos, t);

    vDisplacement = disp;
    vPosition = pos;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size Attenuation & Pop-in
    float sizeMult = (aType < 0.5) ? 1.0 : 0.8;
    
    // Flash size when arriving
    // Activation goes 0 -> 1. Arrival is the low end (0.1 - 0.3)
    float arrivalFlash = smoothstep(0.0, 0.2, activation) * smoothstep(0.4, 0.2, activation);
    
    float growSize = sizeMult * activation * (1.0 + arrivalFlash * 1.5); 
    
    gl_PointSize = uParticleSize * growSize * (300.0 / -mvPosition.z);
    gl_PointSize *= (0.8 + 0.2 * sin(uTime * 2.0 + aRandom * 50.0));
  }
`;

const fragmentShader = `
  varying vec3 vPosition;
  varying float vDisplacement;
  varying float vRandom;
  varying float vType;
  varying float vProgress;

  uniform vec3 uColor;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float d = length(coord);
    if (d > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.0, d);
    
    // Hard clip for unbuilt parts
    if (vProgress < 0.01) discard;
    
    vec3 finalColor;

    if (vType < 0.5) {
      vec3 deepColor = uColor * 0.4;
      vec3 tipColor = uColor * 1.8;
      float mixFactor = smoothstep(-0.1, 0.4, vDisplacement);
      finalColor = mix(deepColor, tipColor, mixFactor);
      finalColor *= (0.8 + 0.4 * vRandom);
    } else {
      vec3 stemDark = vec3(0.05, 0.15, 0.1);
      vec3 leafBlue = vec3(0.1, 0.3, 0.25); 
      finalColor = mix(stemDark, leafBlue, vRandom * 0.8 + 0.2);
      if (vType > 1.5 && vPosition.y > -2.0) {
         finalColor *= 1.2;
      }
    }

    // === LASER SINTERING FLASH ===
    // Heat is high when progress is low (just arrived at scan plane)
    // vProgress represents "how fully built" it is (0 to 1).
    float heat = smoothstep(0.4, 0.0, vProgress); 
    
    // Intense Hot Pink/White
    vec3 hotColor = vec3(1.0, 0.8, 0.9) * 4.0;
    
    finalColor = mix(finalColor, hotColor, heat);
    alpha = mix(alpha, 1.0, heat * 0.8);

    alpha = pow(alpha, 1.5);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// --- Beam Shader ---
const beamVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  
  void main() {
    // Flowing energy
    float flow = mod(vUv.y * 10.0 - uTime * 15.0, 1.0);
    float core = 1.0 - abs(vUv.x - 0.5) * 2.0;
    core = pow(core, 4.0);
    
    float pulse = smoothstep(0.0, 0.3, flow) * smoothstep(0.6, 0.3, flow);
    vec3 color = vec3(0.6, 0.8, 1.0) * (2.0 + pulse * 2.0);
    
    float alpha = core * (0.3 + 0.7 * pulse);
    // Fade at tips slightly
    alpha *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// Helper to create a single beam mesh that tracks a target
const TrackingBeam: React.FC<{ 
  start: THREE.Vector3; 
  growthRef?: React.MutableRefObject<number> 
}> = ({ start, growthRef }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        // Calculate Target Y based on growth
        const growth = growthRef ? growthRef.current : 1.0;
        
        // Match the range in shader: Top (+10) to Bottom (-12)
        const scanY = THREE.MathUtils.lerp(10.0, -12.0, growth);
        
        // If fully built (growth ~1), beams can fade or retract, but keeping them active looks cool.
        // Let's fade them out when done.
        const active = growth < 0.99;

        if (meshRef.current) {
            const target = new THREE.Vector3(0, scanY, 0);
            
            // Position is midpoint
            const mid = new THREE.Vector3().lerpVectors(start, target, 0.5);
            meshRef.current.position.copy(mid);
            
            // Orientation
            dummy.position.copy(start);
            dummy.lookAt(target);
            dummy.rotateX(Math.PI / 2); // Align cylinder Y with lookAt Z
            meshRef.current.quaternion.copy(dummy.quaternion);
            
            // Scale length
            const dist = start.distanceTo(target);
            // Initial geometry height is 1.0, so scale.y = dist
            meshRef.current.scale.set(1, dist, 1);
            
            meshRef.current.visible = active;
        }

        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
        }
    });

    return (
        <mesh ref={meshRef}>
            <cylinderGeometry args={[0.02, 0.05, 1.0, 8, 1, true]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={beamVertexShader}
                fragmentShader={beamFragmentShader}
                uniforms={{ uTime: { value: 0 } }}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}


const ConstructionZone: React.FC<{ growthRef?: React.MutableRefObject<number> }> = ({ growthRef }) => {
  const boxSize = 12.5;
  // Laser Emitters at top corners
  const corners = useMemo(() => [
      new THREE.Vector3(boxSize, boxSize, boxSize),
      new THREE.Vector3(-boxSize, boxSize, boxSize),
      new THREE.Vector3(-boxSize, boxSize, -boxSize),
      new THREE.Vector3(boxSize, boxSize, -boxSize)
  ], []);

  return (
    <group>
       {/* Dynamic Beams */}
       {corners.map((corner, i) => (
           <TrackingBeam key={i} start={corner} growthRef={growthRef} />
       ))}
    </group>
  );
};

export const Rose: React.FC<RoseProps> = ({ config, growthRef }) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const randoms: number[] = [];
    const types: number[] = []; 
    const directions: number[] = []; 

    // 1. Flower Head
    const flowerCount = 120000;
    for(let i=0; i<flowerCount; i++) {
        const offset = 2 / flowerCount;
        const increment = Math.PI * (3 - Math.sqrt(5));
        const yRaw = ((i * offset) - 1) + (offset / 2);
        const rRaw = Math.sqrt(1 - Math.pow(yRaw, 2));
        const phi = ((i + 1) % flowerCount) * increment;
        const x = Math.cos(phi) * rRaw;
        const z = Math.sin(phi) * rRaw;
        const y = yRaw * 2.0 + 1.0; 
        
        positions.push(x, y, z);
        randoms.push(Math.random());
        types.push(0.0);
        directions.push(x, y, z);
    }

    // 2. Stem
    const stemCount = 30000;
    const stemLength = 7.0;
    const stemRadius = 0.08; 
    for(let i=0; i<stemCount; i++) {
      const t = i / stemCount; 
      const y = -1.0 - (t * stemLength); 
      const curveX = Math.sin(y * 0.2) * 0.1; 
      const theta = Math.random() * Math.PI * 2;
      const r = stemRadius * (1.0 - t * 0.1); 
      const x = curveX + Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      positions.push(x, y, z);
      randoms.push(Math.random());
      types.push(1.0);
      directions.push(Math.cos(theta), 0, Math.sin(theta));
    }

    // 3. Leaves
    const leafCount = 40000;
    const leaves = 3; 
    for(let l=0; l<leaves; l++) {
        const attachY = -6.0 + (l * 1.0); 
        const leafAngle = (l * 2.1); 
        const leafDirX = Math.cos(leafAngle);
        const leafDirZ = Math.sin(leafAngle);
        const ptsPerLeaf = Math.floor(leafCount / leaves);
        for(let i=0; i<ptsPerLeaf; i++) {
             const u = Math.random(); 
             const v = (Math.random() * 2 - 1);
             const width = 0.5 * (1.0 - Math.pow(u, 2.0)) * Math.sin(u * 3.14);
             const actualWidth = width * v;
             const h = u * 4.5; 
             const bendOut = Math.sin(u * 3.14 * 0.5) * 0.8; 
             const lx = actualWidth; 
             const lz = 0.1 + bendOut; 
             const rx = leafDirX;
             const rz = leafDirZ;
             const tx = -leafDirZ;
             const tz = leafDirX;
             const px = (rx * lz) + (tx * lx);
             const pz = (rz * lz) + (tz * lx);
             const py = attachY + h;
             positions.push(px, py, pz);
             randoms.push(Math.random());
             types.push(2.0); 
             directions.push(px, 0, pz);
        }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));
    geo.setAttribute('aType', new THREE.Float32BufferAttribute(types, 1));
    geo.setAttribute('aDirection', new THREE.Float32BufferAttribute(directions, 3));
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(config.color) },
      uPetalCount: { value: config.petalCount },
      uTwist: { value: config.twist },
      uOpenness: { value: config.openness },
      uDetail: { value: config.detail },
      uParticleSize: { value: config.particleSize },
      uScanY: { value: 10.0 }, // Start at Top
    }),
    []
  );

  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime() * config.speed;
      material.uniforms.uColor.value.set(config.color);
      material.uniforms.uPetalCount.value = config.petalCount;
      material.uniforms.uTwist.value = config.twist;
      material.uniforms.uOpenness.value = config.openness;
      material.uniforms.uDetail.value = config.detail;
      material.uniforms.uParticleSize.value = config.particleSize;
      
      if (growthRef) {
          // Map growth 0->1 to Scan Y 10->-12
          const scanY = THREE.MathUtils.lerp(10.0, -12.0, growthRef.current);
          material.uniforms.uScanY.value = scanY;
      }
    }
  });

  return (
    <group>
        <ConstructionZone growthRef={growthRef} />
        <points ref={pointsRef}>
          <primitive object={geometry} />
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            transparent={true}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
    </group>
  );
};