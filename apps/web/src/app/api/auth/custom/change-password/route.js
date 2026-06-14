import sql from "@/app/api/utils/sql";
import { verify, hash } from "argon2";

export async function POST(request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !currentPassword || !newPassword) {
      return Response.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Get current password hash
    const [user] =
      await sql`SELECT id, password FROM users WHERE id = ${userId} LIMIT 1`;
    if (!user)
      return Response.json({ error: "User not found" }, { status: 404 });

    // Verify current password
    const isValid = await verify(user.password, currentPassword);
    if (!isValid)
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );

    // Hash new password
    const hashedPassword = await hash(newPassword, {
      timeCost: 3,
      memoryCost: 65536,
    });

    // Update password in users table
    await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${userId}`;

    // Sync with auth_accounts
    try {
      const [authUser] =
        await sql`SELECT id FROM auth_users WHERE email = (SELECT email FROM users WHERE id = ${userId}) LIMIT 1`;
      if (authUser) {
        await sql`UPDATE auth_accounts SET password = ${hashedPassword} WHERE "userId" = ${authUser.id} AND provider = 'credentials-signup'`;
      }
    } catch {}

    return Response.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return Response.json(
      { error: "Failed to change password" },
      { status: 500 },
    );
  }
}
