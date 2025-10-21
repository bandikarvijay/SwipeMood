import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  userName: String,
  text: String,
  time: String,
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
  messages: { type: [messageSchema], default: [] },
  nowPlaying: { type: nowPlayingSchema, default: () => ({}) },
});

export default mongoose.models.Room || mongoose.model("Room", roomSchema);
