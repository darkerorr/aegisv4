"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type SceneProps = {
  active: boolean;
  reducedMotion: boolean;
  simplified: boolean;
  onReady: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
};

function ContextLifecycle({ onContextLost, onContextRestored }: Pick<SceneProps, "onContextLost" | "onContextRestored">) {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onContextLost();
      if (process.env.NODE_ENV !== "production") console.warn("[Hero3D] context lost");
    };
    const restored = () => {
      onContextRestored();
      if (process.env.NODE_ENV !== "production") console.info("[Hero3D] context restored");
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [canvas, onContextLost, onContextRestored]);

  return null;
}

function IntelligenceCore({ active, reducedMotion, simplified }: Pick<SceneProps, "active" | "reducedMotion" | "simplified">) {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(() => [
    { name: "PrimaryRing", radius: 1.45, tube: 0.034, tilt: -0.28, color: "#ffffff" },
    { name: "SecondaryRing", radius: 1.69, tube: 0.024, tilt: 0.25, color: "#d9d9d9" },
    { name: "TertiaryRing", radius: 1.94, tube: 0.017, tilt: 0.56, color: "#b8b8b8" },
  ], []);

  useFrame((state, delta) => {
    if (!group.current || !active || reducedMotion) return;
    const targetX = state.pointer.y * 0.13;
    const targetY = state.pointer.x * 0.18 + state.clock.elapsedTime * 0.045;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 3, delta);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 2, delta);
  });

  return <group ref={group} name="AegisCoreAssembly">
    <mesh name="AegisCore">
      <icosahedronGeometry args={[0.87, simplified ? 2 : 4]} />
      <meshPhysicalMaterial color="#050505" metalness={0.96} roughness={0.14} clearcoat={1} clearcoatRoughness={0.12} />
    </mesh>
    <mesh name="CoreReflection" scale={0.96}>
      <icosahedronGeometry args={[0.87, simplified ? 1 : 2]} />
      <meshPhysicalMaterial color="#2a2a2a" metalness={0.7} roughness={0.26} transparent opacity={0.22} wireframe />
    </mesh>
    {rings.slice(0, simplified ? 2 : 3).map((ring, index) => <mesh key={ring.name} name={ring.name} rotation={[ring.tilt, index * 0.73, index * 0.42]}>
      <torusGeometry args={[ring.radius, ring.tube, 8, simplified ? 80 : 150, Math.PI * 1.72]} />
      <meshStandardMaterial color={ring.color} metalness={1} roughness={0.2} emissive={index === 1 ? "#3a3a3a" : "#000000"} emissiveIntensity={0.24} />
    </mesh>)}
    <group name="LightingRig">
      <pointLight color="#ffffff" intensity={16} distance={5} />
      <pointLight position={[2.2, -1, 1.4]} color="#e0e0e0" intensity={3.5} distance={4} />
    </group>
    {!simplified && !reducedMotion && <Sparkles count={42} scale={6} size={1.15} speed={active ? 0.1 : 0} opacity={0.3} color="#ffffff" />}
  </group>;
}

export default function GlobalIntelligenceScene({ active, reducedMotion, simplified, onReady, onContextLost, onContextRestored }: SceneProps) {
  return <Canvas
    aria-label="Interactive Aegis intelligence core"
    data-testid="hero-3d-canvas"
    dpr={[1, 1.5]}
    frameloop={active && !reducedMotion ? "always" : "demand"}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    camera={{ position: [0, 0, 5.8], fov: 38 }}
    onCreated={({ camera }) => {
      camera.name = "AegisHeroCamera";
      if (process.env.NODE_ENV !== "production") console.info("[Hero3D] canvas created");
      requestAnimationFrame(() => {
        onReady();
        if (process.env.NODE_ENV !== "production") console.info("[Hero3D] scene ready");
      });
    }}
  >
    <ambientLight name="Environment" intensity={0.2} />
    <directionalLight position={[3, 4, 4]} intensity={2.6} />
    <IntelligenceCore active={active} reducedMotion={reducedMotion} simplified={simplified} />
    <ContextLifecycle onContextLost={onContextLost} onContextRestored={onContextRestored} />
  </Canvas>;
}
