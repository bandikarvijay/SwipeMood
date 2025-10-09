// backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MongoDB connection
mongoose
  .connect("mongodb+srv://SwipeMood:W9s1CmfegALiioYL@cluster0.jz2yyaw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

// ✅ API routes
app.use("/api/rooms", roomRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://swipe-mood.vercel.app/"],
    methods: ["GET", "POST"],
  },
});

// 🧠 Store current video for each room (in-memory for now)
const currentVideos = {};

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // ✅ Join a specific room
  socket.on("join-room", (roomCode) => {
    socket.join(roomCode);
    console.log(`👋 ${socket.id} joined room ${roomCode}`);

    // Send current playing video to the new user
    if (currentVideos[roomCode]) {
      console.log(`🔄 Syncing video for ${socket.id}:`, currentVideos[roomCode]);
      socket.emit("sync-video", currentVideos[roomCode]);
    }
  });

  // ✅ When admin plays a new video
  socket.on("play-video", ({ roomCode, videoUrl }) => {
    console.log(`🎵 Admin played in ${roomCode}: ${videoUrl}`);
    currentVideos[roomCode] = videoUrl;

    // Notify all users except sender
    socket.to(roomCode).emit("sync-video", videoUrl);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});

