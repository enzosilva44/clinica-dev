import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";

import "./index.css";

import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";

import { AuthProvider } from "./contexts/AuthContext";
import { DemoInviteProvider } from "./contexts/DemoInviteContext";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DemoInviteProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "var(--creme-50)",
              color: "var(--verde)",
              border: "1px solid var(--creme-200)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#00704A", secondary: "#FAF7F2" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
        </DemoInviteProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);