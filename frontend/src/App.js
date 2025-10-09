import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CreateRoom from "./Pages/CreateRoom";
import Room from "./Pages/Room";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CreateRoom />} />
        <Route path="/room/:roomCode" element={<Room />} />
      </Routes>
    </Router>
  );
}

export default App;
