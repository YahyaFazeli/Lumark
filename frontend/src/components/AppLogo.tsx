import React from 'react';

export interface AppLogoProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Main application brand logo component (White SVG, No Background).
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  size = 18,
  className = '',
  ...rest
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="158 144 395 421"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      data-testid="app-logo"
      {...rest}
    >
      <path
        d="M 458 144 H 380 C 301 144, 238 201, 221 283 L 191 481 C 248 420, 322 384, 417 369 Z"
        fill="#FFFFFF"
      />
      <path
        d="M 553 391 H 424 C 337 399, 246 454, 192 514 C 178 530, 166 548, 158 565 C 211 529, 262 505, 313 504 H 408 C 474 499, 530 454, 553 391 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};
