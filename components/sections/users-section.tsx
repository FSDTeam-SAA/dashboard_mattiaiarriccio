"use client";

import { useEffect, useState } from "react";
import {
  apiRequest,
  apiRequestRaw,
  type ApiErrorShape,
  type PageMeta,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import { AppIcon, Field, Modal } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type UserTier = "free" | "premium";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  tier: UserTier | string;
  premiumSource: string | null;
  premiumExpiresAt: string | null;
  createdAt: string;
};

type UserDetail = {
  user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    avatarUrl: string | null;
    role: string;
    tier: UserTier | string;
    premiumSource: string | null;
    premiumExpiresAt: string | null;
    premiumGrantedBy: string | null;
    manualPremiumActive: boolean;
    manualPremiumExpiresAt: string | null;
    manualPremiumSource: string | null;
    preferredLanguage: string | null;
    createdAt: string;
    updatedAt: string;
  };
  subscriptions: Array<{
    id: string;
    store: string;
    productId: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
  }>;
  couponRedemptions: Array<{
    id: string;
    couponId: string;
    redeemedAt: string;
  }>;
  auditLog: Array<{
    id: string;
    adminId: string;
    action: string;
    meta: unknown;
    createdAt: string;
  }>;
};

type TierFilter = "all" | "free" | "premium";

type GrantPreset = "7" | "14" | "30" | "custom" | "lifetime";

type ConfirmState =
  | { kind: "grant"; durationDays: number | null; label: string }
  | { kind: "revoke" }
  | null;

const PAGE_LIMIT = 20;

const tierFilters: Array<{ value: TierFilter; label: string }> = [
  { value: "all", label: "All tiers" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

const grantPresets: Array<{ value: GrantPreset; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "custom", label: "Custom" },
  { value: "lifetime", label: "Lifetime" },
];

function TierBadge({ tier }: { tier: string }) {
  const isPremium = tier === "premium";
  return (
    <span
      className={classNames(
        "rounded-full px-3 py-1 text-xs font-semibold",
        isPremium
          ? "bg-emerald-100 text-emerald-700"
          : "bg-[#f3f4ff] text-[#3b3da9]"
      )}
    >
      {isPremium ? "Premium" : "Free"}
    </span>
  );
}

function formatExpiry(tier: string, expiresAt: string | null): string {
  if (tier !== "premium") {
    return "—";
  }
  if (!expiresAt) {
    return "Lifetime";
  }
  return formatDate(expiresAt);
}

export function UsersSection({ token, notify }: SectionProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const [grantPreset, setGrantPreset] = useState<GrantPreset>("30");
  const [grantCustom, setGrantCustom] = useState(30);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async (
    targetPage: number,
    searchValue: string,
    tier: TierFilter
  ) => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(PAGE_LIMIT));
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }
      if (tier !== "all") {
        params.set("tier", tier);
      }

      const { data, meta: pageMeta } = await apiRequestRaw<UserRow[]>(
        `/admin/users?${params.toString()}`,
        { token }
      );

      setUsers(data || []);
      setMeta(pageMeta || null);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void fetchUsers(page, appliedSearch, tierFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, appliedSearch, tierFilter]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search);
  };

  const openDetail = async (userId: string) => {
    if (!token) return;
    setDetailOpen(true);
    setDetail(null);
    setGrantPreset("30");
    setGrantCustom(30);
    setDetailLoading(true);

    try {
      const data = await apiRequest<UserDetail>(`/admin/users/${userId}`, {
        token,
      });
      setDetail(data);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setConfirm(null);
  };

  const resolveGrantDuration = (): number | null => {
    if (grantPreset === "lifetime") return null;
    if (grantPreset === "custom") return Math.max(1, Math.round(grantCustom));
    return Number(grantPreset);
  };

  const requestGrant = () => {
    const durationDays = resolveGrantDuration();
    const label =
      durationDays === null ? "Lifetime" : `${durationDays} day${durationDays === 1 ? "" : "s"}`;
    setConfirm({ kind: "grant", durationDays, label });
  };

  const requestRevoke = () => {
    setConfirm({ kind: "revoke" });
  };

  const runAction = async () => {
    if (!token || !detail || !confirm) {
      setConfirm(null);
      return;
    }

    const userId = detail.user.id;
    setActionLoading(true);

    try {
      let updated: UserDetail;
      if (confirm.kind === "grant") {
        updated = await apiRequest<UserDetail>(
          `/admin/users/${userId}/grant-premium`,
          {
            token,
            method: "POST",
            body: { durationDays: confirm.durationDays },
          }
        );
        notify("success", "Premium granted.");
      } else {
        updated = await apiRequest<UserDetail>(
          `/admin/users/${userId}/revoke-premium`,
          {
            token,
            method: "POST",
          }
        );
        notify("success", "Premium revoked.");
      }

      setDetail(updated);
      setConfirm(null);
      await fetchUsers(page, appliedSearch, tierFilter);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = meta?.totalPages ?? 1;
  const totalUsers = meta?.total ?? users.length;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Users
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Search members, review premium status, and grant or revoke access
          </p>
        </div>
      </div>

      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Field
                label="Search users"
                value={search}
                onChange={setSearch}
                placeholder="Find by name or email"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Search
            </button>
          </form>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Tier</span>
            <select
              value={tierFilter}
              onChange={(event) => {
                setPage(1);
                setTierFilter(event.target.value as TierFilter);
              }}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              {tierFilters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              No user matches the current filter.
            </div>
          ) : (
            users.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openDetail(item.id)}
                className="flex w-full flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 text-left transition hover:border-[var(--danger)] md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#f5dede] bg-[#fff5f5] text-[var(--danger)]">
                    <AppIcon name="users" className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                      {item.fullName || "Unnamed user"}
                    </p>
                    <p className="truncate text-sm text-[#6b6467]">{item.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 md:justify-end">
                  <TierBadge tier={item.tier} />
                  <div className="text-sm text-[#6d6668]">
                    <span className="font-medium text-[#322b2d]">Source: </span>
                    {item.premiumSource || "—"}
                  </div>
                  <div className="text-sm text-[#6d6668]">
                    <span className="font-medium text-[#322b2d]">Expires: </span>
                    {formatExpiry(item.tier, item.premiumExpiresAt)}
                  </div>
                  <AppIcon
                    name="chevron"
                    className="h-4 w-4 shrink-0 text-[#b8b1b4]"
                  />
                </div>
              </button>
            ))
          )}
        </div>

        {meta && totalPages > 1 ? (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-[#6d6668]">
              Page {meta.page} of {totalPages} · {totalUsers} users
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages || loading}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={detailOpen}
        title={detail?.user.fullName || "User detail"}
        subtitle={detail?.user.email || "Loading member profile..."}
        onClose={closeDetail}
      >
        {detailLoading || !detail ? (
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] px-5 py-10 text-center text-sm text-[var(--muted)]">
            Loading user...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <TierBadge tier={detail.user.tier} />
                <span className="text-sm text-[var(--muted)]">
                  Role: {detail.user.role}
                </span>
                {detail.user.manualPremiumActive ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    Manual premium active
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailRow label="Phone" value={detail.user.phoneNumber || "—"} />
                <DetailRow
                  label="Preferred language"
                  value={detail.user.preferredLanguage || "—"}
                />
                <DetailRow
                  label="Premium source"
                  value={detail.user.premiumSource || "—"}
                />
                <DetailRow
                  label="Premium expires"
                  value={formatExpiry(
                    detail.user.tier,
                    detail.user.premiumExpiresAt
                  )}
                />
                <DetailRow
                  label="Granted by"
                  value={detail.user.premiumGrantedBy || "—"}
                />
                <DetailRow
                  label="Manual expires"
                  value={
                    detail.user.manualPremiumActive
                      ? detail.user.manualPremiumExpiresAt
                        ? formatDate(detail.user.manualPremiumExpiresAt)
                        : "Lifetime"
                      : "—"
                  }
                />
                <DetailRow
                  label="Joined"
                  value={formatDate(detail.user.createdAt)}
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(detail.user.updatedAt)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <h4 className="text-sm font-bold text-[#201a1b]">Premium actions</h4>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Grant a manual premium window or revoke the current premium access.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-2 sm:w-48">
                  <span className="text-sm font-semibold text-[#33292b]">
                    Duration
                  </span>
                  <select
                    value={grantPreset}
                    onChange={(event) =>
                      setGrantPreset(event.target.value as GrantPreset)
                    }
                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
                  >
                    {grantPresets.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {grantPreset === "custom" ? (
                  <div className="sm:w-40">
                    <Field
                      label="Days"
                      type="number"
                      value={grantCustom}
                      onChange={(value) => setGrantCustom(Number(value || 0))}
                      placeholder="30"
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={requestGrant}
                  disabled={actionLoading}
                  className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Grant premium
                </button>
                <button
                  type="button"
                  onClick={requestRevoke}
                  disabled={actionLoading || detail.user.tier !== "premium"}
                  className="rounded-full border border-[var(--danger-soft)] px-5 py-3 text-sm font-semibold text-[var(--danger)] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Revoke premium
                </button>
              </div>
            </div>

            <DetailListPanel
              title="Subscriptions"
              empty="No store subscriptions on record."
              count={detail.subscriptions.length}
            >
              {detail.subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-[10px] border border-[#ece4e4] bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#2b2526]">
                      {sub.store} · {sub.productId}
                    </p>
                    <span
                      className={classNames(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        sub.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#6d6668]">
                    <span>
                      Expires:{" "}
                      {sub.expiresAt ? formatDate(sub.expiresAt) : "—"}
                    </span>
                    <span>Created: {formatDate(sub.createdAt)}</span>
                  </div>
                </div>
              ))}
            </DetailListPanel>

            <DetailListPanel
              title="Coupon redemptions"
              empty="No coupon redemptions on record."
              count={detail.couponRedemptions.length}
            >
              {detail.couponRedemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[#2b2526]">
                    Coupon {redemption.couponId}
                  </p>
                  <span className="text-xs text-[#6d6668]">
                    {formatDate(redemption.redeemedAt)}
                  </span>
                </div>
              ))}
            </DetailListPanel>

            <DetailListPanel
              title="Audit log"
              empty="No admin actions recorded for this user."
              count={detail.auditLog.length}
            >
              {detail.auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[10px] border border-[#ece4e4] bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#2b2526]">
                      {entry.action}
                    </p>
                    <span className="text-xs text-[#6d6668]">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6d6668]">
                    Admin: {entry.adminId}
                  </p>
                  {entry.meta ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--panel-muted)] px-3 py-2 text-[11px] leading-5 text-[#4a4244]">
                      {JSON.stringify(entry.meta, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </DetailListPanel>
          </div>
        )}
      </Modal>

      <Modal
        open={confirm !== null}
        title={confirm?.kind === "revoke" ? "Revoke premium" : "Grant premium"}
        subtitle={
          confirm?.kind === "revoke"
            ? "Remove premium access for this user immediately."
            : confirm?.kind === "grant"
              ? `Grant ${confirm.label} of premium access.`
              : undefined
        }
        onClose={() => setConfirm(null)}
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
            {confirm?.kind === "revoke"
              ? "The user will lose manual premium access. Store-based subscriptions are not affected."
              : confirm?.kind === "grant"
                ? confirm.durationDays === null
                  ? "This grants lifetime premium access with no expiry."
                  : `This grants premium access for ${confirm.label}.`
                : ""}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runAction()}
              disabled={actionLoading}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading
                ? "Working..."
                : confirm?.kind === "revoke"
                  ? "Revoke now"
                  : "Grant now"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </span>
      <span className="text-sm font-semibold text-[#2b2526]">{value}</span>
    </div>
  );
}

function DetailListPanel({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-[#201a1b]">{title}</h4>
        <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-6 text-center text-sm text-[#7a7275]">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}
