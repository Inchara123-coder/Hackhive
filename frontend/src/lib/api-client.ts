const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

type ApiErrorResponse = {
  error?: { message?: string };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as T & ApiErrorResponse;
  if (!response.ok)
    throw new ApiError(
      payload.error?.message ?? `Request failed (${response.status}).`,
      response.status,
    );
  return payload;
}

export function apiUrl(path: string) {
  return `${apiBase}${path}`;
}
