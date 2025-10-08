import express from "express";
import Room from "../models/Room.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { roomCode, userName } = req.body;
  try {
    const existingRoom = await Room.findOne({ roomCode });
    if (existingRoom)
      return res.status(400).json({ message: "Room already exists" });

    const newRoom = new Room({
      roomCode,
      admin: userName,
      everyone: [],
    });

    await newRoom.save();
    res.status(201).json({ success: true, room: newRoom });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/join", async (req, res) => {
  const { roomCode, userName } = req.body;
  try {
    const room = await Room.findOne({ roomCode });
    if (!room) return res.status(404).json({ message: "Room not found" });

    if (!room.everyone.includes(userName) && userName !== room.admin) {
      room.everyone.push(userName);
      await room.save();
    }

    res.json({ success: true, room });
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:roomCode", async (req, res) => {
  const { roomCode } = req.params;
  try {
    const room = await Room.findOne({ roomCode });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const formattedRoom = {
      roomCode: room.roomCode,
      users: [
        { name: room.admin, role: "Admin" },
        ...room.everyone.map((name) => ({ name, role: "Everyone" })),
      ],
      tracks: room.tracks || [],
    };

    res.json({ success: true, room: formattedRoom });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:roomCode", async (req, res) => {
  const { roomCode } = req.params;
  try {
    const deleted = await Room.findOneAndDelete({ roomCode });
    if (!deleted) return res.status(404).json({ message: "Room not found" });
    res.json({ success: true, message: "Room deleted" });
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
