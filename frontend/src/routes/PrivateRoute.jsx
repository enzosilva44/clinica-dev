import { Navigate } from "react-router-dom";

export default function PrivateRoute({
  children,
  allowPasswordChange = false,
  allowBlocked = false,
}) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" />;
  }

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem("user") || "{}"); } catch { stored = {}; }

  // 1º acesso: se precisa trocar a senha, bloqueia o resto do app até trocar.
  if (!allowPasswordChange && stored.mustChangePassword) {
    return <Navigate to="/trocar-senha" />;
  }

  // Inadimplência: passada a carência de 10 dias, tranca tudo até regularizar.
  if (!allowBlocked && stored.accessState === "blocked") {
    return <Navigate to="/acesso-bloqueado" />;
  }

  return children;
}
