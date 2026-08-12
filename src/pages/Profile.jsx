import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {doc, getDoc, updateDoc} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {fetchJoinedSessions} from "../utils/attendance";
import {
  summarizeAttendance,
  formatAttendanceRate,
  getAttendanceLabel,
} from "../utils/attendanceUtils";
import {getSessionStartMillis} from "../utils/sessionUtils";

// Maps an attendance label to a class so the records list can colour-code
// Attended / Missed / etc. without the JSX carrying styling logic.
const LABEL_CLASS = {
  Attended: "attendance-tag-attended",
  "Checked in": "attendance-tag-in",
  Missed: "attendance-tag-missed",
  Upcoming: "attendance-tag-upcoming",
  Ongoing: "attendance-tag-upcoming",
  Cancelled: "attendance-tag-cancelled",
};
const YEAR_OPTIONS = ["Year 1", "Year 2", "Year 3", "Year 4", "Masters", "PhD"];

function getInitial(user) {
  const source = user?.displayName || user?.email || "U";
  return source.trim().charAt(0).toUpperCase() || "U";
}

function Profile() {
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [yearInput, setYearInput] = useState("");
  const [majorInput, setMajorInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      try {
        const joined = await fetchJoinedSessions(currentUser.uid);
        if (!cancelled) setSessions(joined);
      } catch (loadError) {
        console.error("Failed to load attendance records:", loadError);
        if (!cancelled) setError("Could not load your attendance records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [currentUser.uid]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (cancelled || !snap.exists()) return;

        const data = snap.data();
        setProfile(data);
        setYearInput(data.yearOfStudy || "");
        setMajorInput(data.major || "");
      } catch (loadError) {
        console.error("Failed to load profile:", loadError);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser.uid]);

  const summary = summarizeAttendance(sessions, currentUser.uid, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Most recent first, so the list opens on what the user just did.
  const orderedSessions = [...sessions].sort(
    (a, b) => getSessionStartMillis(b) - getSessionStartMillis(a)
  );

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setProfileMessage("");

    const trimmedMajor = majorInput.trim();

    if (trimmedMajor.length > 60) {
      setProfileMessage("Major must be 60 characters or fewer.");
      setSaving(false);
      return;
    }

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        yearOfStudy: yearInput,
        major: trimmedMajor,
      });

      setProfile((previous) => ({
        ...previous,
        yearOfStudy: yearInput,
        major: trimmedMajor,
      }));
      setEditing(false);
    } catch (saveError) {
      console.error("Failed to save profile:", saveError);
      setProfileMessage("Could not save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setYearInput(profile?.yearOfStudy || "");
    setMajorInput(profile?.major || "");
    setProfileMessage("");
    setEditing(false);
  }

  return (
    <main className="page">
      <h1>My Profile</h1>

      <section className="card profile-identity-card">
        <div className="profile-identity-header">
          <span className="profile-avatar">{getInitial(currentUser)}</span>
          <div className="profile-identity-text">
            <h2>{currentUser?.displayName || "NUS student"}</h2>
            <p className="profile-email">{currentUser?.email}</p>
          </div>
          {!editing && (
            <button
              type="button"
              className="session-action-button secondary-button"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form className="profile-edit-form" onSubmit={handleSaveProfile}>
            <label htmlFor="yearOfStudy">Year of study</label>
            <select
              id="yearOfStudy"
              value={yearInput}
              onChange={(event) => setYearInput(event.target.value)}
            >
              <option value="">Not set</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <label htmlFor="major">Major</label>
            <input
              id="major"
              value={majorInput}
              maxLength={60}
              placeholder="Computer Science"
              onChange={(event) => setMajorInput(event.target.value)}
            />

            {profileMessage && <p className="message">{profileMessage}</p>}

            <div className="profile-edit-actions">
              <button
                type="submit"
                className="session-action-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="session-action-button secondary-button"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="profile-detail-list">
            <div>
              <dt>Year of study</dt>
              <dd>{profile?.yearOfStudy || "Not set"}</dd>
            </div>
            <div>
              <dt>Major</dt>
              <dd>{profile?.major || "Not set"}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="card attendance-summary-card">
        <h2>Attendance</h2>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="message">{error}</p>
        ) : (
          <div className="attendance-stats">
            <div className="attendance-stat">
              <span className="attendance-stat-value">{summary.joined}</span>
              <span className="attendance-stat-label">Sessions joined</span>
            </div>
            <div className="attendance-stat">
              <span className="attendance-stat-value">{summary.attended}</span>
              <span className="attendance-stat-label">Attended</span>
            </div>
            <div className="attendance-stat">
              <span className="attendance-stat-value">{formatAttendanceRate(summary.rate)}</span>
              <span className="attendance-stat-label">Attendance rate</span>
            </div>
          </div>
        )}
      </section>

      {!loading && !error && (
        <section className="card attendance-records-card">
          <h2>Session history</h2>

          {orderedSessions.length === 0 ? (
            <p>
              You have not joined any sessions yet.{" "}
              <button className="link-button" onClick={() => navigate("/sessions")}>
                Browse sessions
              </button>
              .
            </p>
          ) : (
            <ul className="attendance-record-list">
              {orderedSessions.map((session) => {
                const label = getAttendanceLabel(session, currentUser.uid, now);
                return (
                  <li
                    key={session.id}
                    className="attendance-record"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/sessions/${session.id}`);
                      }
                    }}
                  >
                    <div className="attendance-record-main">
                      <span className="attendance-record-space">{session.studySpaceName}</span>
                      <span className="attendance-record-when">
                        {session.date} · {session.startTime}
                      </span>
                    </div>
                    {label && (
                      <span className={`attendance-tag ${LABEL_CLASS[label] || ""}`}>
                        {label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

export default Profile;
