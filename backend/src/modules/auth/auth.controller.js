import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { prisma } from "../../config/prisma.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function buildToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
  };
}

export async function register(req, res) {
  const { name, email, password } = req.body;

  const userExists = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (userExists) {
    return res.status(400).json({
      error: "Usuário já existe",
    });
  }

  const passwordHash = await bcrypt.hash(password, 8);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
    },
  });

  return res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    return res.status(400).json({
      error: "Usuário ou senha inválidos",
    });
  }

  const passwordMatch = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatch) {
    return res.status(400).json({
      error: "Usuário ou senha inválidos",
    });
  }

  const token = buildToken(user);

  return res.json({
    token,
    user: publicUser(user),
  });
}

export async function googleLogin(req, res) {
  try {
    const { credential } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        error: "GOOGLE_CLIENT_ID não configurado",
      });
    }

    if (!credential) {
      return res.status(400).json({
        error: "Credential do Google obrigatória",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name || email;
    const avatarUrl = payload?.picture || null;

    if (!googleId || !email) {
      return res.status(400).json({
        error: "Conta Google sem e-mail válido",
      });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email },
        ],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleId,
          avatarUrl,
          authProvider: user.authProvider === "password" ? "password_google" : user.authProvider,
        },
      });
    } else {
      const randomPassword = await bcrypt.hash(
        `${googleId}-${crypto.randomUUID()}`,
        8
      );

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: randomPassword,
          googleId,
          avatarUrl,
          authProvider: "google",
        },
      });
    }

    const token = buildToken(user);

    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      error: "Login com Google inválido",
    });
  }
}
