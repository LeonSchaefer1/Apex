import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { applyTheme, useUI } from "./store/ui";

applyTheme(useUI.getState().theme);
document.documentElement.setAttribute("data-density", useUI.getState().dichte);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
