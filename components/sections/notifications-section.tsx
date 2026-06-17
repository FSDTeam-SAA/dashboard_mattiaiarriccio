"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiRequestRaw,
  type ApiErrorShape,
  type PageMeta,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import { AppIcon } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type NotificationStatus = "pending" | "sent" | "canceled" | "failed";
type NotificationType = "material_expiry" | "inspection" | "custom";
type NotificationChannel = "push" | "local";

type NotificationJob = {
  id: string;
  userId: string;
  type: NotificationType;
  refId?: string | null;
  title: string;
  body?: string | null;
  scheduledAt?: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: string | null;
  error?: string | null;
  createdAt: string;
};

const PAGE_LIMIT = 20;

const STATUS_OPTIONS: Array<{ value: "" | NotificationStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "canceled", label: "Canceled" },
  { value: "failed", label: "Failed" },
];

const STATUS_TONE: Record<NotificationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  canceled: "bg-slate-100 text-slate-600",
  failed: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

const TYPE_LABEL: Record<NotificationType, string> = {
  material_expiry: "Material expiry",
  inspection: "Inspection",
  custom: "Custom",
};

function NotificationStatusBadge({ value }: { value: string }) {
  const tone =
    STATUS_TONE[value as NotificationStatus] ?? "bg-amber-100 text-amber-700";
  return (
    <span
      className={classNames(
        "rounded-full px-3 py-1 text-xs font-semibold capitalize",
        tone
      )}
    >
      {value}
    </span>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${formatDate(value)} · ${time}`;
}

export function NotificationsSection({ token, notify }: SectionProps) {
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | NotificationStatus>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(PAGE_LIMIT));

      const { data, meta: pageMeta } = await apiRequestRaw<NotificationJob[]>(
        `/admin/notifications?${params.toString()}`,
        { token }
      );

      setJobs(Array.isArray(data) ? data : []);
      setMeta(pageMeta ?? null);
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [token, statusFilter, page, notify]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? jobs.length;

  const statusCounts = useMemo(() => {
    return jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [jobs]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as "" | NotificationStatus);
    setPage(1);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Monitor scheduled and delivered notification jobs across push and local
            channels
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[#eee4e4] bg-[#fffafa] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
          <AppIcon name="notifications" className="h-4 w-4 text-[var(--danger)]" />
          <span>{total} job{total === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex w-full flex-col gap-2 sm:max-w-xs">
            <span className="text-sm font-semibold text-[#33292b]">
              Filter by status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => handleStatusChange(event.target.value)}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {loaded && jobs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6d6668]">
              {(["pending", "sent", "canceled", "failed"] as NotificationStatus[])
                .filter((status) => statusCounts[status])
                .map((status) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 capitalize shadow-[0_4px_12px_rgba(22,18,18,0.04)]"
                  >
                    {status}: {statusCounts[status]}
                  </span>
                ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                    {job.title || "Untitled notification"}
                  </p>
                  <NotificationStatusBadge value={job.status} />
                  <span className="rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-medium text-[#3b3da9]">
                    {TYPE_LABEL[job.type] ?? job.type}
                  </span>
                  <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] capitalize">
                    {job.channel}
                  </span>
                </div>
                {job.body ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[#6b6467]">{job.body}</p>
                ) : null}
                <div className="mt-2 grid gap-x-6 gap-y-1 text-xs font-medium text-[#6d6668] sm:grid-cols-2 lg:grid-cols-3">
                  <span>
                    <span className="text-[#9b9296]">Scheduled:</span>{" "}
                    {formatDateTime(job.scheduledAt)}
                  </span>
                  <span>
                    <span className="text-[#9b9296]">Sent:</span>{" "}
                    {formatDateTime(job.sentAt)}
                  </span>
                  <span className="truncate">
                    <span className="text-[#9b9296]">User:</span>{" "}
                    {job.userId || "—"}
                  </span>
                </div>
                {job.error ? (
                  <p className="mt-2 rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger-deep)]">
                    Error: {job.error}
                  </p>
                ) : null}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              Loading notification jobs…
            </div>
          ) : null}

          {!loading && loaded && jobs.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              {statusFilter
                ? `No ${statusFilter} notification jobs found.`
                : "No notification jobs found."}
            </div>
          ) : null}
        </div>

        {meta && totalPages > 1 ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-[#eee4e4] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#6d6668]">
              Page {meta.page} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || page <= 1}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={loading || page >= totalPages}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
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
