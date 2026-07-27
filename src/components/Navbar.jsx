import {Link, useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext";
import {useEffect, useRef, useState} from "react";
import NotificationBell from "./NotificationBell";
import {fetchJoinedSessions} from "../utils/attendance";
import {summarizeAttendance, formatAttendanceRate} from "../utils/attendanceUtils";

function getUserInitial(currentUser) {
  const source = currentUser?.displayName || currentUser?.email || "User";
  return source.trim().charAt(0).toUpperCase() || "U";
}

function UserMenu({currentUser, onLogout}) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    // Fetch whenever the menu opens so a recent check-in is reflected without
    // requiring a full page reload.
    if (!isOpen || !currentUser?.uid) return;

    // Opening the menu initiates this external Firestore synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummaryLoading(true);

    fetchJoinedSessions(currentUser.uid)
      .then((sessions) => {
        const s = summarizeAttendance(sessions, currentUser.uid);
        setSummary(s);
      })
      .catch((error) => {
        console.error("Failed to load attendance summary:", error);
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  }, [isOpen, currentUser]);

  async function handleLogoutClick() {
    setIsOpen(false);
    await onLogout();
  }

  function goToProfile() {
    setIsOpen(false);
    navigate("/profile");
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

          <div className="user-dropdown-attendance">
            {summaryLoading && !summary ? (
              <small>Loading your attendance...</small>
            ) : summary ? (
              <small>
                Joined {summary.joined} {summary.joined === 1 ? "session" : "sessions"} ·{" "}
                {formatAttendanceRate(summary.rate)} attendance
              </small>
            ) : (
              <small>Attendance record</small>
            )}
            <button type="button" className="user-dropdown-link" onClick={goToProfile}>
              Show past sessions
            </button>
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
          <>
            <NotificationBell currentUser={currentUser} />
            <UserMenu currentUser={currentUser} onLogout={handleLogout} />
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
