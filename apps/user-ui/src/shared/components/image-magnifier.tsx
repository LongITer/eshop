"use client";

import React, { useRef, useState } from "react";

interface ImageMagnifierProps {
  src: string;
  alt?: string;
  zoom?: number;
}

const ImageMagnifier = ({ src, alt = "product", zoom = 2.5 }: ImageMagnifierProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosition({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg cursor-crosshair select-none"
      style={{ aspectRatio: "1 / 1" }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-100"
        style={{
          transformOrigin: `${position.x}% ${position.y}%`,
          transform: isHovering ? `scale(${zoom})` : "scale(1)",
        }}
        draggable={false}
      />
    </div>
  );
};

export default ImageMagnifier;
