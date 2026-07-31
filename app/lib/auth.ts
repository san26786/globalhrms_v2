// lib/auth.ts
import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import { authOptions } from './auth-options'; // your NextAuth config object

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}