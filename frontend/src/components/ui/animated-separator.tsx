"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedSeparator() {
  const separatorRef = useRef<HTMLDivElement>(null);
  const [gradientPosition, setGradientPosition] = useState(50);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!separatorRef.current) return;
      
      const rect = separatorRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      
      // Clamp between 0 and 100
      setGradientPosition(Math.max(0, Math.min(100, percentage)));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div 
      ref={separatorRef}
      className="relative h-px my-12 overflow-hidden"
    >
      <div 
        className="absolute inset-0 transition-all duration-300 ease-out"
        style={{
          background: `linear-gradient(90deg, 
            hsl(var(--border)) 0%, 
            hsl(var(--primary)) ${Math.max(0, gradientPosition - 10)}%, 
            hsl(var(--primary)) ${gradientPosition}%, 
            hsl(var(--primary)) ${Math.min(100, gradientPosition + 10)}%, 
            hsl(var(--border)) 100%)`
        }}
      />
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50 transition-all duration-300 ease-out"
        style={{
          left: `${gradientPosition}%`,
          transform: `translate(-50%, -50%)`
        }}
      />
    </div>
  );
}
