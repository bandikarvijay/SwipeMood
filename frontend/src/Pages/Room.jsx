import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactPlayer from "react-player/youtube";
import io from "socket.io-client";
import "./Room.css";

const socket = io("http://localhost:5000"); // ✅ your backend
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

  const playerRef = useRef(null);
  const userRole = localStorage.getItem("userRole");

  // ✅ 1. Load room from backend
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/rooms/${roomCode}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load room");
        setRoom(data.room);

        // Load current video if exists
        if (data.room.currentVideo) {
          setCurrentUrl(data.room.currentVideo);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomCode]);

  // ✅ 2. Socket setup
  useEffect(() => {
    socket.emit("join-room", roomCode);

    socket.on("sync-video", (url) => {
      console.log("🎵 Syncing video:", url);
      setCurrentUrl(url);
    });

    return () => {
      socket.off("sync-video");
    };
  }, [roomCode]);

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

  // ✅ 3. Handle playing a video
  const playVideo = async (youtubeUrl) => {
    console.log("▶ Playing:", youtubeUrl);
    setCurrentUrl("");
    setTimeout(() => setCurrentUrl(youtubeUrl), 100);
    setSearchResults([]);
    setVideoUrl("");

    // ✅ if admin, broadcast to others
    if (userRole === "Admin") {
      socket.emit("play-video", { roomCode, videoUrl: youtubeUrl });

      // store current video in backend
      try {
        await fetch(`http://localhost:5000/api/rooms/${roomCode}/current`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoUrl: youtubeUrl }),
        });
      } catch (err) {
        console.error("Failed to update room video:", err);
      }
    }
  };

  const handleSelectSuggestion = (video) => {
    const videoId = video?.id?.videoId || (typeof video?.id === "string" ? video.id : null);
    if (!videoId) {
      alert("Invalid video selected.");
      return;
    }
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    playVideo(youtubeUrl);
  };

  const handleUploadAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("track", file);
      try {
        await fetch(`http://localhost:5000/api/rooms/${roomCode}/upload`, {
          method: "POST",
          body: fd,
        });
        alert("Upload successful");
      } catch {
        alert("Upload failed");
      }
    };
    input.click();
  };

  const handleCloseRoom = async () => {
    if (!window.confirm("Close room?")) return;
    try {
      await fetch(`http://localhost:5000/api/rooms/${roomCode}`, {
        method: "DELETE",
      });
      localStorage.removeItem("roomCode");
      navigate("/");
    } catch {
      alert("Failed to close room");
    }
  };

  if (loading) return <div className="loading">Loading room...</div>;
  if (error && !room) return <div className="error">Error: {error}</div>;
  if (!room) return <div className="error">Room not found</div>;

  const admins = (room.users || []).filter((u) => u.role === "Admin");
  const everyone = (room.users || []).filter((u) => u.role !== "Admin");

  return (
    <div className="room-root">
      <aside className="left-panel">
        <div className="room-header">
          <h2>Room {room.roomCode}</h2>
        </div>

        <div className="tabs">
          <button
            className={activeTab === "everyone" ? "tab active" : "tab"}
            onClick={() => setActiveTab("everyone")}
          >
            Everyone
          </button>
          <button
            className={activeTab === "admins" ? "tab active" : "tab"}
            onClick={() => setActiveTab("admins")}
          >
            Admins
          </button>
        </div>

        <div className="users-box">
          <div className="section-title">CONNECTED USERS</div>
          {activeTab === "admins"
            ? admins.length
              ? admins.map((a, i) => (
                  <div key={i} className="user-row">
                    <div className="avatar">{a.name?.charAt(0)?.toUpperCase()}</div>
                    <div className="meta">
                      <div className="name">{a.name}</div>
                      <div className="role">Admin</div>
                    </div>
                  </div>
                ))
              : <div className="no-users">No admins yet</div>
            : everyone.length
            ? everyone.map((u, i) => (
                <div key={i} className="user-row">
                  <div className="avatar">{u.name?.charAt(0)?.toUpperCase()}</div>
                  <div className="meta">
                    <div className="name">{u.name}</div>
                  </div>
                </div>
              ))
            : <div className="no-users">No users yet</div>}
        </div>

        <div className="left-actions">
          <button className="upload-btn" onClick={handleUploadAudio}>
            + Upload audio
          </button>
          {userRole === "Admin" && (
            <button className="close-btn" onClick={handleCloseRoom}>
              ✖ Close Room
            </button>
          )}
        </div>
      </aside>

      <main className="center-panel">
        <div className="search-row">
          <input
            className="search-input"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube link or search song..."
            onKeyDown={(e) => e.key === "Enter" && handlePlayOrSearch()}
          />
          <button className="search-go" onClick={handlePlayOrSearch}>▶</button>
        </div>

        {searchResults.length > 0 && (
          <ul className="suggestions">
            {searchResults.map((it) => (
              <li key={it.id.videoId || it.id} onClick={() => handleSelectSuggestion(it)}>
                <div className="s-thumb">
                  <img src={it.snippet?.thumbnails?.default?.url} alt={it.snippet?.title} />
                </div>
                <div className="s-meta">
                  <div className="s-title">{it.snippet?.title}</div>
                  <div className="s-channel">{it.snippet?.channelTitle}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="video-wrapper">
          {currentUrl ? (
            <ReactPlayer
              ref={playerRef}
              url={currentUrl}
              playing={true}
              controls
              width="100%"
              height="100%"
              onReady={() => setReady(true)}
              onError={(e) => console.error("❌ Player Error:", e)}
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 1,
                    modestbranding: 1,
                    rel: 0,
                    enablejsapi: 1,
                  },
                },
              }}
            />
          ) : (
            <div className="no-video">No video selected</div>
          )}
        </div>
      </main>

      <aside className="right-panel">
        <div className="chat-title">Chat</div>
        <div className="chat-area">
          <div className="no-messages">No messages yet</div>
        </div>
        <div className="chat-input-row">
          <input placeholder="Message..." />
          <button>Send</button>
        </div>
      </aside>
    </div>
  );
}
