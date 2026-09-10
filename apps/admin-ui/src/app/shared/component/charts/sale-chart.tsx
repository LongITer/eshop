"use client";
import React, { useState } from "react";

export interface SalePoint {
	label: string;
	value: number;
}

interface SaleChartProps {
	data?: SalePoint[];
	height?: number;
}

const defaultData: SalePoint[] = [
	{ label: "Jan", value: 42 },
	{ label: "Feb", value: 58 },
	{ label: "Mar", value: 46 },
	{ label: "Apr", value: 72 },
	{ label: "May", value: 64 },
	{ label: "Jun", value: 86 },
	{ label: "Jul", value: 78 },
	{ label: "Aug", value: 96 },
	{ label: "Sep", value: 82 },
	{ label: "Oct", value: 108 },
	{ label: "Nov", value: 92 },
	{ label: "Dec", value: 124 },
];

// Generate smooth Bezier curve path from points
function smoothLine(pts: { x: number; y: number }[]): string {
	if (pts.length < 2) return "";
	let d = `M ${pts[0].x} ${pts[0].y}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[Math.max(i - 1, 0)];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[Math.min(i + 2, pts.length - 1)];
		const tension = 0.35;
		const cp1x = p1.x + (p2.x - p0.x) * tension;
		const cp1y = p1.y + (p2.y - p0.y) * tension;
		const cp2x = p2.x - (p3.x - p1.x) * tension;
		const cp2y = p2.y - (p3.y - p1.y) * tension;
		d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}
	return d;
}

const SaleChart = ({ data = defaultData, height = 260 }: SaleChartProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	const chartWidth = 720;
	const chartHeight = 260;
	const padding = { top: 20, right: 18, bottom: 34, left: 42 };
	const plotWidth = chartWidth - padding.left - padding.right;
	const plotHeight = chartHeight - padding.top - padding.bottom;
	const maximum = Math.max(...data.map((point) => point.value), 1);
	const gridValues = [0, 0.25, 0.5, 0.75, 1];
	const points = data.map((point, index) => ({
		x: padding.left + (index / Math.max(data.length - 1, 1)) * plotWidth,
		y: padding.top + plotHeight - (point.value / maximum) * plotHeight,
	}));
	const linePath = smoothLine(points);
	const areaPath = `${linePath} L ${padding.left + plotWidth} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;

	return (
		<div className="w-full overflow-hidden" role="img" aria-label="Sales chart">
			<svg
				className="h-auto w-full"
				viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				preserveAspectRatio="none"
				height={height}
				xmlns="http://www.w3.org/2000/svg"
			>
				<defs>
					<linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#1677d2" stopOpacity="0.46" />
						<stop offset="1" stopColor="#1677d2" stopOpacity="0.04" />
					</linearGradient>
					<linearGradient id="revenue-line-grad" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0" stopColor="#1a6ed8" />
						<stop offset="0.5" stopColor="#3b9cf5" />
						<stop offset="1" stopColor="#1a6ed8" />
					</linearGradient>
					<filter id="line-glow" x="-10%" y="-10%" width="120%" height="120%">
						<feGaussianBlur stdDeviation="2" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				{/* Grid lines */}
				{gridValues.map((ratio) => {
					const y = padding.top + plotHeight * (1 - ratio);
					return (
						<g key={ratio}>
							<line
								x1={padding.left}
								y1={y}
								x2={chartWidth - padding.right}
								y2={y}
								stroke="#27364a"
								strokeDasharray="3 5"
							/>
							<text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#748198" fontSize="13">
								{Math.round(maximum * ratio)}
							</text>
						</g>
					);
				})}

				{/* Area fill */}
				<path d={areaPath} fill="url(#revenue-area)" />

				{/* Line with glow */}
				<path
					d={linePath}
					fill="none"
					stroke="url(#revenue-line-grad)"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					filter="url(#line-glow)"
				/>

				{/* Hover vertical line */}
				{hoveredIndex !== null && (
					<line
						x1={points[hoveredIndex].x}
						y1={padding.top}
						x2={points[hoveredIndex].x}
						y2={padding.top + plotHeight}
						stroke="#3b9cf5"
						strokeWidth="1"
						strokeDasharray="4 3"
						opacity="0.5"
					/>
				)}

				{/* Data points and hover areas */}
				{data.map((point, index) => {
					const chartPoint = points[index];
					const isHovered = hoveredIndex === index;
					return (
						<g key={`${point.label}-${index}`}>
							{/* Invisible wider hover area */}
							<rect
								x={chartPoint.x - (plotWidth / data.length) / 2}
								y={padding.top}
								width={plotWidth / data.length}
								height={plotHeight}
								fill="transparent"
								onMouseEnter={() => setHoveredIndex(index)}
								onMouseLeave={() => setHoveredIndex(null)}
								style={{ cursor: "crosshair" }}
							/>
							{/* Dot - visible on hover */}
							{isHovered && (
								<>
									<circle
										cx={chartPoint.x}
										cy={chartPoint.y}
										r={8}
										fill="#2588f5"
										opacity="0.2"
									/>
									<circle
										cx={chartPoint.x}
										cy={chartPoint.y}
										r={4.5}
										fill="#2588f5"
										stroke="#fff"
										strokeWidth="2"
									/>
								</>
							)}
							{/* Label */}
							<text x={chartPoint.x} y={chartHeight - 10} textAnchor="middle" fill="#8995a8" fontSize="13">
								{point.label}
							</text>
						</g>
					);
				})}

				{/* Tooltip */}
				{hoveredIndex !== null && (() => {
					const point = data[hoveredIndex];
					const chartPoint = points[hoveredIndex];
					const tooltipW = 88;
					const tooltipH = 42;
					let tx = chartPoint.x - tooltipW / 2;
					const ty = chartPoint.y - tooltipH - 12;
					// Keep tooltip within bounds
					if (tx < padding.left) tx = padding.left;
					if (tx + tooltipW > chartWidth - padding.right) tx = chartWidth - padding.right - tooltipW;

					return (
						<g style={{ pointerEvents: "none" }}>
							<rect
								x={tx}
								y={ty}
								width={tooltipW}
								height={tooltipH}
								rx="6"
								fill="#0f1a2e"
								stroke="#1e3450"
								strokeWidth="1"
								opacity="0.95"
							/>
							{/* Arrow */}
							<polygon
								points={`${chartPoint.x - 5},${ty + tooltipH} ${chartPoint.x + 5},${ty + tooltipH} ${chartPoint.x},${ty + tooltipH + 6}`}
								fill="#0f1a2e"
							/>
							<text x={tx + tooltipW / 2} y={ty + 17} textAnchor="middle" fill="#a8b5c8" fontSize="11" fontFamily="sans-serif">
								{point.label}
							</text>
							<text x={tx + tooltipW / 2} y={ty + 34} textAnchor="middle" fill="#e8ecf2" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
								${point.value}K
							</text>
						</g>
					);
				})()}
			</svg>
		</div>
	);
};

export default SaleChart;