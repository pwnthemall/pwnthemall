"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface AnimatedBorderCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  solved?: boolean;
  locked?: boolean;
}

export function AnimatedBorderCard({ 
  children, 
  onClick, 
  className = "", 
  solved = false,
  locked = false 
}: AnimatedBorderCardProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev + 0.5) % 100);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  // Calculate two positions moving from corners
  const getPositions = (prog: number) => {
    // Progress from 0-100
    // 0-50: both lights travel from top-left to bottom-right (one via top-right, one via bottom-left)
    // 50-100: both lights travel from bottom-right to top-left (one via top-right, one via bottom-left)
    
    const halfCycle = prog < 50;
    const normalizedProgress = halfCycle ? prog * 2 : (prog - 50) * 2; // 0-100 within each half
    
    let pos1, pos2;
    
    if (halfCycle) {
      // First half: top-left to bottom-right
      if (normalizedProgress < 50) {
        // Light 1: top-left → top-right
        pos1 = { x: normalizedProgress * 2, y: 0 };
        // Light 2: top-left → bottom-left
        pos2 = { x: 0, y: normalizedProgress * 2 };
      } else {
        // Light 1: top-right → bottom-right
        pos1 = { x: 100, y: (normalizedProgress - 50) * 2 };
        // Light 2: bottom-left → bottom-right
        pos2 = { x: (normalizedProgress - 50) * 2, y: 100 };
      }
    } else {
      // Second half: bottom-right to top-left
      if (normalizedProgress < 50) {
        // Light 1: bottom-right → bottom-left
        pos1 = { x: 100 - normalizedProgress * 2, y: 100 };
        // Light 2: bottom-right → top-right
        pos2 = { x: 100, y: 100 - normalizedProgress * 2 };
      } else {
        // Light 1: bottom-left → top-left
        pos1 = { x: 0, y: 100 - (normalizedProgress - 50) * 2 };
        // Light 2: top-right → top-left
        pos2 = { x: 100 - (normalizedProgress - 50) * 2, y: 0 };
      }
    }
    
    return [pos1, pos2];
  };

  const [position1, position2] = getPositions(progress);

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer group ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {/* Two animated borders traveling from corners */}
      <div 
        className="absolute -inset-[2px] rounded-lg opacity-90"
        style={{
          background: `
            radial-gradient(circle 120px at ${position1.x}% ${position1.y}%, hsl(var(--primary)), transparent 100%),
            radial-gradient(circle 120px at ${position2.x}% ${position2.y}%, hsl(var(--primary)), transparent 100%)
          `
        }}
      />
      
      <Card className={`relative overflow-hidden transition-all hover:shadow-lg bg-background ${
        solved ? 'ring-2 ring-green-500' : ''
      } ${className}`}>
        {children}
      </Card>
    </div>
  );
}
