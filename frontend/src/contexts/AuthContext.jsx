import {
  createContext,
  useContext,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import api from "../services/api";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  function getStoredUser() {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  }

  const [user, setUser] = useState(getStoredUser);

  const navigate = useNavigate();

  async function login(email, password) {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const { token, user } = response.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    setUser(user);
    navigate("/dashboard");
  }

  async function loginWithGoogle(credential) {
    const response = await api.post("/auth/google", { credential });
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    navigate("/dashboard");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

    navigate("/");
  }

  async function registerAndLogin(data) {
    const response = await api.post("/auth/register", data);
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    navigate("/dashboard");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        registerAndLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
