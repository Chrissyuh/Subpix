import React from "react";
import ReactDOM from "react-dom/client";
import { Site } from "../src/site/Site";

ReactDOM.createRoot(document.getElementById("site-root") as HTMLElement).render(
  <React.StrictMode>
    <Site />
  </React.StrictMode>
);
