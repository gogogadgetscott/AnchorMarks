import React from "react";
import ReactDOM from "react-dom/client";
import { loadComponents } from "./layouts/loader";
import App from "./App";
import "@assets/styles.css";

// Load HTML fragments first (required for legacy code)
loadComponents();

// Don't mount React at #app - it would clear the loaded components
// Instead, create a hidden React root just for state management
const reactRoot = document.createElement("div");
reactRoot.id = "react-root";
reactRoot.style.display = "none";
document.body.appendChild(reactRoot);

const root = ReactDOM.createRoot(reactRoot);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
