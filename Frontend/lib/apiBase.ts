export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5050";
  return raw.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getWsBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BACKEND_WS_URL || getApiBaseUrl();
  return raw.replace(/\/+$/, "");
}
