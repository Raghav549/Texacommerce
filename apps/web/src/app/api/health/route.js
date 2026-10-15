export function GET() {
  return Response.json({ status: 'ok', databaseConfigured: Boolean(process.env.DATABASE_URL), authConfigured: Boolean(process.env.AUTH_SECRET), legacyServices: 'disabled' });
}
