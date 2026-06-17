export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

export type ApiErrorShape = Error & { status?: number };

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export async function apiRequest<T>(
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

export async function apiRequestRaw<T>(
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
): Promise<{ data: T; meta?: PageMeta }> {
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

  return { data: payload?.data as T, meta: payload?.meta as PageMeta | undefined };
}

export async function uploadAsset(
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
