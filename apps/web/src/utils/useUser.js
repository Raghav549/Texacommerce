'use client';
import { useSession } from 'next-auth/react';
// Consumers of this optional helper must be inside an Auth.js SessionProvider.
export default function useUser() {
  const { data, status } = useSession();
  return { data: data?.user || null, loading: status === 'loading' };
}
