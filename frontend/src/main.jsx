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
              background: "#FAF7F2",
              color: "#00704A",
              border: "1px solid #E5D8C5",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#00704A", secondary: "#FAF7F2" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);