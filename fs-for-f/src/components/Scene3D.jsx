import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei';

function Gem({ position, color, scale = 1 }) {
  const ref = useRef();
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <Sphere ref={ref} args={[0.5, 64, 64]} position={position} scale={scale}>
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.3}
          speed={2}
          roughness={0.2}
          metalness={0.4}
        />
      </Sphere>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 5]} color="#ffb6c1" intensity={0.8} />
      <pointLight position={[5, -5, -5]} color="#e0c3fc" intensity={0.6} />
      <Gem position={[2, 1, -3]} color="#ffb6c1" scale={0.8} />
      <Gem position={[-2.5, -0.5, -2]} color="#c9b1ff" scale={0.6} />
      <Gem position={[1, -1.5, -4]} color="#b5ead7" scale={0.5} />
      <Gem position={[-1, 1.5, -3]} color="#ffdac1" scale={0.5} />
      <Gem position={[3, -2, -5]} color="#e0c3fc" scale={0.4} />
      <Gem position={[-3, 0, -4]} color="#ffb6c1" scale={0.45} />
    </>
  );
}

export default function Scene3D() {
  return (
    <div className="scene-3d">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ alpha: true, antialias: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
