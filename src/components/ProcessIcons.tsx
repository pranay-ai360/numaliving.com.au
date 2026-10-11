import type { ReactNode } from "react";

/**
 * Line icons for the Process diagram (24 x 24 grid, drawn in the current text colour).
 * To change a step's icon, set its `icon` in src/content/pages.ts to one of these names.
 * To add a new icon, add a name and its drawing below.
 */
const icons: Record<string, ReactNode> = {
  // pencil
  enquiry: (
    <>
      <path d="M4 20h4L19.5 8.5l-4-4L4 16v4z" />
      <path d="M13 7l4 4" />
    </>
  ),
  // clipboard with tick
  responsibilities: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5h6v3H9z" />
      <path d="M9 13l2 2 4-4.5" />
    </>
  ),
  // drawing sheet
  drawings: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M9.5 9.5v10" />
      <path d="M13 13.5h4M13 16.5h2.5" />
    </>
  ),
  // finish sample card
  samples: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <rect x="7.5" y="6.5" width="9" height="6" rx="1" />
      <path d="M7.5 16h5.5" />
    </>
  ),
  // cog
  production: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  // magnifier with tick
  quality: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
      <path d="M7.8 10.6l2 2 3.5-4" />
    </>
  ),
  // shipping crate
  shipping: (
    <>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </>
  ),
  // finished home with tick
  handover: (
    <>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M9.5 14.5l1.8 1.8 3.4-3.6" />
    </>
  ),
};

export function ProcessIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] ?? icons.enquiry}
    </svg>
  );
}
