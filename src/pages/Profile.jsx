import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
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
};

function Profile() {
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const summary = summarizeAttendance(sessions, currentUser.uid);

  // Most recent first, so the list opens on what the user just did.
  const orderedSessions = [...sessions].sort(
    (a, b) => getSessionStartMillis(b) - getSessionStartMillis(a)
  );

  return (
    <main className="page">
      <h1>My Profile</h1>

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
                const label = getAttendanceLabel(session, currentUser.uid);
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
                    <span className={`attendance-tag ${LABEL_CLASS[label] || ""}`}>
                      {label}
                    </span>
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
