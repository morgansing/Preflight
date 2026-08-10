import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useSyncExternalStore: (
    _subscribe: (listener: () => void) => () => void,
    getSnapshot: () => unknown,
  ) => getSnapshot(),
}));

import { isSameSessionEmail, useSession } from "./auth";

const SESSION_KEY = "preflight.session";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let persistentStorage: MemoryStorage;
let tabStorage: MemoryStorage;

beforeEach(() => {
  persistentStorage = new MemoryStorage();
  tabStorage = new MemoryStorage();
  vi.stubGlobal("window", {
    localStorage: persistentStorage,
    sessionStorage: tabStorage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe("V0 workspace session persistence", () => {
  it("keeps the default sign-in in localStorage", () => {
    const next = useSession().signIn({ name: "Ada", email: "ada@example.com" });

    expect(JSON.parse(persistentStorage.getItem(SESSION_KEY)!)).toEqual(next);
    expect(tabStorage.getItem(SESSION_KEY)).toBeNull();
    expect(useSession().session).toEqual(next);
  });

  it("normalizes casing and whitespace in the saved session identity", () => {
    const next = useSession().signIn({
      name: "Ada",
      email: "  Ada@Example.COM  ",
      company: "Analytical Engines",
      plan: "team",
    });

    expect(next).toMatchObject({
      email: "ada@example.com",
      company: "Analytical Engines",
      plan: "team",
    });
    expect(JSON.parse(persistentStorage.getItem(SESSION_KEY)!)).toEqual(next);
    expect(isSameSessionEmail("ADA@EXAMPLE.COM", next.email)).toBe(true);
  });

  it("uses sessionStorage for a tab-scoped sign-in and removes a persistent session", () => {
    useSession().signIn({ name: "Old", email: "old@example.com" });
    const next = useSession().signIn(
      { name: "Grace", email: "grace@example.com" },
      "session",
    );

    expect(persistentStorage.getItem(SESSION_KEY)).toBeNull();
    expect(JSON.parse(tabStorage.getItem(SESSION_KEY)!)).toEqual(next);
    expect(useSession().session).toEqual(next);
  });

  it("prefers the session for this tab when both stores contain a value", () => {
    persistentStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        name: "Persistent",
        email: "persistent@example.com",
        plan: "free",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    tabStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        name: "Tab",
        email: "tab@example.com",
        plan: "free",
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    );

    expect(useSession().session?.email).toBe("tab@example.com");
  });

  it("migrates a returning session without replacing its workspace identity", () => {
    const original = useSession().signIn({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      plan: "team",
    });

    useSession().setSessionPersistence("session");
    expect(persistentStorage.getItem(SESSION_KEY)).toBeNull();
    expect(JSON.parse(tabStorage.getItem(SESSION_KEY)!)).toEqual(original);

    useSession().setSessionPersistence("persistent");
    expect(tabStorage.getItem(SESSION_KEY)).toBeNull();
    expect(JSON.parse(persistentStorage.getItem(SESSION_KEY)!)).toEqual(original);
  });

  it("updates the plan in the active session store only", () => {
    useSession().signIn({ name: "Ada", email: "ada@example.com" }, "session");
    useSession().setPlan("scale");

    expect(persistentStorage.getItem(SESSION_KEY)).toBeNull();
    expect(JSON.parse(tabStorage.getItem(SESSION_KEY)!).plan).toBe("scale");
  });

  it("does not clear a coexisting persistent session when a tab session changes plan", () => {
    const persistent = {
      name: "Persistent",
      email: "persistent@example.com",
      plan: "team",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const tab = {
      name: "Tab",
      email: "tab@example.com",
      plan: "free",
      createdAt: "2026-02-01T00:00:00.000Z",
    };
    persistentStorage.setItem(SESSION_KEY, JSON.stringify(persistent));
    tabStorage.setItem(SESSION_KEY, JSON.stringify(tab));

    useSession().setPlan("scale");

    expect(JSON.parse(tabStorage.getItem(SESSION_KEY)!)).toEqual({ ...tab, plan: "scale" });
    expect(JSON.parse(persistentStorage.getItem(SESSION_KEY)!)).toEqual(persistent);
  });

  it("signs out of both session stores without deleting workspace data", () => {
    persistentStorage.setItem(SESSION_KEY, "persistent-session");
    tabStorage.setItem(SESSION_KEY, "tab-session");
    persistentStorage.setItem("preflight.mode", "live");
    tabStorage.setItem("preflight.unsaved-draft", "keep-me");

    useSession().signOut();

    expect(persistentStorage.getItem(SESSION_KEY)).toBeNull();
    expect(tabStorage.getItem(SESSION_KEY)).toBeNull();
    expect(persistentStorage.getItem("preflight.mode")).toBe("live");
    expect(tabStorage.getItem("preflight.unsaved-draft")).toBe("keep-me");
  });
});
