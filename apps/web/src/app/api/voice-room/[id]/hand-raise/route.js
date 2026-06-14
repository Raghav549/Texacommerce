import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: roomId } = params;
    const { raised } = await request.json();

    const userProfile = await sql`
      SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1
    `;

    if (!userProfile || userProfile.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userProfile[0].id;

    await sql`
      UPDATE room_participants
      SET hand_raised = ${raised}
      WHERE room_id = ${roomId} AND user_id = ${userId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error raising hand:", error);
    return Response.json({ error: "Failed to raise hand" }, { status: 500 });
  }
}
