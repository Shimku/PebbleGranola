"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function usePointerTilt(active: boolean) {
  const wellRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const fine = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(pointer: fine)");
    const sync = () => {
      fine.current = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const nodes = () => [worldRef.current, ringRef.current];

    if (!active) {
      current.current = { x: 0, y: 0 };
      target.current = { x: 0, y: 0 };
      for (const node of nodes()) {
        if (node) node.style.transform = "rotateX(0deg) rotateY(0deg)";
      }
      return;
    }

    let frame = 0;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.12;
      current.current.y += (target.current.y - current.current.y) * 0.12;
      const transform = `rotateX(${current.current.x.toFixed(3)}deg) rotateY(${current.current.y.toFixed(3)}deg)`;
      for (const node of nodes()) {
        if (node) node.style.transform = transform;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!active || !fine.current) return;
    const well = wellRef.current;
    if (!well) return;
    const rect = well.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    target.current = { x: -ny * 10, y: nx * 14 };
  }

  function onPointerLeave() {
    target.current = { x: 0, y: 0 };
  }

  return { wellRef, worldRef, ringRef, onPointerMove, onPointerLeave };
}
