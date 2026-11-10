import connectDB from "../../../../../lib/mongodb";
import Player from "../../../../../models/Player";
import { successResponse, errorResponse, calculateAge } from "../../../../../utils/apiHelpers";

export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const { playerPool } = body;

    const playerRaw = await Player.findByIdAndUpdate(
      id,
      { playerPool },
      { new: true, runValidators: true },
    )
      .select(
        "playerID playerName playerPhone dateOfBirth anniversary bloodGroup " +
          "fatherName motherName profession professionOther previousTeam playerAddress " +
          "previousPoints previousPerformance " +
          "playerPhoto.url playingStyle playerType playerPool playerCategory " +
          "tShirtSize pantSize tShirtNumber tShirtName paymentMethod practice " +
          "paymentScreenshot.url transactionId status Age createdAt updatedAt",
      )
      .lean();

    if (!playerRaw) {
      return errorResponse("Player not found.", 404);
    }

    const player = {
      ...playerRaw,
      calculatedAge: calculateAge(playerRaw.dateOfBirth, playerRaw.Age),
    };

    return successResponse({ player }, "Player pool updated successfully.");
  } catch (error) {
    console.error("Update player pool error:", error);
    return errorResponse("Failed to update player pool.", 500);
  }
}