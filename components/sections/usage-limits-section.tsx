"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import { AppIcon } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

const LIMIT_KEYS = [
  "freeDailyMessageLimit",
  "freeWeeklyMessageLimit",
  "premiumDailyMessageLimit",
  "premiumWeeklyMessageLimit",
  "freeDailyChatLimit",
  "webSearchFreeDailyLimit",
  "webSearchFreeWeeklyLimit",
  "webSearchPremiumDailyLimit",
  "webSearchPremiumWeeklyLimit",
  "freeCustomChecklistLimit",
  "premiumCustomChecklistLimit",
] as const;

type LimitKey = (typeof LIMIT_KEYS)[number];
type LimitValues = Record<LimitKey, number>;
type LimitForm = Record<LimitKey, string>;
type UsageLimitSettings = LimitValues & { updatedAt?: string };

type LimitDefinition = {
  key: LimitKey;
  label: string;
  helper: string;
  period: "day" | "week" | "total";
};

type LimitGroup = {
  eyebrow: string;
  title: string;
  description: string;
  tone: "red" | "blue" | "amber";
  limits: LimitDefinition[];
};

const EMPTY_FORM: LimitForm = {
  freeDailyMessageLimit: "0",
  freeWeeklyMessageLimit: "0",
  premiumDailyMessageLimit: "0",
  premiumWeeklyMessageLimit: "0",
  freeDailyChatLimit: "0",
  webSearchFreeDailyLimit: "0",
  webSearchFreeWeeklyLimit: "0",
  webSearchPremiumDailyLimit: "0",
  webSearchPremiumWeeklyLimit: "0",
  freeCustomChecklistLimit: "0",
  premiumCustomChecklistLimit: "0",
};

const LIMIT_GROUPS: LimitGroup[] = [
  {
    eyebrow: "WeSafe AI",
    title: "AI messages and requests",
    description:
      "Control how many assistant requests each membership tier can make across a day and a week.",
    tone: "red",
    limits: [
      {
        key: "freeDailyMessageLimit",
        label: "Free · per day",
        helper: "Daily allowance for Free members.",
        period: "day",
      },
      {
        key: "freeWeeklyMessageLimit",
        label: "Free · per week",
        helper: "Weekly allowance for Free members.",
        period: "week",
      },
      {
        key: "premiumDailyMessageLimit",
        label: "Premium · per day",
        helper: "Daily allowance for Premium members.",
        period: "day",
      },
      {
        key: "premiumWeeklyMessageLimit",
        label: "Premium · per week",
        helper: "Weekly allowance for Premium members.",
        period: "week",
      },
    ],
  },
  {
    eyebrow: "Conversation safety",
    title: "New conversations",
    description:
      "Keep the existing Free-tier anti-abuse cap for newly started conversations separate from AI message requests.",
    tone: "amber",
    limits: [
      {
        key: "freeDailyChatLimit",
        label: "Free · new conversations per day",
        helper: "Daily cap on newly started conversations; replies use the AI request limits above.",
        period: "day",
      },
    ],
  },
  {
    eyebrow: "Live information",
    title: "Web Search",
    description:
      "Set separate search budgets for Free and Premium members while keeping search availability elsewhere.",
    tone: "blue",
    limits: [
      {
        key: "webSearchFreeDailyLimit",
        label: "Free · per day",
        helper: "Daily live-search allowance for Free members.",
        period: "day",
      },
      {
        key: "webSearchFreeWeeklyLimit",
        label: "Free · per week",
        helper: "Weekly live-search allowance for Free members.",
        period: "week",
      },
      {
        key: "webSearchPremiumDailyLimit",
        label: "Premium · per day",
        helper: "Daily live-search allowance for Premium members.",
        period: "day",
      },
      {
        key: "webSearchPremiumWeeklyLimit",
        label: "Premium · per week",
        helper: "Weekly live-search allowance for Premium members.",
        period: "week",
      },
    ],
  },
  {
    eyebrow: "User content",
    title: "Custom checklists",
    description:
      "Cap the total number of user-created checklists stored for each membership tier.",
    tone: "amber",
    limits: [
      {
        key: "freeCustomChecklistLimit",
        label: "Free · total checklists",
        helper: "Maximum custom checklists a Free member can keep.",
        period: "total",
      },
      {
        key: "premiumCustomChecklistLimit",
        label: "Premium · total checklists",
        helper: "Maximum custom checklists a Premium member can keep.",
        period: "total",
      },
    ],
  },
];

const LABEL_BY_KEY = Object.fromEntries(
  LIMIT_GROUPS.flatMap((group) =>
    group.limits.map((limit) => [limit.key, limit.label])
  )
) as Record<LimitKey, string>;

const PANEL_CARD =
  "rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6";
const PRIMARY_BUTTON =
  "rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60";

const toneStyles = {
  red: {
    edge: "border-l-[var(--danger)]",
    eyebrow: "text-[var(--danger)]",
    wash: "bg-[#fff7f7]",
  },
  blue: {
    edge: "border-l-[#166ec8]",
    eyebrow: "text-[#166ec8]",
    wash: "bg-[#f5f9ff]",
  },
  amber: {
    edge: "border-l-[#b66a0a]",
    eyebrow: "text-[#9a5907]",
    wash: "bg-[#fffaf1]",
  },
} satisfies Record<LimitGroup["tone"], Record<string, string>>;

function LimitInput({
  definition,
  value,
  onChange,
}: {
  definition: LimitDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  const parsed = Number(value);
  const valid =
    value.trim().length > 0 && Number.isInteger(parsed) && parsed >= 0;
  const unlimited = valid && parsed === 0;
  const stateLabel = !valid
    ? "Whole number required"
    : unlimited
      ? "Unlimited"
      : definition.period === "total"
        ? `${parsed} total`
        : `${parsed} / ${definition.period}`;
  const helperId = `${definition.key}-helper`;

  return (
    <label className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-white p-4 transition focus-within:border-[var(--danger)] focus-within:ring-2 focus-within:ring-[rgba(216,43,43,0.12)]">
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-[#33292b]">
          {definition.label}
        </span>
        <span
          className={classNames(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
            !valid
              ? "bg-red-100 text-red-700"
              : unlimited
                ? "bg-emerald-100 text-emerald-700"
                : "bg-[#f2ecec] text-[#675d5f]"
          )}
        >
          {stateLabel}
        </span>
      </span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        aria-describedby={helperId}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 w-full rounded-xl border border-[#ded4d5] bg-[#fcfafa] px-4 py-3 text-lg font-bold text-[#201a1b] outline-none transition focus:border-[var(--danger)]"
      />
      <span id={helperId} className="mt-2 text-xs leading-5 text-[var(--muted)]">
        {definition.helper} Enter 0 for Unlimited.
      </span>
    </label>
  );
}

export function UsageLimitsSection({ token, notify }: SectionProps) {
  const [form, setForm] = useState<LimitForm>(EMPTY_FORM);
  const [settings, setSettings] = useState<UsageLimitSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hydrate = useCallback((data: UsageLimitSettings) => {
    const next = { ...EMPTY_FORM };
    for (const key of LIMIT_KEYS) {
      const value = Number(data[key]);
      next[key] = String(Number.isInteger(value) && value >= 0 ? value : 0);
    }
    setForm(next);
    setSettings(data);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiRequest<UsageLimitSettings>("/admin/app-settings", {
        token,
      });
      hydrate(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load usage limits.";
      setLoadError(message);
      notify("error", message);
    } finally {
      setLoading(false);
    }
  }, [hydrate, notify, token]);

  useEffect(() => {
    if (token) void loadSettings();
  }, [loadSettings, token]);

  const updateField = (key: LimitKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveLimits = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || saving) return;

    const payload = {} as LimitValues;
    for (const key of LIMIT_KEYS) {
      const raw = form[key].trim();
      const value = Number(raw);
      if (!raw || !Number.isInteger(value) || value < 0) {
        notify(
          "error",
          `${LABEL_BY_KEY[key]} must be a whole number of 0 or more.`
        );
        return;
      }
      payload[key] = value;
    }

    setSaving(true);
    try {
      const data = await apiRequest<UsageLimitSettings>("/admin/app-settings", {
        token,
        method: "PATCH",
        body: payload,
      });
      hydrate(data);
      notify("success", "Usage limits saved for Free and Premium members.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to save usage limits."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={PANEL_CARD}>
        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#eadede] border-t-[var(--danger)]" />
          Loading usage limits...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={PANEL_CARD}>
        <p className="text-sm font-semibold text-[var(--danger)]">
          Usage limits could not be loaded
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className={classNames(PRIMARY_BUTTON, "mt-4")}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={saveLimits} className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-[#eadede] bg-[linear-gradient(135deg,_#2b2022,_#4b292d)] text-white shadow-[0_24px_60px_rgba(35,20,22,0.16)]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              <AppIcon name="usage" className="h-4 w-4" />
              One control center
            </span>
            <h2 className="mt-5 text-2xl font-bold sm:text-3xl">Usage limits</h2>
            <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
              Set every Free and Premium allowance together. A value of 0 always
              means Unlimited; it never disables the feature.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-white/80 lg:justify-end">
            <span className="rounded-full bg-white/10 px-3 py-2">11 policies</span>
            <span className="rounded-full bg-white/10 px-3 py-2">One coordinated save</span>
            {settings?.updatedAt ? (
              <span className="rounded-full bg-white/10 px-3 py-2">
                Updated {formatDate(settings.updatedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {LIMIT_GROUPS.map((group) => {
        const tone = toneStyles[group.tone];
        return (
          <section
            key={group.title}
            className={classNames(PANEL_CARD, "border-l-4", tone.edge)}
          >
            <div className={classNames("rounded-2xl p-4 sm:p-5", tone.wash)}>
              <p
                className={classNames(
                  "font-mono text-[11px] uppercase tracking-[0.22em]",
                  tone.eyebrow
                )}
              >
                {group.eyebrow}
              </p>
              <h3 className="mt-2 text-xl font-bold text-[#201a1b]">
                {group.title}
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {group.description}
              </p>
            </div>
            <div
              className={classNames(
                "mt-5 grid gap-4",
                group.limits.length > 2 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2"
              )}
            >
              {group.limits.map((definition) => (
                <LimitInput
                  key={definition.key}
                  definition={definition}
                  value={form[definition.key]}
                  onChange={(value) => updateField(definition.key, value)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="flex flex-col gap-4 rounded-[24px] border border-[#eadede] bg-[#fffafa] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#201a1b]">Save all limit policies</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            All values are validated together and sent in one request, so tiers stay in sync.
          </p>
        </div>
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {saving ? "Saving all limits..." : "Save usage limits"}
        </button>
      </section>
    </form>
  );
}
