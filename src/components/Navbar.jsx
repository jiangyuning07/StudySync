import {Link, useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext";
import {isFullyVerifiedNusUser} from "../utils/authRules";

function Navbar() {
  const {currentUser, logout} = useAuth();
  const navigate = useNavigate();
  const canAccessApp = isFullyVerifiedNusUser(currentUser);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">StudySync</Link>

      <div className="nav-links">
        {canAccessApp && (
          <>
            <Link to="/spaces">Study Spaces</Link>
            <Link to="/create-session">Create Session</Link>
            <Link to="/sessions">All Sessions</Link>
          </>
        )}

        {!canAccessApp ? (
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