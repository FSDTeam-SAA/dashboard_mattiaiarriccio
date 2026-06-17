"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  apiRequest,
  type ApiErrorShape,
} from "@/lib/api-client";
import { classNames } from "@/lib/format";
import { AppIcon } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type AdFormat = "banner" | "native" | "banner+native";

type PlatformUnitIds = {
  banner: string;
  native: string;
};

type AdConfigInner = {
  format: AdFormat;
  placements: string[];
  nativeFrequency: number;
};

type AdmUnitIds = {
  android: PlatformUnitIds;
  ios: PlatformUnitIds;
};

type AdConfigResponse = {
  adsEnabled: boolean;
  adConfig: AdConfigInner;
  admUnitIds: AdmUnitIds;
};

const FORMAT_OPTIONS: { value: AdFormat; label: string }[] = [
  { value: "banner", label: "Banner" },
  { value: "native", label: "Native" },
  { value: "banner+native", label: "Banner + Native" },
];

const KNOWN_PLACEMENTS = ["home", "checklists", "guides", "chat", "materials"] as const;

const PLACEMENT_LABELS: Record<string, string> = {
  home: "Home",
  checklists: "Checklists",
  guides: "Guides",
  chat: "Chat",
  materials: "Materials",
};

const INPUT_CLASS =
  "rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]";

function emptyPlatform(): PlatformUnitIds {
  return { banner: "", native: "" };
}

function normalizeConfig(data: AdConfigResponse): AdConfigResponse {
  return {
    adsEnabled: Boolean(data?.adsEnabled),
    adConfig: {
      format: (data?.adConfig?.format as AdFormat) || "banner",
      placements: Array.isArray(data?.adConfig?.placements)
        ? data.adConfig.placements
        : [],
      nativeFrequency:
        typeof data?.adConfig?.nativeFrequency === "number" &&
        data.adConfig.nativeFrequency >= 1
          ? data.adConfig.nativeFrequency
          : 1,
    },
    admUnitIds: {
      android: {
        banner: data?.admUnitIds?.android?.banner || "",
        native: data?.admUnitIds?.android?.native || "",
      },
      ios: {
        banner: data?.admUnitIds?.ios?.banner || "",
        native: data?.admUnitIds?.ios?.native || "",
      },
    },
  };
}

export function AdsSection({ token, notify }: SectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [format, setFormat] = useState<AdFormat>("banner");
  const [placements, setPlacements] = useState<string[]>([]);
  const [nativeFrequency, setNativeFrequency] = useState(1);
  const [androidUnits, setAndroidUnits] = useState<PlatformUnitIds>(emptyPlatform());
  const [iosUnits, setIosUnits] = useState<PlatformUnitIds>(emptyPlatform());

  const applyConfig = useCallback((data: AdConfigResponse) => {
    const normalized = normalizeConfig(data);
    setAdsEnabled(normalized.adsEnabled);
    setFormat(normalized.adConfig.format);
    setPlacements(normalized.adConfig.placements);
    setNativeFrequency(normalized.adConfig.nativeFrequency);
    setAndroidUnits(normalized.admUnitIds.android);
    setIosUnits(normalized.admUnitIds.ios);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await apiRequest<AdConfigResponse>("/admin/settings/ad-config", {
          token,
        });
        if (active) {
          applyConfig(data);
        }
      } catch (err) {
        const e = err as ApiErrorShape;
        notify("error", e.message || "Request failed");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [token, applyConfig, notify]);

  const togglePlacement = (placement: string) => {
    setPlacements((current) =>
      current.includes(placement)
        ? current.filter((value) => value !== placement)
        : [...current, placement]
    );
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || saving) return;

    if (!Number.isFinite(nativeFrequency) || nativeFrequency < 1) {
      notify("error", "Native frequency must be at least 1.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiRequest<AdConfigResponse>("/admin/settings/ad-config", {
        token,
        method: "PATCH",
        body: {
          adsEnabled,
          adConfig: {
            format,
            placements,
            nativeFrequency,
          },
          admUnitIds: {
            android: {
              banner: androidUnits.banner.trim(),
              native: androidUnits.native.trim(),
            },
            ios: {
              banner: iosUnits.banner.trim(),
              native: iosUnits.native.trim(),
            },
          },
        },
      });
      applyConfig(data);
      notify("success", "Ad configuration updated.");
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const showBannerUnits = format === "banner" || format === "banner+native";
  const showNativeUnits = format === "native" || format === "banner+native";

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">Ads</h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Configure AdMob placements and unit IDs across the mobile app.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
          Loading ad configuration...
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-4 text-sm font-semibold text-[#201a1b]">
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                  <AppIcon name="ads" className="h-4 w-4" />
                </span>
                <span>
                  <span className="block">Ads enabled</span>
                  <span className="block text-xs font-medium text-[var(--muted)]">
                    Master switch for all in-app advertising.
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={(event) => setAdsEnabled(event.target.checked)}
                className="h-4 w-4 accent-[var(--danger)]"
              />
            </label>
            <p className="mt-3 text-xs text-[var(--muted)]">Premium users never see ads.</p>
          </div>

          <div
            className={classNames(
              "space-y-5 rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6",
              !adsEnabled && "opacity-60"
            )}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
              Placement &amp; format
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#33292b]">Ad format</span>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as AdFormat)}
                  className={INPUT_CLASS}
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#33292b]">
                  Native frequency
                </span>
                <input
                  type="number"
                  min={1}
                  value={nativeFrequency}
                  onChange={(event) =>
                    setNativeFrequency(Math.max(1, Math.floor(Number(event.target.value || 1))))
                  }
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-[var(--muted)]">
                  Show a native ad after every N items (minimum 1).
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold text-[#33292b]">Placements</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {KNOWN_PLACEMENTS.map((placement) => {
                  const active = placements.includes(placement);
                  return (
                    <label
                      key={placement}
                      className={classNames(
                        "flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                        active
                          ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-deep)]"
                          : "border-[var(--border)] bg-white text-[#201a1b] hover:border-[var(--danger)]"
                      )}
                    >
                      {PLACEMENT_LABELS[placement] ?? placement}
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => togglePlacement(placement)}
                        className="h-4 w-4 accent-[var(--danger)]"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className={classNames(
              "space-y-5 rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6",
              !adsEnabled && "opacity-60"
            )}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
              AdMob unit IDs
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
                <p className="text-sm font-semibold text-[#33292b]">Android</p>
                <div className="mt-4 space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#33292b]">
                      Banner unit ID
                    </span>
                    <input
                      type="text"
                      value={androidUnits.banner}
                      placeholder="ca-app-pub-..."
                      readOnly={!showBannerUnits}
                      onChange={(event) =>
                        setAndroidUnits((current) => ({
                          ...current,
                          banner: event.target.value,
                        }))
                      }
                      className={classNames(
                        INPUT_CLASS,
                        !showBannerUnits && "cursor-not-allowed bg-[#f5efef] text-[var(--muted)]"
                      )}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#33292b]">
                      Native unit ID
                    </span>
                    <input
                      type="text"
                      value={androidUnits.native}
                      placeholder="ca-app-pub-..."
                      readOnly={!showNativeUnits}
                      onChange={(event) =>
                        setAndroidUnits((current) => ({
                          ...current,
                          native: event.target.value,
                        }))
                      }
                      className={classNames(
                        INPUT_CLASS,
                        !showNativeUnits && "cursor-not-allowed bg-[#f5efef] text-[var(--muted)]"
                      )}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
                <p className="text-sm font-semibold text-[#33292b]">iOS</p>
                <div className="mt-4 space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#33292b]">
                      Banner unit ID
                    </span>
                    <input
                      type="text"
                      value={iosUnits.banner}
                      placeholder="ca-app-pub-..."
                      readOnly={!showBannerUnits}
                      onChange={(event) =>
                        setIosUnits((current) => ({
                          ...current,
                          banner: event.target.value,
                        }))
                      }
                      className={classNames(
                        INPUT_CLASS,
                        !showBannerUnits && "cursor-not-allowed bg-[#f5efef] text-[var(--muted)]"
                      )}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#33292b]">
                      Native unit ID
                    </span>
                    <input
                      type="text"
                      value={iosUnits.native}
                      placeholder="ca-app-pub-..."
                      readOnly={!showNativeUnits}
                      onChange={(event) =>
                        setIosUnits((current) => ({
                          ...current,
                          native: event.target.value,
                        }))
                      }
                      className={classNames(
                        INPUT_CLASS,
                        !showNativeUnits && "cursor-not-allowed bg-[#f5efef] text-[var(--muted)]"
                      )}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !token}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
