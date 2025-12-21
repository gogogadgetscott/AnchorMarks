import React from "react";
import ReactDOM from "react-dom/client";
import { loadComponents } from "./layouts/loader";
import App from "./App";
import "@assets/styles.css";

// Load HTML fragments first (required for legacy code)
loadComponents();

const root = ReactDOM.createRoot(
  document.getElementById("app") || document.body,
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
