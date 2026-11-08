/**
 * GET /api/players
 * Fetch all registered players with pagination, advanced search, and filtering
 * Returns full player data matching the updated Player model
 */
import connectDB from "../../../lib/mongodb";
import Player from "../../../models/Player";
import { successResponse, errorResponse, calculateAge } from "../../../utils/apiHelpers";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status"); // pending | approved | rejected
    const playerType = searchParams.get("playerType"); // Batsman | Bowler | All Rounder
    const playingStyle = searchParams.get("playingStyle"); // e.g. Right Arm Batting
    const search = searchParams.get("search"); // name, phone, transactionId, playerID, tShirtNumber
    const playerCategory = searchParams.get("playerCategory");
    const playerPool = searchParams.get("playerPool");
    const profession = searchParams.get("profession");

    // Sorting
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (playerType) query.playerType = playerType;
    if (playingStyle) query.playingStyle = { $in: [playingStyle] };
    if (playerCategory) query.playerCategory = playerCategory;
    if (profession) query.profession = profession;
    if (playerPool !== null && playerPool !== undefined && playerPool !== "") {
      query.playerPool = Number(playerPool);
    }

    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      const orConditions = [
        { playerName: { $regex: trimmedSearch, $options: "i" } },
        { playerPhone: { $regex: trimmedSearch, $options: "i" } },
        { transactionId: { $regex: trimmedSearch, $options: "i" } },
      ];

      // If search is numeric, also search playerID and tShirtNumber
      const numericVal = Number(trimmedSearch);
      if (!isNaN(numericVal)) {
        orConditions.push({ playerID: numericVal });
        orConditions.push({ tShirtNumber: numericVal });
      }

      query.$or = orConditions;
    }

    // Allowed sort fields (whitelist to prevent injection)
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "playerID",
      "playerName",
      "dateOfBirth",
      "bloodGroup",
      "profession",
      "tShirtNumber",
      "Age",
      "status",
      "playerType",
      "playerPool",
    ];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : "createdAt";

    // Execute query with pagination
    const [playersRaw, total] = await Promise.all([
      Player.find(query)
        .select(
          "playerID playerName playerPhone dateOfBirth anniversary bloodGroup " +
            "fatherName motherName profession professionOther previousTeam playerAddress " +
            "previousPoints previousPerformance " +
            "playerPhoto.url playingStyle playerType playerPool playerCategory " +
            "tShirtSize pantSize tShirtNumber tShirtName " +
            "paymentScreenshot.url transactionId status Age createdAt updatedAt",
        )
        .sort({ [safeSortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Player.countDocuments(query),
    ]);

    // Attach calculated age dynamically while preserving historical Age fallback
    const players = playersRaw.map((p) => ({
      ...p,
      calculatedAge: calculateAge(p.dateOfBirth, p.Age),
    }));

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
      filters: { status, playerType, playingStyle, playerCategory, playerPool, profession, search },
    });
  } catch (error) {
    console.error("Fetch players error:", error);
    return errorResponse("Failed to fetch players.", 500);
  }
}