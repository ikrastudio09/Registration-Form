/**
 * Player Registration Schema
 * Mongoose model for cricket tournament player registrations
 */
import mongoose from 'mongoose';
import PlayerCounter from './PlayerCounter';

const PlayerSchema = new mongoose.Schema(
  {
    playerID: {
      type: Number,
      unique: true
    },
    // Player's full name
    playerName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    // Indian mobile number (10 digits)
    playerPhone: {
      type: String,
      required: [true, 'Mobile number is required'],
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number'],
    },

    Age: {
      type: Number,
      required: true
    },

    // Player photo stored in Cloudinary
    playerPhoto: {
      url: {
        type: String,
        required: [true, 'Player photo is required'],
      },
      public_id: {
        type: String,
        required: [true, 'Player photo public ID is required'],
      },
    },

    // Playing styles (max 2 selections)
    playingStyle: {
      type: [String],
      required: [true, 'At least one playing style is required'],
      enum: {
        values: ['Right Arm Batting', 'Right Arm Balling', 'Left Arm Batting', 'Left Arm Balling'],
        message: '{VALUE} is not a valid playing style',
      },
      validate: {
        validator: function (arr) {
          return arr.length >= 1 && arr.length <= 2;
        },
        message: 'Select 1 to 2 playing styles only',
      },
    },

    // Player role in the team
    playerType: {
      type: String,
      required: [true, 'Player role is required'],
      enum: {
        values: ['Batsman', 'Bowler', 'All Rounder'],
        message: '{VALUE} is not a valid role',
      },
    },

    previousTeam: {
      type: String  
    },

    playerPool: {
      type: Number,
    },

    playerCategory:{
      type: String
    },

    // Payment screenshot stored in Cloudinary
    paymentScreenshot: {
      url: {
        type: String,
        required: [true, 'Payment screenshot is required'],
      },
      public_id: {
        type: String,
        required: [true, 'Payment screenshot public ID is required'],
      },
    },

    // Unique transaction ID from payment
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },

    // Registration status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  {
    // Auto timestamps: createdAt & updatedAt
    timestamps: true,
  }
);


PlayerSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await PlayerCounter.findOneAndUpdate(
      { id: "playerID" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.playerID = counter.seq;
  }
  next();
});



// Index for faster queries
PlayerSchema.index({ playerPhone: 1 });
PlayerSchema.index({ status: 1 });
PlayerSchema.index({ createdAt: -1 });

// Prevent model overwrite in development (hot reload)
const Player = mongoose.models.Player || mongoose.model('Player', PlayerSchema);

export default Player;
