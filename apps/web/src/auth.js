import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verify } from 'argon2';
import sql from '@/app/api/utils/sql';
import { allowAttempt } from '@/lib/throttle';

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials, request) {
      if (!process.env.DATABASE_URL || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') return null;
      if (credentials.email.length > 254 || credentials.password.length > 128 || !await allowAttempt(request, 'signin', 10)) return null;
      const [user] = await sql`SELECT id, email, name, password_hash, session_version FROM tx_accounts WHERE status = 'active' AND email = ${credentials.email.toLowerCase().trim()} LIMIT 1`;
      if (!user || !await verify(user.password_hash, credentials.password)) return null;
      return { id: String(user.id), email: user.email, name: user.name, sessionVersion: user.session_version };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.sessionVersion = user.sessionVersion; }
      if (!process.env.DATABASE_URL || !token.id) return null;
      try {
        const [account] = await sql`SELECT name,email,role,session_version FROM tx_accounts WHERE id=${token.id} AND status='active'`;
        if (!account || account.session_version !== token.sessionVersion) return null;
        token.name=account.name; token.email=account.email; token.role=account.role; return token;
      } catch { return null; }
    },
    session({ session, token }) { session.user.id = token.id; session.user.role = token.role; session.user.sessionVersion = token.sessionVersion; return session; },
  },
});
