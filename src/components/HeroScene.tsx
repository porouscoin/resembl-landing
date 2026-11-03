'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

/* ── Particle Network ── */
function ParticleNetwork({ count = 220, mouse }: { count?: number; mouse: React.MutableRefObject<[number, number]> }) {
  const meshRef = useRef<THREE.Points>(null!);
  const lineRef = useRef<THREE.LineSegments>(null!);
  const { viewport } = useThree();

  const { positions, velocities, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [
      [0.031, 0.569, 0.698], // cyan #0891b2
      [0.024, 0.714, 0.831], // light cyan #06b6d4
      [0.388, 0.400, 0.945], // indigo #6366f1
      [0.545, 0.361, 0.965], // purple #8b5cf6
      [0.051, 0.580, 0.533], // teal #0d9488
      [0.925, 0.306, 0.600], // pink #ec4899
      [0.961, 0.620, 0.043], // amber #f59e0b
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3]     = (Math.random() - 0.5) * 10;
      pos[i3 + 1] = (Math.random() - 0.5) * 10;
      pos[i3 + 2] = (Math.random() - 0.5) * 6;
      vel[i3]     = (Math.random() - 0.5) * 0.003;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.003;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.002;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i3] = c[0]; col[i3 + 1] = c[1]; col[i3 + 2] = c[2];
    }
    return { positions: pos, velocities: vel, colors: col };
  }, [count]);

  const lineGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const pos = meshRef.current.geometry.attributes.position.array as Float32Array;
    const dt = Math.min(delta, 0.05);

    // Mouse influence
    const mx = mouse.current[0] * viewport.width * 0.5;
    const my = mouse.current[1] * viewport.height * 0.5;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Move particles
      pos[i3]     += velocities[i3] + (mx - pos[i3]) * 0.0004 * dt;
      pos[i3 + 1] += velocities[i3 + 1] + (my - pos[i3 + 1]) * 0.0004 * dt;
      pos[i3 + 2] += velocities[i3 + 2];

      // Boundary wrapping
      for (let j = 0; j < 3; j++) {
        const bound = j === 2 ? 3 : 5;
        if (pos[i3 + j] > bound) pos[i3 + j] = -bound;
        if (pos[i3 + j] < -bound) pos[i3 + j] = bound;
      }
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;

    // Build connections
    const lineVerts: number[] = [];
    const lineCols: number[] = [];
    const maxDist = 1.6;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDist) {
          const alpha = 1 - dist / maxDist;
          lineVerts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          lineVerts.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
          lineCols.push(0.034, 0.569, 0.698, alpha * 0.35);
          lineCols.push(0.034, 0.569, 0.698, alpha * 0.15);
        }
      }
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCols, 4));
  });

  return (
    <>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} />
        </bufferGeometry>
        <PointMaterial size={0.06} vertexColors transparent opacity={0.9} sizeAttenuation depthWrite={false} />
      </points>
      <lineSegments ref={lineRef} geometry={lineGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.4} depthWrite={false} />
      </lineSegments>
    </>
  );
}

/* ── Glowing Core Sphere ── */
function CoreSphere() {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 0.8) * 0.08);
  });
  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color="#0891b2"
          emissive="#0891b2"
          emissiveIntensity={2.5}
          transparent
          opacity={0.7}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      {/* Outer glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.015, 16, 100]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.5} transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[1.0, 0.008, 16, 100]} />
        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={1.2} transparent opacity={0.25} />
      </mesh>
    </Float>
  );
}

/* ── Orbiting Nodes ── */
function OrbitNodes({ count = 8 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const nodeColors = ['#0891b2', '#06b6d4', '#6366f1', '#8b5cf6', '#0d9488', '#ec4899', '#f59e0b', '#10b981'];

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.08;
      groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.05) * 0.1;
    }
  });

  const nodes = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.8 + Math.random() * 0.5;
      const y = (Math.random() - 0.5) * 1.2;
      return {
        pos: [Math.cos(angle) * radius, y, Math.sin(angle) * radius] as [number, number, number],
        color: nodeColors[i % nodeColors.length],
        scale: 0.06 + Math.random() * 0.06,
      };
    });
  }, [count]);

  return (
    <group ref={groupRef}>
      {nodes.map((n, i) => (
        <mesh key={i} position={n.pos}>
          <sphereGeometry args={[n.scale, 16, 16]} />
          <meshStandardMaterial
            color={n.color}
            emissive={n.color}
            emissiveIntensity={2}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Main Scene Component ── */
export default function HeroScene() {
  const mouseRef = useRef<[number, number]>([0, 0]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current = [
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ];
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div ref={containerRef} className="hero-3d-canvas">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="#0891b2" />
        <pointLight position={[-5, -3, 3]} intensity={0.4} color="#6366f1" />
        <ParticleNetwork count={180} mouse={mouseRef} />
        <CoreSphere />
        <OrbitNodes count={8} />
      </Canvas>
    </div>
  );
}
