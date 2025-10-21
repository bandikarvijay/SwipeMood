// backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes.js";
import Room from "./models/Room.js";

const app = express();

// ✅ CORS for front-end domains
const allowedOrigins = [
  "https://swipemood-sage.vercel.app", // your deployed frontend
  "http://localhost:3000",             // local frontend
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

// 🧠 MongoDB
mongoose
  .connect(
    "mongodb+srv://SwipeMood:W9s1CmfegALiioYL@cluster0.jz2yyaw.mongodb.net/?retryWrites=true&w=majority"
  )
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

app.use("/api/rooms", roomRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// 🎵 In-memory caches
const currentVideos = {};
const roomChats = {}; // store chats temporarily

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join-room", async ({ roomCode, userName, userRole }) => {
    socket.join(roomCode);
    console.log(`${userName} joined room ${roomCode} (${userRole})`);

    // Fetch room and update members
    const room = await Room.findOne({ roomCode });
    if (room) {
      if (userName === room.admin) userRole = "Admin";
      else if (!room.everyone.includes(userName)) {
        room.everyone.push(userName);
        await room.save();
      }

      const allUsers = [
        { name: room.admin, role: "Admin" },
        ...room.everyone.map((n) => ({ name: n, role: "Everyone" })),
      ];

      io.to(roomCode).emit("user-joined", allUsers);
    }

    // Send current video & chat history
    if (currentVideos[roomCode]) socket.emit("sync-video", currentVideos[roomCode]);
    if (roomChats[roomCode]) socket.emit("chat-history", roomChats[roomCode]);
  });

  socket.on("play-video", ({ roomCode, videoUrl }) => {
    currentVideos[roomCode] = videoUrl;
    socket.to(roomCode).emit("sync-video", videoUrl);
  });

  socket.on("chat-message", ({ roomCode, msg }) => {
    if (!roomChats[roomCode]) roomChats[roomCode] = [];
    roomChats[roomCode].push(msg);
    io.to(roomCode).emit("chat-message", msg);
  });

  socket.on("close-room", async (roomCode) => {
    try {
      await Room.findOneAndDelete({ roomCode });
      delete currentVideos[roomCode];
      delete roomChats[roomCode];
      io.to(roomCode).emit("room-closed");
      console.log(`🗑️ Room ${roomCode} deleted by Admin`);
    } catch (err) {
      console.error("Delete room error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ✅ Use process.env.PORT for Render deployment
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
