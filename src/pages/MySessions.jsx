import {useCallback, useEffect, useState} from "react";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate} from "react-router-dom";
import {collection, query, where, getDoc, getDocs, doc} from "firebase/firestore";
import {isInactive, sortSessions} from "../utils/sessionUtils";
import {getAttendanceLabel} from "../utils/attendanceUtils";
import SessionLabels from "../components/SessionLabels";
import SessionStatusPill from "../components/SessionStatusPill";
import {formatSessionWhen} from "../utils/sessionFormat";

function MySessions() {
  const [createdSessions, setCreatedSessions] = useState([]);
  const [joinedSessions, setJoinedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatorProfiles, setCreatorProfiles] = useState({});
  const [now, setNow] = useState(() => new Date());
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  // Fetch sessions the current user created or joined, plus joined-session creators.
  const fetchMySessions = useCallback(async () => {
    if (!currentUser) {
      setCreatedSessions([]);
      setJoinedSessions([]);
      setCreatorProfiles({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const createdSessionsQuery = query(
      collection(db, "sessions"),
      where("creatorId", "==", currentUser.uid)
    );

    const joinedSessionsQuery = query(
      collection(db, "sessions"),
      where("participants", "array-contains", currentUser.uid)
    );

    const [createdSnapshot, joinedSnapshot] = await Promise.all([
      getDocs(createdSessionsQuery),
      getDocs(joinedSessionsQuery),
    ]);

    const createdSessionList = createdSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const joinedSessionList = joinedSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((session) => session.creatorId !== currentUser.uid);

    const creatorUids = [
      ...new Set(
        joinedSessionList.map((session) => session.creatorId).filter(Boolean)
      ),
    ];

    const creatorProfileEntries = await Promise.all(
      creatorUids.map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));

        if (!userSnap.exists()) {
          return [uid, {uid, name: "Unknown creator"}];
        }

        return [uid, {uid, ...userSnap.data()}];
      })
    );

    setCreatorProfiles(Object.fromEntries(creatorProfileEntries));
    setCreatedSessions(sortSessions(createdSessionList));
    setJoinedSessions(sortSessions(joinedSessionList));
    setLoading(false);
  }, [currentUser]);

  function renderSessionCard(session, type) {
    const participantCount = session.participants?.length || 0;
    const creatorProfile = creatorProfiles[session.creatorId];
    const creatorName = creatorProfile?.name || "Unknown creator";
    const inactive = isInactive(session);
    const attendanceLabel = session.status === "Cancelled"
      ? null
      : getAttendanceLabel(session, currentUser?.uid, now);

    return (
      <div
        className={`card session-card${inactive ? " session-inactive" : ""}`}
        key={session.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/sessions/${session.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/sessions/${session.id}`);
          }
        }}
      >
        <div className="session-card-header">
          <h3>{session.studySpaceName}</h3>
          <SessionStatusPill session={session} />
        </div>
        <p className="session-when">{formatSessionWhen(session)}</p>
        <p className="session-meta">
          {type === "joined" && `${creatorName} · `}
          {participantCount} of {session.maxParticipants} joined
          {attendanceLabel && ` · ${attendanceLabel}`}
        </p>
        <SessionLabels session={session} />
      </div>
    );
  }

  useEffect(() => {
    // Initial Firestore synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMySessions();
  }, [fetchMySessions]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="page">
      <h1>My Sessions</h1>

      {loading && <p>Loading your sessions...</p>}

      {!loading && (
        <>
          <section>
            <h2 className="my-sessions-section">Sessions I Created</h2>
            {createdSessions.length > 0 && (
              <p className="session-result-count" aria-live="polite">
                {createdSessions.length} {createdSessions.length === 1 ? "session" : "sessions"}
              </p>
            )}

            {createdSessions.length === 0 && (
              <p>You have not created any sessions yet.</p>
            )}

            {createdSessions.length > 0 && (
              <div className="session-list">
                {createdSessions.map((session) => renderSessionCard(session, "created"))}
              </div>
            )}
          </section>

          <section>
            <h2 className="my-sessions-section">Sessions I Joined</h2>
            {joinedSessions.length > 0 && (
              <p className="session-result-count" aria-live="polite">
                {joinedSessions.length} {joinedSessions.length === 1 ? "session" : "sessions"}
              </p>
            )}

            {joinedSessions.length === 0 && (
              <p>You have not joined any sessions yet.</p>
            )}

            {joinedSessions.length > 0 && (
              <div className="session-list">
                {joinedSessions.map((session) => renderSessionCard(session, "joined"))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default MySessions;
