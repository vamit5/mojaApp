import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { usePath } from "./router";
import { track } from "./lib/analytics";
import "./builder.css";

const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const Builder = lazy(() => import("./Builder").then((m) => ({ default: m.Builder })));
const DemoView = lazy(() => import("./pages/DemoView").then((m) => ({ default: m.DemoView })));
const Offer = lazy(() => import("./pages/Offer").then((m) => ({ default: m.Offer })));
const Admin = lazy(() => import("./admin/Admin").then((m) => ({ default: m.Admin })));

function App() {
  const path = usePath();
  useEffect(() => { track("page_view", { path }); }, [path]);

  let page;
  if (path === "/" || path === "") page = <Home />;
  else if (path.startsWith("/demo")) page = <Builder />;
  else if (path.startsWith("/d/")) page = <DemoView slug={decodeURIComponent(path.slice(3))} />;
  else if (path.startsWith("/ponuda/")) page = <Offer token={decodeURIComponent(path.slice(8))} />;
  else if (path.startsWith("/admin")) page = <Admin />;
  else page = <Home />;

  return <Suspense fallback={<div className="page-loading" aria-busy="true" />}>{page}</Suspense>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
