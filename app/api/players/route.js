/**
 * GET /api/players
 * Fetch all registered players with pagination and filtering
 * Returns full player data matching the Player model
 */
import connectDB from '../../../lib/mongodb';
import Player from '../../../models/Player';
import { successResponse, errorResponse } from '../../../utils/apiHelpers';

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status');           // pending | approved | rejected
    const playerType = searchParams.get('playerType');   // Batsman | Bowler | All Rounder
    const playingStyle = searchParams.get('playingStyle'); // e.g. Right Arm Batting
    const search = searchParams.get('search');           // name or phone search
    const playerCategory = searchParams.get('playerCategory');
    const playerPool = searchParams.get('playerPool');

    // Sorting
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (playerType) query.playerType = playerType;
    if (playingStyle) query.playingStyle = { $in: [playingStyle] };
    if (playerCategory) query.playerCategory = playerCategory;
    if (playerPool !== null && playerPool !== undefined && playerPool !== '')
      query.playerPool = Number(playerPool);

    if (search) {
      query.$or = [
        { playerName: { $regex: search, $options: 'i' } },
        { playerPhone: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } },
      ];
    }

    // Allowed sort fields (whitelist to prevent injection)
    const allowedSortFields = [
      'createdAt', 'updatedAt', 'playerID', 'playerName',
      'Age', 'status', 'playerType', 'playerPool',
    ];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';

    // Execute query with pagination
    const [players, total] = await Promise.all([
      Player.find(query)
        .select(
          'playerID playerName playerPhone Age ' +
          'playerPhoto.url ' +                    // include photo URL, exclude public_id
          'playingStyle playerType previousTeam ' +
          'playerPool playerCategory ' +
          'paymentScreenshot.url ' +              // include screenshot URL, exclude public_id
          'transactionId status createdAt updatedAt'
        )
        .sort({ [safeSortField]: sortOrder })
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
      // Summary counts for dashboard stats
      filters: { status, playerType, playingStyle, playerCategory, playerPool, search },
    });
  } catch (error) {
    console.error('Fetch players error:', error);
    return errorResponse('Failed to fetch players.', 500);
  }
}