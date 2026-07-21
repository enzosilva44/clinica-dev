import { Router } from "express";

import {
  register,
  login,
  googleLogin,
  createDemo,
} from "./auth.controller.js";

const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/google", googleLogin);
authRoutes.post("/demo", createDemo);

export { authRoutes };
