import { Navigate } from "react-router-dom";

export default function PrivateRoute({
  children,
  allowPasswordChange = false,
}) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" />;
  }

  // 1º acesso: se precisa trocar a senha, bloqueia o resto do app até trocar.
  if (!allowPasswordChange) {
    let mustChange = false;
    try {
      mustChange = JSON.parse(localStorage.getItem("user") || "{}").mustChangePassword;
    } catch {
      mustChange = false;
    }
    if (mustChange) return <Navigate to="/trocar-senha" />;
  }

  return children;
}