"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { classNames } from "@/lib/format";
import {
  AppIcon,
  Field,
  Modal,
  StatCard,
  TextAreaField,
} from "@/components/ui/primitives";
import type { SectionProps } from "./types";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type Language = "en" | "it";

type LocalizedText = { en: string; it: string };
type LocalizedList = { en: string[]; it: string[] };

type WebSearchSettings = {
  webSearchEnabled: boolean;
  webSearchFreeDailyLimit: number;
  webSearchPremiumDailyLimit: number;
  webSearchContextSize: "low" | "medium" | "high";
  webSearchPrompt: LocalizedText;
  webSearchTriggers: LocalizedList;
};

type ApprovedDomain = {
  id: string;
  domain: string;
  label: string;
  category: "civil_protection" | "weather" | "official" | "other";
  order: number;
  active: boolean;
};

type ApprovedDomainsResponse = {
  domains: ApprovedDomain[];
  activeCount: number;
  maxAllowed: number;
  overLimit: boolean;
};

type SuggestionKind = "live_info" | "suggested_question";

type LiveInfoSuggestion = {
  id: string;
  title: string;
  prompt: string;
  icon: string;
  kind: SuggestionKind;
  requiresLocation: boolean;
  language: Language;
  order: number;
  active: boolean;
};

/**
 * The two lists the chat welcome screen shows. Same five controls on both -
 * title, prompt, language, order, enabled - which is why they share one editor
 * rather than getting a page each.
 */
const SUGGESTION_KINDS: Array<{
  value: SuggestionKind;
  tab: string;
  heading: string;
  blurb: string;
  addLabel: string;
}> = [
  {
    value: "live_info",
    tab: "Live Information buttons",
    heading: "Live Information buttons",
    blurb:
      "The live-search shortcuts in the chat welcome screen. Hidden in the app whenever Web Search is off or no source is approved.",
    addLabel: "+ Add button",
  },
  {
    value: "suggested_question",
    tab: "Suggested Questions",
    heading: "Suggested Questions",
    blurb:
      "The question list above the buttons. Mix questions that need a live lookup with ones WeSafe answers from its own guidance, so users learn it does both.",
    addLabel: "+ Add question",
  },
];

type UsageSummary = {
  today: number;
  month: number;
  total: number;
  byDay: Array<{ date: string; count: number }>;
};

type SaveKey = "limits" | "prompt" | "triggers";

/* ------------------------------------------------------------------ *
 * Shared styling, matching system-settings-section.tsx
 * ------------------------------------------------------------------ */

const PANEL_CARD =
  "rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6";
const PRIMARY_BUTTON =
  "rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60";
const TOGGLE_ROW =
  "flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]";
const INPUT_CLASS =
  "w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]";
const ROW_CARD =
  "flex flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between";

const DOMAIN_CATEGORIES: Array<{ value: ApprovedDomain["category"]; label: string }> = [
  { value: "civil_protection", label: "Civil protection" },
  { value: "weather", label: "Weather" },
  { value: "official", label: "Official" },
  { value: "other", label: "Other" },
];

const linesToArray = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const arrayToLines = (value: string[] | undefined) => (value ?? []).join("\n");

const emptyDomainForm = {
  domain: "",
  label: "",
  category: "official" as ApprovedDomain["category"],
  order: 0,
  active: true,
};

const emptySuggestionForm = {
  icon: "",
  title: "",
  prompt: "",
  kind: "live_info" as SuggestionKind,
  requiresLocation: false,
  language: "en" as Language,
  order: 0,
  active: true,
};

/* ------------------------------------------------------------------ *
 * Section
 * ------------------------------------------------------------------ */

export function WebSearchSection({ token, notify }: SectionProps) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<SaveKey | null>(null);

  // Settings-backed state
  const [enabled, setEnabled] = useState(true);
  const [freeLimit, setFreeLimit] = useState(2);
  const [premiumLimit, setPremiumLimit] = useState(20);
  const [contextSize, setContextSize] =
    useState<WebSearchSettings["webSearchContextSize"]>("low");
  const [prompt, setPrompt] = useState<LocalizedText>({ en: "", it: "" });
  const [triggers, setTriggers] = useState<LocalizedList>({ en: [], it: [] });

  // Collection-backed state
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [domains, setDomains] = useState<ApprovedDomain[]>([]);
  const [domainMeta, setDomainMeta] = useState({
    activeCount: 0,
    maxAllowed: 20,
    overLimit: false,
  });
  const [suggestions, setSuggestions] = useState<LiveInfoSuggestion[]>([]);
  const [suggestionLanguage, setSuggestionLanguage] = useState<Language | "all">(
    "all"
  );
  const [suggestionKind, setSuggestionKind] =
    useState<SuggestionKind>("live_info");

  // Modals
  const [domainForm, setDomainForm] = useState(emptyDomainForm);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<ApprovedDomain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<ApprovedDomain | null>(null);

  const [suggestionForm, setSuggestionForm] = useState(emptySuggestionForm);
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [editingSuggestion, setEditingSuggestion] =
    useState<LiveInfoSuggestion | null>(null);
  const [deletingSuggestion, setDeletingSuggestion] =
    useState<LiveInfoSuggestion | null>(null);

  const handleError = useCallback(
    (error: unknown, fallback: string) => {
      const message = error instanceof Error ? error.message : fallback;
      notify("error", message);
    },
    [notify]
  );

  const hydrateSettings = useCallback((data: Partial<WebSearchSettings>) => {
    setEnabled(data.webSearchEnabled !== false);
    setFreeLimit(Number(data.webSearchFreeDailyLimit ?? 2));
    setPremiumLimit(Number(data.webSearchPremiumDailyLimit ?? 20));
    setContextSize(data.webSearchContextSize ?? "low");
    setPrompt({
      en: data.webSearchPrompt?.en ?? "",
      it: data.webSearchPrompt?.it ?? "",
    });
    setTriggers({
      en: data.webSearchTriggers?.en ?? [],
      it: data.webSearchTriggers?.it ?? [],
    });
  }, []);

  const loadDomains = useCallback(async () => {
    const data = await apiRequest<ApprovedDomainsResponse>(
      "/admin/approved-domains",
      { token }
    );
    setDomains(data.domains ?? []);
    setDomainMeta({
      activeCount: data.activeCount ?? 0,
      maxAllowed: data.maxAllowed ?? 20,
      overLimit: Boolean(data.overLimit),
    });
  }, [token]);

  const loadSuggestions = useCallback(async () => {
    const data = await apiRequest<LiveInfoSuggestion[]>(
      "/admin/live-info-suggestions",
      { token }
    );
    setSuggestions(data ?? []);
  }, [token]);

  const loadUsage = useCallback(async () => {
    const data = await apiRequest<UsageSummary>("/admin/web-search-usage", {
      token,
    });
    setUsage(data);
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoadingInitial(true);
    setLoadError(null);
    try {
      const [settings] = await Promise.all([
        apiRequest<WebSearchSettings>("/admin/app-settings", { token }),
        loadDomains(),
        loadSuggestions(),
        loadUsage(),
      ]);
      hydrateSettings(settings);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load Web Search settings."
      );
    } finally {
      setLoadingInitial(false);
    }
  }, [token, loadDomains, loadSuggestions, loadUsage, hydrateSettings]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ---- settings saves ---- */

  const patchSettings = async (
    key: SaveKey,
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!token) return;
    setSavingKey(key);
    try {
      const data = await apiRequest<WebSearchSettings>("/admin/app-settings", {
        token,
        method: "PATCH",
        body,
      });
      hydrateSettings(data);
      notify("success", successMessage);
    } catch (error) {
      handleError(error, "Unable to save changes.");
    } finally {
      setSavingKey(null);
    }
  };

  const saveLimits = (event: FormEvent) => {
    event.preventDefault();
    if (!Number.isInteger(freeLimit) || freeLimit < 0) {
      notify("error", "Free daily searches must be a whole number of 0 or more.");
      return;
    }
    if (!Number.isInteger(premiumLimit) || premiumLimit < 0) {
      notify("error", "Premium daily searches must be a whole number of 0 or more.");
      return;
    }
    void patchSettings(
      "limits",
      {
        webSearchEnabled: enabled,
        webSearchFreeDailyLimit: freeLimit,
        webSearchPremiumDailyLimit: premiumLimit,
        webSearchContextSize: contextSize,
      },
      "Web Search settings saved."
    );
  };

  const savePrompt = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.en.trim() || !prompt.it.trim()) {
      notify("error", "The Web Search prompt is required in both languages.");
      return;
    }
    void patchSettings(
      "prompt",
      { webSearchPrompt: { en: prompt.en, it: prompt.it } },
      "Web Search prompt saved."
    );
  };

  const saveTriggers = (event: FormEvent) => {
    event.preventDefault();
    if (triggers.en.length === 0 || triggers.it.length === 0) {
      notify(
        "error",
        "Each language needs at least one trigger, otherwise Web Search never runs for it."
      );
      return;
    }
    void patchSettings(
      "triggers",
      { webSearchTriggers: { en: triggers.en, it: triggers.it } },
      "Trigger keywords saved."
    );
  };

  /* ---- domain CRUD ---- */

  const openCreateDomain = () => {
    setEditingDomain(null);
    setDomainForm({ ...emptyDomainForm, order: domains.length });
    setDomainModalOpen(true);
  };

  const openEditDomain = (domain: ApprovedDomain) => {
    setEditingDomain(domain);
    setDomainForm({
      domain: domain.domain,
      label: domain.label,
      category: domain.category,
      order: domain.order,
      active: domain.active,
    });
    setDomainModalOpen(true);
  };

  const submitDomain = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!domainForm.domain.trim()) {
      notify("error", "Domain is required.");
      return;
    }

    try {
      if (editingDomain) {
        await apiRequest(`/admin/approved-domains/${editingDomain.id}`, {
          token,
          method: "PATCH",
          body: domainForm,
        });
        notify("success", "Approved source updated.");
      } else {
        await apiRequest("/admin/approved-domains", {
          token,
          method: "POST",
          body: domainForm,
        });
        notify("success", "Approved source added.");
      }
      setDomainModalOpen(false);
      setEditingDomain(null);
      await loadDomains();
    } catch (error) {
      handleError(error, "Unable to save the approved source.");
    }
  };

  const toggleDomainActive = async (domain: ApprovedDomain) => {
    if (!token) return;
    try {
      await apiRequest(`/admin/approved-domains/${domain.id}`, {
        token,
        method: "PATCH",
        body: { active: !domain.active },
      });
      await loadDomains();
    } catch (error) {
      handleError(error, "Unable to update the approved source.");
    }
  };

  const confirmDeleteDomain = async () => {
    if (!token || !deletingDomain) return;
    try {
      await apiRequest(`/admin/approved-domains/${deletingDomain.id}`, {
        token,
        method: "DELETE",
      });
      notify("success", "Approved source removed.");
      setDeletingDomain(null);
      await loadDomains();
    } catch (error) {
      handleError(error, "Unable to remove the approved source.");
    }
  };

  /* ---- suggestion CRUD ---- */

  const activeKind = useMemo(
    () =>
      SUGGESTION_KINDS.find((entry) => entry.value === suggestionKind) ??
      SUGGESTION_KINDS[0],
    [suggestionKind]
  );

  // Rows written before `kind` existed are Live Information buttons, so a
  // missing value is read as that rather than dropped from both lists.
  const suggestionsOfKind = useMemo(
    () =>
      suggestions.filter(
        (item) => (item.kind ?? "live_info") === suggestionKind
      ),
    [suggestions, suggestionKind]
  );

  const visibleSuggestions = useMemo(
    () =>
      suggestionLanguage === "all"
        ? suggestionsOfKind
        : suggestionsOfKind.filter(
            (item) => item.language === suggestionLanguage
          ),
    [suggestionsOfKind, suggestionLanguage]
  );

  const openCreateSuggestion = () => {
    setEditingSuggestion(null);
    setSuggestionForm({
      ...emptySuggestionForm,
      kind: suggestionKind,
      language: suggestionLanguage === "all" ? "en" : suggestionLanguage,
      order: visibleSuggestions.length,
    });
    setSuggestionModalOpen(true);
  };

  const openEditSuggestion = (item: LiveInfoSuggestion) => {
    setEditingSuggestion(item);
    setSuggestionForm({
      icon: item.icon,
      title: item.title,
      prompt: item.prompt,
      kind: item.kind ?? "live_info",
      requiresLocation: item.requiresLocation === true,
      language: item.language,
      order: item.order,
      active: item.active,
    });
    setSuggestionModalOpen(true);
  };

  const submitSuggestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!suggestionForm.title.trim() || !suggestionForm.prompt.trim()) {
      notify("error", "Both a title and a prompt are required.");
      return;
    }

    try {
      if (editingSuggestion) {
        await apiRequest(`/admin/live-info-suggestions/${editingSuggestion.id}`, {
          token,
          method: "PATCH",
          body: suggestionForm,
        });
        notify("success", "Saved.");
      } else {
        await apiRequest("/admin/live-info-suggestions", {
          token,
          method: "POST",
          body: suggestionForm,
        });
        notify("success", "Created.");
      }
      setSuggestionModalOpen(false);
      setEditingSuggestion(null);
      await loadSuggestions();
    } catch (error) {
      handleError(error, "Unable to save the shortcut.");
    }
  };

  const toggleSuggestionActive = async (item: LiveInfoSuggestion) => {
    if (!token) return;
    try {
      await apiRequest(`/admin/live-info-suggestions/${item.id}`, {
        token,
        method: "PATCH",
        body: { active: !item.active },
      });
      await loadSuggestions();
    } catch (error) {
      handleError(error, "Unable to update the shortcut.");
    }
  };

  // Reorder by swapping the `order` of two neighbours in the same language,
  // matching how emergency playbooks are reordered.
  const swapSuggestionOrder = async (
    item: LiveInfoSuggestion,
    direction: -1 | 1
  ) => {
    if (!token) return;
    const sameLanguage = suggestions
      .filter(
        (entry) =>
          entry.language === item.language &&
          (entry.kind ?? "live_info") === (item.kind ?? "live_info")
      )
      .sort((a, b) => a.order - b.order);
    const index = sameLanguage.findIndex((entry) => entry.id === item.id);
    const neighbour = sameLanguage[index + direction];
    if (!neighbour) return;

    try {
      await Promise.all([
        apiRequest(`/admin/live-info-suggestions/${item.id}`, {
          token,
          method: "PATCH",
          body: { order: neighbour.order },
        }),
        apiRequest(`/admin/live-info-suggestions/${neighbour.id}`, {
          token,
          method: "PATCH",
          body: { order: item.order },
        }),
      ]);
      await loadSuggestions();
    } catch (error) {
      handleError(error, "Unable to reorder the shortcuts.");
    }
  };

  const confirmDeleteSuggestion = async () => {
    if (!token || !deletingSuggestion) return;
    try {
      await apiRequest(`/admin/live-info-suggestions/${deletingSuggestion.id}`, {
        token,
        method: "DELETE",
      });
      notify("success", "Removed.");
      setDeletingSuggestion(null);
      await loadSuggestions();
    } catch (error) {
      handleError(error, "Unable to remove the shortcut.");
    }
  };

  /* ---- render ---- */

  if (loadingInitial) {
    return (
      <div className={PANEL_CARD}>
        <p className="text-sm text-[var(--muted)]">Loading Web Search settings...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={PANEL_CARD}>
        <p className="text-sm text-[var(--danger)]">{loadError}</p>
        <button type="button" onClick={() => void loadAll()} className={classNames(PRIMARY_BUTTON, "mt-4")}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-[#201a1b]">Web Search</h2>
        <p className="text-sm text-[var(--muted)]">
          WeSafe AI can consult approved official sources when a question needs
          current information. Everything here is live: no app release required.
        </p>
      </header>

      {/* 1. Usage counters */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Searches today"
          value={String(usage?.today ?? 0)}
          tone="red"
          icon="websearch"
        />
        <StatCard
          label="Searches this month"
          value={String(usage?.month ?? 0)}
          tone="blue"
          icon="clock"
        />
        <StatCard
          label="Total searches"
          value={String(usage?.total ?? 0)}
          tone="green"
          icon="published"
        />
      </section>

      {/* 2. Status & limits */}
      <form onSubmit={saveLimits} className={PANEL_CARD}>
        <h3 className="text-lg font-bold text-[#201a1b]">Status and limits</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Each search is billed by OpenAI on top of normal tokens, so these caps
          are the main cost control. Use 0 for unlimited.
        </p>

        <div className="mt-4 space-y-4">
          <label className={TOGGLE_ROW}>
            <span>
              Web Search enabled
              <span className="block text-xs font-normal text-[var(--muted)]">
                Turn off to make every answer use stored knowledge only.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5 accent-[var(--danger)]"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Free users: searches per day"
              type="number"
              value={freeLimit}
              onChange={(value) => setFreeLimit(Number(value))}
            />
            <Field
              label="Premium users: searches per day"
              type="number"
              value={premiumLimit}
              onChange={(value) => setPremiumLimit(Number(value))}
            />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">
              Search depth
            </span>
            <select
              value={contextSize}
              onChange={(event) =>
                setContextSize(
                  event.target.value as WebSearchSettings["webSearchContextSize"]
                )
              }
              className={INPUT_CLASS}
            >
              <option value="low">Low - cheapest, fastest</option>
              <option value="medium">Medium - balanced</option>
              <option value="high">High - most thorough, most expensive</option>
            </select>
          </label>
        </div>

        <button type="submit" disabled={savingKey === "limits"} className={classNames(PRIMARY_BUTTON, "mt-5")}>
          {savingKey === "limits" ? "Saving..." : "Save settings"}
        </button>
      </form>

      {/* 3. Approved sources */}
      <section className={PANEL_CARD}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#201a1b]">Approved sources</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Searches are restricted to these domains. Subdomains are included
              automatically.
            </p>
          </div>
          <button type="button" onClick={openCreateDomain} className={PRIMARY_BUTTON}>
            + Add source
          </button>
        </div>

        {domainMeta.overLimit ? (
          <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {domainMeta.activeCount} sources are active but OpenAI accepts at most{" "}
            {domainMeta.maxAllowed} per search. Only the first{" "}
            {domainMeta.maxAllowed} by order are used - disable some to choose
            which ones apply.
          </p>
        ) : null}

        {domainMeta.activeCount === 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No active sources, so Web Search cannot run. Add at least one source
            to enable live information.
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {domains.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[#ddd0d0] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No approved sources yet.
            </p>
          ) : (
            domains.map((domain) => (
              <div key={domain.id} className={ROW_CARD}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#201a1b]">{domain.domain}</span>
                    <span className="rounded-full bg-[#f3ecec] px-3 py-1 text-xs font-semibold text-[#6b5b5d]">
                      {DOMAIN_CATEGORIES.find((c) => c.value === domain.category)?.label ??
                        domain.category}
                    </span>
                    <span
                      className={classNames(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        domain.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-[#f0e9e9] text-[#7d6f71]"
                      )}
                    >
                      {domain.active ? "active" : "disabled"}
                    </span>
                  </div>
                  {domain.label ? (
                    <p className="mt-1 truncate text-sm text-[var(--muted)]">{domain.label}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#6b5b5d]">
                    <input
                      type="checkbox"
                      checked={domain.active}
                      onChange={() => void toggleDomainActive(domain)}
                      className="h-4 w-4 accent-[var(--danger)]"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => openEditDomain(domain)}
                    className="rounded-full border border-[#ece4e4] p-2 text-[#1771d6] transition hover:border-[#1771d6]"
                    aria-label={`Edit ${domain.domain}`}
                  >
                    <AppIcon name="edit" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingDomain(domain)}
                    className="rounded-full border border-[#ece4e4] p-2 text-[#ef4444] transition hover:border-[#ef4444]"
                    aria-label={`Delete ${domain.domain}`}
                  >
                    <AppIcon name="delete" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Chat welcome screen prompts */}
      <section className={PANEL_CARD}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#201a1b]">
              {activeKind.heading}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {activeKind.blurb} Tapping one sends its prompt as a normal
              message, so the usual limits apply.
            </p>
          </div>
          <button type="button" onClick={openCreateSuggestion} className={PRIMARY_BUTTON}>
            {activeKind.addLabel}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-[#ece4e4] pb-4">
          {SUGGESTION_KINDS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setSuggestionKind(entry.value)}
              className={classNames(
                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                suggestionKind === entry.value
                  ? "border-[#1771d6] bg-[#1771d6] text-white"
                  : "border-[var(--border)] text-[#6b5b5d] hover:border-[#1771d6]"
              )}
            >
              {entry.tab}
              <span className="ml-2 opacity-70">
                {
                  suggestions.filter(
                    (item) => (item.kind ?? "live_info") === entry.value
                  ).length
                }
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {(["all", "en", "it"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSuggestionLanguage(value)}
              className={classNames(
                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                suggestionLanguage === value
                  ? "border-[var(--danger)] bg-[var(--danger)] text-white"
                  : "border-[var(--border)] text-[#6b5b5d] hover:border-[var(--danger)]"
              )}
            >
              {value === "all" ? "All" : value.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {visibleSuggestions.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[#ddd0d0] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Nothing in this list for the selected language yet.
            </p>
          ) : (
            visibleSuggestions
              .slice()
              .sort((a, b) =>
                a.language === b.language
                  ? a.order - b.order
                  : a.language.localeCompare(b.language)
              )
              .map((item) => (
                <div key={item.id} className={ROW_CARD}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.icon ? <span className="text-lg">{item.icon}</span> : null}
                      <span className="font-semibold text-[#201a1b]">{item.title}</span>
                      <span className="rounded-full bg-[#f3ecec] px-3 py-1 text-xs font-semibold text-[#6b5b5d]">
                        {item.language.toUpperCase()}
                      </span>
                      <span
                        className={classNames(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          item.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-[#f0e9e9] text-[#7d6f71]"
                        )}
                      >
                        {item.active ? "active" : "disabled"}
                      </span>
                      {item.requiresLocation ? (
                        <span className="rounded-full bg-[#e7f0fb] px-3 py-1 text-xs font-semibold text-[#12558f]">
                          asks for location
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--muted)]">{item.prompt}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void swapSuggestionOrder(item, -1)}
                      className="rounded-full border border-[#ece4e4] p-2 text-[#6b5b5d] transition hover:border-[var(--danger)]"
                      aria-label={`Move ${item.title} up`}
                    >
                      <AppIcon name="chevron" className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void swapSuggestionOrder(item, 1)}
                      className="rounded-full border border-[#ece4e4] p-2 text-[#6b5b5d] transition hover:border-[var(--danger)]"
                      aria-label={`Move ${item.title} down`}
                    >
                      <AppIcon name="chevron" className="h-4 w-4" />
                    </button>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#6b5b5d]">
                      <input
                        type="checkbox"
                        checked={item.active}
                        onChange={() => void toggleSuggestionActive(item)}
                        className="h-4 w-4 accent-[var(--danger)]"
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => openEditSuggestion(item)}
                      className="rounded-full border border-[#ece4e4] p-2 text-[#1771d6] transition hover:border-[#1771d6]"
                      aria-label={`Edit ${item.title}`}
                    >
                      <AppIcon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSuggestion(item)}
                      className="rounded-full border border-[#ece4e4] p-2 text-[#ef4444] transition hover:border-[#ef4444]"
                      aria-label={`Delete ${item.title}`}
                    >
                      <AppIcon name="delete" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      {/* 5. Web Search prompt */}
      <form onSubmit={savePrompt} className={PANEL_CARD}>
        <h3 className="text-lg font-bold text-[#201a1b]">Web Search prompt</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Controls what WeSafe AI does with live results. It is sent in addition
          to the Free/Premium prompt, so answers combine current information with
          WeSafe safety guidance rather than only reporting what was found.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextAreaField
            label="English"
            rows={14}
            value={prompt.en}
            onChange={(value) => setPrompt((current) => ({ ...current, en: value }))}
          />
          <TextAreaField
            label="Italian"
            rows={14}
            value={prompt.it}
            onChange={(value) => setPrompt((current) => ({ ...current, it: value }))}
          />
        </div>
        <button type="submit" disabled={savingKey === "prompt"} className={classNames(PRIMARY_BUTTON, "mt-5")}>
          {savingKey === "prompt" ? "Saving..." : "Save prompt"}
        </button>
      </form>

      {/* 6. Trigger keywords */}
      <form onSubmit={saveTriggers} className={PANEL_CARD}>
        <h3 className="text-lg font-bold text-[#201a1b]">Trigger keywords</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A search is only ever considered when a message contains one of these.
          Everything else answers from stored knowledge at no extra cost. One per
          line. Multi-word entries match as a phrase.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextAreaField
            label="English"
            rows={12}
            value={arrayToLines(triggers.en)}
            onChange={(value) =>
              setTriggers((current) => ({ ...current, en: linesToArray(value) }))
            }
          />
          <TextAreaField
            label="Italian"
            rows={12}
            value={arrayToLines(triggers.it)}
            onChange={(value) =>
              setTriggers((current) => ({ ...current, it: linesToArray(value) }))
            }
          />
        </div>
        <button type="submit" disabled={savingKey === "triggers"} className={classNames(PRIMARY_BUTTON, "mt-5")}>
          {savingKey === "triggers" ? "Saving..." : "Save triggers"}
        </button>
      </form>

      {/* ---- Modals ---- */}

      <Modal
        open={domainModalOpen}
        title={editingDomain ? "Edit approved source" : "Add approved source"}
        subtitle="Paste a full URL if you like - it is reduced to the bare domain."
        onClose={() => {
          setDomainModalOpen(false);
          setEditingDomain(null);
        }}
      >
        <form onSubmit={submitDomain} className="space-y-4">
          <Field
            label="Domain"
            value={domainForm.domain}
            placeholder="protezionecivile.gov.it"
            onChange={(value) => setDomainForm((f) => ({ ...f, domain: value }))}
          />
          <Field
            label="Label (optional)"
            value={domainForm.label}
            placeholder="Dipartimento della Protezione Civile"
            onChange={(value) => setDomainForm((f) => ({ ...f, label: value }))}
          />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#33292b]">Category</span>
            <select
              value={domainForm.category}
              onChange={(event) =>
                setDomainForm((f) => ({
                  ...f,
                  category: event.target.value as ApprovedDomain["category"],
                }))
              }
              className={INPUT_CLASS}
            >
              {DOMAIN_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Order"
            type="number"
            value={domainForm.order}
            onChange={(value) => setDomainForm((f) => ({ ...f, order: Number(value) }))}
          />
          <label className={TOGGLE_ROW}>
            <span>Active</span>
            <input
              type="checkbox"
              checked={domainForm.active}
              onChange={(event) =>
                setDomainForm((f) => ({ ...f, active: event.target.checked }))
              }
              className="h-5 w-5 accent-[var(--danger)]"
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON}>
            {editingDomain ? "Save changes" : "Add source"}
          </button>
        </form>
      </Modal>

      <Modal
        open={suggestionModalOpen}
        title={`${editingSuggestion ? "Edit" : "Add"} ${
          suggestionForm.kind === "suggested_question"
            ? "suggested question"
            : "Live Information button"
        }`}
        subtitle="A prompt that should reach a live search has to mention current conditions - weather, alerts, earthquakes, updates - or the cost gate will not open it."
        onClose={() => {
          setSuggestionModalOpen(false);
          setEditingSuggestion(null);
        }}
      >
        <form onSubmit={submitSuggestion} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <Field
              label="Icon"
              value={suggestionForm.icon}
              placeholder="🌤"
              onChange={(value) => setSuggestionForm((f) => ({ ...f, icon: value }))}
            />
            <Field
              label="Title"
              value={suggestionForm.title}
              placeholder="Weather in my area"
              onChange={(value) => setSuggestionForm((f) => ({ ...f, title: value }))}
            />
          </div>
          <TextAreaField
            label="Prompt sent to WeSafe AI"
            rows={3}
            value={suggestionForm.prompt}
            onChange={(value) => setSuggestionForm((f) => ({ ...f, prompt: value }))}
          />
          <p className="-mt-2 text-xs text-[var(--muted)]">
            The user only ever sees the title. Write the prompt for the model:
            say what to look for and how to answer. Put{" "}
            <code className="rounded bg-[#f3ecec] px-1 py-0.5 font-mono">
              {"{location}"}
            </code>{" "}
            where the place belongs and the app fills it in.
          </p>
          <label className={TOGGLE_ROW}>
            <span className="pr-4">
              Ask for a location first
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
                Offers current location or another place before sending. Use it
                for weather, alerts and earthquakes; leave it off for questions
                that are not about one place.
              </span>
            </span>
            <input
              type="checkbox"
              checked={suggestionForm.requiresLocation}
              onChange={(event) =>
                setSuggestionForm((f) => ({
                  ...f,
                  requiresLocation: event.target.checked,
                }))
              }
              className="h-5 w-5 shrink-0 accent-[var(--danger)]"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Language</span>
              <select
                value={suggestionForm.language}
                onChange={(event) =>
                  setSuggestionForm((f) => ({
                    ...f,
                    language: event.target.value as Language,
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="en">English</option>
                <option value="it">Italian</option>
              </select>
            </label>
            <Field
              label="Order"
              type="number"
              value={suggestionForm.order}
              onChange={(value) =>
                setSuggestionForm((f) => ({ ...f, order: Number(value) }))
              }
            />
          </div>
          <label className={TOGGLE_ROW}>
            <span>Active</span>
            <input
              type="checkbox"
              checked={suggestionForm.active}
              onChange={(event) =>
                setSuggestionForm((f) => ({ ...f, active: event.target.checked }))
              }
              className="h-5 w-5 accent-[var(--danger)]"
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON}>
            {editingSuggestion ? "Save changes" : "Add"}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(deletingDomain)}
        title="Remove approved source"
        subtitle={`${deletingDomain?.domain ?? ""} will no longer be searched.`}
        onClose={() => setDeletingDomain(null)}
      >
        <div className="flex gap-3">
          <button type="button" onClick={() => void confirmDeleteDomain()} className={PRIMARY_BUTTON}>
            Remove
          </button>
          <button
            type="button"
            onClick={() => setDeletingDomain(null)}
            className="rounded-2xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[#6b5b5d]"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(deletingSuggestion)}
        title="Remove shortcut"
        subtitle={`"${deletingSuggestion?.title ?? ""}" will disappear from the chat.`}
        onClose={() => setDeletingSuggestion(null)}
      >
        <div className="flex gap-3">
          <button type="button" onClick={() => void confirmDeleteSuggestion()} className={PRIMARY_BUTTON}>
            Remove
          </button>
          <button
            type="button"
            onClick={() => setDeletingSuggestion(null)}
            className="rounded-2xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[#6b5b5d]"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
