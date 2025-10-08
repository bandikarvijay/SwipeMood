// backend/models/Room.js
import mongoose from "mongoose";

const trackSchema = new mongoose.Schema({
  title: String,
  path: String,
  uploadedBy: String,
});

const nowPlayingSchema = new mongoose.Schema({
  videoId: String,
  time: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
});

const roomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  admin: { type: String, required: true },
  everyone: { type: [String], default: [] },
  tracks: { type: [trackSchema], default: [] },
  nowPlaying: { type: nowPlayingSchema, default: () => ({}) },
});

export default mongoose.models.Room || mongoose.model("Room", roomSchema);
