import type { SVGProps } from "react";

type IconName = "shield" | "dashboard" | "queue" | "flag" | "list" | "exit" | "back" | "menu" | "close" | "search" | "check" | "clock";

const paths: Record<IconName, React.ReactNode> = {
  shield: <path d="M12 3 5 6v5c0 4.5 3 7.5 7 10 4-2.5 7-5.5 7-10V6l-7-3Z" />,
  dashboard: <><rect x="4" y="4" width="6" height="6" rx=".5" /><rect x="14" y="4" width="6" height="6" rx=".5" /><rect x="4" y="14" width="6" height="6" rx=".5" /><rect x="14" y="14" width="6" height="6" rx=".5" /></>,
  queue: <><path d="M4 6h16M4 11h12M4 16h7m3 1 2 2 5-5" /></>,
  flag: <><path d="M6 21V4h12l-3 4 3 4H6" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1" /></>,
  exit: <><path d="M10 4H5v16h5m4-12 4 4-4 4m-5-4h12" /></>,
  back: <path d="m14 6-6 6 6 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

export function AdminIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
