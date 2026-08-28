import { Router } from "express";

import {
  register,
  login,
  googleLogin,
  createDemo,
  forgotPassword,
  resetPassword,
} from "./auth.controller.js";

const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/google", googleLogin);
authRoutes.post("/demo", createDemo);
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);

export { authRoutes };
