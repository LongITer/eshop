import React from "react";

export const AccountIcon = ({
	className = "w-6 h-6",
	fill = "currentColor",
}: {
	className?: string;
	fill?: string;
}) => (
	<svg
		aria-label="Account"
		className={className}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="12" cy="8" r="3.25" fill={fill} />
		<path
			d="M5 20c.55-3.5 3.15-5.5 7-5.5s6.45 2 7 5.5H5Z"
			fill={fill}
		/>
	</svg>
);
