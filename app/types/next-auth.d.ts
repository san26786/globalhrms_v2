import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      isAdmin: boolean;
      oaId: string | null;
      oaBrandId: string | null;
    };
  }

  interface User {
    userId: string;
    isAdmin: boolean;
    oaId: string | null;
    oaBrandId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isAdmin?: boolean;
    oaId?: string | null;
    oaBrandId?: string | null;
  }
}