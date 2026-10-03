import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { AppConfig, ModuleKey } from "@mojapp/core";

/** Lokalno stanje demo aplikacije. U produkciji isti moduli koriste adapter ka backendu. */
export interface Booking { id: string; title: string; when: string; detail?: string }
export interface EngineState {
  tab: ModuleKey;
  bookingPreset?: string;          // id usluge izabrane pre ulaska u rezervaciju
  cart: Record<string, number>;
  bookings: Booking[];
  points: number;
  joined: string[];
  membership: string | null;
  modeOverride?: "light" | "dark";
}

type Action =
  | { type: "tab"; tab: ModuleKey; preset?: string }
  | { type: "cart"; id: string; delta: number }
  | { type: "cartClear" }
  | { type: "book"; booking: Booking }
  | { type: "points"; delta: number }
  | { type: "join"; id: string }
  | { type: "membership"; plan: string | null }
  | { type: "mode"; mode: "light" | "dark" | undefined };

function reducer(s: EngineState, a: Action): EngineState {
  switch (a.type) {
    case "tab": return { ...s, tab: a.tab, bookingPreset: a.preset };
    case "cart": {
      const q = Math.max(0, (s.cart[a.id] ?? 0) + a.delta);
      const cart = { ...s.cart };
      if (q) cart[a.id] = q; else delete cart[a.id];
      return { ...s, cart };
    }
    case "cartClear": return { ...s, cart: {} };
    case "book": return { ...s, bookings: [a.booking, ...s.bookings] };
    case "points": return { ...s, points: Math.max(0, s.points + a.delta) };
    case "join": return { ...s, joined: s.joined.includes(a.id) ? s.joined.filter((x) => x !== a.id) : [...s.joined, a.id] };
    case "membership": return { ...s, membership: a.plan };
    case "mode": return { ...s, modeOverride: a.mode };
  }
}

interface Ctx {
  config: AppConfig;
  state: EngineState;
  dispatch: (a: Action) => void;
  toast: (text: string, icon?: string) => void;
  toasts: { id: number; text: string; icon?: string }[];
  go: (tab: ModuleKey, preset?: string) => void;
}

const EngineCtx = createContext<Ctx | null>(null);

export function EngineProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tab: "home", cart: {}, bookings: [], points: 3, joined: [], membership: null });
  const [toasts, setToasts] = useState<Ctx["toasts"]>([]);
  const nextId = useRef(1);

  const toast = useCallback((text: string, icon?: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-1), { id, text, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);
  const go = useCallback((tab: ModuleKey, preset?: string) => dispatch({ type: "tab", tab, preset }), []);

  // ako je trenutni tab isključen u builderu, vrati na početnu
  const safeState = config.modules.includes(state.tab) ? state : { ...state, tab: "home" as ModuleKey };

  const value = useMemo(() => ({ config, state: safeState, dispatch, toast, toasts, go }), [config, safeState, toast, toasts, go]);
  return <EngineCtx.Provider value={value}>{children}</EngineCtx.Provider>;
}

export function useEngine() {
  const c = useContext(EngineCtx);
  if (!c) throw new Error("useEngine outside EngineProvider");
  return c;
}

/** Sve stavke kataloga u jednom nizu. */
export const allItems = (config: AppConfig) => config.catalog.flatMap((c) => c.items);
