"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apiRequestRaw,
  type ApiErrorShape,
  type PageMeta,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import { AppIcon } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type MaterialInspection = {
  intervalDays?: number | null;
  lastInspectedAt?: string | null;
  nextInspectionAt?: string | null;
};

type MaterialReminderRule = {
  offsetDays?: number;
  channel?: string;
};

type MaterialRecord = {
  id: string;
  userId: string;
  name: string;
  category?: string | null;
  imageUrl?: string | null;
  expirationDate?: string | null;
  inspection?: MaterialInspection | null;
  reminderRules?: MaterialReminderRule[];
  active: boolean;
  createdAt?: string | null;
};

const PAGE_LIMIT = 10;
const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const daysUntil = (value?: string | null): number | null => {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / DAY_MS);
};

const isExpiringSoon = (value?: string | null): boolean => {
  const days = daysUntil(value);
  if (days === null) return false;
  return days <= EXPIRING_SOON_DAYS;
};

export function MaterialsSection({ token, notify }: SectionProps) {
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadMaterials = useCallback(
    async (targetPage: number, onlyExpiring: boolean) => {
      if (!token) return;

      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_LIMIT));
        if (onlyExpiring) {
          params.set("expiringSoon", "true");
        }

        const { data, meta: pageMeta } = await apiRequestRaw<MaterialRecord[]>(
          `/admin/materials?${params.toString()}`,
          { token }
        );

        setMaterials(data || []);
        setMeta(pageMeta || null);
      } catch (error) {
        const typedError = error as ApiErrorShape;
        notify("error", typedError.message || "Request failed");
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [token, notify]
  );

  useEffect(() => {
    if (!token) return;
    void loadMaterials(page, expiringSoon);
  }, [token, page, expiringSoon, loadMaterials]);

  const handleToggleExpiring = () => {
    setPage(1);
    setExpiringSoon((current) => !current);
  };

  const totalPages = meta?.totalPages ?? 1;
  const totalCount = meta?.total ?? materials.length;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Materials
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Read-only oversight of user materials, expirations, and inspections
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleExpiring}
          className={classNames(
            "inline-flex w-full items-center justify-center gap-2 self-start rounded-full border px-5 py-2.5 text-sm font-semibold transition sm:w-auto",
            expiringSoon
              ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
          )}
        >
          <AppIcon name="clock" className="h-4 w-4" />
          <span>Expiring soon</span>
        </button>
      </div>

      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#6d6668]">
          <span>
            {totalCount} material{totalCount === 1 ? "" : "s"}
            {expiringSoon ? " expiring within 30 days" : ""}
          </span>
          {loading ? <span>Loading...</span> : null}
        </div>

        <div className="space-y-2">
          {materials.map((item) => {
            const expiringBadge = isExpiringSoon(item.expirationDate);
            const nextInspectionAt = item.inspection?.nextInspectionAt;

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                      {item.name}
                    </p>
                    {item.category ? (
                      <span className="rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-medium text-[#3b3da9]">
                        {item.category}
                      </span>
                    ) : null}
                    <span
                      className={classNames(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        item.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {item.active ? "active" : "inactive"}
                    </span>
                    {expiringBadge ? (
                      <span className="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                        Expiring soon
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#6d6668]">
                    <span>
                      Owner:{" "}
                      <span className="font-mono text-[#4a4446]">{item.userId}</span>
                    </span>
                    <span>
                      Expires:{" "}
                      {item.expirationDate
                        ? formatDate(item.expirationDate)
                        : "—"}
                    </span>
                    <span>
                      Next inspection:{" "}
                      {nextInspectionAt ? formatDate(nextInspectionAt) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && loaded && materials.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              {expiringSoon
                ? "No materials are expiring within the next 30 days."
                : "No materials found."}
            </div>
          ) : null}

          {!loaded && loading ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              Loading materials...
            </div>
          ) : null}
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-sm text-[#6d6668]">
              Page {meta?.page ?? page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPrev || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext || loading}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
