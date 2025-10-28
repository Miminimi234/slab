// Load Buffer polyfill FIRST before any other imports
import "./lib/bufferPolyfill";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
