import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactPlayer from "react-player/youtube";
import io from "socket.io-client";
import "./Room.css";

// ✅ Socket.IO connection for local and production
const SOCKET_URL =
  process.env.NODE_ENV === "production"
    ? "https://swipemood.onrender.com" // deployed backend URL
    : "http://localhost:5000";         // local backend

const socket = io(SOCKET_URL, { transports: ["websocket"] });

const YOUTUBE_API_KEY = "AIzaSyDgtLPxsAnZtdTUNPf7suwB92QLjExbHCA";

export default function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("everyone");
  const [videoUrl, setVideoUrl] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [users, setUsers] = useState([]);

  const playerRef = useRef(null);

  const userName = localStorage.getItem("userName");
  const userRole = localStorage.getItem("userRole");

  // ✅ Load room data from backend
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(
          `https://swipemood.onrender.com/api/rooms/${roomCode}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load room");
        setRoom(data.room);
        setUsers(data.room.users || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomCode]);

  // ✅ Join socket room
  useEffect(() => {
    if (!userName || !roomCode) return;

    socket.emit("join-room", { roomCode, userName, userRole });

    socket.on("user-joined", (list) => setUsers(list || []));
    socket.on("sync-video", (url) => setCurrentUrl(url));
    socket.on("chat-message", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("chat-history", (history) => setMessages(history));
    socket.on("room-closed", () => {
      alert("Room closed by Admin");
      navigate("/");
    });

    return () => {
      socket.off("user-joined");
      socket.off("sync-video");
      socket.off("chat-message");
      socket.off("chat-history");
      socket.off("room-closed");
    };
  }, [roomCode, userName, userRole, navigate]);

  // ✅ Parse YouTube links
  function extractYoutubeId(input) {
    if (!input) return null;
    try {
      const url = new URL(input);
      if (url.hostname.includes("youtu")) {
        const v = url.searchParams.get("v");
        if (v) return v;
        const pathParts = url.pathname.split("/");
        return pathParts[pathParts.length - 1];
      }
    } catch {}
    const match = input.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  }

  // ✅ Play or search video
  const handlePlayOrSearch = async () => {
    const id = extractYoutubeId(videoUrl);
    if (id) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${id}`;
      playVideo(youtubeUrl);
      return;
    }

    if (!YOUTUBE_API_KEY) {
      alert("Missing YouTube API key!");
      return;
    }

    try {
      const q = encodeURIComponent(videoUrl);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${q}&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      if (data.items?.length > 0) setSearchResults(data.items);
      else alert("No results found.");
    } catch (err) {
      console.error("YouTube search failed:", err);
      alert("YouTube search failed. Check console.");
    }
  };

  // ✅ Broadcast play to all users
  const playVideo = (youtubeUrl) => {
    setCurrentUrl("");
    setTimeout(() => setCurrentUrl(youtubeUrl), 100);
    setSearchResults([]);
    setVideoUrl("");
    if (userRole === "Admin") {
      socket.emit("play-video", { roomCode, videoUrl: youtubeUrl });
    }
  };

  const handleSelectSuggestion = (video) => {
    const videoId =
      video?.id?.videoId || (typeof video?.id === "string" ? video.id : null);
    if (!videoId) {
      alert("Invalid video selected.");
      return;
    }
    playVideo(`https://www.youtube.com/watch?v=${videoId}`);
  };

  // ✅ Send chat message
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const msg = { sender: userName, text: chatInput.trim(), time: new Date().toLocaleTimeString() };
    socket.emit("chat-message", { roomCode, msg });
    setChatInput("");
  };

  // ✅ Admin closes room
  const handleCloseRoom = () => {
    if (window.confirm("Are you sure you want to close this room?")) {
      socket.emit("close-room", roomCode);
    }
  };

  if (loading) return <div className="loading">Loading room...</div>;
  if (error && !room) return <div className="error">Error: {error}</div>;
  if (!room) return <div className="error">Room not found</div>;

  const admins = users.filter((u) => u.role === "Admin");
  const everyone = users.filter((u) => u.role !== "Admin");

  return (
    <div className="room-root">
      <aside className="left-panel">
        <div className="room-header">
          <h2>Room {room.roomCode}</h2>
          {userRole === "Admin" && (
            <button className="close-room-btn" onClick={handleCloseRoom}>❌ Close Room</button>
          )}
        </div>
        <div className="tabs">
          <button className={activeTab === "everyone" ? "tab active" : "tab"} onClick={() => setActiveTab("everyone")}>Everyone</button>
          <button className={activeTab === "admins" ? "tab active" : "tab"} onClick={() => setActiveTab("admins")}>Admins</button>
        </div>
        <div className="users-box">
          <div className="section-title">CONNECTED USERS</div>
          {activeTab === "admins"
            ? admins.length ? admins.map((a, i) => (
                <div key={i} className="user-row">
                  <div className="avatar">{a.name?.charAt(0) || "A"}</div>
                  <div className="meta"><div className="name">{a.name}</div><div className="role">Admin</div></div>
                </div>
              )) : <div className="no-users">No admins yet</div>
            : everyone.length ? everyone.map((u, i) => (
                <div key={i} className="user-row">
                  <div className="avatar">{u.name?.charAt(0) || "U"}</div>
                  <div className="meta"><div className="name">{u.name}</div><div className="role">Everyone</div></div>
                </div>
              )) : <div className="no-users">No users yet</div>
          }
        </div>
      </aside>

      <main className="center-panel">
        <div className="search-row">
          <input className="search-input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste YouTube link or search song..." onKeyDown={(e) => e.key === "Enter" && handlePlayOrSearch()} />
          <button className="search-go" onClick={handlePlayOrSearch}>▶</button>
        </div>

        {searchResults.length > 0 && (
          <ul className="suggestions">
            {searchResults.map((it) => (
              <li key={it.id.videoId || it.id} onClick={() => handleSelectSuggestion(it)}>
                <div className="s-thumb"><img src={it.snippet?.thumbnails?.default?.url} alt={it.snippet?.title} /></div>
                <div className="s-meta"><div className="s-title">{it.snippet?.title}</div><div className="s-channel">{it.snippet?.channelTitle}</div></div>
              </li>
            ))}
          </ul>
        )}

        <div className="video-wrapper">
          {currentUrl ? (
            <ReactPlayer ref={playerRef} url={currentUrl} playing={true} controls width="100%" height="100%" onReady={() => setReady(true)} onError={(e) => console.error("❌ Player Error:", e)} config={{ youtube: { playerVars: { autoplay: 1, modestbranding: 1, rel: 0, enablejsapi: 1 } } }} />
          ) : <div className="no-video">No video selected</div>}
        </div>
      </main>

      <aside className="right-panel">
        <div className="chat-title">Live Chat</div>
        <div className="chat-area">
          {messages.length ? messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.sender === userName ? "me" : "other"}`}>
              <b>{m.sender}</b>: {m.text}
              <div className="chat-time">{m.time}</div>
            </div>
          )) : <div className="no-messages">No messages yet</div>}
        </div>
        <div className="chat-input-row">
          <input placeholder="Message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
          <button onClick={sendMessage}>Send</button>
        </div>
      </aside>
    </div>
  );
}
