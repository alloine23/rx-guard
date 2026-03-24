import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.institutionId = user.institutionId;
        token.institutionType = user.institutionType;
        token.isActive = user.isActive;
        token.forcePasswordChange = user.forcePasswordChange;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as import("@prisma/client").UserRole;
      session.user.institutionId = token.institutionId as string | null;
      session.user.institutionType = token.institutionType as import("@prisma/client").InstitutionType | null;
      session.user.isActive = token.isActive as boolean;
      session.user.forcePasswordChange = token.forcePasswordChange as boolean;
      return session;
    },
  },
} satisfies NextAuthConfig;
