"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  apiRequest,
  uploadAsset,
  type ApiErrorShape,
} from "@/lib/api-client";
import { classNames, formatDate, formatRelativeTime, uid } from "@/lib/format";
import {
  AppIcon,
  BrandMark,
  Field,
  Modal,
  StatCard,
  StatusBadge,
  TextAreaField,
} from "@/components/ui/primitives";
import type { Notify } from "@/components/sections/types";
import { UsersSection } from "@/components/sections/users-section";
import { CouponsSection } from "@/components/sections/coupons-section";
import { SystemSettingsSection } from "@/components/sections/system-settings-section";
import { AdsSection } from "@/components/sections/ads-section";
import { EmergencyResponsesSection } from "@/components/sections/emergency-responses-section";
import { MaterialsSection } from "@/components/sections/materials-section";
import { NotificationsSection } from "@/components/sections/notifications-section";

type AuthMode = "login" | "forgot" | "otp" | "reset";
type Section =
  | "dashboard"
  | "prompt"
  | "categories"
  | "checklists"
  | "tips"
  | "settings"
  | "users"
  | "coupons"
  | "appsettings"
  | "ads"
  | "emergency"
  | "materials"
  | "notifications";
type ToastState = { kind: "success" | "error"; message: string } | null;

type DashboardData = {
  summary: {
    totalUsers: number;
    totalCategories: number;
    totalChecklists: number;
    totalSafetyTips: number;
    totalChats: number;
    publishedSafetyTips: number;
  };
  recentActivity: ActivityItem[];
  aiPrompt: PromptFormBundle | null;
  templatesPreview: Array<{
    id: string;
    title: string;
    status: string;
    itemCount: number;
    updatedAt: string;
  }>;
};

type PromptLanguage = "en" | "it";

type PromptForm = {
  language: PromptLanguage;
  welcomeMessage: string;
  systemInstruction: string;
  fallbackMessage: string;
};

type PromptFormBundle = {
  en: PromptForm;
  it: PromptForm;
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
  categorySlug: string;
  description: string;
  language: string;
  iconUrl: string;
  icon: string;
  coverImageUrl: string;
  status: string;
  items: Array<{ id: string; text: string; order: number; icon: string }>;
  updatedAt: string;
};

type LocalizedField = { en: string; it: string };

type CategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  names: LocalizedField;
  descriptions: LocalizedField;
  sortOrder: number;
  checklistsCount: number;
  safetyTipsCount: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

type SafetyTipRecord = {
  id: string;
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
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
  categorySlug: string;
  description: string;
  language: string;
  status: string;
  iconUrl: string;
  icon: string;
  coverImageUrl: string;
  items: Array<{ id: string; text: string; icon: string }>;
};

type CategoryFormState = {
  id?: string;
  slug: string;
  names: LocalizedField;
  descriptions: LocalizedField;
  sortOrder: number;
};

type SafetyTipFormState = {
  id?: string;
  title: string;
  categorySlug: string;
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

const navItems: Array<{ id: Section; label: string; eyebrow: string }> = [
  { id: "dashboard", label: "Dashboard", eyebrow: "Overview" },
  { id: "prompt", label: "Chat bot prompts", eyebrow: "AI" },
  { id: "categories", label: "Categories", eyebrow: "Library" },
  { id: "checklists", label: "Checklists", eyebrow: "Preparedness" },
  { id: "tips", label: "Safety tips", eyebrow: "Guides" },
  { id: "settings", label: "Settings", eyebrow: "Profile" },
  { id: "users", label: "Users", eyebrow: "Members" },
  { id: "coupons", label: "Coupons", eyebrow: "Access codes" },
  { id: "appsettings", label: "App settings", eyebrow: "Limits & rules" },
  { id: "ads", label: "Ads", eyebrow: "Monetization" },
  { id: "emergency", label: "Emergency responses", eyebrow: "Override" },
  { id: "materials", label: "Materials", eyebrow: "Oversight" },
  { id: "notifications", label: "Notifications", eyebrow: "Monitoring" },
];

const languageOptions = [
  { value: "en", label: "English" },
  { value: "it", label: "Italian" },
];

const languageLabel = (value: string) =>
  languageOptions.find((option) => option.value === value)?.label || "English";

const emptyChecklistForm = (defaultCategorySlug = ""): ChecklistFormState => ({
  title: "",
  categorySlug: defaultCategorySlug,
  description: "",
  language: "en",
  status: "published",
  iconUrl: "",
  icon: "",
  coverImageUrl: "",
  items: [{ id: uid(), text: "", icon: "" }],
});

const ALLOWED_IMAGE_MIME_PREFIX = "image/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const validateImageFile = (file: File): string | null => {
  if (!file.type.startsWith(ALLOWED_IMAGE_MIME_PREFIX)) {
    return "Only image files are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be smaller than 5 MB.";
  }
  return null;
};

const emptyCategoryForm = (): CategoryFormState => ({
  slug: "",
  names: { en: "", it: "" },
  descriptions: { en: "", it: "" },
  sortOrder: 0,
});

const emptySafetyTipForm = (defaultCategorySlug = ""): SafetyTipFormState => ({
  title: "",
  categorySlug: defaultCategorySlug,
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

const emptyPromptForm = (language: PromptLanguage): PromptForm => ({
  language,
  welcomeMessage: "",
  systemInstruction: "",
  fallbackMessage: "",
});

const emptyPromptBundle = (): PromptFormBundle => ({
  en: emptyPromptForm("en"),
  it: emptyPromptForm("it"),
});

const getSectionIconName = (section: Section) =>
  section === "dashboard"
    ? "dashboard"
    : section === "prompt"
      ? "prompt"
      : section === "categories"
        ? "categories"
      : section === "checklists"
        ? "checklists"
        : section === "tips"
          ? "tips"
          : section === "settings"
            ? "settings"
            : section === "users"
              ? "users"
              : section === "coupons"
                ? "coupon"
                : section === "appsettings"
                  ? "settings"
                  : section === "ads"
                    ? "ads"
                    : section === "emergency"
                      ? "emergency"
                      : section === "materials"
                        ? "materials"
                        : "notifications";

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
  const [promptForms, setPromptForms] = useState<PromptFormBundle>(
    emptyPromptBundle()
  );
  const [promptLanguage, setPromptLanguage] = useState<PromptLanguage>("en");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [checklists, setChecklists] = useState<ChecklistRecord[]>([]);
  const [safetyTips, setSafetyTips] = useState<SafetyTipRecord[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [categorySearch, setCategorySearch] = useState("");
  const [checklistSearch, setChecklistSearch] = useState("");
  const [tipSearch, setTipSearch] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [safetyTipModalOpen, setSafetyTipModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm());
  const [checklistForm, setChecklistForm] = useState<ChecklistFormState>(
    emptyChecklistForm()
  );
  const [safetyTipForm, setSafetyTipForm] = useState<SafetyTipFormState>(
    emptySafetyTipForm()
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    kind: "logout" | "category" | "checklist" | "tip" | null;
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

  const notify: Notify = (kind, message) => setToast({ kind, message });

  const handleLogout = (showToast = true) => {
    window.localStorage.removeItem("wesafe-admin-token");
    setToken(null);
    setMobileNavOpen(false);
    setDashboard(null);
    setCategories([]);
    setChecklists([]);
    setSafetyTips([]);
    setActivity([]);
    setAdminProfile(null);
    setCategoryModalOpen(false);
    setChecklistModalOpen(false);
    setSafetyTipModalOpen(false);
    setActiveSection("dashboard");
    setAuthMode("login");
    setConfirmDialog({ kind: null });
    if (showToast) {
      setToast({ kind: "success", message: "Logged out successfully." });
    }
  };

  const handleSectionChange = (section: Section) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };

  const openLogoutDialog = () => {
    setMobileNavOpen(false);
    setConfirmDialog({ kind: "logout" });
  };

  const handleRequestError = (error: unknown) => {
    const typedError = error as ApiErrorShape;
    if (typedError?.status === 401) {
      handleLogout(false);
      setToast({
        kind: "error",
        message: "Session expired. Please log in again.",
      });
      return;
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
        categoryData,
        checklistData,
        safetyTipData,
        settingsData,
        activityData,
      ] = await Promise.all([
        apiRequest<DashboardData>("/admin/dashboard", { token: currentToken }),
        apiRequest<PromptFormBundle>("/admin/ai-prompt", { token: currentToken }),
        apiRequest<CategoryRecord[]>("/admin/categories", { token: currentToken }),
        apiRequest<ChecklistRecord[]>("/admin/checklists", { token: currentToken }),
        apiRequest<SafetyTipRecord[]>("/admin/safety-tips", { token: currentToken }),
        apiRequest<AdminProfile>("/admin/settings", { token: currentToken }),
        apiRequest<ActivityItem[]>("/admin/activity", { token: currentToken }),
      ]);

      setDashboard(dashboardData);
      setPromptForms({
        en: { ...promptData.en, language: "en" },
        it: { ...promptData.it, language: "it" },
      });
      setCategories(categoryData);
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

  const defaultCategorySlug = categories[0]?.slug || "";
  const hasManagedCategories = categories.length > 0;

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) {
      return categories;
    }
    return categories.filter((item) =>
      [
        item.names?.en || "",
        item.names?.it || "",
        item.descriptions?.en || "",
        item.descriptions?.it || "",
        item.slug,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [categories, categorySearch]);

  const filteredChecklists = useMemo(() => {
    const query = checklistSearch.trim().toLowerCase();
    if (!query) {
      return checklists;
    }
    return checklists.filter((item) =>
      [item.title, item.category, item.description, languageLabel(item.language)]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [checklists, checklistSearch]);

  const filteredTips = useMemo(() => {
    const query = tipSearch.trim().toLowerCase();
    if (!query) {
      return safetyTips;
    }
    return safetyTips.filter((item) =>
      [item.title, item.category, item.summary, languageLabel(item.language)]
        .join(" ")
        .toLowerCase()
        .includes(query)
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

  const openCategoryModal = (record?: CategoryRecord) => {
    if (record) {
      setCategoryForm({
        id: record.id,
        slug: record.slug,
        names: {
          en: record.names?.en || "",
          it: record.names?.it || "",
        },
        descriptions: {
          en: record.descriptions?.en || "",
          it: record.descriptions?.it || "",
        },
        sortOrder: record.sortOrder,
      });
    } else {
      setCategoryForm(emptyCategoryForm());
    }

    setCategoryModalOpen(true);
  };

  const openChecklistModal = (record?: ChecklistRecord) => {
    if (record) {
      setChecklistForm({
        id: record.id,
        title: record.title,
        categorySlug: record.categorySlug || record.category || defaultCategorySlug,
        description: record.description,
        language: record.language || "en",
        status: record.status,
        iconUrl: record.iconUrl,
        icon: record.icon || "",
        coverImageUrl: record.coverImageUrl,
        items: record.items.map((item) => ({
          id: item.id,
          text: item.text,
          icon: item.icon || "",
        })),
      });
    } else {
      setChecklistForm(emptyChecklistForm(defaultCategorySlug));
    }

    setChecklistModalOpen(true);
  };

  const openSafetyTipModal = (record?: SafetyTipRecord) => {
    if (record) {
      setSafetyTipForm({
        id: record.id,
        title: record.title,
        categorySlug: record.categorySlug || record.category || defaultCategorySlug,
        summary: record.summary,
        status: record.status,
        language: record.language || "en",
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
      setSafetyTipForm(emptySafetyTipForm(defaultCategorySlug));
    }

    setSafetyTipModalOpen(true);
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (!categoryForm.names.en.trim()) {
      setToast({ kind: "error", message: "English name is required." });
      return;
    }

    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        names: {
          en: categoryForm.names.en.trim(),
          it: categoryForm.names.it.trim(),
        },
        descriptions: {
          en: categoryForm.descriptions.en.trim(),
          it: categoryForm.descriptions.it.trim(),
        },
        sortOrder: Number(categoryForm.sortOrder),
      };

      if (categoryForm.slug.trim()) {
        body.slug = categoryForm.slug.trim();
      }

      if (categoryForm.id) {
        await apiRequest(`/admin/categories/${categoryForm.id}`, {
          token,
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/admin/categories", {
          token,
          method: "POST",
          body,
        });
      }

      setCategoryModalOpen(false);
      setToast({
        kind: "success",
        message: categoryForm.id ? "Category updated." : "Category created.",
      });
      await refreshAll(token);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const saveChecklist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    if (!checklistForm.categorySlug) {
      setToast({ kind: "error", message: "Create a category first." });
      return;
    }
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        title: checklistForm.title,
        category: checklistForm.categorySlug,
        description: checklistForm.description,
        language: checklistForm.language,
        status: checklistForm.status,
        iconUrl: checklistForm.iconUrl,
        iconEmoji: checklistForm.icon,
        coverImageUrl: checklistForm.coverImageUrl,
        items: checklistForm.items
          .map((item, index) => ({
            id: item.id,
            text: item.text,
            order: index + 1,
            icon: item.icon || "",
          }))
          .filter((item) => (item.text as string).trim()),
      };

      if (checklistForm.id && !checklistForm.iconUrl) {
        body.removeIconUrl = true;
      }
      if (checklistForm.id && !checklistForm.coverImageUrl) {
        body.removeCoverImageUrl = true;
      }

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
    if (!safetyTipForm.categorySlug) {
      setToast({ kind: "error", message: "Create a category first." });
      return;
    }
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        title: safetyTipForm.title,
        category: safetyTipForm.categorySlug,
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

      if (safetyTipForm.id && !safetyTipForm.coverImageUrl) {
        body.removeCoverImageUrl = true;
      }
      if (safetyTipForm.id && !safetyTipForm.thumbnailUrl) {
        body.removeThumbnailUrl = true;
      }

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

      if (confirmDialog.kind === "category" && confirmDialog.id) {
        await apiRequest(`/admin/categories/${confirmDialog.id}`, {
          token,
          method: "DELETE",
        });
        setToast({ kind: "success", message: "Category deleted." });
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
      const current = promptForms[promptLanguage];
      const data = await apiRequest<PromptForm>("/admin/ai-prompt", {
        token,
        method: "PATCH",
        body: {
          language: promptLanguage,
          welcomeMessage: current.welcomeMessage,
          systemInstruction: current.systemInstruction,
          fallbackMessage: current.fallbackMessage,
        },
      });
      setPromptForms((forms) => ({
        ...forms,
        [promptLanguage]: { ...data, language: promptLanguage },
      }));
      setToast({ kind: "success", message: `Prompt updated (${promptLanguage}).` });
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
      const settingsBody: Record<string, unknown> = {
        firstName: adminProfile.firstName,
        lastName: adminProfile.lastName,
        phoneNumber: adminProfile.phoneNumber,
        avatarUrl: adminProfile.avatarUrl,
      };

      if (!adminProfile.avatarUrl) {
        settingsBody.removeAvatarUrl = true;
      }

      const data = await apiRequest<AdminProfile>("/admin/settings", {
        token,
        method: "PATCH",
        body: settingsBody,
      });
      setAdminProfile(data);
      setToast({ kind: "success", message: "Settings updated." });
    } catch (error) {
      handleRequestError(error);
    } finally {
      setLoading(false);
    }
  };

  const persistAdminAvatar = async (
    nextAvatarUrl: string,
    currentToken: string
  ) => {
    const body: Record<string, unknown> = { avatarUrl: nextAvatarUrl };
    if (!nextAvatarUrl) {
      body.removeAvatarUrl = true;
    }

    const data = await apiRequest<AdminProfile>("/admin/settings", {
      token: currentToken,
      method: "PATCH",
      body,
    });
    setAdminProfile(data);
    return data;
  };

  const handleMediaUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    folder: string,
    scope: "checklist" | "tip" | "profile",
    field: "iconUrl" | "coverImageUrl" | "thumbnailUrl" | "avatarUrl"
  ) => {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      event.target.value = "";
      setToast({ kind: "error", message: validationError });
      return;
    }

    setLoading(true);
    try {
      const secureUrl = await uploadAsset(file, folder, token);

      if (scope === "checklist") {
        setChecklistForm((current) => ({ ...current, [field]: secureUrl }));
        setToast({ kind: "success", message: "Media uploaded successfully." });
      } else if (scope === "profile") {
        await persistAdminAvatar(secureUrl, token);
        setToast({ kind: "success", message: "Avatar uploaded successfully." });
      } else {
        setSafetyTipForm((current) => ({ ...current, [field]: secureUrl }));
        setToast({ kind: "success", message: "Media uploaded successfully." });
      }
    } catch (error) {
      handleRequestError(error);
    } finally {
      event.target.value = "";
      setLoading(false);
    }
  };

  const handleMediaRemove = async (
    scope: "checklist" | "tip" | "profile",
    field: "iconUrl" | "coverImageUrl" | "thumbnailUrl" | "avatarUrl"
  ) => {
    if (scope === "checklist") {
      setChecklistForm((current) => ({ ...current, [field]: "" }));
      setToast({
        kind: "success",
        message: "Image removed. Save changes to apply.",
      });
      return;
    }

    if (scope === "tip") {
      setSafetyTipForm((current) => ({ ...current, [field]: "" }));
      setToast({
        kind: "success",
        message: "Image removed. Save changes to apply.",
      });
      return;
    }

    if (!token) return;
    setLoading(true);
    try {
      await persistAdminAvatar("", token);
      setToast({ kind: "success", message: "Avatar removed." });
    } catch (error) {
      handleRequestError(error);
    } finally {
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
          <div className="flex flex-col items-start gap-2 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h3 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[#241d1f] sm:text-[1.7rem]">
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

  const renderPromptSection = () => {
    const activeForm = promptForms[promptLanguage];
    const updateActiveForm = (patch: Partial<PromptForm>) =>
      setPromptForms((forms) => ({
        ...forms,
        [promptLanguage]: { ...forms[promptLanguage], ...patch },
      }));

    return (
      <form onSubmit={savePrompt} className="space-y-6">
        <div className="rounded-[28px] border border-[var(--border)] bg-white p-4 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
                Live AI configuration
              </p>
              <h3 className="mt-2 text-xl font-bold text-[#201a1b]">
                Chat bot modification
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Each language has its own welcome, system instruction, and fallback. The chat uses the
                prompt that matches the user&apos;s app language.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--danger-deep)] sm:w-auto"
            >
              {loading ? "Saving..." : `Save ${promptLanguage.toUpperCase()} prompt`}
            </button>
          </div>
          <div className="mb-5 inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-muted)] p-1">
            {(["en", "it"] as PromptLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setPromptLanguage(lang)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  promptLanguage === lang
                    ? "bg-white text-[var(--danger)] shadow-[0_2px_6px_rgba(216,43,43,0.18)]"
                    : "text-[var(--muted)] hover:text-[#201a1b]"
                }`}
              >
                {lang === "en" ? "English" : "Italian"}
              </button>
            ))}
          </div>
          <div className="grid gap-5">
            <TextAreaField
              label="Welcome message"
              value={activeForm.welcomeMessage}
              onChange={(value) => updateActiveForm({ welcomeMessage: value })}
              rows={4}
            />
            <TextAreaField
              label="System instruction"
              value={activeForm.systemInstruction}
              onChange={(value) => updateActiveForm({ systemInstruction: value })}
              rows={10}
            />
            <TextAreaField
              label="Fallback response"
              value={activeForm.fallbackMessage}
              onChange={(value) => updateActiveForm({ fallbackMessage: value })}
              rows={4}
            />
          </div>
        </div>
      </form>
    );
  };

  const renderCategoriesSection = () => (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-[#221c1d]">
            Categories
          </h2>
          <p className="mt-1 text-sm text-[#6d6668]">
            Create the shared category library used by checklists and safety tips
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCategoryModal()}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Category</span>
        </button>
      </div>
      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="mb-4">
          <Field
            label="Search categories"
            value={categorySearch}
            onChange={setCategorySearch}
            placeholder="Find by name, description, or slug"
          />
        </div>
        <div className="space-y-2">
          {filteredCategories.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                    {item.names?.en || item.name}
                  </p>
                  {item.names?.it ? (
                    <span className="rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-medium text-[#3b3da9]">
                      IT: {item.names.it}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#fff3e0] px-2.5 py-1 text-xs font-medium text-[#a06400]">
                      Missing IT translation
                    </span>
                  )}
                  <span className="rounded-full bg-[#fff3f3] px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
                    #{item.sortOrder}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#6b6467]">
                  {item.descriptions?.en || item.description || item.slug}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-[#6d6668]">
                  <span>{item.checklistsCount} checklists</span>
                  <span>{item.safetyTipsCount} safety tips</span>
                  <span>{item.usageCount} total uses</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openCategoryModal(item)}
                  className="text-[#1771d6] transition hover:text-[#0f5eb6]"
                >
                  <AppIcon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      kind: "category",
                      id: item.id,
                      label: item.names?.en || item.name,
                    })
                  }
                  className="text-[#ef4444] transition hover:text-[#d72d2d]"
                >
                  <AppIcon name="delete" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-10 text-center text-sm text-[#7a7275]">
              No category matches the current filter.
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
          disabled={!hasManagedCategories}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Checklist</span>
        </button>
      </div>
      {!hasManagedCategories ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-4 text-sm text-[#7a7275]">
          Create at least one category before creating a checklist.
        </div>
      ) : null}
      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="space-y-2">
          {filteredChecklists.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-start gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 sm:flex-row sm:items-center"
            >
              <div className="flex w-full min-w-0 items-center gap-3">
                <div className="shrink-0 text-[var(--danger)]">
                  <AppIcon name="chevron" className="h-4 w-4" />
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f5dede] bg-[#fff5f5] text-lg">
                  {item.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.iconUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : item.icon ? (
                    <span aria-hidden="true">{item.icon}</span>
                  ) : (
                    <AppIcon name="checklists" className="h-4 w-4 text-[var(--danger)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.02rem] font-semibold text-[#2b2526]">
                    {item.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6b6467]">
                    <span>{item.items.length} Items</span>
                    <span className="text-[#b8b1b4]">•</span>
                    <span>{languageLabel(item.language)}</span>
                  </div>
                </div>
              </div>
              <StatusBadge value={item.status} />
              <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
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
          disabled={!hasManagedCategories}
          className="inline-flex w-full items-center justify-center gap-2 self-start rounded-[10px] bg-[var(--danger)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(216,43,43,0.22)] transition hover:bg-[var(--danger-deep)] sm:w-auto"
        >
          <span className="text-xl leading-none">+</span>
          <span>New Safety Tip</span>
        </button>
      </div>
      {!hasManagedCategories ? (
        <div className="rounded-[10px] border border-dashed border-[#eadede] bg-white px-4 py-4 text-sm text-[#7a7275]">
          Create at least one category before publishing a safety tip.
        </div>
      ) : null}
      <div className="rounded-[14px] border border-[#eee4e4] bg-[#fffafa] p-3 shadow-[0_10px_24px_rgba(22,18,18,0.04)] sm:p-4">
        <div className="space-y-2">
          {filteredTips.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-start gap-3 rounded-[10px] border border-[#ece4e4] bg-white px-4 py-4 sm:flex-row sm:items-center"
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
                  <span>{languageLabel(item.language)}</span>
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
        <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--danger)]">
            Profile
          </p>
          <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-[var(--danger-soft)] text-2xl font-bold text-[var(--danger)]">
              {adminProfile.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xl font-bold text-[#201a1b]">{adminProfile.fullName}</p>
              <p className="text-sm text-[var(--muted)]">{adminProfile.email}</p>
            </div>
          </div>
        </div>
        <div className="space-y-5 rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_40px_rgba(26,18,18,0.06)] sm:p-6">
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
              <div className="flex flex-wrap gap-3">
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
                {adminProfile.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => handleMediaRemove("profile", "avatarUrl")}
                    className="rounded-full border border-[var(--danger-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove avatar
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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
    categories: {
      eyebrow: "Categories",
      title: "Categories",
      description: "Manage the shared category library used by dashboard content.",
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
    users: {
      eyebrow: "Members",
      title: "Users",
      description: "Review members and manage premium access.",
    },
    coupons: {
      eyebrow: "Access codes",
      title: "Coupons",
      description: "Issue and manage premium access codes.",
    },
    appsettings: {
      eyebrow: "Limits & rules",
      title: "App settings",
      description: "Tune free-tier limits, prompts, and access rules.",
    },
    ads: {
      eyebrow: "Monetization",
      title: "Ads",
      description: "Configure ad placements and unit identifiers.",
    },
    emergency: {
      eyebrow: "Override",
      title: "Emergency responses",
      description: "Manage emergency override response templates.",
    },
    materials: {
      eyebrow: "Oversight",
      title: "Materials",
      description: "Monitor user materials and expirations.",
    },
    notifications: {
      eyebrow: "Monitoring",
      title: "Notifications",
      description: "Monitor scheduled and delivered notifications.",
    },
  };

  const currentSection = sectionMeta[activeSection];

  const renderActiveSection = () => {
    switch (activeSection) {
      case "prompt":
        return renderPromptSection();
      case "categories":
        return renderCategoriesSection();
      case "checklists":
        return renderChecklistsSection();
      case "tips":
        return renderTipsSection();
      case "settings":
        return renderSettingsSection();
      case "users":
        return <UsersSection token={token} notify={notify} />;
      case "coupons":
        return <CouponsSection token={token} notify={notify} />;
      case "appsettings":
        return <SystemSettingsSection token={token} notify={notify} />;
      case "ads":
        return <AdsSection token={token} notify={notify} />;
      case "emergency":
        return <EmergencyResponsesSection token={token} notify={notify} />;
      case "materials":
        return <MaterialsSection token={token} notify={notify} />;
      case "notifications":
        return <NotificationsSection token={token} notify={notify} />;
      default:
        return renderDashboardSection();
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[#f1e9e9] px-5 py-4 sm:px-8 sm:py-5 lg:border-b-0">
        <BrandMark />
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {navItems.map((item) => {
          const active = item.id === activeSection;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSectionChange(item.id)}
              className={classNames(
                "flex w-full items-center gap-3 rounded-[8px] px-3 py-3 text-left text-sm font-medium transition",
                active
                  ? "bg-[var(--danger)] text-white"
                  : "text-[#2b2526] hover:bg-[#faf4f4]"
              )}
            >
              <AppIcon
                name={getSectionIconName(item.id)}
                className="h-4 w-4 shrink-0"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#f1e9e9] px-4 py-5">
        <button
          type="button"
          onClick={openLogoutDialog}
          className="flex items-center gap-2 text-sm font-medium text-[#2c2627] transition hover:text-[var(--danger)]"
        >
          <AppIcon name="logout" className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

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
          <section className="flex flex-col justify-center bg-[var(--panel)] px-5 py-8 sm:px-10 sm:py-10">
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
              "fixed bottom-4 left-4 right-4 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg sm:bottom-6 sm:left-auto sm:right-6",
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
      <div className="min-h-screen bg-white lg:flex">
          <aside className="hidden min-h-screen w-[230px] border-r border-[#f1e9e9] bg-white lg:flex lg:flex-col">
            {sidebarContent}
          </aside>

          <section className="flex-1 bg-[#fcf8f8]">
            <header className="border-b border-[#f1e9e9] bg-white px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 lg:hidden">
                  <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ece2e2] text-[#2c2627] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                        aria-label="Open navigation menu"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 7h16" />
                          <path d="M4 12h16" />
                          <path d="M4 17h16" />
                        </svg>
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-[280px] max-w-[85vw] border-r border-[#f1e9e9] p-0"
                    >
                      <SheetHeader className="sr-only">
                        <SheetTitle>Admin navigation</SheetTitle>
                        <SheetDescription>
                          Open the dashboard sections and account actions.
                        </SheetDescription>
                      </SheetHeader>
                      {sidebarContent}
                    </SheetContent>
                  </Sheet>
                  <BrandMark />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void refreshAll()}
                    disabled={refreshing}
                    className="rounded-full border border-[#ece2e2] px-3 py-1.5 text-xs font-semibold text-[#6c6668] transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-60"
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
        open={categoryModalOpen}
        title={categoryForm.id ? "Edit category" : "Create category"}
        subtitle="Create the shared category names the dashboard uses for guides and checklists."
        onClose={() => setCategoryModalOpen(false)}
      >
        <form onSubmit={saveCategory} className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
            <p className="text-sm font-semibold text-[#201a1b]">Localized labels</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              The mobile app shows the label that matches the user&apos;s language. English is required.
            </p>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field
                label="Name (English)"
                value={categoryForm.names.en}
                onChange={(value) =>
                  setCategoryForm((current) => ({
                    ...current,
                    names: { ...current.names, en: value },
                  }))
                }
                placeholder="Flood"
              />
              <Field
                label="Name (Italian)"
                value={categoryForm.names.it}
                onChange={(value) =>
                  setCategoryForm((current) => ({
                    ...current,
                    names: { ...current.names, it: value },
                  }))
                }
                placeholder="Alluvione"
              />
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <TextAreaField
                label="Description (English)"
                value={categoryForm.descriptions.en}
                onChange={(value) =>
                  setCategoryForm((current) => ({
                    ...current,
                    descriptions: { ...current.descriptions, en: value },
                  }))
                }
                rows={3}
              />
              <TextAreaField
                label="Description (Italian)"
                value={categoryForm.descriptions.it}
                onChange={(value) =>
                  setCategoryForm((current) => ({
                    ...current,
                    descriptions: { ...current.descriptions, it: value },
                  }))
                }
                rows={3}
              />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Slug (optional)"
              value={categoryForm.slug}
              onChange={(value) =>
                setCategoryForm((current) => ({ ...current, slug: value }))
              }
              placeholder="auto-generated from English name"
            />
            <Field
              label="Sort order"
              type="number"
              value={categoryForm.sortOrder}
              onChange={(value) =>
                setCategoryForm((current) => ({
                  ...current,
                  sortOrder: Number(value || 0),
                }))
              }
              placeholder="1"
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
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
                : categoryForm.id
                  ? "Save Category"
                  : "Create Category"}
            </button>
          </div>
        </form>
      </Modal>

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
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Category</span>
              <select
                value={checklistForm.categorySlug}
                onChange={(event) =>
                  setChecklistForm((current) => ({
                    ...current,
                    categorySlug: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.names?.en || category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-[0.6fr_0.6fr_1.4fr]">
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
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Language</span>
              <select
                value={checklistForm.language}
                onChange={(event) =>
                  setChecklistForm((current) => ({
                    ...current,
                    language: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] p-4">
              <p className="text-sm font-semibold text-[#201a1b]">Upload checklist media</p>
              <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                PNG/JPG up to 5 MB. If upload is unavailable, set an emoji fallback below — the app
                renders the emoji whenever the image is missing.
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
                {checklistForm.iconUrl ? (
                  <button
                    type="button"
                    onClick={() => handleMediaRemove("checklist", "iconUrl")}
                    className="rounded-full border border-[var(--danger-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove icon
                  </button>
                ) : null}
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
                {checklistForm.coverImageUrl ? (
                  <button
                    type="button"
                    onClick={() => handleMediaRemove("checklist", "coverImageUrl")}
                    className="rounded-full border border-[var(--danger-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove cover
                  </button>
                ) : null}
              </div>
              <div className="mt-4">
                <Field
                  label="Icon emoji fallback"
                  value={checklistForm.icon}
                  onChange={(value) =>
                    setChecklistForm((current) => ({ ...current, icon: value }))
                  }
                  placeholder="e.g. 🔥"
                />
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
                    items: [
                      ...current.items,
                      { id: uid(), text: "", icon: "" },
                    ],
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
                    value={item.icon}
                    onChange={(event) =>
                      setChecklistForm((current) => ({
                        ...current,
                        items: current.items.map((currentItem) =>
                          currentItem.id === item.id
                            ? { ...currentItem, icon: event.target.value }
                            : currentItem
                        ),
                      }))
                    }
                    placeholder="🛟"
                    aria-label="Icon emoji fallback"
                    className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-3 text-center text-base outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)] md:w-16"
                  />
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
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Category</span>
              <select
                value={safetyTipForm.categorySlug}
                onChange={(event) =>
                  setSafetyTipForm((current) => ({
                    ...current,
                    categorySlug: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.names?.en || category.name}
                  </option>
                ))}
              </select>
            </label>
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
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#33292b]">Language</span>
              <select
                value={safetyTipForm.language}
                onChange={(event) =>
                  setSafetyTipForm((current) => ({
                    ...current,
                    language: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--danger)] focus:ring-2 focus:ring-[rgba(216,43,43,0.15)]"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
                {safetyTipForm.coverImageUrl ? (
                  <button
                    type="button"
                    onClick={() => handleMediaRemove("tip", "coverImageUrl")}
                    className="rounded-full border border-[var(--danger-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove cover
                  </button>
                ) : null}
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
                {safetyTipForm.thumbnailUrl ? (
                  <button
                    type="button"
                    onClick={() => handleMediaRemove("tip", "thumbnailUrl")}
                    className="rounded-full border border-[var(--danger-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                  >
                    Remove thumbnail
                  </button>
                ) : null}
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
                  <div key={`do-${index}`} className="flex flex-col gap-3 sm:flex-row">
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
                  <div key={`dont-${index}`} className="flex flex-col gap-3 sm:flex-row">
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
                <div key={`tag-${index}`} className="flex flex-col gap-3 sm:flex-row">
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
            : confirmDialog.kind === "category"
              ? "Delete category"
            : confirmDialog.kind === "checklist"
              ? "Delete checklist"
              : "Delete safety tip"
        }
        subtitle={
          confirmDialog.kind === "logout"
            ? "End the current admin session on this browser."
            : confirmDialog.kind === "category"
              ? `This action will remove ${confirmDialog.label || "this category"} if it is no longer used by checklist or safety tip content.`
            : `This action will permanently remove ${confirmDialog.label || "this item"} from the MongoDB-backed admin library.`
        }
        onClose={() => setConfirmDialog({ kind: null })}
      >
        <div className="space-y-6">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--panel-muted)] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
            {confirmDialog.kind === "logout"
              ? "You can sign back in at any time with the admin credentials."
              : confirmDialog.kind === "category"
                ? "Categories can only be deleted after related checklists and safety tips are reassigned."
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
            "fixed bottom-4 left-4 right-4 z-[70] rounded-[22px] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(26,18,18,0.22)] sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm",
            toast.kind === "success" ? "bg-emerald-600" : "bg-[var(--danger)]"
          )}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
