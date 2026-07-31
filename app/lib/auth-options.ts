// lib/auth-options.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // TODO: replace with users/user_master lookup + password check
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // login-redirect-resolver.ts and permission-class-resolver.ts logic plugs in here later
  },
};