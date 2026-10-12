"use client";

/**
 * Holds the state of the portal demo while someone clicks around:
 * who they are "signed in" as, the responsibility form, and what has
 * been approved or answered. It lives in memory only, so a page refresh
 * resets everything. The real portal will load this from Firebase.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PortalModule } from "@/lib/types";
import { modules, roles, startingMainContact, startingRights, tasks, type DemoRole, type Level, type Task } from "@/lib/portal/demo";

const ROLE_KEY = "numa-demo-role";

type DemoState = {
  role: DemoRole;
  setRole: (role: DemoRole) => void;
  /** Index into `people` for the current role. */
  person: number;
  rights: Level[][];
  setRight: (person: number, moduleIndex: number, level: Level) => void;
  resetRights: () => void;
  mainContact: number;
  setMainContact: (person: number) => void;
  /** Decisions made in this session, by item id (e.g. "sd104" → "Approved"). */
  done: Record<string, string>;
  markDone: (id: string, outcome: string) => void;
  /** Does the current person have at least this level on a module? */
  can: (module: PortalModule, level: Level) => boolean;
  myTasks: Task[];
};

const Ctx = createContext<DemoState | null>(null);

const moduleIndex = (m: PortalModule) => modules.findIndex((x) => x.key === m);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>("architect");
  const [rights, setRights] = useState<Level[][]>(() => startingRights.map((r) => [...r]));
  const [mainContact, setMainContact] = useState(startingMainContact);
  const [done, setDone] = useState<Record<string, string>>({});

  // Pick up the role chosen on the login page (kept for this browser tab only).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ROLE_KEY) as DemoRole | null;
      if (saved && roles.some((r) => r.key === saved)) setRoleState(saved);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const setRole = useCallback((r: DemoRole) => {
    setRoleState(r);
    try {
      sessionStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);

  const person = roles.find((r) => r.key === role)?.person ?? 1;

  const value = useMemo<DemoState>(() => {
    const can = (m: PortalModule, level: Level) => rights[person][moduleIndex(m)] >= level;
    const myTasks = tasks.filter((t) => {
      if (done[t.id]) return false;
      if (t.to !== undefined) return t.to === person && can(t.module, 1);
      return can(t.module, t.need ?? 3);
    });
    return {
      role,
      setRole,
      person,
      rights,
      setRight: (p, mi, level) =>
        setRights((prev) => prev.map((row, ri) => (ri === p ? row.map((v, ci) => (ci === mi ? level : v)) : row))),
      resetRights: () => setRights(startingRights.map((r) => [...r])),
      mainContact,
      setMainContact,
      done,
      markDone: (id, outcome) => setDone((prev) => ({ ...prev, [id]: outcome })),
      can,
      myTasks,
    };
  }, [role, setRole, person, rights, mainContact, done]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo must be used inside <DemoProvider>");
  return v;
}

/** Used by the login page to choose who to enter the demo as. */
export function rememberDemoRole(role: DemoRole) {
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}
