import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials?.email as string;
        const { allowed } = await rateLimit(`login:${email}`, 10, 900);
        if (!allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { institution: { select: { type: true } } },
        });

        if (!user || !user.isActive) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          institutionId: user.institutionId,
          institutionType: user.institution?.type ?? null,
          isActive: user.isActive,
          forcePasswordChange: user.forcePasswordChange,
        };
      },
    }),
  ],
});
