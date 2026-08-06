import axios from "axios";

import { clearSession } from "./session";

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
    // 401: o token venceu (ou é inválido) no meio da sessão. Sem isto o app
    // continuava aberto com um token morto e cada tela ficava vazia em silêncio,
    // indistinguível de "não há registros". Limpa e volta para o login.
    // A rota de login é exceção: lá o 401 é "senha errada", tratado na tela.
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/")) {
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login?sessao=expirada");
      }
      return Promise.reject(err);
    }

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
