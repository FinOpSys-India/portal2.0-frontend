"use client";

// Adapted from React Bits (https://reactbits.dev) — Silk.
// Ported to TypeScript, given a prefers-reduced-motion path, and reworked so
// prop changes are applied on the render loop instead of in an effect.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Color, Mesh, ShaderMaterial, type IUniform } from "three";

type SilkUniforms = {
  uSpeed: IUniform<number>;
  uScale: IUniform<number>;
  uNoiseIntensity: IUniform<number>;
  uColor: IUniform<Color>;
  uRotation: IUniform<number>;
  uTime: IUniform<number>;
};

export type SilkProps = {
  /** Animation speed. */
  speed?: number;
  /** Pattern scale. */
  scale?: number;
  /** Hex colour of the silk. */
  color?: string;
  /** Grain strength. */
  noiseIntensity?: number;
  /** Pattern rotation, in radians. */
  rotation?: number;
  /**
   * Hold the animation on its first frame. Pass the user's reduced-motion
   * preference here — a shader that never stops moving is precisely what that
   * setting exists to prevent.
   */
  paused?: boolean;
};

function hexToNormalizedRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
}
`;

function createUniforms(props: Required<Omit<SilkProps, "paused">>) {
  return {
    uSpeed: { value: props.speed },
    uScale: { value: props.scale },
    uNoiseIntensity: { value: props.noiseIntensity },
    uColor: { value: new Color(...hexToNormalizedRGB(props.color)) },
    uRotation: { value: props.rotation },
    uTime: { value: 0 },
  } satisfies SilkUniforms;
}

function SilkPlane({
  speed,
  scale,
  color,
  noiseIntensity,
  rotation,
  paused,
}: Required<SilkProps>) {
  const meshRef = useRef<Mesh>(null);
  const { viewport } = useThree();

  // Built once via a lazy initialiser. Recreating it would reset uTime and
  // make the pattern jump on every prop change, so the values are synced on
  // the render loop instead.
  const [uniforms] = useState(() =>
    createUniforms({ speed, scale, color, noiseIntensity, rotation }),
  );

  // Uniforms are read through the material rather than the object React
  // handed us: they belong to three.js, and mutating them there is the
  // documented r3f pattern.
  useFrame((_, delta) => {
    const material = meshRef.current?.material as ShaderMaterial | undefined;
    if (!material) return;

    const u = material.uniforms as SilkUniforms;
    u.uSpeed.value = speed;
    u.uScale.value = scale;
    u.uNoiseIntensity.value = noiseIntensity;
    u.uRotation.value = rotation;
    u.uColor.value.setRGB(...hexToNormalizedRGB(color));

    if (!paused) u.uTime.value += 0.1 * delta;
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

export default function Silk({
  speed = 5,
  scale = 1,
  color = "#7B7481",
  noiseIntensity = 1.5,
  rotation = 0,
  paused = false,
}: SilkProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      // The plane animates every frame, so "demand" would need manual
      // invalidation. `paused` is what actually stops the work.
      frameloop={paused ? "never" : "always"}
    >
      <SilkPlane
        speed={speed}
        scale={scale}
        color={color}
        noiseIntensity={noiseIntensity}
        rotation={rotation}
        paused={paused}
      />
    </Canvas>
  );
}

