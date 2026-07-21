import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization =
      `Bearer ${token}`;
  }

  return config;
});

// Se o acesso for suspenso durante a sessão (status mudou no servidor), o
// backend responde 403 SUBSCRIPTION_BLOCKED — mandamos direto pra tela de
// bloqueio, marcando o estado no user local para o PrivateRoute segurar.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 && err.response?.data?.code === "SUBSCRIPTION_BLOCKED") {
      try {
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        u.accessState = "blocked";
        localStorage.setItem("user", JSON.stringify(u));
      } catch { /* ignore */ }
      if (window.location.pathname !== "/acesso-bloqueado") {
        window.location.assign("/acesso-bloqueado");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
