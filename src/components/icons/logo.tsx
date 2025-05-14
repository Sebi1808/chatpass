import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 50"
      width="150"
      height="37.5"
      aria-label="ChatSim Schularena Logo"
      {...props}
    >
      <rect width="200" height="50" rx="5" fill="transparent" />
      <text
        x="10"
        y="35"
        fontFamily="var(--font-sans), Arial, sans-serif"
        fontSize="28"
        fontWeight="800"
        fill="hsl(var(--primary))"
      >
        ChatSim
      </text>
      <text
        x="115"
        y="35"
        fontFamily="var(--font-sans), Arial, sans-serif"
        fontSize="28"
        fontWeight="600"
        fill="hsl(var(--foreground))"
      >
        Schularena
      </text>
    </svg>
  );
}
