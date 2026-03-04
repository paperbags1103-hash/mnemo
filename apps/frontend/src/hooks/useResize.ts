import { useCallback, useEffect, useRef, useState } from "react";

export function useResize(
  storageKey: string,
  defaultSize: number,
  min: number,
  max: number,
  direction: "right" | "left" = "right",
) {
  const [size, setSize] = useState<number>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? Number(stored) : defaultSize;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startSize = useRef(size);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startSize.current = size;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [size]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = direction === "right"
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const next = Math.min(max, Math.max(min, startSize.current + delta));
      setSize(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSize(s => { localStorage.setItem(storageKey, String(s)); return s; });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [storageKey, direction, min, max]);

  return { size, onMouseDown };
}
