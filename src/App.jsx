import {Routes, Route} from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import StudySpaces from "./pages/StudySpaces";
import CreateSession from "./pages/CreateSession";
import AllSessions from "./pages/AllSessions";

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/spaces"
          element={
            <ProtectedRoute>
              <StudySpaces />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-session"
          element={
            <ProtectedRoute>
              <CreateSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <AllSessions />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;