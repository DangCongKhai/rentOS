export type IconName =
  | "pin"
  | "building"
  | "check"
  | "calendar"
  | "info"
  | "wifi"
  | "parking"
  | "laundry"
  | "air"
  | "kitchen";

const amenityIcons: Record<string, IconName> = {
  wifi: "wifi",
  parking: "parking",
  laundry: "laundry",
  elevator: "building",
  air_conditioning: "air",
  washing_machine: "laundry",
  kitchen: "kitchen",
};

export function amenityIcon(key: string): IconName {
  return amenityIcons[key] ?? "check";
}

export function ListingIcon({ name, size }: { name: IconName; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: IconName) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "check":
      return <path d="m5 12 5 5L20 7" {...stroke} />;
    case "pin":
      return <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" {...stroke} />;
    case "building":
      return <path d="M4 20V6.5L12 3l8 3.5V20M9 20v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01" {...stroke} />;
    case "calendar":
      return <path d="M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" {...stroke} />;
    case "wifi":
      return <path d="M5 10.5a10 10 0 0 1 14 0M8 13.5a6 6 0 0 1 8 0M12 17.5h.01" {...stroke} />;
    case "parking":
      return <path d="M6 4h7a4 4 0 0 1 0 8H6V4Zm0 8v8" {...stroke} />;
    case "laundry":
      return <path d="M6 3h12v18H6V3Zm0 4h12M12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" {...stroke} />;
    case "air":
      return <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" {...stroke} />;
    case "kitchen":
      return <path d="M8 3v8a2 2 0 1 0 4 0V3M10 11v10M16 3v6h3V3M17.5 9v12" {...stroke} />;
    case "info":
      return <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 8h.01" {...stroke} />;
  }
}
