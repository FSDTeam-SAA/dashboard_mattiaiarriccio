"use client";

import { ReactNode } from "react";
import { classNames } from "@/lib/format";

export function AppIcon({
  name,
  className,
}: {
  name:
    | "dashboard"
    | "prompt"
    | "categories"
    | "checklists"
    | "tips"
    | "settings"
    | "logout"
    | "edit"
    | "delete"
    | "clock"
    | "chevron"
    | "users"
    | "published"
    | "coupon"
    | "ads"
    | "emergency"
    | "materials"
    | "notifications";
  className?: string;
}) {
  const sharedProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...sharedProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "prompt":
      return (
        <svg {...sharedProps}>
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
          <path d="M8.5 8.5h7" />
          <path d="M8.5 11.5h4.5" />
        </svg>
      );
    case "categories":
      return (
        <svg {...sharedProps}>
          <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" />
          <path d="M4 12.5 12 17l8-4.5" />
          <path d="M4 17.5 12 22l8-4.5" />
        </svg>
      );
    case "checklists":
      return (
        <svg {...sharedProps}>
          <path d="M9 4h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M8 7H5" />
          <path d="m4 7 .8.8L6.5 6" />
          <path d="M8 12H5" />
          <path d="m4 12 .8.8L6.5 11" />
          <path d="M8 17H5" />
          <path d="m4 17 .8.8L6.5 16" />
        </svg>
      );
    case "tips":
      return (
        <svg {...sharedProps}>
          <path d="M12 3a6 6 0 0 1 3.72 10.71c-.92.74-1.47 1.44-1.66 2.29h-4.12c-.19-.85-.74-1.55-1.66-2.29A6 6 0 0 1 12 3Z" />
          <path d="M10 19h4" />
          <path d="M10.5 22h3" />
        </svg>
      );
    case "settings":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1 1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1-1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.4a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1 1 0 0 1 1 1v1.4a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.7Z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...sharedProps}>
          <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H4" />
        </svg>
      );
    case "edit":
      return (
        <svg {...sharedProps}>
          <path d="M3 21h6" />
          <path d="M14.7 5.3a2.1 2.1 0 1 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      );
    case "delete":
      return (
        <svg {...sharedProps}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...sharedProps}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "users":
      return (
        <svg {...sharedProps}>
          <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 19.5V21" />
          <circle cx="10.5" cy="8" r="3.5" />
          <path d="M17 11a3 3 0 1 0 0-6" />
          <path d="M19 21v-1a3 3 0 0 0-2-2.82" />
        </svg>
      );
    case "published":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
        </svg>
      );
    case "coupon":
      return (
        <svg {...sharedProps}>
          <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
          <path d="M14 7v2" />
          <path d="M14 15v2" />
          <path d="M14 11v2" />
        </svg>
      );
    case "ads":
      return (
        <svg {...sharedProps}>
          <path d="M3 11a2 2 0 0 1 2-2h2l8-4v14l-8-4H5a2 2 0 0 1-2-2Z" />
          <path d="M18 8a4 4 0 0 1 0 8" />
        </svg>
      );
    case "emergency":
      return (
        <svg {...sharedProps}>
          <path d="M10.3 3.9 2.4 17.4a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "materials":
      return (
        <svg {...sharedProps}>
          <path d="M3.3 7 12 11l8.7-4" />
          <path d="M12 11v10" />
          <path d="M20.5 7.3 12 3 3.5 7.3a1 1 0 0 0-.5.9v7.6a1 1 0 0 0 .5.9L12 21l8.5-4.3a1 1 0 0 0 .5-.9V8.2a1 1 0 0 0-.5-.9Z" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...sharedProps}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      );
  }
}

export function BrandMark() {
  return (
    <div className="inline-flex items-end gap-1 text-[#1d1718]">
      <span className="text-[17px] font-black tracking-[0.12em]">WE</span>
      <svg
        viewBox="0 0 52 18"
        className="h-[18px] w-[52px] text-[var(--danger)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 10h10l3-7 5 13 4-9h8l3-4 3 7h14" />
      </svg>
      <span className="text-[17px] font-black tracking-[0.12em]">SAFE</span>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#33292b]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={classNames(
          "rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]",
          readOnly && "cursor-not-allowed bg-[#f5efef] text-[var(--muted)]"
        )}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#33292b]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
      />
    </label>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-4 py-4 sm:flex sm:items-center sm:justify-center sm:py-8">
      <div className="scrollbar-thin mx-auto w-full max-w-4xl overflow-y-auto rounded-[24px] border border-white/50 bg-[var(--panel)] shadow-[var(--shadow)] sm:max-h-full sm:rounded-[28px]">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
          <div>
            <h3 className="text-xl font-bold text-[#201a1b]">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "published"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold", tone)}>
      {value}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "red" | "blue" | "rose" | "green";
  icon: "checklists" | "tips" | "prompt" | "published";
}) {
  const toneMap = {
    red: {
      border: "border-b-[#de3232]",
      bubble: "bg-[#de3232]",
    },
    blue: {
      border: "border-b-[#166ec8]",
      bubble: "bg-[#166ec8]",
    },
    rose: {
      border: "border-b-[#ff8e8e]",
      bubble: "bg-[#ff8e8e]",
    },
    green: {
      border: "border-b-[#148a45]",
      bubble: "bg-[#148a45]",
    },
  }[tone];

  return (
    <div
      className={classNames(
        "rounded-[12px] border border-[#ece4e4] border-b-[3px] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(22,18,18,0.06)]",
        toneMap.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[1.75rem] font-semibold leading-none text-[#252022]">{value}</p>
          <p className="mt-4 text-sm font-medium text-[#322b2d]">{label}</p>
        </div>
        <div
          className={classNames(
            "grid h-9 w-9 place-items-center rounded-full text-white shadow-[0_10px_20px_rgba(0,0,0,0.08)]",
            toneMap.bubble
          )}
        >
          <AppIcon name={icon} className="h-[18px] w-[18px]" />
        </div>
      </div>
    </div>
  );
}
