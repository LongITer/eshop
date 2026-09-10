import React from "react";

export const Home = ({ className = "w-6 h-6", fill = "currentColor" }: { className?: string; fill?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill={fill}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="3" width="7.5" height="10.5" rx="1.5" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="1.5" />
  </svg>
);