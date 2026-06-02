import {Link, useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext";

function Navbar() {
  const {currentUser, logout} = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">StudySync</Link>

      <div className="nav-links">
        {currentUser && (
          <>
            <Link to="/spaces">Study Spaces</Link>
            <Link to="/create-session">Create Session</Link>
            <Link to="/sessions">All Sessions</Link>
          </>
        )}

        {!currentUser ? (
          <>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
          </>
        ) : (
          <button onClick={handleLogout}>Logout</button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;