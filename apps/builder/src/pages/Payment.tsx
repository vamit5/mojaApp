import { useEffect, useState } from "react";
import { Icon } from "@mojapp/ui";
import { Link } from "../router";
import { supabase } from "../lib/supabase";
import { money } from "./Offer";
import { track } from "../lib/analytics";
import "./share.css";
import "./offer.css";

type State = { s: "checking" } | { s: "paid"; token: string | null; amount: number; kind: string } | { s: "pending" } | { s: "error" };

/** Povratak sa Stripe-a: potvrđuje uplatu kod servera i vodi klijenta u portal. */
export function Payment() {
  const [state, setState] = useState<State>({ s: "checking" });
  const sessionId = new URLSearchParams(location.search).get("session_id") ?? "";

  useEffect(() => {
    document.title = "Plaćanje · MojApp";
    if (!supabase || !/^cs_(live|test)_/.test(sessionId)) { setState({ s: "error" }); return; }
    let tries = 0;
    const check = async () => {
      const { data, error } = await supabase!.functions.invoke("payment-verify", { body: { session_id: sessionId } });
      if (!error && data?.paid) {
        setState({ s: "paid", token: data.project_token, amount: Number(data.amount), kind: data.kind });
        track("payment_completed", { value: Number(data.amount), currency: "EUR", kind: data.kind });
        return;
      }
      if (++tries < 5) setTimeout(check, 2500); // banka ponekad potvrdi sa par sekundi zakašnjenja
      else setState(error ? { s: "error" } : { s: "pending" });
    };
    check();
  }, [sessionId]);

  return (
    <div className="s-center">
      <div className="o-doc p-result">
        {state.s === "checking" && <><div className="s-spinner" aria-label="Proveravamo" /><h1>Proveravamo uplatu…</h1><p className="o-muted">Ovo traje par sekundi.</p></>}
        {state.s === "paid" && (
          <>
            <div className="p-check"><Icon name="check" size={30} /></div>
            <h1>Uplata je primljena</h1>
            <p className="o-muted">{state.kind === "balance" ? "Hvala! Aplikacija ide na objavu." : `Hvala! Uplatili ste ${money(state.amount)}. Počinjemo izradu vaše aplikacije.`} Potvrdu o uplati Stripe šalje na vaš email.</p>
            {state.token && <Link to={`/projekat/${state.token}`} className="b-btn is-big">Pratite izradu aplikacije</Link>}
            {state.token && <p className="o-muted p-small">Sačuvajte ovaj link. Preko njega u svakom trenutku vidite status projekta.</p>}
          </>
        )}
        {state.s === "pending" && (
          <><h1>Uplata se još obrađuje</h1><p className="o-muted">Banka još nije potvrdila uplatu. Ništa ne morate da radite: čim stigne potvrda, videćete je u svom portalu, a mi ćemo vam se javiti.</p>
            <button type="button" className="b-btn" onClick={() => location.reload()}>Proveri ponovo</button></>
        )}
        {state.s === "error" && (
          <><h1>Ne možemo da proverimo uplatu</h1><p className="o-muted">Ako ste platili, uplata je sigurna i videćemo je u našem sistemu. Javite nam se ako imate pitanja.</p>
            <Link to="/" className="b-btn is-ghost">Na početnu</Link></>
        )}
      </div>
    </div>
  );
}
