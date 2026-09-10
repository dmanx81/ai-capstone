export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function parse(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : Array.isArray(data?.detail) ? data.detail[0]?.msg : res.statusText;
    throw new ApiError(res.status, detail || "Request failed");
  }
  return data;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  return parse(res) as Promise<T>;
}

export function apiPost<T>(path: string, body?: unknown) {
  return api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete(path: string) {
  return api<void>(path, { method: "DELETE" });
}
