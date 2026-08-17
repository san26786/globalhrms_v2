import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        username: {
          label: "Username or Email",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const login = credentials.username.trim();
        const password = credentials.password;

        /*
         * IMPORTANT:
         * Replace the Prisma model/field names below with the exact
         * names from your Prisma schema.
         */

        const user = await prisma.user_mst.findFirst({
          where: {
            OR: [
              {
                USER_NAME: {
                  equals: login,
                  mode: "insensitive",
                },
              },
              {
                REG_EMAIL_ID: {
                  equals: login,
                  mode: "insensitive",
                },
              },
            ],
          },
        });

        if (!user) {
          return null;
        }

        /*
         * If your database contains plaintext passwords from the
         * old system, DO NOT compare them directly.
         *
         * Passwords should be migrated to bcrypt hashes.
         */
        const passwordValid = await bcrypt.compare(
          password,
          user.PASSWORD
        );

        if (!passwordValid) {
          return null;
        }

        return {
          id: String(user.USER_ID),
          name: user.USER_NAME,
          email: user.REG_EMAIL_ID,

          userId: String(user.USER_ID),

          isAdmin: Boolean(user.IS_ADMIN),

          // Map these according to your actual Prisma model.
          oaId: user.OA_ID ? String(user.OA_ID) : null,
          oaBrandId: user.OA_BRAND_ID
            ? String(user.OA_BRAND_ID)
            : null,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",

    // 30 days
    maxAge: 30 * 24 * 60 * 60,

    // NextAuth JWT/session refresh window
    updateAge: 24 * 60 * 60,
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.userId;
        token.isAdmin = user.isAdmin;
        token.oaId = user.oaId;
        token.oaBrandId = user.oaBrandId;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId);
        session.user.isAdmin = Boolean(token.isAdmin);

        session.user.oaId = token.oaId
          ? String(token.oaId)
          : null;

        session.user.oaBrandId = token.oaBrandId
          ? String(token.oaBrandId)
          : null;
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      if (url.startsWith(baseUrl)) {
        return url;
      }

      return `${baseUrl}/dashboard`;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};