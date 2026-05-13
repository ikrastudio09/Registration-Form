import connectDB from "../../../lib/mongodb";
import Player from "../../../models/Player";
import {
  uploadPlayerPhoto,
  uploadPaymentScreenshot,
} from "../../../lib/cloudinary";
import {
  successResponse,
  errorResponse,
  parseMongooseErrors,
  validateRequiredFields,
  validateMobile,
} from "../../../utils/apiHelpers";

export async function POST(request) {
  try {
    // Connect to MongoDB
    await connectDB();

    // Parse request body
    const formData = await request.formData();

    const name = formData.get("name");
    const mobile = formData.get("mobile");
    const Age = formData.get("Age");
    const role = formData.get("role");
    const transactionId = formData.get("transactionId");
    const previousTeam = formData.get("previousTeam");

    const playingStyle = JSON.parse(formData.get("playingStyle"));

    const playerPhoto = formData.get("playerPhoto");

    const paymentScreenshot = formData.get("paymentScreenshot");

    // --- Validate required fields ---
    const requiredFields = [
      "name",
      "mobile",
      "playerPhoto",
      "playingStyle",
      "role",
      "Age",
      "paymentScreenshot",
      "transactionId",
    ];
    const body = {
      name,
      mobile,
      playerPhoto,
      playingStyle,
      role,
      Age,
      paymentScreenshot,
      transactionId,
    };

    const missingError = validateRequiredFields(body, requiredFields);

    // Validate mobile number
    if (!validateMobile(mobile)) {
      return errorResponse(
        "Invalid Indian mobile number. Must be 10 digits starting with 6-9.",
        400,
      );
    }

    // Validate playing styles count
    if (
      !Array.isArray(playingStyle) ||
      playingStyle.length === 0 ||
      playingStyle.length > 2
    ) {
      return errorResponse("Select 1 to 2 playing styles.", 400);
    }

    // Validate role
    const validRoles = ["Batsman", "Bowler", "All Rounder"];
    if (!validRoles.includes(role)) {
      return errorResponse(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        400,
      );
    }

    // Check for duplicate transaction ID before uploading images
    const existingPlayer = await Player.findOne({
      transactionId: transactionId.toUpperCase(),
    });
    if (existingPlayer) {
      return errorResponse(
        `Transaction ID "${transactionId}" is already registered. Please use a unique transaction ID.`,
        409,
      );
    }

    // --- Upload images to Cloudinary ---
    let playerPhotoData, paymentScreenshotData;

    try {
      [playerPhotoData, paymentScreenshotData] = await Promise.all([
        uploadPlayerPhoto(playerPhoto),
        uploadPaymentScreenshot(paymentScreenshot),
      ]);
    } catch (uploadError) {
      return errorResponse(`Image upload failed: ${uploadError.message}`, 500);
    }

    // --- Save player to MongoDB ---
    const player = new Player({
      playerName: name.trim(),
      playerPhone: mobile,
      Age,
      playerPhoto: playerPhotoData,
      playingStyle,
      playerType: role,
      previousTeam,
      paymentScreenshot: paymentScreenshotData,
      transactionId: transactionId.trim().toUpperCase(),
      status: "pending",
      playerCategory: "Undefined",
      playerPool: 0,
    });

    await player.save();

    // Return success with player data (excluding sensitive image public IDs)
    return successResponse(
      {
        id: player._id,
        name: player.playerName,
        mobile: player.playerPhone,
        playerPhoto: player.playerPhoto.url,
        playingStyle: player.playingStyle,
        role: player.playerType,
        Age: player.Age,
        transactionId: player.transactionId,
        status: player.status,
        createdAt: player.createdAt,
      },
      "Registration successful! Your application is under review.",
      201,
    );
  } catch (error) {
    console.error("Registration error:", error);

    // Handle Mongoose errors
    if (error.name === "ValidationError" || error.code === 11000) {
      const parsed = parseMongooseErrors(error);
      return errorResponse(parsed.message, parsed.status, parsed.errors);
    }

    return errorResponse("Registration failed. Please try again.", 500);
  }
}
