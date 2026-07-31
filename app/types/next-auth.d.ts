import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      oaId?: number | null;
      oaBrandId?: number | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}