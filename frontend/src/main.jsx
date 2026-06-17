import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";

import "./index.css";

import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";

import { AuthProvider } from "./contexts/AuthContext";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#F2F0EB",
              color: "#00704A",
              border: "1px solid #DDD8CC",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#00704A", secondary: "#F2F0EB" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);