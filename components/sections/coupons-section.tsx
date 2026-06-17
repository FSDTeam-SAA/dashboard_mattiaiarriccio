"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  apiRequestRaw,
  type ApiErrorShape,
  type PageMeta,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import { AppIcon, Field, Modal, StatCard } from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type CouponType = "premium_grant" | "trial";

type CouponRecord = {
  id: string;
  code: string;
  type: CouponType;
  durationDays: number | null;
  maxRedemptions: number | null;
  redemptionsCount: number;
  remainingRedemptions: number | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

type TypeFilter = "all" | CouponType;
type ActiveFilter = "all" | "active" | "inactive";

type CreateFormState = {
  code: string;
  type: CouponType;
  durationDays: number;
  lifetime: boolean;
  maxRedemptions: number;
  expiresAt: string;
};

type EditFormState = {
  id: string;
  code: string;
  type: CouponType;
  durationDays: number;
  lifetime: boolean;
  maxRedemptions: number;
  expiresAt: string;
  active: boolean;
};

const PAGE_LIMIT = 20;

const couponTypeLabel = (type: CouponType) =>
  type === "premium_grant" ? "Premium grant" : "Trial";

const emptyCreateForm = (): CreateFormState => ({
  code: "",
  type: "premium_grant",
  durationDays: 30,
  lifetime: false,
  maxRedemptions: 100,
  expiresAt: "",
});

// Backend expiresAt is ISO; the date input needs YYYY-MM-DD.
const toDateInputValue = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export function CouponsSection({ token, notify }: SectionProps) {
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm());

  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    code: string;
  } | null>(null);

  const handleError = (error: unknown) => {
    const typed = error as ApiErrorShape;
    notify("error", typed.message || "Request failed");
  };

  const loadCoupons = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(PAGE_LIMIT));
      if (search.trim()) params.set("search", search.trim());
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (activeFilter !== "all") {
        params.set("active", activeFilter === "active" ? "true" : "false");
      }

      const { data, meta: pageMeta } = await apiRequestRaw<CouponRecord[]>(
        `/admin/coupons?${params.toString()}`,
        { token }
      );

      setCoupons(data ?? []);
      setMeta(pageMeta ?? null);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
      setInitialised(true);
    }
  };

  // Fetch on mount and whenever filters/page change (token-gated).
  useEffect(() => {
    if (!token) return;
    void loadCoupons(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, typeFilter, activeFilter]);

  // Reset to page 1 when filters change so we don't land on an empty page.
  useEffect(() => {
    setPage(1);
  }, [typeFilter, activeFilter]);

  const stats = useMemo(() => {
    const total = meta?.total ?? coupons.length;
    const active = coupons.filter((item) => item.active).length;
    const redemptions = coupons.reduce(
      (sum, item) => sum + (item.redemptionsCount || 0),
      0
    );
    return { total, active, redemptions };
  }, [coupons, meta]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (page === 1) {
      void loadCoupons(1);
    } else {
      setPage(1);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1500);
      notify("success", `Copied ${code} to clipboard.`);
    } catch {
      notify("error", "Unable to copy code.");
    }
  };

  const handleToggleActive = async (coupon: CouponRecord) => {
    if (!token) return;
    setTogglingId(coupon.id);

    try {
      const updated = await apiRequest<CouponRecord>(
        `/admin/coupons/${coupon.id}`,
        { token, method: "PATCH", body: { active: !coupon.active } }
      );
      setCoupons((current) =>
        current.map((item) => (item.id === coupon.id ? updated : item))
      );
      notify(
        "success",
        updated.active ? "Coupon activated." : "Coupon deactivated."
      );
    } catch (error) {
      handleError(error);
    } finally {
      setTogglingId(null);
    }
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm());
    setCreateOpen(true);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        type: createForm.type,
        maxRedemptions: Number(createForm.maxRedemptions) || 0,
        active: true,
      };

      const trimmedCode = createForm.code.trim();
      if (trimmedCode) {
        body.code = trimmedCode;
      }

      // Lifetime only applies to premium grants; trials are always time-boxed.
      if (createForm.type === "premium_grant" && createForm.lifetime) {
        body.durationDays = null;
      } else {
        body.durationDays = Number(createForm.durationDays) || 0;
      }

      if (createForm.expiresAt) {
        body.expiresAt = new Date(createForm.expiresAt).toISOString();
      }

      await apiRequest<CouponRecord>("/admin/coupons", {
        token,
        method: "POST",
        body,
      });

      setCreateOpen(false);
      notify("success", "Coupon created.");
      if (page === 1) {
        void loadCoupons(1);
      } else {
        setPage(1);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (coupon: CouponRecord) => {
    setEditForm({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      durationDays: coupon.durationDays ?? 0,
      lifetime: coupon.type === "premium_grant" && coupon.durationDays === null,
      maxRedemptions: coupon.maxRedemptions ?? 0,
      expiresAt: toDateInputValue(coupon.expiresAt),
      active: coupon.active,
    });
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editForm) return;
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        type: editForm.type,
        maxRedemptions: Number(editForm.maxRedemptions) || 0,
        active: editForm.active,
      };

      if (editForm.type === "premium_grant" && editForm.lifetime) {
        body.durationDays = null;
      } else {
        body.durationDays = Number(editForm.durationDays) || 0;
      }

      body.expiresAt = editForm.expiresAt
        ? new Date(editForm.expiresAt).toISOString()
        : null;

      const updated = await apiRequest<CouponRecord>(
        `/admin/coupons/${editForm.id}`,
        { token, method: "PATCH", body }
      );

      setCoupons((current) =>
        current.map((item) => (item.id === editForm.id ? updated : item))
      );
      setEditForm(null);
      notify("success", "Coupon updated.");
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!token || !confirmDelete) return;
    setSaving(true);

    try {
      await apiRequest(`/admin/coupons/${confirmDelete.id}`, {
        token,
        method: "DELETE",
      });
      notify("success", "Coupon deleted.");
      const deletedId = confirmDelete.id;
      setConfirmDelete(null);
      // If the page would now be empty, step back a page.
      if (coupons.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setCoupons((current) => current.filter((item) => item.id !== deletedId));
        void loadCoupons(page);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = meta?.totalPages ?? 1;
  const createLifetimeDisabled = createForm.type !== "premium_grant";
  const editLifetimeDisabled = editForm?.type !== "premium_grant";

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Coupons
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Issue premium-grant and trial access codes, then monitor redemptions
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Coupon</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Coupons"
          value={String(stats.total)}
          tone="red"
          icon="checklists"
        />
        <StatCard
          label="Active On This Page"
          value={String(stats.active)}
          tone="green"
          icon="published"
        />
        <StatCard
          label="Redemptions On This Page"
          value={String(stats.redemptions)}
          tone="blue"
          icon="tips"
        />
      </div>

      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">
              Search coupons
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find by code"
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            />
          </form>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              <option value="all">All types</option>
              <option value="premium_grant">Premium grant</option>
              <option value="trial">Trial</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Status</span>
            <select
              value={activeFilter}
              onChange={(event) =>
                setActiveFilter(event.target.value as ActiveFilter)
              }
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {loading && !initialised ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              Loading coupons...
            </div>
          ) : coupons.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              No coupon matches the current filter.
            </div>
          ) : (
            coupons.map((coupon) => {
              const usedLabel = `${coupon.redemptionsCount}/${
                coupon.maxRedemptions ?? "∞"
              }`;
              const durationLabel =
                coupon.durationDays === null
                  ? "Lifetime"
                  : `${coupon.durationDays} day${
                      coupon.durationDays === 1 ? "" : "s"
                    }`;

              return (
                <div
                  key={coupon.id}
                  className="flex flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[1.02rem] font-semibold tracking-[0.04em] text-[#2b2526]">
                        {coupon.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(coupon.code)}
                        className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                      >
                        {copiedCode === coupon.code ? "Copied" : "Copy"}
                      </button>
                      <span
                        className={classNames(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          coupon.type === "premium_grant"
                            ? "bg-[#fff3f3] text-[var(--danger)]"
                            : "bg-[#f3f4ff] text-[#3b3da9]"
                        )}
                      >
                        {couponTypeLabel(coupon.type)}
                      </span>
                      <span
                        className={classNames(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          coupon.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {coupon.active ? "active" : "inactive"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#6d6668]">
                      <span>Duration: {durationLabel}</span>
                      <span>Redemptions: {usedLabel}</span>
                      <span>
                        Expires:{" "}
                        {coupon.expiresAt
                          ? formatDate(coupon.expiresAt)
                          : "Never"}
                      </span>
                      <span>Created: {formatDate(coupon.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#201a1b]">
                      <input
                        type="checkbox"
                        checked={coupon.active}
                        disabled={togglingId === coupon.id}
                        onChange={() => void handleToggleActive(coupon)}
                        className="h-4 w-4 accent-[var(--danger)]"
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => openEdit(coupon)}
                      className="text-[#1771d6] transition hover:text-[#0f5eb6]"
                      aria-label="Edit coupon"
                    >
                      <AppIcon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({ id: coupon.id, code: coupon.code })
                      }
                      className="text-[#ef4444] transition hover:text-[#d72d2d]"
                      aria-label="Delete coupon"
                    >
                      <AppIcon name="delete" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {meta && totalPages > 1 ? (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs font-medium text-[#6d6668]">
              Page {meta.page} of {totalPages} · {meta.total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
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

      <Modal
        open={createOpen}
        title="Create coupon"
        subtitle="Leave the code blank to auto-generate one."
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={submitCreate} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Code (optional)"
              value={createForm.code}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, code: value }))
              }
              placeholder="Auto-generate if empty"
            />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Type</span>
              <select
                value={createForm.type}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    type: event.target.value as CouponType,
                    // Trials cannot be lifetime.
                    lifetime:
                      event.target.value === "premium_grant"
                        ? current.lifetime
                        : false,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                <option value="premium_grant">Premium grant</option>
                <option value="trial">Trial</option>
              </select>
            </label>
          </div>

          <label
            className={classNames(
              "flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]",
              createLifetimeDisabled && "opacity-50"
            )}
          >
            Lifetime (no expiry of granted premium)
            <input
              type="checkbox"
              checked={createForm.type === "premium_grant" && createForm.lifetime}
              disabled={createLifetimeDisabled}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  lifetime: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[var(--danger)]"
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Duration (days)"
              type="number"
              value={createForm.durationDays}
              onChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  durationDays: Number(value || 0),
                }))
              }
              readOnly={createForm.type === "premium_grant" && createForm.lifetime}
            />
            <Field
              label="Max redemptions"
              type="number"
              value={createForm.maxRedemptions}
              onChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  maxRedemptions: Number(value || 0),
                }))
              }
            />
          </div>

          <Field
            label="Expires at (optional)"
            type="date"
            value={createForm.expiresAt}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, expiresAt: value }))
            }
          />

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Coupon"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editForm)}
        title="Edit coupon"
        subtitle={editForm ? editForm.code : undefined}
        onClose={() => setEditForm(null)}
      >
        {editForm ? (
          <form onSubmit={submitEdit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Code" value={editForm.code} onChange={() => {}} readOnly />
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#33292b]">Type</span>
                <select
                  value={editForm.type}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            type: event.target.value as CouponType,
                            lifetime:
                              event.target.value === "premium_grant"
                                ? current.lifetime
                                : false,
                          }
                        : current
                    )
                  }
                  className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
                >
                  <option value="premium_grant">Premium grant</option>
                  <option value="trial">Trial</option>
                </select>
              </label>
            </div>

            <label
              className={classNames(
                "flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]",
                editLifetimeDisabled && "opacity-50"
              )}
            >
              Lifetime (no expiry of granted premium)
              <input
                type="checkbox"
                checked={editForm.type === "premium_grant" && editForm.lifetime}
                disabled={editLifetimeDisabled}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, lifetime: event.target.checked }
                      : current
                  )
                }
                className="h-4 w-4 accent-[var(--danger)]"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Duration (days)"
                type="number"
                value={editForm.durationDays}
                onChange={(value) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, durationDays: Number(value || 0) }
                      : current
                  )
                }
                readOnly={editForm.type === "premium_grant" && editForm.lifetime}
              />
              <Field
                label="Max redemptions"
                type="number"
                value={editForm.maxRedemptions}
                onChange={(value) =>
                  setEditForm((current) =>
                    current
                      ? { ...current, maxRedemptions: Number(value || 0) }
                      : current
                  )
                }
              />
            </div>

            <Field
              label="Expires at (optional)"
              type="date"
              value={editForm.expiresAt}
              onChange={(value) =>
                setEditForm((current) =>
                  current ? { ...current, expiresAt: value } : current
                )
              }
            />

            <label className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]">
              Active
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(event) =>
                  setEditForm((current) =>
                    current ? { ...current, active: event.target.checked } : current
                  )
                }
                className="h-4 w-4 accent-[var(--danger)]"
              />
            </label>

            <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Coupon"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title="Delete coupon"
        subtitle={
          confirmDelete
            ? `This will permanently remove ${confirmDelete.code} and cascade its redemptions.`
            : undefined
        }
        onClose={() => setConfirmDelete(null)}
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
            Deleting a coupon cannot be undone. Existing redemption records linked
            to this coupon are removed as well.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitDelete()}
              disabled={saving}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Working..." : "Delete now"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
