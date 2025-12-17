/**
 * AnchorMarks - Main Entry Point (Vite)
 * This is the main entry point for the Vite-powered frontend
 */

// Import styles first (Vite will process and inject them)
import "../css/styles.css";

// Import the main app module which will initialize everything
import "./app.js";

// Note: app.js expects DOM elements to exist, so HTML must be loaded first
// The index.html provides the structure, this file provides the behavior
