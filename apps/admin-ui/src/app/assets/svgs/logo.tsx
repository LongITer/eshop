import React from "react";

const Logo = ({ className = "" }: { className?: string }) => {
	return (
		<svg
			aria-label="Eshop logo"
			className={className}
			fill="none"
			height="42"
			role="img"
			viewBox="0 0 42 42"
			width="42"
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect fill="#0085FF" height="42" rx="12" width="42" />
			<path
				d="M12 14.5C12 12.567 13.567 11 15.5 11H30L25.5 16H17V19H25L21 23H17V26H30L25.5 31H15.5C13.567 31 12 29.433 12 27.5V14.5Z"
				fill="white"
			/>
			<path d="M27 19H31L27 23H23L27 19Z" fill="#B9E3FF" />
		</svg>
	);
};

export default Logo;
