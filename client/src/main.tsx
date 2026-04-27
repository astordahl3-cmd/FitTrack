import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Register service worker with correct base path
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Unregister any old SW from wrong scope first
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
      // Re-register with correct path (includes /FitTrack/ base)
      await navigator.serviceWorker.register('/FitTrack/sw.js');
    } catch {}
  });
}

// build: 2026-04-27
createRoot(document.getElementById("root")!).render(<App />);

