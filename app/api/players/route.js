/**
 * GET /api/players
 * Fetch all registered players with pagination and filtering
 */
import connectDB from '@/lib/mongodb';
import Player from '@/models/Player';
import { successResponse, errorResponse } from '@/utils/apiHelpers';

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    // Build query
    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;

    // Execute query with pagination
    const [players, total] = await Promise.all([
      Player.find(query)
        .select('-playerPhoto.public_id -paymentScreenshot.public_id') // Exclude sensitive fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Player.countDocuments(query),
    ]);

    return successResponse({
      players,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Fetch players error:', error);
    return errorResponse('Failed to fetch players.', 500);
  }
}
