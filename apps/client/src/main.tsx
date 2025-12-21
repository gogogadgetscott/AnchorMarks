import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@assets/styles.css";

// Mount React app at #app
const appElement = document.getElementById("app");
if (!appElement) throw new Error("App mount point not found");

const root = ReactDOM.createRoot(appElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
