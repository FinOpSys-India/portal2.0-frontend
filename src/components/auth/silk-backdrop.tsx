"use client";

import * as React from "react";
import dynamic from "next/dynamic";

// WebGL cannot render on the server, and `three` is a heavy dependency — keep
// it out of the initial bundle and off the SSR pass entirely.
const Silk = dynamic(() => import("@/components/ui/silk"), { ssr: false });

/**
 * Animated silk backdrop for the auth panel.
 *
 * Until the canvas mounts, and for anyone who has asked for reduced motion,
 * the panel falls back to a flat brand fill rather than popping in.
 */
export function SilkBackdrop({ color }: { color: string }) {
  const reduced = useReducedMotion();

  return (
    <div className="absolute inset-0 bg-[#2c1a72]">
      <Silk
        color={color}
        speed={reduced ? 0 : 3.2}
        scale={1.1}
        noiseIntensity={1.4}
        rotation={0.35}
        paused={reduced}
      />
    </div>
  );
}

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Tracks `prefers-reduced-motion`, including changes made while the page is
 * open. `useSyncExternalStore` rather than state-in-an-effect: matchMedia is
 * an external store, and reading it that way avoids a cascading render.
 */
function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false, // server: assume motion is fine, the canvas is client-only
  );
}
