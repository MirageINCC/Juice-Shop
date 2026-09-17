export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    const message =
      typeof body.error === "string" ? body.error : (response.statusText ?? "Unbekannter Fehler");
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}
