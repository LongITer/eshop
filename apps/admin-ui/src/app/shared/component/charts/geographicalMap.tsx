"use client";
import React, { useEffect, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

export interface CountryData {
  id: string | number; // numeric ISO 3166-1 id
  name: string;
  users: number;
  sellers: number;
}

interface GeographicalMapProps {
  countries?: CountryData[];
}

const defaultCountries: CountryData[] = [
  { id: 840, name: "United States", users: 320, sellers: 85 },
  { id: 76,  name: "Brazil",        users: 150, sellers: 42 },
  { id: 356, name: "India",         users: 100, sellers: 20 },
  { id: 156, name: "China",         users: 200, sellers: 55 },
  { id: 643, name: "Russia",        users: 80,  sellers: 15 },
  { id: 36,  name: "Australia",     users: 60,  sellers: 18 },
  { id: 276, name: "Germany",       users: 90,  sellers: 30 },
  { id: 566, name: "Nigeria",       users: 45,  sellers: 8  },
  { id: 392, name: "Japan",         users: 110, sellers: 35 },
  { id: 826, name: "United Kingdom",users: 95,  sellers: 28 },
  { id: 710, name: "South Africa",  users: 55,  sellers: 12 },
  { id: 484, name: "Mexico",        users: 70,  sellers: 22 },
];

interface TooltipState {
  x: number;
  y: number;
  country: CountryData;
}

const WIDTH  = 900;
const HEIGHT = 460;

const GeographicalMap = ({ countries = defaultCountries }: GeographicalMapProps) => {
  const [paths, setPaths] = useState<Array<{ d: string; id: number }>>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dataMap = new Map(countries.map((c) => [Number(c.id), c]));

  useEffect(() => {
    // Fetch topology from local public folder (copied from world-atlas package)
    fetch("/countries-110m.json")
      .then((r) => r.json())
      .then((topo: Topology) => {
        const projection = geoNaturalEarth1()
          .scale(145)
          .translate([WIDTH / 2, HEIGHT / 2]);
        const pathGen = geoPath(projection);

        const geojson = feature(
          topo,
          (topo.objects as Record<string, GeometryCollection>)["countries"]
        );

        const built = (geojson as any).features.map((f: any) => ({
          d: pathGen(f) ?? "",
          id: Number(f.id),
        }));
        setPaths(built);
      });
  }, []);

  const handleMouseMove = (
    e: React.MouseEvent<SVGPathElement>,
    id: number,
    country: CountryData
  ) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH  / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top)  * scaleY;
    setHovered(id);
    setTooltip({ x, y, country });
  };

  const handleMouseLeave = () => {
    setHovered(null);
    setTooltip(null);
  };

  const maxUsers = Math.max(...countries.map((c) => c.users), 1);

  // tooltip placement: keep it inside the viewBox
  const ttW = 150, ttH = 72;
  const ttX = tooltip
    ? Math.min(Math.max(tooltip.x - ttW / 2, 4), WIDTH - ttW - 4)
    : 0;
  const ttY = tooltip
    ? tooltip.y - ttH - 14 < 0
      ? tooltip.y + 14
      : tooltip.y - ttH - 14
    : 0;

  return (
    <div
      className="w-full overflow-hidden"
      role="img"
      aria-label="User & Seller distribution map"
    >
      <svg
        ref={svgRef}
        className="h-auto w-full"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #0a1628 0%, #060d18 100%)",
        }}
      >
        <defs>
          <radialGradient id="map-glow-g" cx="50%" cy="50%" r="50%">
            <stop offset="0"   stopColor="#21c966" stopOpacity="0.7" />
            <stop offset="1"   stopColor="#21c966" stopOpacity="0"   />
          </radialGradient>
          <radialGradient id="map-glow-b" cx="50%" cy="50%" r="50%">
            <stop offset="0"   stopColor="#4285f4" stopOpacity="0.6" />
            <stop offset="1"   stopColor="#4285f4" stopOpacity="0"   />
          </radialGradient>
          <filter id="country-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tt-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* graticule lines */}
        {Array.from({ length: 7 }, (_, i) => {
          const x = (i / 6) * WIDTH;
          return (
            <line key={`vg-${i}`} x1={x} y1={0} x2={x} y2={HEIGHT}
              stroke="#0d1f35" strokeWidth="0.5" opacity="0.6" />
          );
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const y = (i / 4) * HEIGHT;
          return (
            <line key={`hg-${i}`} x1={0} y1={y} x2={WIDTH} y2={y}
              stroke="#0d1f35" strokeWidth="0.5" opacity="0.6" />
          );
        })}

        {/* Country paths */}
        {paths.map(({ d, id }) => {
          if (!d) return null;
          const data      = dataMap.get(id);
          const isHovered = hovered === id;
          const hasData   = Boolean(data);
          const isHighUser = data && data.users > 100;

          return (
            <path
              key={id}
              d={d}
              fill={
                hasData
                  ? isHovered
                    ? isHighUser ? "#2ee87a" : "#5ba5f7"
                    : isHighUser ? "#1fa855" : "#2460c0"
                  : "#13243a"
              }
              stroke={hasData ? (isHighUser ? "#30f07e" : "#5ba5f7") : "#1c3250"}
              strokeWidth={hasData ? (isHovered ? 1.2 : 0.7) : 0.4}
              opacity={isHovered ? 1 : hasData ? 0.9 : 0.65}
              style={{
                cursor: hasData ? "pointer" : "default",
                transition: "fill 0.2s ease, opacity 0.2s ease",
              }}
              filter={isHovered ? "url(#country-blur)" : undefined}
              onMouseMove={hasData ? (e) => handleMouseMove(e, id, data!) : undefined}
              onMouseLeave={hasData ? handleMouseLeave : undefined}
            />
          );
        })}

        {/* Glow dots on countries with data */}
        {paths.map(({ d, id }) => {
          if (!d) return null;
          const data = dataMap.get(id);
          if (!data) return null;
          // Compute centroid-ish from bounding box of path — simpler: use a circle at known spot
          // We'll skip centroids and just render dots at the SVG path centroid via a dummy path trick
          return null; // dots are handled by path highlight, skip extra SVG for now
        })}

        {/* Tooltip */}
        {tooltip && (
          <g
            transform={`translate(${ttX},${ttY})`}
            filter="url(#tt-shadow)"
            style={{ pointerEvents: "none" }}
          >
            {/* Arrow */}
            {tooltip.y - ttH - 14 >= 0 && (
              <polygon
                points={`${tooltip.x - ttX - 6},${ttH} ${tooltip.x - ttX + 6},${ttH} ${tooltip.x - ttX},${ttH + 10}`}
                fill="#0c1726"
              />
            )}
            <rect
              x="0" y="0"
              width={ttW} height={ttH}
              rx="7"
              fill="#0c1726"
              stroke="#1e3450"
              strokeWidth="1"
            />
            {/* Country name */}
            <text
              x={ttW / 2} y="19"
              textAnchor="middle"
              fill="#e2e8f4"
              fontSize="12"
              fontWeight="700"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {tooltip.country.name}
            </text>
            <line x1="12" y1="26" x2={ttW - 12} y2="26" stroke="#1e3450" strokeWidth="0.8" />

            {/* Users row */}
            <circle cx="20" cy="41" r="4" fill="#21c966" />
            <text x="30" y="45" fill="#8fa3bc" fontSize="11" fontFamily="sans-serif">
              Users:{" "}
              <tspan fill="#e2e8f4" fontWeight="600">
                {tooltip.country.users}
              </tspan>
            </text>

            {/* Sellers row */}
            <circle cx="20" cy="58" r="4" fill="#4285f4" />
            <text x="30" y="62" fill="#8fa3bc" fontSize="11" fontFamily="sans-serif">
              Sellers:{" "}
              <tspan fill="#e2e8f4" fontWeight="600">
                {tooltip.country.sellers}
              </tspan>
            </text>
          </g>
        )}

        {/* Loading placeholder */}
        {paths.length === 0 && (
          <text
            x={WIDTH / 2} y={HEIGHT / 2}
            textAnchor="middle"
            fill="#2a4060"
            fontSize="16"
            fontFamily="sans-serif"
          >
            Loading map…
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 px-1 text-sm text-slate-400">
        {countries.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: c.users > 100 ? "#21c966" : "#4285f4" }}
            />
            <span className="text-slate-300">{c.name}</span>
            <strong className="text-slate-100">{c.users}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeographicalMap;
