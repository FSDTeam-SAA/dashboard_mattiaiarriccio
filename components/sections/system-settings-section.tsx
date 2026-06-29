"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  apiRequest,
  type ApiErrorShape,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import { AppIcon, Field, TextAreaField } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type AccessRules = {
  premiumChecklistsLocked: boolean;
  premiumGuidesLocked: boolean;
  maxFreeMaterials: number;
};

type AppSettings = {
  freeDailyMessageLimit: number;
  freeDailyChatLimit: number;
  freePrompt: string;
  premiumPrompt: string;
  accessRules: AccessRules;
  emergencyOverrideEnabled: boolean;
  notificationsEnabled: boolean;
  // optional / not edited here
  updatedAt?: string;
  adsEnabled?: boolean;
  adConfig?: unknown;
  admUnitIds?: unknown;
  reminderDefaults?: unknown;
};

type SaveKey = "limits" | "prompts" | "access" | "toggles";

const PANEL_CARD =
  "rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6";
const PRIMARY_BUTTON =
  "rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60";
const TOGGLE_ROW =
  "flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]";

const DEFAULT_ACCESS_RULES: AccessRules = {
  premiumChecklistsLocked: false,
  premiumGuidesLocked: false,
  maxFreeMaterials: 0,
};

export function SystemSettingsSection({ token, notify }: SectionProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<SaveKey | null>(null);

  // Free limits
  const [freeDailyMessageLimit, setFreeDailyMessageLimit] = useState(0);
  const [freeDailyChatLimit, setFreeDailyChatLimit] = useState(0);

  // Tier prompts
  const [freePrompt, setFreePrompt] = useState("");
  const [premiumPrompt, setPremiumPrompt] = useState("");

  // Access rules
  const [premiumChecklistsLocked, setPremiumChecklistsLocked] = useState(false);
  const [premiumGuidesLocked, setPremiumGuidesLocked] = useState(false);
  const [maxFreeMaterials, setMaxFreeMaterials] = useState(0);

  // Toggles
  const [emergencyOverrideEnabled, setEmergencyOverrideEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const hydrate = useCallback((data: AppSettings) => {
    const accessRules = data.accessRules ?? DEFAULT_ACCESS_RULES;
    setSettings(data);
    setFreeDailyMessageLimit(Number(data.freeDailyMessageLimit ?? 0));
    setFreeDailyChatLimit(Number(data.freeDailyChatLimit ?? 0));
    setFreePrompt(data.freePrompt ?? "");
    setPremiumPrompt(data.premiumPrompt ?? "");
    setPremiumChecklistsLocked(Boolean(accessRules.premiumChecklistsLocked));
    setPremiumGuidesLocked(Boolean(accessRules.premiumGuidesLocked));
    setMaxFreeMaterials(Number(accessRules.maxFreeMaterials ?? 0));
    setEmergencyOverrideEnabled(Boolean(data.emergencyOverrideEnabled));
    setNotificationsEnabled(Boolean(data.notificationsEnabled));
  }, []);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    setLoadingInitial(true);
    setLoadError(null);
    try {
      const data = await apiRequest<AppSettings>("/admin/app-settings", { token });
      hydrate(data);
    } catch (err) {
      const e = err as ApiErrorShape;
      setLoadError(e.message || "Failed to load settings.");
      notify("error", e.message || "Failed to load settings.");
    } finally {
      setLoadingInitial(false);
    }
  }, [token, hydrate, notify]);

  useEffect(() => {
    if (token) {
      void loadSettings();
    }
  }, [token, loadSettings]);

  const patchSettings = async (
    key: SaveKey,
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!token) return;
    setSavingKey(key);
    try {
      const data = await apiRequest<AppSettings>("/admin/app-settings", {
        token,
        method: "PATCH",
        body,
      });
      hydrate(data);
      notify("success", successMessage);
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setSavingKey(null);
    }
  };

  const saveLimits = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isInteger(freeDailyMessageLimit) || freeDailyMessageLimit < 0) {
      notify("error", "Free daily message limit must be a whole number of 0 or more.");
      return;
    }
    if (!Number.isInteger(freeDailyChatLimit) || freeDailyChatLimit < 0) {
      notify("error", "Free daily chat limit must be a whole number of 0 or more.");
      return;
    }
    void patchSettings(
      "limits",
      { freeDailyMessageLimit, freeDailyChatLimit },
      "Free limits updated."
    );
  };

  const savePrompts = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!freePrompt.trim()) {
      notify("error", "Free prompt cannot be empty.");
      return;
    }
    if (!premiumPrompt.trim()) {
      notify("error", "Premium prompt cannot be empty.");
      return;
    }
    void patchSettings(
      "prompts",
      { freePrompt: freePrompt.trim(), premiumPrompt: premiumPrompt.trim() },
      "Tier prompts updated."
    );
  };

  const saveAccessRules = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isInteger(maxFreeMaterials) || maxFreeMaterials < 0) {
      notify("error", "Max free materials must be a whole number of 0 or more.");
      return;
    }
    void patchSettings(
      "access",
      {
        accessRules: {
          premiumChecklistsLocked,
          premiumGuidesLocked,
          maxFreeMaterials,
        },
      },
      "Access rules updated."
    );
  };

  const saveToggles = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void patchSettings(
      "toggles",
      { emergencyOverrideEnabled, notificationsEnabled },
      "Feature toggles updated."
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Premium permissions
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Configure what free and premium users can access across chat, guides, checklists, ads, and materials
          </p>
        </div>
        {settings?.updatedAt ? (
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--muted)]">
            <AppIcon name="clock" className="h-4 w-4" />
            <span>Last updated {formatDate(settings.updatedAt)}</span>
          </div>
        ) : null}
      </div>

      {loadingInitial ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
          Loading settings...
        </div>
      ) : loadError ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="mt-3 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            Retry
          </button>
        </div>
      ) : !settings ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
          No settings available.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Free limits */}
          <form onSubmit={saveLimits} className={PANEL_CARD}>
            <div className="mb-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
                Free tier
              </p>
              <h3 className="mt-2 text-xl font-bold text-[#201a1b]">Daily limits</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Caps applied to free users each day. Use 0 to disallow.
              </p>
            </div>
            <div className="grid gap-5">
              <Field
                label="Free daily message limit"
                type="number"
                value={freeDailyMessageLimit}
                onChange={(v) => setFreeDailyMessageLimit(Number(v || 0))}
                placeholder="0"
              />
              <Field
                label="Free daily chat limit"
                type="number"
                value={freeDailyChatLimit}
                onChange={(v) => setFreeDailyChatLimit(Number(v || 0))}
                placeholder="0"
              />
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={savingKey === "limits"} className={PRIMARY_BUTTON}>
                {savingKey === "limits" ? "Saving..." : "Save limits"}
              </button>
            </div>
          </form>

          {/* Toggles */}
          <form onSubmit={saveToggles} className={PANEL_CARD}>
            <div className="mb-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
                Feature flags
              </p>
              <h3 className="mt-2 text-xl font-bold text-[#201a1b]">Toggles</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Enable or disable platform-wide behaviours.
              </p>
            </div>
            <div className="grid gap-3">
              <label className={TOGGLE_ROW}>
                <span className="flex flex-col gap-0.5">
                  Emergency override
                  <span className="text-xs font-normal text-[var(--muted)]">
                    Surface emergency responses ahead of normal chat.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={emergencyOverrideEnabled}
                  onChange={(event) => setEmergencyOverrideEnabled(event.target.checked)}
                  className="h-4 w-4 accent-[var(--danger)]"
                />
              </label>
              <label className={TOGGLE_ROW}>
                <span className="flex flex-col gap-0.5">
                  Notifications enabled
                  <span className="text-xs font-normal text-[var(--muted)]">
                    Master switch for scheduled push / local notifications.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(event) => setNotificationsEnabled(event.target.checked)}
                  className="h-4 w-4 accent-[var(--danger)]"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={savingKey === "toggles"} className={PRIMARY_BUTTON}>
                {savingKey === "toggles" ? "Saving..." : "Save toggles"}
              </button>
            </div>
          </form>

          {/* Tier prompts */}
          <form onSubmit={savePrompts} className={classNames(PANEL_CARD, "xl:col-span-2")}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
                  Live AI configuration
                </p>
                <h3 className="mt-2 text-xl font-bold text-[#201a1b]">Tier prompts</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Changes apply live to the chat for free and premium users.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#fff3f3] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                Changes apply live
              </span>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <TextAreaField
                label="Free prompt"
                value={freePrompt}
                onChange={setFreePrompt}
                rows={8}
              />
              <TextAreaField
                label="Premium prompt"
                value={premiumPrompt}
                onChange={setPremiumPrompt}
                rows={8}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={savingKey === "prompts"} className={PRIMARY_BUTTON}>
                {savingKey === "prompts" ? "Saving..." : "Save prompts"}
              </button>
            </div>
          </form>

          {/* Access rules */}
          <form onSubmit={saveAccessRules} className={classNames(PANEL_CARD, "xl:col-span-2")}>
            <div className="mb-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
                Gating
              </p>
              <h3 className="mt-2 text-xl font-bold text-[#201a1b]">Access rules</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                These settings work with each guide/checklist Premium-only toggle.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-3">
                <label className={TOGGLE_ROW}>
                  <span className="flex flex-col gap-0.5">
                    Premium-only checklists locked
                    <span className="text-xs font-normal text-[var(--muted)]">
                      Hide premium checklists from free users.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={premiumChecklistsLocked}
                    onChange={(event) => setPremiumChecklistsLocked(event.target.checked)}
                    className="h-4 w-4 accent-[var(--danger)]"
                  />
                </label>
                <label className={TOGGLE_ROW}>
                  <span className="flex flex-col gap-0.5">
                    Premium-only guides locked
                    <span className="text-xs font-normal text-[var(--muted)]">
                      Hide premium guides from free users.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={premiumGuidesLocked}
                    onChange={(event) => setPremiumGuidesLocked(event.target.checked)}
                    className="h-4 w-4 accent-[var(--danger)]"
                  />
                </label>
              </div>
              <div className="grid content-start gap-3">
                <Field
                  label="Max free materials"
                  type="number"
                  value={maxFreeMaterials}
                  onChange={(v) => setMaxFreeMaterials(Number(v || 0))}
                  placeholder="0"
                />
                <p className="text-xs text-[var(--muted)]">
                  Maximum tracked materials a free user can create. Use 0 to disallow.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={savingKey === "access"} className={PRIMARY_BUTTON}>
                {savingKey === "access" ? "Saving..." : "Save access rules"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
