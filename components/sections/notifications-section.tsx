"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  apiRequest,
  apiRequestRaw,
  type ApiErrorShape,
  type PageMeta,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import {
  AppIcon,
  Field,
  Modal,
  TextAreaField,
} from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type NotificationStatus =
  | "pending"
  | "sent"
  | "skipped"
  | "canceled"
  | "failed";
type NotificationType =
  | "material_expiry"
  | "inspection"
  | "checklist_item"
  | "premium_expiry"
  | "custom";
type HistoryChannel = "push" | "local" | "email";
type SendChannel = "push" | "email";
type AudienceType = "all" | "free" | "premium" | "category" | "specific";
type TabId = "compose" | "templates" | "history";

type NotificationJob = {
  id: string;
  userId: string;
  type: NotificationType;
  refId?: string | null;
  title: string;
  body?: string | null;
  scheduledAt?: string | null;
  channel: HistoryChannel;
  status: NotificationStatus;
  sentAt?: string | null;
  error?: string | null;
  attempts?: number;
  maxAttempts?: number;
  campaignId?: string | null;
  createdAt: string;
};

type NotificationTemplate = {
  id: string;
  name: string;
  title: string;
  body: string;
  channels: SendChannel[];
  audienceType: AudienceType;
  categorySlug: string;
  createdAt: string;
  updatedAt: string;
};

type CategoryOption = {
  id?: string;
  slug: string;
  name?: string;
  names?: {
    en?: string;
    it?: string;
  };
};

type NotificationFormState = {
  templateId: string;
  name: string;
  title: string;
  body: string;
  channels: SendChannel[];
  audienceType: AudienceType;
  categorySlug: string;
  // Whitespace/comma separated user ids, used only for the "specific" audience.
  userIds: string;
};

type SendResult = {
  campaignId: string;
  recipients: number;
  channels: SendChannel[];
  audience: {
    type: AudienceType;
    categorySlug: string;
  };
  queued: number;
};

const PAGE_LIMIT = 20;

const STATUS_OPTIONS: Array<{ value: "" | NotificationStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "skipped", label: "Skipped" },
  { value: "canceled", label: "Canceled" },
  { value: "failed", label: "Failed" },
];

const CHANNEL_FILTER_OPTIONS: Array<{ value: "" | HistoryChannel; label: string }> = [
  { value: "", label: "All channels" },
  { value: "push", label: "Push" },
  { value: "email", label: "Email" },
  { value: "local", label: "Local" },
];

const STATUS_TONE: Record<NotificationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  skipped: "bg-slate-100 text-slate-600",
  canceled: "bg-slate-100 text-slate-600",
  failed: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

const TYPE_LABEL: Record<NotificationType, string> = {
  material_expiry: "Material expiry",
  inspection: "Inspection",
  checklist_item: "Checklist reminder",
  premium_expiry: "Premium expiry",
  custom: "Custom",
};

const AUDIENCE_LABEL: Record<AudienceType, string> = {
  all: "All users",
  free: "Free users",
  premium: "Premium users",
  category: "Category users",
  specific: "Specific users",
};

const emptyForm = (): NotificationFormState => ({
  templateId: "",
  name: "",
  title: "",
  body: "",
  channels: ["push"],
  audienceType: "all",
  categorySlug: "",
  userIds: "",
});

// A unique key per compose-and-send intent. The backend dedupes repeated sends
// (double click / retry) that carry the same key, so it is regenerated only
// after a successful send or an explicit Clear.
const genCampaignKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `campaign_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Split a free-text list of user ids on commas/whitespace/newlines.
const parseUserIds = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

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
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${formatDate(value)} - ${time}`;
}

function channelLabel(channel: SendChannel | HistoryChannel) {
  return channel === "push" ? "Push" : channel === "email" ? "Email" : "Local";
}

function categoryLabel(category: CategoryOption) {
  return category.names?.en || category.name || category.slug;
}

function audienceText(value: AudienceType, categorySlug: string, categories: CategoryOption[]) {
  if (value !== "category") return AUDIENCE_LABEL[value];
  const category = categories.find((item) => item.slug === categorySlug);
  return category ? `${AUDIENCE_LABEL[value]}: ${categoryLabel(category)}` : "Category users";
}

export function NotificationsSection({ token, notify }: SectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>("compose");
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | NotificationStatus>("");
  const [channelFilter, setChannelFilter] = useState<"" | HistoryChannel>("");
  const [page, setPage] = useState(1);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadedJobs, setLoadedJobs] = useState(false);
  const [composeForm, setComposeForm] = useState<NotificationFormState>(
    emptyForm()
  );
  const [templateForm, setTemplateForm] = useState<NotificationFormState>(
    emptyForm()
  );
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [campaignKey, setCampaignKey] = useState<string>(genCampaignKey);

  const loadJobs = useCallback(async () => {
    if (!token) return;
    setLoadingJobs(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
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
      setLoadingJobs(false);
      setLoadedJobs(true);
    }
  }, [token, statusFilter, channelFilter, page, notify]);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const { data } = await apiRequestRaw<NotificationTemplate[]>(
        "/admin/notifications/templates?limit=100",
        { token }
      );
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setLoadingTemplates(false);
    }
  }, [token, notify]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<CategoryOption[]>("/admin/categories", {
        token,
      });
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Unable to load categories");
    }
  }, [token, notify]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadTemplates();
    void loadCategories();
  }, [loadTemplates, loadCategories]);

  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const total = meta?.total ?? jobs.length;
  const defaultCategorySlug = categories[0]?.slug || "";

  const statusCounts = useMemo(() => {
    return jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [jobs]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "compose", label: "Compose" },
    { id: "templates", label: "Templates" },
    { id: "history", label: "History" },
  ];

  const updateForm = (
    target: "compose" | "template",
    updater: (current: NotificationFormState) => NotificationFormState
  ) => {
    if (target === "compose") {
      setComposeForm(updater);
    } else {
      setTemplateForm(updater);
    }
  };

  const toggleChannel = (target: "compose" | "template", channel: SendChannel) => {
    updateForm(target, (current) => {
      const hasChannel = current.channels.includes(channel);
      const nextChannels = hasChannel
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];

      return {
        ...current,
        channels: nextChannels.length ? nextChannels : current.channels,
      };
    });
  };

  const handleAudienceChange = (
    target: "compose" | "template",
    audienceType: AudienceType
  ) => {
    updateForm(target, (current) => ({
      ...current,
      audienceType,
      categorySlug:
        audienceType === "category"
          ? current.categorySlug || defaultCategorySlug
          : "",
    }));
  };

  const useTemplateInComposer = (template: NotificationTemplate) => {
    setComposeForm({
      templateId: template.id,
      name: template.name,
      title: template.title,
      body: template.body,
      channels: template.channels.length ? template.channels : ["push"],
      audienceType: template.audienceType,
      categorySlug: template.categorySlug || "",
      userIds: "",
    });
    setActiveTab("compose");
  };

  const openTemplateModal = (template?: NotificationTemplate) => {
    if (template) {
      setEditingTemplateId(template.id);
      setTemplateForm({
        templateId: template.id,
        name: template.name,
        title: template.title,
        body: template.body,
        channels: template.channels.length ? template.channels : ["push"],
        audienceType: template.audienceType,
        categorySlug: template.categorySlug || "",
        userIds: "",
      });
    } else {
      setEditingTemplateId(null);
      setTemplateForm(emptyForm());
    }
    setTemplateModalOpen(true);
  };

  const resetCompose = () => {
    setComposeForm(emptyForm());
    setCampaignKey(genCampaignKey());
  };

  const validateForm = (form: NotificationFormState, includeName: boolean) => {
    if (includeName && !form.name.trim()) {
      notify("error", "Template name is required.");
      return false;
    }
    if (!form.title.trim()) {
      notify("error", "Notification title is required.");
      return false;
    }
    if (!form.body.trim()) {
      notify("error", "Notification message is required.");
      return false;
    }
    if (form.audienceType === "category" && !form.categorySlug) {
      notify("error", "Choose a category for this audience.");
      return false;
    }
    if (form.audienceType === "specific" && parseUserIds(form.userIds).length === 0) {
      notify("error", "Enter at least one user ID.");
      return false;
    }
    return true;
  };

  const sendNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !validateForm(composeForm, false)) return;

    setSending(true);
    try {
      const result = await apiRequest<SendResult>("/admin/notifications/send", {
        token,
        method: "POST",
        body: {
          idempotencyKey: campaignKey,
          templateId: composeForm.templateId || undefined,
          title: composeForm.title,
          body: composeForm.body,
          channels: composeForm.channels,
          audienceType: composeForm.audienceType,
          categorySlug: composeForm.categorySlug,
          userIds:
            composeForm.audienceType === "specific"
              ? parseUserIds(composeForm.userIds)
              : undefined,
        },
      });

      notify(
        "success",
        result.recipients === 0
          ? "No users matched this audience."
          : `Queued ${result.queued} notification(s) for ${result.recipients} user(s).`
      );
      // New key so the next send is treated as a distinct campaign.
      setCampaignKey(genCampaignKey());
      void loadJobs();
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Unable to send notification");
    } finally {
      setSending(false);
    }
  };

  const retryJob = async (job: NotificationJob) => {
    if (!token) return;
    try {
      await apiRequest(`/admin/notifications/${job.id}/retry`, {
        token,
        method: "POST",
      });
      notify("success", "Notification re-queued for delivery.");
      void loadJobs();
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Unable to retry notification");
    }
  };

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !validateForm(templateForm, true)) return;

    setSavingTemplate(true);
    try {
      const path = editingTemplateId
        ? `/admin/notifications/templates/${editingTemplateId}`
        : "/admin/notifications/templates";
      const method = editingTemplateId ? "PATCH" : "POST";

      await apiRequest<NotificationTemplate>(path, {
        token,
        method,
        body: {
          name: templateForm.name,
          title: templateForm.title,
          body: templateForm.body,
          channels: templateForm.channels,
          audienceType: templateForm.audienceType,
          categorySlug: templateForm.categorySlug,
        },
      });

      notify(
        "success",
        editingTemplateId
          ? "Notification template updated."
          : "Notification template created."
      );
      setTemplateModalOpen(false);
      setEditingTemplateId(null);
      void loadTemplates();
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Unable to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (template: NotificationTemplate) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete template "${template.name}"?`);
    if (!confirmed) return;

    try {
      await apiRequest(`/admin/notifications/templates/${template.id}`, {
        token,
        method: "DELETE",
      });
      notify("success", "Notification template deleted.");
      void loadTemplates();
    } catch (err) {
      const e = err as ApiErrorShape;
      notify("error", e.message || "Unable to delete template");
    }
  };

  const renderChannelToggles = (target: "compose" | "template", form: NotificationFormState) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["push", "email"] as SendChannel[]).map((channel) => {
        const active = form.channels.includes(channel);
        return (
          <button
            key={channel}
            type="button"
            onClick={() => toggleChannel(target, channel)}
            className={classNames(
              "flex min-h-14 items-center justify-between rounded-[10px] border px-4 py-3 text-left text-sm font-semibold transition",
              active
                ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                : "border-[var(--border)] bg-white text-[#4d4548] hover:border-[var(--danger)]"
            )}
          >
            <span>{channelLabel(channel)}</span>
            <span
              className={classNames(
                "grid h-5 w-5 place-items-center rounded-full border text-[10px]",
                active
                  ? "border-[var(--danger)] bg-[var(--danger)] text-white"
                  : "border-[#cfc4c7] text-transparent"
              )}
            >
              on
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderAudienceControls = (
    target: "compose" | "template",
    form: NotificationFormState
  ) => {
    // "specific" targets an explicit user list — only for one-off sends, never
    // saved as a reusable template.
    const options: AudienceType[] =
      target === "compose"
        ? ["all", "free", "premium", "category", "specific"]
        : ["all", "free", "premium", "category"];
    return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => handleAudienceChange(target, value)}
            className={classNames(
              "min-h-11 rounded-[10px] border px-3 py-2 text-sm font-semibold transition",
              form.audienceType === value
                ? "border-[var(--danger)] bg-[var(--danger)] text-white"
                : "border-[var(--border)] bg-white text-[#4d4548] hover:border-[var(--danger)]"
            )}
          >
            {AUDIENCE_LABEL[value]}
          </button>
        ))}
      </div>
      {form.audienceType === "specific" ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[#33292b]">User IDs</span>
          <textarea
            value={form.userIds}
            onChange={(event) =>
              updateForm(target, (current) => ({
                ...current,
                userIds: event.target.value,
              }))
            }
            rows={3}
            placeholder="user_abc, user_def"
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
          />
          <span className="text-xs font-medium text-[#8b8286]">
            Paste user IDs separated by commas or spaces.
          </span>
        </label>
      ) : null}
      {form.audienceType === "category" ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[#33292b]">Category</span>
          <select
            value={form.categorySlug}
            onChange={(event) =>
              updateForm(target, (current) => ({
                ...current,
                categorySlug: event.target.value,
              }))
            }
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
          >
            {categories.length === 0 ? (
              <option value="">No categories available</option>
            ) : null}
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
    );
  };

  const renderComposeTab = () => (
    <form
      onSubmit={(event) => void sendNotification(event)}
      className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-5"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Use template</span>
            <select
              value={composeForm.templateId}
              onChange={(event) => {
                const template = templates.find((item) => item.id === event.target.value);
                if (template) {
                  useTemplateInComposer(template);
                } else {
                  setComposeForm((current) => ({ ...current, templateId: "", name: "" }));
                }
              }}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              <option value="">Custom notification</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Notification title"
            value={composeForm.title}
            placeholder="Emergency kit reminder"
            onChange={(value) =>
              setComposeForm((current) => ({ ...current, title: value }))
            }
          />
          <TextAreaField
            label="Notification message"
            value={composeForm.body}
            onChange={(value) =>
              setComposeForm((current) => ({ ...current, body: value }))
            }
            rows={6}
          />
          <p className="-mt-2 text-xs font-medium text-[#8b8286]">
            Variables:{" "}
            <code>{"{{name}}"}</code> <code>{"{{email}}"}</code>{" "}
            <code>{"{{expiryDate}}"}</code> <code>{"{{daysRemaining}}"}</code>{" "}
            <code>{"{{planName}}"}</code> — replaced per recipient.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[12px] border border-[#ece4e4] bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[#33292b]">Channels</p>
              {renderChannelToggles("compose", composeForm)}
            </div>
            <div className="rounded-[12px] border border-[#ece4e4] bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[#33292b]">Audience</p>
              {renderAudienceControls("compose", composeForm)}
            </div>
          </div>
        </div>

        <aside className="rounded-[12px] border border-[#ece4e4] bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
              <AppIcon name="notifications" className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-[#221c1d]">Ready to send</p>
              <p className="text-xs font-medium text-[#7a7275]">
                {composeForm.channels.map(channelLabel).join(", ")}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-[10px] bg-[#fff7f7] px-4 py-3">
              <p className="text-xs font-semibold uppercase text-[#9b9296]">Audience</p>
              <p className="mt-1 font-semibold text-[#2b2526]">
                {audienceText(composeForm.audienceType, composeForm.categorySlug, categories)}
              </p>
            </div>
            <div className="rounded-[10px] bg-[#fff7f7] px-4 py-3">
              <p className="text-xs font-semibold uppercase text-[#9b9296]">Title</p>
              <p className="mt-1 line-clamp-2 font-semibold text-[#2b2526]">
                {composeForm.title || "Untitled notification"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="submit"
              disabled={sending}
              className="rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send notification"}
            </button>
            <button
              type="button"
              onClick={resetCompose}
              className="rounded-[10px] border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
            >
              Clear
            </button>
          </div>
        </aside>
      </div>
    </form>
  );

  const renderTemplatesTab = () => (
    <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[#6d6668]">
          {templates.length} template{templates.length === 1 ? "" : "s"}
          {loadingTemplates ? " - Loading..." : ""}
        </div>
        <button
          type="button"
          onClick={() => openTemplateModal()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--danger)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)]"
        >
          <AppIcon name="notifications" className="h-4 w-4" />
          New template
        </button>
      </div>

      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="grid gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                  {template.name}
                </p>
                <span className="rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-medium text-[#3b3da9]">
                  {template.channels.map(channelLabel).join(", ")}
                </span>
                <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
                  {audienceText(template.audienceType, template.categorySlug, categories)}
                </span>
              </div>
              <p className="mt-2 font-semibold text-[#33292b]">{template.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-[#6b6467]">
                {template.body}
              </p>
              <p className="mt-2 text-xs font-medium text-[#8b8286]">
                Updated {formatDateTime(template.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => useTemplateInComposer(template)}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Use
              </button>
              <button
                type="button"
                onClick={() => openTemplateModal(template)}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void deleteTemplate(template)}
                className="rounded-full border border-[var(--danger-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {!loadingTemplates && templates.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
            No notification templates found.
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex w-full flex-col gap-2 sm:min-w-52">
            <span className="text-sm font-semibold text-[#33292b]">
              Filter by status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "" | NotificationStatus);
                setPage(1);
              }}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-2 sm:min-w-52">
            <span className="text-sm font-semibold text-[#33292b]">
              Filter by channel
            </span>
            <select
              value={channelFilter}
              onChange={(event) => {
                setChannelFilter(event.target.value as "" | HistoryChannel);
                setPage(1);
              }}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
            >
              {CHANNEL_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loadedJobs && jobs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6d6668]">
            {(["pending", "sent", "skipped", "canceled", "failed"] as NotificationStatus[])
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
                <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
                  {channelLabel(job.channel)}
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
                  {job.userId || "-"}
                </span>
                {job.attempts ? (
                  <span>
                    <span className="text-[#9b9296]">Attempts:</span>{" "}
                    {job.attempts}
                    {job.maxAttempts ? `/${job.maxAttempts}` : ""}
                  </span>
                ) : null}
              </div>
              {job.error ? (
                <p className="mt-2 rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger-deep)]">
                  {job.error}
                </p>
              ) : null}
            </div>
            {job.status === "failed" ? (
              <div className="flex items-start md:justify-end">
                <button
                  type="button"
                  onClick={() => void retryJob(job)}
                  className="rounded-full border border-[var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {loadingJobs ? (
          <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
            Loading notification jobs...
          </div>
        ) : null}

        {!loadingJobs && loadedJobs && jobs.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
            No notification jobs found.
          </div>
        ) : null}
      </div>

      {meta && totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-[#eee4e4] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#6d6668]">
            Page {meta.page} of {totalPages} - {total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loadingJobs || page <= 1}
              className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={loadingJobs || page >= totalPages}
              className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Create reusable templates and send push or email notifications.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="rounded-full border border-[#eee4e4] bg-[#fffafa] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
            {templates.length} template{templates.length === 1 ? "" : "s"}
          </div>
          <div className="rounded-full border border-[#eee4e4] bg-[#fffafa] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
            {total} job{total === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[12px] border border-[#eee4e4] bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={classNames(
              "min-h-10 rounded-[8px] px-4 py-2 text-sm font-semibold transition",
              activeTab === tab.id
                ? "bg-[var(--danger)] text-white"
                : "text-[#5f5659] hover:bg-[#fff3f3] hover:text-[var(--danger)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "compose" ? renderComposeTab() : null}
      {activeTab === "templates" ? renderTemplatesTab() : null}
      {activeTab === "history" ? renderHistoryTab() : null}

      <Modal
        open={templateModalOpen}
        title={editingTemplateId ? "Edit notification template" : "New notification template"}
        subtitle="Save a reusable title, message, channel, and audience."
        onClose={() => setTemplateModalOpen(false)}
      >
        <form onSubmit={(event) => void saveTemplate(event)} className="space-y-5">
          <Field
            label="Template name"
            value={templateForm.name}
            placeholder="Premium upgrade offer"
            onChange={(value) =>
              setTemplateForm((current) => ({ ...current, name: value }))
            }
          />
          <Field
            label="Notification title"
            value={templateForm.title}
            placeholder="Stay prepared today"
            onChange={(value) =>
              setTemplateForm((current) => ({ ...current, title: value }))
            }
          />
          <TextAreaField
            label="Notification message"
            value={templateForm.body}
            onChange={(value) =>
              setTemplateForm((current) => ({ ...current, body: value }))
            }
            rows={5}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[12px] border border-[#ece4e4] bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[#33292b]">Channels</p>
              {renderChannelToggles("template", templateForm)}
            </div>
            <div className="rounded-[12px] border border-[#ece4e4] bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[#33292b]">Audience</p>
              {renderAudienceControls("template", templateForm)}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setTemplateModalOpen(false)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTemplate}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTemplate
                ? "Saving..."
                : editingTemplateId
                  ? "Save template"
                  : "Create template"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
