"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthMode = "login" | "forgot" | "otp" | "reset";
type Section = "dashboard" | "prompt" | "checklists" | "tips" | "settings";
type ToastState = { kind: "success" | "error"; message: string } | null;

type DashboardData = {
  summary: {
    totalUsers: number;
    totalChecklists: number;
    totalSafetyTips: number;
    totalChats: number;
    publishedSafetyTips: number;
  };
  recentActivity: ActivityItem[];
  aiPrompt: PromptForm | null;
  templatesPreview: Array<{
    id: string;
    title: string;
    status: string;
    itemCount: number;
    updatedAt: string;
  }>;
};

type PromptForm = {
  welcomeMessage: string;
  systemInstruction: string;
  fallbackMessage: string;
};

type ActivityItem = {
  id: string;
  type: string;
  actorId: string;
  title: string;
  description: string;
  createdAt: string;
};

type AdminProfile = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatarUrl: string;
};

type ChecklistRecord = {
  id: string;
  title: string;
  category: string;
  description: string;
  iconUrl: string;
  coverImageUrl: string;
  status: string;
  items: Array<{ id: string; text: string; order: number }>;
  updatedAt: string;
};

type SafetyTipRecord = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  status: string;
  language: string;
  featured: boolean;
  estimatedReadMinutes: number;
  coverImageUrl: string;
  thumbnailUrl: string;
  contentSections: Array<{ heading: string; body: string }>;
  doList: string[];
  dontList: string[];
  tags: string[];
  updatedAt: string;
};

type ChecklistFormState = {
  id?: string;
  title: string;
  category: string;
  description: string;
  status: string;
  iconUrl: string;
  coverImageUrl: string;
  items: Array<{ id: string; text: string }>;
};

type SafetyTipFormState = {
  id?: string;
  title: string;
  category: string;
  summary: string;
  status: string;
  language: string;
  featured: boolean;
  estimatedReadMinutes: number;
  coverImageUrl: string;
  thumbnailUrl: string;
  contentSections: Array<{ heading: string; body: string }>;
  doList: string[];
  dontList: string[];
  tags: string[];
};

type ApiErrorShape = Error & { status?: number };

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

const navItems: Array<{ id: Section; label: string; eyebrow: string }> = [
  { id: "dashboard", label: "Dashboard", eyebrow: "Overview" },
  { id: "prompt", label: "Chat bot prompts", eyebrow: "AI" },
  { id: "checklists", label: "Checklists", eyebrow: "Preparedness" },
  { id: "tips", label: "Safety tips", eyebrow: "Guides" },
  { id: "settings", label: "Settings", eyebrow: "Profile" },
];

const emptyChecklistForm = (): ChecklistFormState => ({
  title: "",
  category: "General",
  description: "",
  status: "published",
  iconUrl: "",
  coverImageUrl: "",
  items: [{ id: crypto.randomUUID(), text: "" }],
});

const emptySafetyTipForm = (): SafetyTipFormState => ({
  title: "",
  category: "General",
  summary: "",
  status: "published",
  language: "en",
  featured: false,
  estimatedReadMinutes: 4,
  coverImageUrl: "",
  thumbnailUrl: "",
  contentSections: [{ heading: "Overview", body: "" }],
  doList: [""],
  dontList: [""],
  tags: [""],
});

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const formatRelativeTime = (value: string) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

function AppIcon({
  name,
  className,
}: {
  name:
    | "dashboard"
    | "prompt"
    | "checklists"
    | "tips"
    | "settings"
    | "logout"
    | "edit"
    | "delete"
    | "clock"
    | "chevron"
    | "users"
    | "published";
  className?: string;
}) {
  const sharedProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...sharedProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "prompt":
      return (
        <svg {...sharedProps}>
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
          <path d="M8.5 8.5h7" />
          <path d="M8.5 11.5h4.5" />
        </svg>
      );
    case "checklists":
      return (
        <svg {...sharedProps}>
          <path d="M9 4h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M8 7H5" />
          <path d="m4 7 .8.8L6.5 6" />
          <path d="M8 12H5" />
          <path d="m4 12 .8.8L6.5 11" />
          <path d="M8 17H5" />
          <path d="m4 17 .8.8L6.5 16" />
        </svg>
      );
    case "tips":
      return (
        <svg {...sharedProps}>
          <path d="M12 3a6 6 0 0 1 3.72 10.71c-.92.74-1.47 1.44-1.66 2.29h-4.12c-.19-.85-.74-1.55-1.66-2.29A6 6 0 0 1 12 3Z" />
          <path d="M10 19h4" />
          <path d="M10.5 22h3" />
        </svg>
      );
    case "settings":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1 1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1-1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.4a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1 1 0 0 1 1 1v1.4a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.7Z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...sharedProps}>
          <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H4" />
        </svg>
      );
    case "edit":
      return (
        <svg {...sharedProps}>
          <path d="M3 21h6" />
          <path d="M14.7 5.3a2.1 2.1 0 1 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      );
    case "delete":
      return (
        <svg {...sharedProps}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...sharedProps}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "users":
      return (
        <svg {...sharedProps}>
          <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 19.5V21" />
          <circle cx="10.5" cy="8" r="3.5" />
          <path d="M17 11a3 3 0 1 0 0-6" />
          <path d="M19 21v-1a3 3 0 0 0-2-2.82" />
        </svg>
      );
    case "published":
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
        </svg>
      );
  }
}

function BrandMark() {
  return (
    <div className="inline-flex items-end gap-1 text-[#1d1718]">
      <span className="text-[17px] font-black tracking-[0.12em]">WE</span>
      <svg
        viewBox="0 0 52 18"
        className="h-[18px] w-[52px] text-[var(--danger)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 10h10l3-7 5 13 4-9h8l3-4 3 7h14" />
      </svg>
      <span className="text-[17px] font-black tracking-[0.12em]">SAFE</span>
    </div>
  );
}

async function apiRequest<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
    isFormData = false,
  }: {
    token?: string | null;
    method?: string;
    body?: unknown;
    isFormData?: boolean;
  } = {}
): Promise<T> {
  const headers = new Headers();

  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as BodyInit) : body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Request failed") as ApiErrorShape;
    error.status = response.status;
    throw error;
  }

  return payload?.data as T;
}

async function uploadAsset(
  file: File,
  folder: string,
  token: string | null
): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);

  const data = await apiRequest<{ secure_url: string }>("/uploads", {
    token,
    method: "POST",
    body: formData,
    isFormData: true,
  });

  return data.secure_url;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#33292b]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={classNames(
          "rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]",
          readOnly && "cursor-not-allowed bg-[#f5efef] text-[var(--muted)]"
        )}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#33292b]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
      />
    </label>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
      <div className="scrollbar-thin max-h-full w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/50 bg-[var(--panel)] shadow-[var(--shadow)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--panel)] px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-[#201a1b]">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            Close
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "published"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold", tone)}>
      {value}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "red" | "blue" | "rose" | "green";
  icon: "checklists" | "tips" | "prompt" | "published";
}) {
  const toneMap = {
    red: {
      border: "border-b-[#de3232]",
      bubble: "bg-[#de3232]",
    },
    blue: {
      border: "border-b-[#166ec8]",
      bubble: "bg-[#166ec8]",
    },
    rose: {
      border: "border-b-[#ff8e8e]",
      bubble: "bg-[#ff8e8e]",
    },
    green: {
      border: "border-b-[#148a45]",
      bubble: "bg-[#148a45]",
    },
  }[tone];

  return (
    <div
      className={classNames(
        "rounded-[12px] border border-[#ece4e4] border-b-[3px] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(22,18,18,0.06)]",
        toneMap.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[1.75rem] font-semibold leading-none text-[#252022]">{value}</p>
          <p className="mt-4 text-sm font-medium text-[#322b2d]">{label}</p>
        </div>
        <div
          className={classNames(
            "grid h-9 w-9 place-items-center rounded-full text-white shadow-[0_10px_20px_rgba(0,0,0,0.08)]",
            toneMap.bubble
          )}
        >
          <AppIcon name={icon} className="h-[18px] w-[18px]" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardApp() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [loginForm, setLoginForm] = useState({
    email: "admin@wesafe.app",
    password: "Admin123!",
  });
  const [forgotEmail, setForgotEmail] = useState("admin@wesafe.app");
  const [otpCode, setOtpCode] = useState("");
  const [resetContext, setResetContext] = useState({
    debugOtp: "",
    resetToken: "",
  });
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [promptForm, setPromptForm] = useState<PromptForm>({
    welcomeMessage: "",
    systemInstruction: "",
    fallbackMessage: "",
  });
  const [checklists, setChecklists] = useState<ChecklistRecord[]>([]);
  const [safetyTips, setSafetyTips] = useState<SafetyTipRecord[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [checklistSearch, setChecklistSearch] = useState("");
  const [tipSearch, setTipSearch] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [safetyTipModalOpen, setSafetyTipModalOpen] = useState(false);
  const [checklistForm, setChecklistForm] = useState<ChecklistFormState>(
    emptyChecklistForm()
  );
  const [safetyTipForm, setSafetyTipForm] = useState<SafetyTipFormState>(
    emptySafetyTipForm()
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    kind: "logout" | "checklist" | "tip" | null;
    id?: string;
    label?: string;
  }>({ kind: null });

  useEffect(() => {
    const savedToken = window.localStorage.getItem("wesafe-admin-token");
    if (savedToken) {
      setToken(savedToken);
    }
    setBooting(false);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleLogout = (showToast = true) => {
    window.localStorage.removeItem("wesafe-admin-token");
    setToken(null);
    setDashboard(null);
    setChecklists([]);
    setSafetyTips([]);
    setActivity([]);
    setAdminProfile(null);
    setActiveSection("dashboard");
    setAuthMode("login");
    setConfirmDialog({ kind: null });
    if (showToast) {
      setToast({ kind: "success", message: "Logged out successfully." });
    }
  };

  const handleRequestError = (error: unknown) => {
    const typedError = error as ApiErrorShape;
    if (typedError?.status === 401) {
      handleLogout(false);
    }
    setToast({
      kind: "error",
      message: typedError.message || "Request failed",
    });
  };

  const refreshAll = async (currentToken = token) => {
    if (!currentToken) {
      return;
    }

    setRefreshing(true);

    try {
      const [
        dashboardData,
        promptData,
        checklistData,
        safetyTipData,
        settingsData,
        activityData,
      ] = await Promise.all([
        apiRequest<DashboardData>("/admin/dashboard", { token: currentToken }),
        apiRequest<PromptForm>("/admin/ai-prompt", { token: currentToken }),
        apiRequest<ChecklistRecord[]>("/admin/checklists", { token: currentToken }),
        apiRequest<SafetyTipRecord[]>("/admin/safety-tips", { token: currentToken }),
        apiRequest<AdminProfile>("/admin/settings", { token: currentToken }),
        apiRequest<ActivityItem[]>("/admin/activity", { token: currentToken }),
      ]);

      setDashboard(dashboardData);
      setPromptForm(promptData);
      setChecklists(checklistData);
      setSafetyTips(safetyTipData);
      setAdminProfile(settingsData);
      setActivity(activityData);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshAll(token);
  }, [token]);

  const filteredChecklists = useMemo(() => {
    const query = checklistSearch.trim().toLowerCase();
    if (!query) {
      return checklists;
    }
    return checklists.filter((item) =>
      [item.title, item.category, item.description].join(" ").toLowerCase().includes(query)
    );
  }, [checklists, checklistSearch]);

  const filteredTips = useMemo(() => {
    const query = tipSearch.trim().toLowerCase();
    if (!query) {
      return safetyTips;
    }
    return safetyTips.filter((item) =>
      [item.title, item.category, item.summary].join(" ").toLowerCase().includes(query)
    );
  }, [safetyTips, tipSearch]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await apiRequest<{
        accessToken: string;
        user: AdminProfile;
      }>("/auth/admin/login", {
        method: "POST",
        body: loginForm,
      });

      window.localStorage.setItem("wesafe-admin-token", data.accessToken);
      setToken(data.accessToken);
      setAdminProfile(data.user);
      setToast({ kind: "success", message: "Admin login successful." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await apiRequest<{ debugOtp?: string }>("/auth/admin/password-reset/request", {
        method: "POST",
        body: { email: forgotEmail },
      });

      setResetContext({
        debugOtp: data.debugOtp || "",
        resetToken: "",
      });
      setOtpCode(data.debugOtp || "");
      setAuthMode("otp");
      setToast({ kind: "success", message: "OTP generated successfully." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await apiRequest<{ resetToken: string }>(
        "/auth/admin/password-reset/verify",
        {
          method: "POST",
          body: { email: forgotEmail, otpCode },
        }
      );

      setResetContext((current) => ({
        ...current,
        resetToken: data.resetToken,
      }));
      setAuthMode("reset");
      setToast({ kind: "success", message: "OTP verified successfully." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      await apiRequest("/auth/admin/password-reset/reset", {
        method: "POST",
        body: {
          email: forgotEmail,
          resetToken: resetContext.resetToken,
          password: resetForm.password,
          confirmPassword: resetForm.confirmPassword,
        },
      });

      setAuthMode("login");
      setResetForm({ password: "", confirmPassword: "" });
      setToast({ kind: "success", message: "Password reset complete. Sign in now." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const openChecklistModal = (record?: ChecklistRecord) => {
    if (record) {
      setChecklistForm({
        id: record.id,
        title: record.title,
        category: record.category,
        description: record.description,
        status: record.status,
        iconUrl: record.iconUrl,
        coverImageUrl: record.coverImageUrl,
        items: record.items.map((item) => ({ id: item.id, text: item.text })),
      });
    } else {
      setChecklistForm(emptyChecklistForm());
    }

    setChecklistModalOpen(true);
  };

  const openSafetyTipModal = (record?: SafetyTipRecord) => {
    if (record) {
      setSafetyTipForm({
        id: record.id,
        title: record.title,
        category: record.category,
        summary: record.summary,
        status: record.status,
        language: record.language,
        featured: record.featured,
        estimatedReadMinutes: record.estimatedReadMinutes,
        coverImageUrl: record.coverImageUrl,
        thumbnailUrl: record.thumbnailUrl,
        contentSections:
          record.contentSections.length > 0
            ? record.contentSections
            : [{ heading: "Overview", body: "" }],
        doList: record.doList.length > 0 ? record.doList : [""],
        dontList: record.dontList.length > 0 ? record.dontList : [""],
        tags: record.tags.length > 0 ? record.tags : [""],
      });
    } else {
      setSafetyTipForm(emptySafetyTipForm());
    }

    setSafetyTipModalOpen(true);
  };

  const saveChecklist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);

    try {
      const body = {
        title: checklistForm.title,
        category: checklistForm.category,
        description: checklistForm.description,
        status: checklistForm.status,
        iconUrl: checklistForm.iconUrl,
        coverImageUrl: checklistForm.coverImageUrl,
        items: checklistForm.items
          .map((item, index) => ({
            id: item.id,
            text: item.text,
            order: index + 1,
          }))
          .filter((item) => item.text.trim()),
      };

      if (checklistForm.id) {
        await apiRequest(`/admin/checklists/${checklistForm.id}`, {
          token,
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/admin/checklists", {
          token,
          method: "POST",
          body,
        });
      }

      setChecklistModalOpen(false);
      setToast({
        kind: "success",
        message: checklistForm.id ? "Checklist updated." : "Checklist created.",
      });
      await refreshAll(token);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const saveSafetyTip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);

    try {
      const body = {
        title: safetyTipForm.title,
        category: safetyTipForm.category,
        summary: safetyTipForm.summary,
        status: safetyTipForm.status,
        language: safetyTipForm.language,
        featured: safetyTipForm.featured,
        estimatedReadMinutes: Number(safetyTipForm.estimatedReadMinutes),
        coverImageUrl: safetyTipForm.coverImageUrl,
        thumbnailUrl: safetyTipForm.thumbnailUrl,
        contentSections: safetyTipForm.contentSections.filter(
          (section) => section.heading.trim() || section.body.trim()
        ),
        doList: safetyTipForm.doList.filter((item) => item.trim()),
        dontList: safetyTipForm.dontList.filter((item) => item.trim()),
        tags: safetyTipForm.tags.filter((item) => item.trim()),
      };

      if (safetyTipForm.id) {
        await apiRequest(`/admin/safety-tips/${safetyTipForm.id}`, {
          token,
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/admin/safety-tips", {
          token,
          method: "POST",
          body,
        });
      }

      setSafetyTipModalOpen(false);
      setToast({
        kind: "success",
        message: safetyTipForm.id ? "Safety tip updated." : "Safety tip created.",
      });
      await refreshAll(token);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmCurrentAction = async () => {
    if (!token || !confirmDialog.kind) {
      setConfirmDialog({ kind: null });
      return;
    }

    setLoading(true);

    try {
      if (confirmDialog.kind === "logout") {
        handleLogout();
        return;
      }

      if (confirmDialog.kind === "checklist" && confirmDialog.id) {
        await apiRequest(`/admin/checklists/${confirmDialog.id}`, {
          token,
          method: "DELETE",
        });
        setToast({ kind: "success", message: "Checklist deleted." });
      }

      if (confirmDialog.kind === "tip" && confirmDialog.id) {
        await apiRequest(`/admin/safety-tips/${confirmDialog.id}`, {
          token,
          method: "DELETE",
        });
        setToast({ kind: "success", message: "Safety tip deleted." });
      }

      setConfirmDialog({ kind: null });
      await refreshAll(token);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);

    try {
      const data = await apiRequest<PromptForm>("/admin/ai-prompt", {
        token,
        method: "PATCH",
        body: promptForm,
      });
      setPromptForm(data);
      setToast({ kind: "success", message: "Prompt updated." });
      await refreshAll(token);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !adminProfile) return;
    setLoading(true);

    try {
      const data = await apiRequest<AdminProfile>("/admin/settings", {
        token,
        method: "PATCH",
        body: {
          firstName: adminProfile.firstName,
          lastName: adminProfile.lastName,
          phoneNumber: adminProfile.phoneNumber,
          avatarUrl: adminProfile.avatarUrl,
        },
      });
      setAdminProfile(data);
      setToast({ kind: "success", message: "Settings updated." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    folder: string,
    scope: "checklist" | "tip" | "profile",
    field: "iconUrl" | "coverImageUrl" | "thumbnailUrl" | "avatarUrl"
  ) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setLoading(true);
    try {
      const secureUrl = await uploadAsset(file, folder, token);

      if (scope === "checklist") {
        setChecklistForm((current) => ({ ...current, [field]: secureUrl }));
      } else if (scope === "profile") {
        setAdminProfile((current) =>
          current ? { ...current, avatarUrl: secureUrl } : current
        );
      } else {
        setSafetyTipForm((current) => ({ ...current, [field]: secureUrl }));
      }

      setToast({ kind: "success", message: "Media uploaded successfully." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      event.target.value = "";
      setLoading(false);
    }
  };

  const renderAuthPanel = () => {
    if (authMode === "login") {
      return (
        <form onSubmit={handleLogin} className="space-y-5">
          <Field
            label="Email Address"
            value={loginForm.email}
            onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))}
          />
          <Field
            label="Password"
            type="password"
            value={loginForm.password}
            onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
          />
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>Use the seeded admin account to start.</span>
            <button
              type="button"
              onClick={() => {
                setForgotEmail(loginForm.email);
                setAuthMode("forgot");
              }}
              className="font-semibold text-[var(--danger)]"
            >
              Forgot Password
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--danger)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      );
    }

    if (authMode === "forgot") {
      return (
        <form onSubmit={handleForgotRequest} className="space-y-5">
          <Field
            label="Admin Email"
            value={forgotEmail}
            onChange={setForgotEmail}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--danger)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--danger-deep)]"
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("login")}
            className="w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--muted)]"
          >
            Back to login
          </button>
        </form>
      );
    }

    if (authMode === "otp") {
      return (
        <form onSubmit={handleOtpVerify} className="space-y-5">
          <Field label="Enter OTP" value={otpCode} onChange={setOtpCode} />
          {resetContext.debugOtp ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--muted)]">
              Debug OTP: <span className="font-mono font-semibold">{resetContext.debugOtp}</span>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--danger)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--danger-deep)]"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      );
    }

    return (
      <form onSubmit={handlePasswordReset} className="space-y-5">
        <Field
          label="New Password"
          type="password"
          value={resetForm.password}
          onChange={(value) => setResetForm((current) => ({ ...current, password: value }))}
        />
        <Field
          label="Confirm Password"
          type="password"
          value={resetForm.confirmPassword}
          onChange={(value) =>
            setResetForm((current) => ({ ...current, confirmPassword: value }))
          }
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[var(--danger)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--danger-deep)]"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    );
  };

  const renderDashboardSection = () => {
    if (!dashboard) {
      return null;
    }

    const visibleActivity = showAllActivity ? activity : activity.slice(0, 5);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Welcome back to your admin panel
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Checklists"
            value={String(dashboard.summary.totalChecklists)}
            tone="red"
            icon="checklists"
          />
          <StatCard
            label="Safety Tips"
            value={String(dashboard.summary.totalSafetyTips)}
            tone="blue"
            icon="tips"
          />
          <StatCard
            label="Recently Updated"
            value={String(activity.length)}
            tone="rose"
            icon="prompt"
          />
          <StatCard
            label="Published Items"
            value={String(dashboard.summary.publishedSafetyTips)}
            tone="green"
            icon="published"
          />
        </div>

        <section className="rounded-[14px] border border-[#f0e7e7] bg-[#fffafa] p-4 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-[#241d1f]">
              Recent Activity
            </h3>
            {activity.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllActivity((current) => !current)}
                className="text-lg font-semibold text-[#0f67d8] transition hover:text-[#0b58bb]"
              >
                {showAllActivity ? "Show Less" : "See All"}
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {visibleActivity.map((item) => {
              const iconName = item.type.includes("checklist")
                ? "checklists"
                : item.type.includes("guide")
                  ? "tips"
                  : "prompt";

              return (
                <div
                  key={item.id}
                  className="rounded-[10px] border border-[#ebe4e4] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(22,18,18,0.02)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#ffd6d6] bg-[#fff3f3] text-[var(--danger)]">
                      <AppIcon name={iconName} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                        {item.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[#6c6567]">
                        <AppIcon name="clock" className="h-4 w-4" />
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  const renderPromptSection = () => (
    <form onSubmit={savePrompt} className="space-y-6">
      <div className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_18px_40px_rgba(26,18,18,0.06)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
              Live AI configuration
            </p>
            <h3 className="mt-2 text-xl font-bold text-[#201a1b]">
              Chat bot modification
            </h3>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)]"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
        <div className="grid gap-5">
          <TextAreaField
            label="Welcome message"
            value={promptForm.welcomeMessage}
            onChange={(value) =>
              setPromptForm((current) => ({ ...current, welcomeMessage: value }))
            }
            rows={4}
          />
          <TextAreaField
            label="System instruction"
            value={promptForm.systemInstruction}
            onChange={(value) =>
              setPromptForm((current) => ({ ...current, systemInstruction: value }))
            }
            rows={10}
          />
          <TextAreaField
            label="Fallback response"
            value={promptForm.fallbackMessage}
            onChange={(value) =>
              setPromptForm((current) => ({ ...current, fallbackMessage: value }))
            }
            rows={4}
          />
        </div>
      </div>
    </form>
  );

  const renderChecklistsSection = () => (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Checklists
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Create and manage emergency preparedness checklists
          </p>
        </div>
        <button
          type="button"
          onClick={() => openChecklistModal()}
          className="inline-flex items-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)]"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Checklist</span>
        </button>
      </div>
      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="space-y-2">
          {filteredChecklists.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4"
            >
              <div className="shrink-0 text-[var(--danger)]">
                <AppIcon name="chevron" className="h-4 w-4" />
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f5dede] bg-[#fff5f5]">
                {item.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.iconUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AppIcon name="checklists" className="h-4 w-4 text-[var(--danger)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-[#6b6467]">{item.items.length} Items</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openChecklistModal(item)}
                  className="text-[#1771d6] transition hover:text-[#0f5eb6]"
                >
                  <AppIcon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      kind: "checklist",
                      id: item.id,
                      label: item.title,
                    })
                  }
                  className="text-[#ef4444] transition hover:text-[#d72d2d]"
                >
                  <AppIcon name="delete" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredChecklists.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              No checklist matches the current filter.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );

  const renderTipsSection = () => (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Safety Tips
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Manage guide content, visibility, and publishing state
          </p>
        </div>
        <button
          type="button"
          onClick={() => openSafetyTipModal()}
          className="inline-flex items-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)]"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Safety Tip</span>
        </button>
      </div>
      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="space-y-2">
          {filteredTips.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4"
            >
              <div className="shrink-0 text-[var(--danger)]">
                <AppIcon name="chevron" className="h-4 w-4" />
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f5dede] bg-[#fff5f5]">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AppIcon name="tips" className="h-4 w-4 text-[var(--danger)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6b6467]">
                  <span>{item.category}</span>
                  <span className="text-[#b8b1b4]">•</span>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              </div>
              <StatusBadge value={item.status} />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openSafetyTipModal(item)}
                  className="text-[#1771d6] transition hover:text-[#0f5eb6]"
                >
                  <AppIcon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      kind: "tip",
                      id: item.id,
                      label: item.title,
                    })
                  }
                  className="text-[#ef4444] transition hover:text-[#d72d2d]"
                >
                  <AppIcon name="delete" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredTips.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              No guide matches the current filter.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );

  const renderSettingsSection = () => {
    if (!adminProfile) {
      return null;
    }

    return (
      <form onSubmit={saveSettings} className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_18px_40px_rgba(26,18,18,0.06)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
            Profile
          </p>
          <div className="mt-5 flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-[var(--danger-soft)] text-2xl font-bold text-[var(--danger)]">
              {adminProfile.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xl font-bold text-[#201a1b]">{adminProfile.fullName}</p>
              <p className="text-sm text-[var(--muted)]">{adminProfile.email}</p>
            </div>
          </div>
        </div>
        <div className="space-y-5 rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_18px_40px_rgba(26,18,18,0.06)]">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="First name"
              value={adminProfile.firstName}
              onChange={(value) =>
                setAdminProfile((current) =>
                  current
                    ? {
                        ...current,
                        firstName: value,
                        fullName: `${value} ${current.lastName}`.trim(),
                      }
                    : current
                )
              }
            />
            <Field
              label="Last name"
              value={adminProfile.lastName}
              onChange={(value) =>
                setAdminProfile((current) =>
                  current
                    ? {
                        ...current,
                        lastName: value,
                        fullName: `${current.firstName} ${value}`.trim(),
                      }
                    : current
                )
              }
            />
          </div>
          <Field
            label="Email"
            value={adminProfile.email}
            onChange={() => undefined}
            readOnly
          />
          <Field
            label="Phone number"
            value={adminProfile.phoneNumber}
            onChange={(value) =>
              setAdminProfile((current) =>
                current ? { ...current, phoneNumber: value } : current
              )
            }
          />
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--panel-muted)] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#201a1b]">Profile image</p>
                <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                  Upload the avatar directly using form-data. Manual URL entry is disabled.
                </p>
              </div>
              <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]">
                {adminProfile.avatarUrl ? "Replace avatar" : "Upload avatar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    void handleMediaUpload(event, "admin-profile", "profile", "avatarUrl")
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#eadede] bg-white">
                {adminProfile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={adminProfile.avatarUrl}
                    alt={adminProfile.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-[var(--danger)]">
                    {adminProfile.fullName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {adminProfile.avatarUrl
                  ? "Avatar uploaded successfully."
                  : "No avatar uploaded yet."}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    );
  };

  const sectionMeta: Record<
    Section,
    { eyebrow: string; title: string; description: string }
  > = {
    dashboard: {
      eyebrow: "Dashboard",
      title: "Dashboard",
      description: "Welcome back to your admin panel",
    },
    prompt: {
      eyebrow: "Chat bot prompts",
      title: "Chat bot prompts",
      description: "Update the live assistant prompt and sync changes to the AI service.",
    },
    checklists: {
      eyebrow: "Checklists",
      title: "Checklists",
      description: "Create and manage emergency preparedness checklists",
    },
    tips: {
      eyebrow: "Safety Tips",
      title: "Safety Tips",
      description: "Create and manage published safety guides",
    },
    settings: {
      eyebrow: "Settings",
      title: "Settings",
      description: "Manage your admin profile and account details",
    },
  };

  const currentSection = sectionMeta[activeSection];

  const renderActiveSection = () => {
    switch (activeSection) {
      case "prompt":
        return renderPromptSection();
      case "checklists":
        return renderChecklistsSection();
      case "tips":
        return renderTipsSection();
      case "settings":
        return renderSettingsSection();
      default:
        return renderDashboardSection();
    }
  };

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#67615d,_#4a4948_58%)] p-6 text-white">
        <div className="rounded-[28px] border border-white/15 bg-white/10 px-8 py-6 text-center backdrop-blur">
          Loading admin dashboard...
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#67615d,_#4a4948_58%)] p-4">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/20 bg-[var(--panel)] shadow-[var(--shadow)] lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden flex-col justify-between bg-[linear-gradient(160deg,_#d82b2b,_#991b1f)] p-10 text-white lg:flex">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/70">
                We Safe Admin
              </p>
              <h1 className="mt-6 text-5xl font-bold leading-tight">
                Manage emergency content with one focused control room.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/80">
                Review dashboard health, edit the live AI prompt, publish safety tips,
                and curate checklists the mobile app can use immediately.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                "Secure prompt control",
                "Checklist publishing",
                "Guide moderation",
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-[22px] border border-white/20 bg-white/10 p-4 text-sm"
                >
                  {label}
                </div>
              ))}
            </div>
          </section>
          <section className="flex flex-col justify-center bg-[var(--panel)] px-6 py-10 sm:px-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--danger)]">
                  Admin_flow
                </p>
                <h2 className="mt-4 text-3xl font-bold text-[#201a1b]">
                  {authMode === "login" && "Login to your account"}
                  {authMode === "forgot" && "Reset password"}
                  {authMode === "otp" && "Enter OTP"}
                  {authMode === "reset" && "Choose a new password"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {authMode === "login" &&
                    "Use the seeded admin credentials or your own Mongo-backed account."}
                  {authMode === "forgot" &&
                    "Request an OTP for the admin account email."}
                  {authMode === "otp" &&
                    "Verify the one-time password before setting a new password."}
                  {authMode === "reset" &&
                    "Save the new admin password and return to the login screen."}
                </p>
              </div>
              {renderAuthPanel()}
            </div>
          </section>
        </div>
        {toast ? (
          <div
            className={classNames(
              "fixed bottom-6 right-6 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg",
              toast.kind === "success" ? "bg-emerald-600" : "bg-[var(--danger)]"
            )}
          >
            {toast.message}
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fcf8f8] text-[#201a1b]">
      <div className="min-h-screen overflow-hidden bg-white lg:flex">
          <aside className="flex w-full flex-col border-b border-[#f1e9e9] bg-white lg:min-h-screen lg:w-[230px] lg:border-b-0 lg:border-r">
            <div className="px-8 py-5">
              <BrandMark />
            </div>

            <nav className="flex-1 space-y-1 px-4 py-3">
              {navItems.map((item) => {
                const active = item.id === activeSection;
                const iconName =
                  item.id === "dashboard"
                    ? "dashboard"
                    : item.id === "prompt"
                      ? "prompt"
                      : item.id === "checklists"
                        ? "checklists"
                        : item.id === "tips"
                          ? "tips"
                          : "settings";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={classNames(
                      "flex w-full items-center gap-3 rounded-[4px] px-3 py-3 text-left text-sm font-medium transition",
                      active
                        ? "bg-[var(--danger)] text-white"
                        : "text-[#2b2526] hover:bg-[#faf4f4]"
                    )}
                  >
                    <AppIcon name={iconName} className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="px-4 py-5">
              <button
                type="button"
                onClick={() => setConfirmDialog({ kind: "logout" })}
                className="flex items-center gap-2 text-sm font-medium text-[#2c2627] transition hover:text-[var(--danger)]"
              >
                <AppIcon name="logout" className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>

          <section className="flex-1 bg-[#fcf8f8]">
            <header className="flex items-center justify-end border-b border-[#f1e9e9] bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                className="mr-3 rounded-full border border-[#ece2e2] px-3 py-1.5 text-xs font-semibold text-[#6c6668] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <div className="flex items-center gap-2 rounded-full pl-1 pr-2">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#ebe2e2] bg-[#fff3f3] text-xs font-bold text-[#201a1b]">
                  {adminProfile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={adminProfile.avatarUrl}
                      alt={adminProfile.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (adminProfile?.fullName || "AD").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#231d1f]">
                    {adminProfile?.firstName || "Admin"}
                  </p>
                  <p className="text-xs text-[#6d6668]">@Admin</p>
                </div>
              </div>
            </header>

            <div className="px-4 py-4 sm:px-6 sm:py-5">
              {renderActiveSection() || (
                <div className="rounded-[14px] border border-[#ece2e2] bg-white px-6 py-14 text-center text-sm text-[#726b6d] shadow-[0_10px_24px_rgba(22,18,18,0.04)]">
                  {refreshing ? "Loading live admin data..." : "No data available yet."}
                </div>
              )}
            </div>
          </section>
        </div>

      <Modal
        open={checklistModalOpen}
        title={checklistForm.id ? "Edit checklist" : "Create checklist"}
        subtitle="Manage checklist metadata, cover assets, and ordered steps for the mobile app."
        onClose={() => setChecklistModalOpen(false)}
      >
        <form onSubmit={saveChecklist} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Checklist title"
              value={checklistForm.title}
              onChange={(value) =>
                setChecklistForm((current) => ({ ...current, title: value }))
              }
              placeholder="Earthquake emergency"
            />
            <Field
              label="Category"
              value={checklistForm.category}
              onChange={(value) =>
                setChecklistForm((current) => ({ ...current, category: value }))
              }
              placeholder="Emergency"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-[0.6fr_1.4fr]">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Status</span>
              <select
                value={checklistForm.status}
                onChange={(event) =>
                  setChecklistForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>

            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] p-4">
              <p className="text-sm font-semibold text-[#201a1b]">Upload checklist media</p>
              <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                Upload icon and cover assets directly using form-data. Manual URL entry is disabled.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]">
                  {checklistForm.iconUrl ? "Replace icon" : "Upload icon"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      void handleMediaUpload(event, "checklists", "checklist", "iconUrl")
                    }
                  />
                </label>
                <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]">
                  {checklistForm.coverImageUrl ? "Replace cover" : "Upload cover"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      void handleMediaUpload(
                        event,
                        "checklists",
                        "checklist",
                        "coverImageUrl"
                      )
                    }
                  />
                </label>
              </div>
            </div>
          </div>

          <TextAreaField
            label="Description"
            value={checklistForm.description}
            onChange={(value) =>
              setChecklistForm((current) => ({ ...current, description: value }))
            }
            rows={4}
          />

          {(checklistForm.iconUrl || checklistForm.coverImageUrl) && (
            <div className="grid gap-4 md:grid-cols-2">
              {checklistForm.iconUrl ? (
                <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                    Icon preview
                  </p>
                  <div
                    className="mt-3 h-24 rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${checklistForm.iconUrl})` }}
                  />
                </div>
              ) : null}
              {checklistForm.coverImageUrl ? (
                <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                    Cover preview
                  </p>
                  <div
                    className="mt-3 h-24 rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${checklistForm.coverImageUrl})` }}
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel-muted)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-[#201a1b]">Checklist items</p>
                <p className="text-sm text-[var(--muted)]">
                  These steps are returned to the mobile app in order.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setChecklistForm((current) => ({
                    ...current,
                    items: [...current.items, { id: crypto.randomUUID(), text: "" }],
                  }))
                }
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Add item
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {checklistForm.items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-[22px] border border-[var(--border)] bg-white p-4 md:flex-row md:items-center"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--danger-soft)] text-sm font-bold text-[var(--danger)]">
                    {index + 1}
                  </div>
                  <input
                    value={item.text}
                    onChange={(event) =>
                      setChecklistForm((current) => ({
                        ...current,
                        items: current.items.map((currentItem) =>
                          currentItem.id === item.id
                            ? { ...currentItem, text: event.target.value }
                            : currentItem
                        ),
                      }))
                    }
                    placeholder="Describe the checklist action"
                    className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChecklistForm((current) => ({
                        ...current,
                        items:
                          current.items.length === 1
                            ? current.items
                            : current.items.filter((currentItem) => currentItem.id !== item.id),
                      }))
                    }
                    className="rounded-full border border-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setChecklistModalOpen(false)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Saving..."
                : checklistForm.id
                  ? "Save Checklist"
                  : "Create Checklist"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={safetyTipModalOpen}
        title={safetyTipForm.id ? "Edit safety tip" : "Create safety tip"}
        subtitle="Build rich guide content with sections, tags, and do or do not recommendations."
        onClose={() => setSafetyTipModalOpen(false)}
      >
        <form onSubmit={saveSafetyTip} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Title"
              value={safetyTipForm.title}
              onChange={(value) =>
                setSafetyTipForm((current) => ({ ...current, title: value }))
              }
              placeholder="Staying safe during floods"
            />
            <Field
              label="Category"
              value={safetyTipForm.category}
              onChange={(value) =>
                setSafetyTipForm((current) => ({ ...current, category: value }))
              }
              placeholder="Flood"
            />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Status</span>
              <select
                value={safetyTipForm.status}
                onChange={(event) =>
                  setSafetyTipForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <Field
              label="Language"
              value={safetyTipForm.language}
              onChange={(value) =>
                setSafetyTipForm((current) => ({ ...current, language: value }))
              }
              placeholder="en"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <TextAreaField
              label="Summary"
              value={safetyTipForm.summary}
              onChange={(value) =>
                setSafetyTipForm((current) => ({ ...current, summary: value }))
              }
              rows={5}
            />
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel-muted)] p-5">
              <p className="text-sm font-semibold text-[#201a1b]">Publication options</p>
              <div className="mt-4 grid gap-4">
                <Field
                  label="Read time (minutes)"
                  type="number"
                  value={safetyTipForm.estimatedReadMinutes}
                  onChange={(value) =>
                    setSafetyTipForm((current) => ({
                      ...current,
                      estimatedReadMinutes: Number(value || 0),
                    }))
                  }
                />
                <label className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[#201a1b]">
                  Featured guide
                  <input
                    type="checkbox"
                    checked={safetyTipForm.featured}
                    onChange={(event) =>
                      setSafetyTipForm((current) => ({
                        ...current,
                        featured: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--danger)]"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel-muted)] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-[#201a1b]">Guide media</p>
                <p className="text-sm text-[var(--muted)]">
                  Upload the hero cover and list thumbnail directly using form-data. Manual URL entry is disabled.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]">
                  {safetyTipForm.coverImageUrl ? "Replace cover" : "Upload cover"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      void handleMediaUpload(event, "safety-tips", "tip", "coverImageUrl")
                    }
                  />
                </label>
                <label className="cursor-pointer rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]">
                  {safetyTipForm.thumbnailUrl ? "Replace thumbnail" : "Upload thumbnail"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      void handleMediaUpload(event, "safety-tips", "tip", "thumbnailUrl")
                    }
                  />
                </label>
              </div>
            </div>
            {(safetyTipForm.coverImageUrl || safetyTipForm.thumbnailUrl) && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {safetyTipForm.coverImageUrl ? (
                  <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Cover preview
                    </p>
                    <div
                      className="mt-3 h-28 rounded-2xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${safetyTipForm.coverImageUrl})` }}
                    />
                  </div>
                ) : null}
                {safetyTipForm.thumbnailUrl ? (
                  <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Thumbnail preview
                    </p>
                    <div
                      className="mt-3 h-28 rounded-2xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${safetyTipForm.thumbnailUrl})` }}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.04)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-[#201a1b]">Content sections</p>
                <p className="text-sm text-[var(--muted)]">
                  Structure long-form guidance into digestible blocks for the app reader.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSafetyTipForm((current) => ({
                    ...current,
                    contentSections: [...current.contentSections, { heading: "", body: "" }],
                  }))
                }
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                Add section
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {safetyTipForm.contentSections.map((section, index) => (
                <div
                  key={`${section.heading}-${index}`}
                  className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#201a1b]">
                      Section {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          contentSections:
                            current.contentSections.length === 1
                              ? current.contentSections
                              : current.contentSections.filter(
                                  (_, currentIndex) => currentIndex !== index
                                ),
                        }))
                      }
                      className="rounded-full border border-[var(--danger-soft)] px-3 py-1 text-xs font-semibold text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-4">
                    <Field
                      label="Heading"
                      value={section.heading}
                      onChange={(value) =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          contentSections: current.contentSections.map(
                            (currentSectionItem, currentIndex) =>
                              currentIndex === index
                                ? { ...currentSectionItem, heading: value }
                                : currentSectionItem
                          ),
                        }))
                      }
                    />
                    <TextAreaField
                      label="Body"
                      value={section.body}
                      onChange={(value) =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          contentSections: current.contentSections.map(
                            (currentSectionItem, currentIndex) =>
                              currentIndex === index
                                ? { ...currentSectionItem, body: value }
                                : currentSectionItem
                          ),
                        }))
                      }
                      rows={4}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-[#201a1b]">Do list</p>
                  <p className="text-sm text-[var(--muted)]">Positive actions to recommend.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSafetyTipForm((current) => ({
                      ...current,
                      doList: [...current.doList, ""],
                    }))
                  }
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)]"
                >
                  Add
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {safetyTipForm.doList.map((item, index) => (
                  <div key={`do-${index}`} className="flex gap-3">
                    <input
                      value={item}
                      onChange={(event) =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          doList: current.doList.map((currentItem, currentIndex) =>
                            currentIndex === index ? event.target.value : currentItem
                          ),
                        }))
                      }
                      placeholder="Recommended action"
                      className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          doList:
                            current.doList.length === 1
                              ? current.doList
                              : current.doList.filter((_, currentIndex) => currentIndex !== index),
                        }))
                      }
                      className="rounded-full border border-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-[#201a1b]">Do not list</p>
                  <p className="text-sm text-[var(--muted)]">
                    Actions the user should avoid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSafetyTipForm((current) => ({
                      ...current,
                      dontList: [...current.dontList, ""],
                    }))
                  }
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)]"
                >
                  Add
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {safetyTipForm.dontList.map((item, index) => (
                  <div key={`dont-${index}`} className="flex gap-3">
                    <input
                      value={item}
                      onChange={(event) =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          dontList: current.dontList.map((currentItem, currentIndex) =>
                            currentIndex === index ? event.target.value : currentItem
                          ),
                        }))
                      }
                      placeholder="Avoid this action"
                      className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSafetyTipForm((current) => ({
                          ...current,
                          dontList:
                            current.dontList.length === 1
                              ? current.dontList
                              : current.dontList.filter(
                                  (_, currentIndex) => currentIndex !== index
                                ),
                        }))
                      }
                      className="rounded-full border border-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-[#201a1b]">Tags</p>
                <p className="text-sm text-[var(--muted)]">
                  Lightweight labels for filtering and discovery.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSafetyTipForm((current) => ({
                    ...current,
                    tags: [...current.tags, ""],
                  }))
                }
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)]"
              >
                Add tag
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {safetyTipForm.tags.map((tag, index) => (
                <div key={`tag-${index}`} className="flex gap-3">
                  <input
                    value={tag}
                    onChange={(event) =>
                      setSafetyTipForm((current) => ({
                        ...current,
                        tags: current.tags.map((currentTag, currentIndex) =>
                          currentIndex === index ? event.target.value : currentTag
                        ),
                      }))
                    }
                    placeholder="earthquake"
                    className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSafetyTipForm((current) => ({
                        ...current,
                        tags:
                          current.tags.length === 1
                            ? current.tags
                            : current.tags.filter((_, currentIndex) => currentIndex !== index),
                      }))
                    }
                    className="rounded-full border border-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setSafetyTipModalOpen(false)}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-[var(--danger)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Saving..."
                : safetyTipForm.id
                  ? "Save Safety Tip"
                  : "Create Safety Tip"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDialog.kind)}
        title={
          confirmDialog.kind === "logout"
            ? "Logout"
            : confirmDialog.kind === "checklist"
              ? "Delete checklist"
              : "Delete safety tip"
        }
        subtitle={
          confirmDialog.kind === "logout"
            ? "End the current admin session on this browser."
            : `This action will permanently remove ${confirmDialog.label || "this item"} from the MongoDB-backed admin library.`
        }
        onClose={() => setConfirmDialog({ kind: null })}
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
            {confirmDialog.kind === "logout"
              ? "You can sign back in at any time with the admin credentials."
              : "The mobile app will stop receiving this content after deletion. This cannot be undone from the dashboard."}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmDialog({ kind: null })}
              className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmCurrentAction()}
              disabled={loading}
              className={classNames(
                "rounded-2xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
                confirmDialog.kind === "logout"
                  ? "bg-[#2b2324] hover:bg-black"
                  : "bg-[var(--danger)] hover:bg-[var(--danger-deep)]"
              )}
            >
              {loading
                ? "Working..."
                : confirmDialog.kind === "logout"
                  ? "Logout now"
                  : "Delete now"}
            </button>
          </div>
        </div>
      </Modal>

      {toast ? (
        <div
          className={classNames(
            "fixed bottom-6 right-6 z-[70] max-w-sm rounded-[22px] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(26,18,18,0.22)]",
            toast.kind === "success" ? "bg-emerald-600" : "bg-[var(--danger)]"
          )}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
