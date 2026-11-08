/**
 * GET /api/players/[id]
 * PATCH /api/players/[id]
 * Fetch individual player details and update player information (Admin)
 */
import connectDB from "../../../../lib/mongodb";
import Player from "../../../../models/Player";
import {
  successResponse,
  errorResponse,
  parseMongooseErrors,
  validateMobile,
  validateDate,
  calculateAge,
} from "../../../../utils/apiHelpers";
import {
  BLOOD_GROUPS,
  PROFESSIONS,
  PLAYER_ROLES,
  PLAYING_STYLES,
  CLOTHING_SIZES,
  PREVIOUS_TEAMS,
  TSHIRT_NUMBER_MIN,
  TSHIRT_NUMBER_MAX,
  TSHIRT_NAME_MAX_LENGTH,
} from "../../../../constants/playerOptions";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const playerRaw = await Player.findById(id)
      .select(
        "playerID playerName playerPhone dateOfBirth anniversary bloodGroup " +
          "fatherName motherName profession professionOther previousTeam playerAddress " +
          "previousPoints previousPerformance " +
          "playerPhoto.url playingStyle playerType playerPool playerCategory " +
          "tShirtSize pantSize tShirtNumber tShirtName " +
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

    return successResponse({ player });
  } catch (error) {
    console.error("Fetch player detail error:", error);
    return errorResponse("Failed to fetch player details.", 500);
  }
}

export async function PATCH(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const existingPlayer = await Player.findById(id);
    if (!existingPlayer) {
      return errorResponse("Player not found.", 404);
    }

    const updateFields = {};

    // 1. Full Name
    if (body.playerName !== undefined) {
      const name = String(body.playerName).trim();
      if (name.length < 2 || name.length > 100) {
        return errorResponse("Full name must be between 2 and 100 characters.", 400);
      }
      updateFields.playerName = name;
    }

    // 2. Mobile
    if (body.playerPhone !== undefined) {
      const mobile = String(body.playerPhone).trim();
      if (!validateMobile(mobile)) {
        return errorResponse("Invalid Indian mobile number (10 digits starting with 6-9).", 400);
      }
      updateFields.playerPhone = mobile;
    }

    // 3. Date of Birth
    if (body.dateOfBirth !== undefined) {
      const dobError = validateDate(body.dateOfBirth, {
        required: true,
        allowFuture: false,
        fieldName: "Date of Birth",
      });
      if (dobError) return errorResponse(dobError, 400);
      updateFields.dateOfBirth = new Date(body.dateOfBirth);
    }

    // 4. Anniversary
    if (body.anniversary !== undefined) {
      if (body.anniversary) {
        const annivError = validateDate(body.anniversary, {
          required: false,
          allowFuture: false,
          fieldName: "Marriage anniversary",
        });
        if (annivError) return errorResponse(annivError, 400);
        updateFields.anniversary = new Date(body.anniversary);
      } else {
        updateFields.anniversary = null;
      }
    }

    // 5. Blood Group
    if (body.bloodGroup !== undefined) {
      if (!BLOOD_GROUPS.includes(body.bloodGroup)) {
        return errorResponse(`Invalid blood group. Must be one of: ${BLOOD_GROUPS.join(", ")}`, 400);
      }
      updateFields.bloodGroup = body.bloodGroup;
    }

    // 6. Father's Name
    if (body.fatherName !== undefined) {
      const fn = String(body.fatherName).trim();
      if (fn.length < 2 || fn.length > 100) {
        return errorResponse("Father's name must be between 2 and 100 characters.", 400);
      }
      updateFields.fatherName = fn;
    }

    // 7. Mother's Name
    if (body.motherName !== undefined) {
      const mn = String(body.motherName).trim();
      if (mn.length < 2 || mn.length > 100) {
        return errorResponse("Mother's name must be between 2 and 100 characters.", 400);
      }
      updateFields.motherName = mn;
    }

    // 8. Profession & Custom Profession
    if (body.profession !== undefined) {
      if (!PROFESSIONS.includes(body.profession)) {
        return errorResponse("Invalid profession option selected.", 400);
      }
      updateFields.profession = body.profession;

      if (body.profession === "Other") {
        const custProf = String(body.professionOther || "").trim();
        if (!custProf) {
          return errorResponse("Please specify custom profession when 'Other' is selected.", 400);
        }
        if (custProf.length > 100) {
          return errorResponse("Custom profession cannot exceed 100 characters.", 400);
        }
        updateFields.professionOther = custProf;
      } else {
        updateFields.professionOther = "";
      }
    } else if (body.professionOther !== undefined && existingPlayer.profession === "Other") {
      const custProf = String(body.professionOther).trim();
      if (!custProf) {
        return errorResponse("Custom profession cannot be empty.", 400);
      }
      if (custProf.length > 100) {
        return errorResponse("Custom profession cannot exceed 100 characters.", 400);
      }
      updateFields.professionOther = custProf;
    }

    // 9. Previous Team
    if (body.previousTeam !== undefined) {
      const pt = String(body.previousTeam || "").trim();
      if (pt && !PREVIOUS_TEAMS.includes(pt)) {
        return errorResponse("Please select a valid previous team from the options.", 400);
      }
      updateFields.previousTeam = pt;
    }

    // 10. Playing Style
    if (body.playingStyle !== undefined) {
      if (!Array.isArray(body.playingStyle) || body.playingStyle.length < 1 || body.playingStyle.length > 2) {
        return errorResponse("Select 1 to 2 playing styles.", 400);
      }
      for (const style of body.playingStyle) {
        if (!PLAYING_STYLES.includes(style)) {
          return errorResponse(`Invalid playing style: "${style}".`, 400);
        }
      }
      updateFields.playingStyle = body.playingStyle;
    }

    // 11. Player Role (playerType)
    if (body.playerType !== undefined || body.role !== undefined) {
      const roleVal = body.playerType || body.role;
      if (!PLAYER_ROLES.includes(roleVal)) {
        return errorResponse(`Invalid player role. Must be one of: ${PLAYER_ROLES.join(", ")}`, 400);
      }
      updateFields.playerType = roleVal;
    }

    // 12. Clothing Sizes
    if (body.tShirtSize !== undefined) {
      if (!CLOTHING_SIZES.includes(body.tShirtSize)) {
        return errorResponse(`Invalid T-shirt size. Must be one of: ${CLOTHING_SIZES.join(", ")}`, 400);
      }
      updateFields.tShirtSize = body.tShirtSize;
    }

    if (body.pantSize !== undefined) {
      if (!CLOTHING_SIZES.includes(body.pantSize)) {
        return errorResponse(`Invalid pant size. Must be one of: ${CLOTHING_SIZES.join(", ")}`, 400);
      }
      updateFields.pantSize = body.pantSize;
    }

    // 13. T-Shirt Number
    if (body.tShirtNumber !== undefined) {
      const num = Number(body.tShirtNumber);
      if (!Number.isInteger(num) || num < TSHIRT_NUMBER_MIN || num > TSHIRT_NUMBER_MAX) {
        return errorResponse(
          `T-shirt number must be an integer between ${TSHIRT_NUMBER_MIN} and ${TSHIRT_NUMBER_MAX}.`,
          400,
        );
      }
      updateFields.tShirtNumber = num;
    }

    // 14. T-Shirt Name
    if (body.tShirtName !== undefined) {
      const tName = String(body.tShirtName).trim().toUpperCase();
      if (!tName || tName.length > TSHIRT_NAME_MAX_LENGTH) {
        return errorResponse(
          `T-shirt name is required and cannot exceed ${TSHIRT_NAME_MAX_LENGTH} characters.`,
          400,
        );
      }
      updateFields.tShirtName = tName;
    }

    // 15. Address Details (AddressSchema)
    if (body.playerAddress !== undefined) {
      updateFields.playerAddress = Array.isArray(body.playerAddress)
        ? body.playerAddress
        : [body.playerAddress];
    } else if (
      body.addressLine1 !== undefined ||
      body.city !== undefined ||
      body.state !== undefined ||
      body.pinCode !== undefined
    ) {
      const existingAddr =
        (existingPlayer.playerAddress && existingPlayer.playerAddress[0]) || {};
      const addr1 =
        body.addressLine1 !== undefined
          ? String(body.addressLine1).trim()
          : existingAddr.AddressLine1 || "";
      const addr2 =
        body.addressLine2 !== undefined
          ? String(body.addressLine2).trim()
          : existingAddr.AddressLine2 || "";
      const cityVal =
        body.city !== undefined
          ? String(body.city).trim()
          : existingAddr.City || "";
      const stateVal =
        body.state !== undefined
          ? String(body.state).trim()
          : existingAddr.State || "";
      const pinVal =
        body.pinCode !== undefined
          ? String(body.pinCode).trim()
          : existingAddr.PinCode || "";
      const countryVal =
        body.country !== undefined
          ? String(body.country).trim()
          : existingAddr.Country || "India";

      if (!addr1) {
        return errorResponse("Address Line 1 is required.", 400);
      }
      if (!cityVal) {
        return errorResponse("City is required.", 400);
      }
      if (!stateVal) {
        return errorResponse("State is required.", 400);
      }
      if (!pinVal) {
        return errorResponse("Pin Code is required.", 400);
      }

      updateFields.playerAddress = [
        {
          AddressLine1: addr1,
          AddressLine2: addr2 || undefined,
          City: cityVal,
          State: stateVal,
          PinCode: pinVal,
          Country: countryVal,
        },
      ];
    }

    // 16. Previous Points
    if (body.previousPoints !== undefined) {
      const pts =
        body.previousPoints === "" || body.previousPoints === null
          ? null
          : Number(body.previousPoints);
      if (pts !== null && isNaN(pts)) {
        return errorResponse("Previous points must be a valid number.", 400);
      }
      updateFields.previousPoints = pts;
    }

    // 17. Previous Performance Records
    if (body.previousPerformance !== undefined) {
      if (!Array.isArray(body.previousPerformance)) {
        return errorResponse(
          "previousPerformance must be an array of season records.",
          400,
        );
      }
      updateFields.previousPerformance = body.previousPerformance.map((item) => ({
        year:
          item.year !== undefined && item.year !== null && item.year !== ""
            ? Number(item.year)
            : undefined,
        matches: Number(item.matches) || 0,
        runs: Number(item.runs) || 0,
        wickets: Number(item.wickets) || 0,
        fielding: Number(item.fielding) || 0,
        mom: Number(item.mom) || 0,
        battingAvg: Number(item.battingAvg) || 0,
        strikeRate: Number(item.strikeRate) || 0,
        economy: Number(item.economy) || 0,
      }));
    }

    // Update document while preserving playerID, status, pool, category, photo, etc.
    const updatedPlayerRaw = await Player.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true },
    )
      .select(
        "playerID playerName playerPhone dateOfBirth anniversary bloodGroup " +
          "fatherName motherName profession professionOther previousTeam playerAddress " +
          "previousPoints previousPerformance " +
          "playerPhoto.url playingStyle playerType playerPool playerCategory " +
          "tShirtSize pantSize tShirtNumber tShirtName " +
          "paymentScreenshot.url transactionId status Age createdAt updatedAt",
      )
      .lean();

    const player = {
      ...updatedPlayerRaw,
      calculatedAge: calculateAge(updatedPlayerRaw.dateOfBirth, updatedPlayerRaw.Age),
    };

    return successResponse({ player }, "Player details updated successfully.");
  } catch (error) {
    console.error("Player update error:", error);
    if (error.name === "ValidationError" || error.code === 11000) {
      const parsed = parseMongooseErrors(error);
      return errorResponse(parsed.message, parsed.status, parsed.errors);
    }
    return errorResponse("Failed to update player information.", 500);
  }
}
