type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
};

function makeInMemoryStorage(): StorageLike {
  const map = new Map<string, string>();

  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

function ensureStorageGlobal(name: "localStorage" | "sessionStorage") {
  const g = globalThis as unknown as Record<string, unknown>;
  const existing = g[name] as Partial<StorageLike> | undefined;

  const ok =
    existing &&
    typeof existing.getItem === "function" &&
    typeof existing.setItem === "function" &&
    typeof existing.removeItem === "function";

  if (!ok) {
    g[name] = makeInMemoryStorage();
  }
}

// Runs on the server at startup (Node/Edge). This prevents crashes when some code
// (or injected Node flags) provides a broken localStorage implementation.
export async function register() {
  ensureStorageGlobal("localStorage");
  ensureStorageGlobal("sessionStorage");
}
