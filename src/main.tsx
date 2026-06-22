import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import { DocumentStoreProvider } from "@/state/documentStore";
import "./app/App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DocumentStoreProvider>
      <App />
    </DocumentStoreProvider>
  </React.StrictMode>
);

