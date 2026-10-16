import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, createHashRouter, createMemoryRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "@/components/shell/AppShell";
import { LadeBildschirm } from "@/components/shell/LadeBildschirm";
import { useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import Login from "@/pages/public/Login";

const Cockpit = lazy(() => import("@/pages/Cockpit"));
const AktenListe = lazy(() => import("@/pages/akten/AktenListe"));
const AkteDetail = lazy(() => import("@/pages/akten/AkteDetail"));
const Posteingang = lazy(() => import("@/pages/posteingang/Posteingang"));
const Fristen = lazy(() => import("@/pages/fristen/Fristen"));
const Abrechnung = lazy(() => import("@/pages/abrechnung/Abrechnung"));
const FallDatenbank = lazy(() => import("@/pages/falldb/FallDatenbank"));
const KiStudio = lazy(() => import("@/pages/ki/KiStudio"));
const Motor = lazy(() => import("@/pages/motor/Motor"));
const Kontakte = lazy(() => import("@/pages/kontakte/Kontakte"));
const Umzug = lazy(() => import("@/pages/umzug/Umzug"));
const Hilfe = lazy(() => import("@/pages/hilfe/Hilfe"));
const Einstellungen = lazy(() => import("@/pages/einstellungen/Einstellungen"));
const ConsolePage = lazy(() => import("@/pages/console/Console"));
const Landing = lazy(() => import("@/pages/public/Landing"));

const s = (el: ReactNode) => <Suspense fallback={<div className="h-[60vh]" />}>{el}</Suspense>;

function Start() {
  const { sitzung, status } = useSession();
  if (status === "unbekannt") return <LadeBildschirm text="Einen Moment …" />;
  if (!sitzung) return <Navigate to="/willkommen" replace />;
  return <Navigate to={istConsole(sitzung) ? "/console" : "/cockpit"} replace />;
}

function ConsoleGuard() {
  const { sitzung } = useSession();
  if (!sitzung) return <Navigate to="/login" replace />;
  if (!istConsole(sitzung)) return <Navigate to="/cockpit" replace />;
  return s(<ConsolePage />);
}

const routes: RouteObject[] = [
  { path: "/", element: <Start /> },
  { path: "/willkommen", element: s(<Landing />) },
  { path: "/login", element: <Login /> },
  { path: "/console", element: <ConsoleGuard /> },
  {
    element: <AppShell />,
    children: [
      { path: "/cockpit", element: s(<Cockpit />) },
      { path: "/akten", element: s(<AktenListe />) },
      { path: "/akten/:id", element: s(<AkteDetail />) },
      { path: "/posteingang", element: s(<Posteingang />) },
      { path: "/fristen", element: s(<Fristen />) },
      { path: "/abrechnung", element: s(<Abrechnung />) },
      { path: "/fall-datenbank", element: s(<FallDatenbank />) },
      { path: "/ki", element: s(<KiStudio />) },
      { path: "/automatisierung", element: s(<Motor />) },
      { path: "/kontakte", element: s(<Kontakte />) },
      { path: "/umzug", element: s(<Umzug />) },
      { path: "/hilfe", element: s(<Hilfe />) },
      { path: "/einstellungen", element: s(<Einstellungen />) },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

export function createAppRouter() {
  const art = (import.meta.env.VITE_ROUTER as string | undefined) ?? "browser";
  if (art === "memory") {
    let start = "/";
    try {
      const h = window.location.hash.replace(/^#/, "");
      if (/^[a-z-]+$/.test(h) && ["willkommen", "login", "cockpit", "akten", "posteingang", "fristen", "ki"].includes(h)) start = `/${h}`;
    } catch {
      /* ignorieren */
    }
    return createMemoryRouter(routes, { initialEntries: [start] });
  }
  if (art === "hash") return createHashRouter(routes);
  return createBrowserRouter(routes);
}
