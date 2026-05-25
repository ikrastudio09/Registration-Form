import connectDB from '../../../../../lib/mongodb';
import Player from '../../../../../models/Player';
import { successResponse, errorResponse } from '../../../../../utils/apiHelpers';


export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const {playerPool} = body;

    const player = await Player.findByIdAndUpdate(
      id,
      { playerPool },
      { new: true, runValidators: true }
    )
      .select(
        'playerID playerName playerPhone Age playerPhoto.url ' +
        'playingStyle playerType previousTeam playerPool playerCategory ' +
        'paymentScreenshot.url transactionId status createdAt updatedAt'
      )
      .lean();

    if (!player) {
      return errorResponse('Player not found.', 404);
    }

    return successResponse({ player }, 'Player pool updated successfully.');
  } catch (error) {
    console.error('Update player pool error:', error);
    return errorResponse('Failed to update player pool.', 500);
  }
}