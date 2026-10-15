'use client';
import { signIn, signOut } from 'next-auth/react';
export default function useAuth() {
  const signInWithCredentials = options => signIn('credentials', options);
  return { signInWithCredentials, signOut };
}
