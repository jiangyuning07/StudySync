import {Link, useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext";
import {useEffect, useRef, useState} from "react";

function getUserInitial(currentUser) {
  const source = currentUser?.displayName || currentUser?.email || "User";
  return source.trim().charAt(0).toUpperCase() || "U";
}

function UserMenu({currentUser, onLogout}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleLogoutClick() {
    setIsOpen(false);
    await onLogout();
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-label="Open user menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {currentUser?.photoURL ? (
          <img src={currentUser.photoURL} alt="User profile" referrerPolicy="no-referrer" />
        ) : (
          <span>{getUserInitial(currentUser)}</span>
        )}
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <strong>{currentUser?.displayName || "Account"}</strong>
            {currentUser?.email && <small>{currentUser.email}</small>}
          </div>

          <button type="button" className="user-dropdown-item" onClick={handleLogoutClick}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const {canAccessApp, currentUser, logout} = useAuth();
  const navigate = useNavigate();

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
            <Link to="/my-sessions">My Sessions</Link>
          </>
        )}

        {!canAccessApp ? (
          <>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
          </>
        ) : (
          <UserMenu currentUser={currentUser} onLogout={handleLogout} />
        )}
      </div>
    </nav>
  );
}

export default Navbar;