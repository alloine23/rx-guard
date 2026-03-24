import { UserRole, InstitutionType } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
    institutionId: string | null;
    institutionType: InstitutionType | null;
    isActive: boolean;
    forcePasswordChange: boolean;
  }

  interface Session {
    user: User & {
      id: string;
      email: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    institutionId: string | null;
    institutionType: InstitutionType | null;
    isActive: boolean;
    forcePasswordChange: boolean;
  }
}
