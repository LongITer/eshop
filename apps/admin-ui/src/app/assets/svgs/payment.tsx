import React from "react";

export const Payment = ({
	className = "w-6 h-6",
	fill = "currentColor",
}: {
	className?: string;
	fill?: string;
}) => (
	<svg
		aria-label="Payment"
		className={className}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect x="3" y="5" width="18" height="14" rx="2" fill={fill} />
		<path d="M3 9h18v2H3V9Z" fill="white" fillOpacity="0.45" />
		<rect x="6" y="14" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
		<rect x="13" y="14" width="5" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
	</svg>
);
