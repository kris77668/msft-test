/**
 * Icon set — ported from design_handoff/site/core.jsx.
 *
 * All 19 icons, same geometry and stroke weights as the prototype. Two changes:
 *
 *  - `aria-hidden` by default. The prototype rendered bare <svg> with no label,
 *    so screen readers announced nothing for icon-only controls. Pass a `title`
 *    where the icon carries meaning on its own; leave it off where adjacent text
 *    already says it.
 *  - Named exports rather than one `Icon` object, so unused icons tree-shake.
 */

import type { SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Width and height in px. Defaults match the prototype's per-icon defaults. */
  size?: number;
  /** Accessible name. Omit for decorative icons — they stay aria-hidden. */
  title?: string;
}

function Svg({
  size,
  title,
  children,
  ...rest
}: IconProps & { children: React.ReactNode; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const SearchIcon = ({ size = 18, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.5-4.5" />
  </Svg>
);

export const BagIcon = ({ size = 18, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <path d="M5 8h14l-1.2 12H6.2L5 8Z" />
    <path d="M9 8a3 3 0 1 1 6 0" />
  </Svg>
);

export const AccountIcon = ({ size = 18, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5" />
  </Svg>
);

export const HeartIcon = ({ size = 18, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
  </Svg>
);

export const HeartFilledIcon = ({ size = 18, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={0} fill="currentColor" {...p}>
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
  </Svg>
);

export const ArrowRightIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.1} {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Svg>
);

export const ArrowLeftIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.1} {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Svg>
);

export const ChevronDownIcon = ({ size = 14, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.1} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const ChevronRightIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <path d="m10 6 6 6-6 6" />
  </Svg>
);

export const ChevronLeftIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <path d="m14 6-6 6 6 6" />
  </Svg>
);

export const CloseIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.3} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const PlusIcon = ({ size = 14, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.3} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = ({ size = 14, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.3} {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const StarIcon = ({ size = 13, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={0} fill="currentColor" {...p}>
    <path d="M12 2.5l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.6 6.2 20l1.5-6.5-5-4.4 6.6-.6L12 2.5Z" />
  </Svg>
);

export const CheckIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.4} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);

export const CalendarIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <rect x="4" y="5" width="16" height="16" rx="1.5" />
    <path d="M4 9h16M8 3v4M16 3v4" />
  </Svg>
);

export const TruckIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </Svg>
);

export const RulerIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <rect x="3" y="8" width="18" height="8" rx="1" />
    <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
  </Svg>
);

export const InstagramIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r=".8" fill="currentColor" />
  </Svg>
);

export const FacebookIcon = ({ size = 16, ...p }: IconProps) => (
  <Svg size={size} strokeWidth={1.2} {...p}>
    <path d="M14 22V13h3l.5-3.5H14V7.5c0-1 .3-1.7 1.8-1.7H17.7V2.6c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V9.5H7.5V13H10.5V22" />
  </Svg>
);
