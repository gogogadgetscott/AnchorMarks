// Import styles first (Vite will process and inject them)
import "@assets/styles.css";

// Import the component loader
import { loadComponents } from "@layouts/loader.ts";

// Initialize components immediately
loadComponents();

// Import the main app module which will initialize everything
// Now that components are in the DOM, App.js can find them
import "./App.ts";
