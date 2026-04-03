import { PrismaAdapter } from "@auth/prisma-adapter";
import type { User } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { getUserRoleById } from "@/lib/auth/admin";
import { consumeLoginCode } from "@/lib/auth/otp";
import { ensureDefaultNoteDocument } from "@/features/notes/service";
import { prisma } from "@/lib/prisma";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function toSafeUser(user: {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "password",
    name: "账号密码",
    credentials: {
      email: { label: "邮箱", type: "email" },
      password: { label: "密码", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email;
      const password = credentials?.password;

      if (!email || !password) {
        return null;
      }

      const normalizedEmail = normalizeEmail(email);
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user?.passwordHash) {
        return null;
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        return null;
      }

      return toSafeUser(user);
    },
  }),
  CredentialsProvider({
    id: "email-code",
    name: "邮箱验证码",
    credentials: {
      email: { label: "邮箱", type: "email" },
      code: { label: "验证码", type: "text" },
    },
    async authorize(credentials) {
      const email = credentials?.email;
      const code = credentials?.code;

      if (!email || !code) {
        return null;
      }

      const normalizedEmail = normalizeEmail(email);
      const validCode = await consumeLoginCode(normalizedEmail, code);
      if (!validCode) {
        return null;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!existingUser) {
        return null;
      }

      if (!existingUser.emailVerified) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: new Date() },
        });
      }

      return toSafeUser(existingUser);
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {});

        await ensureDefaultNoteDocument(user.id).catch(() => {});
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = await getUserRoleById(
          token.sub,
          session.user.email,
        );
      }

      return session;
    },
  },
};

export function getEnabledSocialProviders() {
  return {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    apple: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
  };
}
