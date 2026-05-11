/**
 * PATCH /api/players/[id]/status
 * Update a player's registration status (pending | approved | rejected)
 */
import connectDB from '../../../../../lib/mongodb';
import Player from '../../../../../models/Player';
import { successResponse, errorResponse } from '../../../../../utils/apiHelpers';

export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    const VALID_STATUSES = ['pending', 'approved', 'rejected'];

    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(
        `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        400
      );
    }

    const player = await Player.findByIdAndUpdate(
      id,
      { status },
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

    return successResponse({ player }, 'Player status updated successfully.');
  } catch (error) {
    console.error('Update player status error:', error);
    return errorResponse('Failed to update player status.', 500);
  }
}