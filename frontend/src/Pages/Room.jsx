import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactPlayer from "react-player";
import "./Room.css";

const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY || "AIzaSyDgtLPxsAnZtdTUNPf7suwB92QLjExbHCA";

export default function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("everyone");

  const [videoUrl, setVideoUrl] = useState(""); 
  const [currentUrl, setCurrentUrl] = useState(""); 
  const [playing, setPlaying] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const playerRef = useRef(null);

  const userName = localStorage.getItem("userName");
  const userRole = localStorage.getItem("userRole");

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`https://swipemood.onrender.com/api/rooms/${roomCode}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load room");
        setRoom(data.room);
      } catch (err) {
        console.warn("Room load error (non-fatal here):", err?.message || err);
        setError(err.message || "");
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomCode]);

  function extractYoutubeId(urlOrText) {
    if (!urlOrText) return null;
    try {
      const url = new URL(urlOrText);
      if (url.hostname.includes("youtu")) {
        const byPath = url.pathname.split("/").filter(Boolean);
        if (url.hostname.includes("youtu.be") && byPath.length > 0) return byPath[0];
        const v = url.searchParams.get("v");
        if (v) return v;
      }
    } catch (e) {
    }

    const regex = /(?:v=|\/)([0-9A-Za-z_-]{11})/;
    const m = urlOrText.match(regex);
    if (m && m[1]) return m[1];
    return null;
  }

  function getInternalPlayer() {
    try {
      if (!playerRef.current) return null;
      if (typeof playerRef.current.getInternalPlayer === "function") {
        return playerRef.current.getInternalPlayer();
      }
      return playerRef.current.internalPlayer || null;
    } catch {
      return null;
    }
  }

  const handlePlayOrSearch = async () => {
    const id = extractYoutubeId(videoUrl);
    if (id) {
      const url = `https://www.youtube.com/watch?v=${id}`;
      setCurrentUrl(url);
      setPlaying(true);
      setSearchResults([]);
      return;
    }

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "AIzaSyDgtLPxsAnZtdTUNPf7suwB92QLjExbHCA") {
      alert("Please set your YouTube API key in Room.jsx (YOUTUBE_API_KEY).");
      return;
    }

    try {
      const q = encodeURIComponent(videoUrl);
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${q}&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      if (!data.items) {
        alert("No results from YouTube.");
        return;
      }
      setSearchResults(data.items);
    } catch (err) {
      console.error("YouTube search error:", err);
      alert("YouTube search failed. Check console.");
    }
  };

  const handleSelectSuggestion = (video) => {
    const videoId = (video?.id && (video.id.videoId || video.id)) || null;
    if (!videoId) {
      alert("Invalid selection");
      return;
    }
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    setCurrentUrl(url);
    setPlaying(true);
    setSearchResults([]); 
    setVideoUrl(video.snippet?.title || ""); 
  };

  const handlePlayerReady = () => {
    const p = getInternalPlayer();
    if (!p) return;
    try {
      if (typeof p.playVideo === "function") {
        p.playVideo();
      } else if (typeof p.play === "function") {
        p.play();
      }
    } catch (err) {

    }
  };

  const handlePlayerError = (e) => {
    console.error("Player error:", e);
    alert("Playback error occurred. See console for details.");
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
        await fetch(`https://swipemood.onrender.com/api/rooms/${roomCode}/upload`, {
          method: "POST",
          body: fd,
        });
        alert("Upload successful");
      } catch (err) {
        console.error("Upload failed:", err);
        alert("Upload failed");
      }
    };
    input.click();
  };

  const handleCloseRoom = async () => {
    if (!window.confirm("Close room? This will delete the room from the server.")) return;
    try {
      const res = await fetch(`https://swipemood.onrender.com/api/rooms/${roomCode}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Close failed");
      localStorage.removeItem("roomCode");
      navigate("/");
    } catch (err) {
      console.error("Close error:", err);
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
          {activeTab === "admins" ? (
            admins.length ? (
              admins.map((a, i) => (
                <div key={i} className="user-row">
                  <div className="avatar">{a.name?.charAt(0)?.toUpperCase()}</div>
                  <div className="meta">
                    <div className="name">{a.name}</div>
                    <div className="role">Admin</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-users">No admins yet</div>
            )
          ) : everyone.length ? (
            everyone.map((u, i) => (
              <div key={i} className="user-row">
                <div className="avatar">{u.name?.charAt(0)?.toUpperCase()}</div>
                <div className="meta">
                  <div className="name">{u.name}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-users">No users yet</div>
          )}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePlayOrSearch();
            }}
          />
          <button className="search-go" onClick={handlePlayOrSearch}>
            ▶
          </button>
        </div>

        {searchResults.length > 0 && (
          <ul className="suggestions">
            {searchResults.map((it) => {
              const vid = it.id.videoId || it.id;
              const title = it.snippet?.title || "";
              const channel = it.snippet?.channelTitle || "";
              return (
                <li key={vid} onClick={() => handleSelectSuggestion(it)}>
                  <div className="s-thumb">
                    <img src={it.snippet?.thumbnails?.default?.url} alt={title} />
                  </div>
                  <div className="s-meta">
                    <div className="s-title">{title}</div>
                    <div className="s-channel">{channel}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="video-wrapper">
          {currentUrl ? (
            <ReactPlayer
              ref={playerRef}
              key={currentUrl}
              url={currentUrl}
              playing={playing}
              controls
              width="100%"
              height="100%"
              onReady={handlePlayerReady}
              onError={handlePlayerError}
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
