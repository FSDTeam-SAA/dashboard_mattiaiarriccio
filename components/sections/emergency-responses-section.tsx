"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  type ApiErrorShape,
} from "@/lib/api-client";
import { classNames, formatDate } from "@/lib/format";
import {
  AppIcon,
  Field,
  Modal,
  TextAreaField,
} from "@/components/ui/primitives";
import type { SectionProps } from "@/components/sections/types";

type EmergencyLanguage = "en" | "it";
type EmergencySeverity = "low" | "medium" | "high" | "critical";
type ResponseMode = "stored_high_confidence" | "ai_with_context" | "ai_only";
type FollowUpPolicy = "ai_when_needed" | "always_ai" | "stored_only";

type EmergencyResponse = {
  id: string;
  title: string;
  category: string;
  triggerKeywords: string[];
  matchPhrases: string[];
  negativeKeywords: string[];
  responseTemplate: string;
  language: EmergencyLanguage;
  intentKey: string;
  severity: EmergencySeverity;
  responseMode: ResponseMode;
  followUpPolicy: FollowUpPolicy;
  aiContext: string;
  order: number;
  active: boolean;
  createdAt: string;
};

type EmergencyFormState = {
  id?: string;
  title: string;
  category: string;
  triggerKeywords: string[];
  matchPhrases: string[];
  negativeKeywords: string[];
  responseTemplate: string;
  language: EmergencyLanguage;
  intentKey: string;
  severity: EmergencySeverity;
  responseMode: ResponseMode;
  followUpPolicy: FollowUpPolicy;
  aiContext: string;
  order: number;
  active: boolean;
};

type RoutePreview = {
  routingSource: string;
  routingConfidence: number;
  matchedPlaybookId: string;
  matchedPlaybookTitle: string;
  routingReason: string;
  followUp: boolean;
  topMatches: Array<{
    id: string;
    title: string;
    confidence: number;
    reasons: string[];
  }>;
};

const languageOptions: Array<{ value: EmergencyLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "it", label: "Italian" },
];

const languageLabel = (value: string) =>
  languageOptions.find((option) => option.value === value)?.label || value;

const severityOptions: Array<{ value: EmergencySeverity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const responseModeOptions: Array<{ value: ResponseMode; label: string }> = [
  { value: "stored_high_confidence", label: "Stored for high confidence" },
  { value: "ai_with_context", label: "OpenAI with playbook context" },
  { value: "ai_only", label: "OpenAI only" },
];

const followUpPolicyOptions: Array<{ value: FollowUpPolicy; label: string }> = [
  { value: "ai_when_needed", label: "AI when needed" },
  { value: "always_ai", label: "Always AI for follow-ups" },
  { value: "stored_only", label: "Stored only" },
];

const emptyForm = (): EmergencyFormState => ({
  title: "",
  category: "",
  triggerKeywords: [],
  matchPhrases: [],
  negativeKeywords: [],
  responseTemplate: "",
  language: "en",
  intentKey: "",
  severity: "medium",
  responseMode: "stored_high_confidence",
  followUpPolicy: "ai_when_needed",
  aiContext: "",
  order: 0,
  active: true,
});

const linesToArray = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const arrayToLines = (value: string[]) => value.join("\n");

const inputClass =
  "rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]";

export function EmergencyResponsesSection({ token, notify }: SectionProps) {
  const [responses, setResponses] = useState<EmergencyResponse[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState<"" | EmergencyLanguage>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EmergencyFormState>(emptyForm());
  const [keywordDraft, setKeywordDraft] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testPreview, setTestPreview] = useState<RoutePreview | null>(null);
  const [testingRoute, setTestingRoute] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EmergencyResponse | null>(null);

  const fetchResponses = async (currentToken = token) => {
    if (!currentToken) return;

    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter.trim()) params.set("category", categoryFilter.trim());
      if (languageFilter) params.set("language", languageFilter);
      const query = params.toString();

      const data = await apiRequest<EmergencyResponse[]>(
        `/admin/emergency-responses${query ? `?${query}` : ""}`,
        { token: currentToken }
      );

      const sorted = [...(data || [])].sort((a, b) => a.order - b.order);
      setResponses(sorted);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void fetchResponses(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, categoryFilter, languageFilter]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [responses]);

  const openCreateModal = () => {
    const nextOrder =
      responses.length > 0
        ? Math.max(...responses.map((item) => item.order)) + 1
        : 0;
    setForm({ ...emptyForm(), order: nextOrder });
    setKeywordDraft("");
    setTestMessage("");
    setTestPreview(null);
    setModalOpen(true);
  };

  const openEditModal = (record: EmergencyResponse) => {
    setForm({
      id: record.id,
      title: record.title,
      category: record.category || "",
      triggerKeywords: [...(record.triggerKeywords || [])],
      matchPhrases: [...(record.matchPhrases || [])],
      negativeKeywords: [...(record.negativeKeywords || [])],
      responseTemplate: record.responseTemplate || "",
      language: record.language || "en",
      intentKey: record.intentKey || "",
      severity: record.severity || "medium",
      responseMode: record.responseMode || "stored_high_confidence",
      followUpPolicy: record.followUpPolicy || "ai_when_needed",
      aiContext: record.aiContext || "",
      order: record.order ?? 0,
      active: record.active,
    });
    setKeywordDraft("");
    setTestMessage("");
    setTestPreview(null);
    setModalOpen(true);
  };

  const addKeyword = () => {
    const value = keywordDraft.trim();
    if (!value) return;
    setForm((current) =>
      current.triggerKeywords.some(
        (keyword) => keyword.toLowerCase() === value.toLowerCase()
      )
        ? current
        : { ...current, triggerKeywords: [...current.triggerKeywords, value] }
    );
    setKeywordDraft("");
  };

  const removeKeyword = (index: number) => {
    setForm((current) => ({
      ...current,
      triggerKeywords: current.triggerKeywords.filter((_, i) => i !== index),
    }));
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addKeyword();
    } else if (
      event.key === "Backspace" &&
      keywordDraft === "" &&
      form.triggerKeywords.length > 0
    ) {
      removeKeyword(form.triggerKeywords.length - 1);
    }
  };

  const buildPlaybookBody = () => ({
    title: form.title.trim(),
    responseTemplate: form.responseTemplate.trim(),
    category: form.category.trim(),
    triggerKeywords: form.triggerKeywords
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    matchPhrases: form.matchPhrases
      .map((phrase) => phrase.trim())
      .filter(Boolean),
    negativeKeywords: form.negativeKeywords
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    language: form.language,
    intentKey: form.intentKey.trim(),
    severity: form.severity,
    responseMode: form.responseMode,
    followUpPolicy: form.followUpPolicy,
    aiContext: form.aiContext.trim(),
    order: Number(form.order) || 0,
    active: form.active,
  });

  const saveResponse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (!form.title.trim()) {
      notify("error", "Title is required.");
      return;
    }
    if (!form.responseTemplate.trim()) {
      notify("error", "Response template is required.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = buildPlaybookBody();

      if (form.id) {
        await apiRequest(`/admin/emergency-responses/${form.id}`, {
          token,
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/admin/emergency-responses", {
          token,
          method: "POST",
          body,
        });
      }

      setModalOpen(false);
      notify("success", form.id ? "Emergency response updated." : "Emergency response created.");
      await fetchResponses(token);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const previewRoute = async () => {
    if (!token) return;
    if (!testMessage.trim()) {
      notify("error", "Enter a test message first.");
      return;
    }

    setTestingRoute(true);
    try {
      const data = await apiRequest<RoutePreview>(
        "/admin/emergency-responses/preview-route",
        {
          token,
          method: "POST",
          body: {
            text: testMessage.trim(),
            language: form.language,
            emergencyType: form.category.trim() || form.title.trim(),
            playbook: {
              id: form.id,
              ...buildPlaybookBody(),
              responseTemplate:
                form.responseTemplate.trim() || "Draft emergency response",
            },
          },
        }
      );
      setTestPreview(data);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Route preview failed");
    } finally {
      setTestingRoute(false);
    }
  };

  const toggleActive = async (record: EmergencyResponse) => {
    if (!token) return;
    setTogglingId(record.id);
    try {
      await apiRequest(`/admin/emergency-responses/${record.id}`, {
        token,
        method: "PATCH",
        body: { active: !record.active },
      });
      setResponses((current) =>
        current.map((item) =>
          item.id === record.id ? { ...item, active: !item.active } : item
        )
      );
      notify("success", !record.active ? "Response activated." : "Response deactivated.");
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setTogglingId(null);
    }
  };

  const swapOrder = async (index: number, direction: "up" | "down") => {
    if (!token) return;
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= responses.length) return;

    const current = responses[index];
    const neighbor = responses[neighborIndex];

    setReorderingId(current.id);
    try {
      await Promise.all([
        apiRequest(`/admin/emergency-responses/${current.id}`, {
          token,
          method: "PATCH",
          body: { order: neighbor.order },
        }),
        apiRequest(`/admin/emergency-responses/${neighbor.id}`, {
          token,
          method: "PATCH",
          body: { order: current.order },
        }),
      ]);

      setResponses((list) => {
        const next = list.map((item) => {
          if (item.id === current.id) return { ...item, order: neighbor.order };
          if (item.id === neighbor.id) return { ...item, order: current.order };
          return item;
        });
        return next.sort((a, b) => a.order - b.order);
      });
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
      await fetchResponses(token);
    } finally {
      setReorderingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/emergency-responses/${deleteTarget.id}`, {
        token,
        method: "DELETE",
      });
      notify("success", "Emergency response deleted.");
      setDeleteTarget(null);
      await fetchResponses(token);
    } catch (error) {
      const e = error as ApiErrorShape;
      notify("error", e.message || "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (patch: Partial<EmergencyFormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Smart emergency playbooks
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Manage approved emergency guidance and how chat chooses stored content or OpenAI
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Playbook</span>
        </button>
      </div>

      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={inputClass}
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Language</span>
            <select
              value={languageFilter}
              onChange={(event) =>
                setLanguageFilter(event.target.value as "" | EmergencyLanguage)
              }
              className={inputClass}
            >
              <option value="">All languages</option>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {loadingList ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              Loading emergency responses...
            </div>
          ) : responses.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              No smart emergency playbooks match the current filter.
            </div>
          ) : (
            responses.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3 md:flex-1 md:min-w-0">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => void swapOrder(index, "up")}
                      disabled={index === 0 || reorderingId !== null}
                      aria-label="Move up"
                      className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <AppIcon name="chevron" className="h-4 w-4 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void swapOrder(index, "down")}
                      disabled={index === responses.length - 1 || reorderingId !== null}
                      aria-label="Move down"
                      className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <AppIcon name="chevron" className="h-4 w-4 rotate-90" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                        {item.title}
                      </p>
                      <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
                        #{item.order}
                      </span>
                      <span className="rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-medium text-[#3b3da9]">
                        {languageLabel(item.language)}
                      </span>
                      <span className="rounded-full bg-[#eef7ff] px-2.5 py-1 text-xs font-medium text-[#2563a5]">
                        {item.severity}
                      </span>
                      <span className="rounded-full bg-[#f7f1ff] px-2.5 py-1 text-xs font-medium text-[#6d3bb5]">
                        {item.responseMode.replaceAll("_", " ")}
                      </span>
                      {item.category ? (
                        <span className="rounded-full bg-[#f6f1ee] px-2.5 py-1 text-xs font-medium text-[#6b6467]">
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
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-[#6b6467]">
                      {item.responseTemplate}
                    </p>
                    {item.triggerKeywords.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.triggerKeywords.map((keyword, keywordIndex) => (
                          <span
                            key={`${item.id}-kw-${keywordIndex}`}
                            className="rounded-full border border-[var(--border)] bg-[var(--panel-muted)] px-2.5 py-1 text-xs font-medium text-[#6d6668]"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs font-medium text-[#9a9295]">
                      Added {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#201a1b]">
                    <span className="text-[var(--muted)]">Active</span>
                    <input
                      type="checkbox"
                      checked={item.active}
                      disabled={togglingId === item.id}
                      onChange={() => void toggleActive(item)}
                      className="h-4 w-4 accent-[var(--danger)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    aria-label="Edit response"
                    className="text-[#1771d6] transition hover:text-[#0f5eb6]"
                  >
                    <AppIcon name="edit" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    aria-label="Delete response"
                    className="text-[#ef4444] transition hover:text-[#d72d2d]"
                  >
                    <AppIcon name="delete" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={form.id ? "Edit smart playbook" : "New smart playbook"}
        subtitle="Configure approved guidance, match signals, and how chat routes between stored content and OpenAI."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={saveResponse} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Title"
              value={form.title}
              onChange={(value) => updateForm({ title: value })}
              placeholder="Earthquake guidance"
            />
            <Field
              label="Category"
              value={form.category}
              onChange={(value) => updateForm({ category: value })}
              placeholder="earthquake"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Language</span>
              <select
                value={form.language}
                onChange={(event) =>
                  updateForm({ language: event.target.value as EmergencyLanguage })
                }
                className={inputClass}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Order"
              type="number"
              value={form.order}
              onChange={(value) => updateForm({ order: Number(value || 0) })}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Intent key"
              value={form.intentKey}
              onChange={(value) => updateForm({ intentKey: value })}
              placeholder="earthquake_immediate"
            />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Severity</span>
              <select
                value={form.severity}
                onChange={(event) =>
                  updateForm({ severity: event.target.value as EmergencySeverity })
                }
                className={inputClass}
              >
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Routing mode</span>
              <select
                value={form.responseMode}
                onChange={(event) =>
                  updateForm({ responseMode: event.target.value as ResponseMode })
                }
                className={inputClass}
              >
                {responseModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Follow-up policy</span>
              <select
                value={form.followUpPolicy}
                onChange={(event) =>
                  updateForm({ followUpPolicy: event.target.value as FollowUpPolicy })
                }
                className={inputClass}
              >
                {followUpPolicyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-[#33292b]">Trigger keywords</p>
              <p className="text-xs text-[var(--muted)]">
                Type a keyword and press Enter to add a chip. These are matched against the
                user&apos;s message.
              </p>
            </div>
            {form.triggerKeywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.triggerKeywords.map((keyword, index) => (
                  <span
                    key={`form-kw-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[#33292b]"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      aria-label={`Remove ${keyword}`}
                      className="text-[var(--muted)] transition hover:text-[var(--danger)]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="earthquake, drop, cover"
                className={classNames(inputClass, "min-w-0 flex-1")}
              />
              <button
                type="button"
                onClick={addKeyword}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Add
              </button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <TextAreaField
              label="Match phrases"
              value={arrayToLines(form.matchPhrases)}
              onChange={(value) => updateForm({ matchPhrases: linesToArray(value) })}
              rows={5}
            />
            <TextAreaField
              label="Negative keywords"
              value={arrayToLines(form.negativeKeywords)}
              onChange={(value) =>
                updateForm({ negativeKeywords: linesToArray(value) })
              }
              rows={5}
            />
          </div>

          <TextAreaField
            label="Response template"
            value={form.responseTemplate}
            onChange={(value) => updateForm({ responseTemplate: value })}
            rows={8}
          />

          <TextAreaField
            label="AI context"
            value={form.aiContext}
            onChange={(value) => updateForm({ aiContext: value })}
            rows={4}
          />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-[#33292b]">Test routing</p>
              <p className="text-xs text-[var(--muted)]">
                Preview whether a sample chat message uses stored guidance or OpenAI.
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                placeholder="what to do when earthquake finish"
                className={classNames(inputClass, "min-w-0 flex-1")}
              />
              <button
                type="button"
                onClick={() => void previewRoute()}
                disabled={testingRoute}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testingRoute ? "Testing..." : "Test"}
              </button>
            </div>
            {testPreview ? (
              <div className="mt-4 rounded-2xl border border-[#eadede] bg-white p-4 text-sm text-[#33292b]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#fff3f3] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                    {testPreview.routingSource.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full bg-[#f3f4ff] px-3 py-1 text-xs font-semibold text-[#3b3da9]">
                    {testPreview.routingConfidence}% confidence
                  </span>
                  {testPreview.matchedPlaybookTitle ? (
                    <span className="rounded-full bg-[#edf7ed] px-3 py-1 text-xs font-semibold text-emerald-700">
                      {testPreview.matchedPlaybookTitle}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  {testPreview.routingReason}
                </p>
              </div>
            ) : null}
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]">
            Active
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateForm({ active: event.target.checked })}
              className="h-4 w-4 accent-[var(--danger)]"
            />
          </label>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : form.id
                  ? "Save Response"
                  : "Create Response"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete emergency response"
        subtitle={`This action will permanently remove ${deleteTarget?.title || "this response"} from the emergency override library.`}
        onClose={() => setDeleteTarget(null)}
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
            The mobile app will stop returning this override reply after deletion. This cannot be
            undone from the dashboard.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
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
