import {useCallback, useEffect, useState} from "react";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate} from "react-router-dom";
import {collection, query, where, getDoc, getDocs, orderBy, doc, updateDoc, arrayRemove} from "firebase/firestore";

function isExpired(session) {
  const sessionEnd = new Date(`${session.date}T${session.endTime}`);
  return sessionEnd < new Date();
}

function isInactive(session) {
  return session.status === "Cancelled" || isExpired(session);
}

function sortSessions(sessions) {
  const active = sessions.filter((s) => !isInactive(s));
  const inactive = sessions.filter((s) => isInactive(s));

  const byStartTime = (a, b) => {
    const dateA = new Date(`${a.date}T${a.startTime}`);
    const dateB = new Date(`${b.date}T${b.startTime}`);
    return dateA - dateB;
  };

  return [...active.sort(byStartTime), ...inactive.sort(byStartTime)];
}

function MySessions() {
  const [createdSessions, setCreatedSessions] = useState([]);
  const [joinedSessions, setJoinedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [participantProfiles, setParticipantProfiles] = useState({});
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const setSessionActionLoading = (sessionId, isLoading) => {
    setActionLoading((prev) => ({
      ...prev,
      [sessionId]: isLoading,
    }));
  };

  function getSessionStartMillis(session) {
    if (!session.date || !session.startTime) return Number.POSITIVE_INFINITY;

    const parsedTime = Date.parse(`${session.date} ${session.startTime}`);
    if (!Number.isNaN(parsedTime)) return parsedTime;

    const parsedIsoTime = Date.parse(`${session.date}T${session.startTime}`);
    if (!Number.isNaN(parsedIsoTime)) return parsedIsoTime;

    return Number.POSITIVE_INFINITY;
  }

  const fetchMySessions = useCallback(async () => {
    if (!currentUser) {
      setCreatedSessions([]);
      setJoinedSessions([]);
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

    const createdSessionList = createdSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => getSessionStartMillis(a) - getSessionStartMillis(b));

    const participantUids = [
      ...new Set(createdSessionList.flatMap((session => session.participants || [])))
    ];

    const participantProfileEntries = await Promise.all(
      participantUids.map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));

        if (!userSnap.exists()) {
          return [uid, {name: "Unknown participant"}];
        }

        return [
          uid,
          {
            uid,
            ...userSnap.data(),
          },
        ];
      })
    );

    setParticipantProfiles(Object.fromEntries(participantProfileEntries));

    const joinedSessionList = joinedSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((session) => session.creatorId !== currentUser.uid)
      .sort((a, b) => getSessionStartMillis(a) - getSessionStartMillis(b));

    setCreatedSessions(sortSessions(createdSessionList));
    setJoinedSessions(sortSessions(joinedSessionList));
    setLoading(false);
  }, [currentUser]);

  async function handleCancelSession(sessionId) {
    const confirmed = window.confirm("Are you sure you want to cancel this session?");
    if (!confirmed) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);
      await updateDoc(sessionRef, {
        status: "Cancelled",
      });
      await fetchMySessions();
    } catch (error) {
      console.error("Failed to cancel session:", error);
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  async function handleLeaveSession(sessionId) {
    const confirmed = window.confirm("Are you sure you want to leave this session?");
    if (!confirmed) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);
      await updateDoc(sessionRef, {
        participants: arrayRemove(currentUser.uid),
      });
      await fetchMySessions();
    } catch (error) {
      console.error("Failed to leave session:", error);
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  function renderSessionCard(session, type) {
    const participantCount = session.participants?.length || 0;
    const isActionLoading = !!actionLoading[session.id];

    return (
      <div
        className="card session-card"
        key={session.id}
        style={{opacity: isInactive(session) ? 0.5 : 1}}
      >
        <h3>{session.studySpaceName}</h3>
        <p><strong>Date:</strong> {session.date}</p>
        <p><strong>Time:</strong> {session.startTime} - {session.endTime}</p>
        <p><strong>Duration:</strong> {session.duration} mins</p>
        <p><strong>Study Mode:</strong> {session.studyMode}</p>
        <p><strong>Participants:</strong> {participantCount}/{session.maxParticipants}</p>
        <p><strong>Status:</strong> {session.status}</p>

        <div className="session-actions">
          {type === "created" && !isInactive(session) && (
            <button
              className="session-action-button edit-button"
              disabled={isActionLoading}
              onClick={() => navigate(`/sessions/${session.id}/edit`)}
            >
              Edit
            </button>
          )}

          {type === "created" && !isInactive(session) && (
            <button
              className="session-action-button cancel-button"
              disabled={isActionLoading}
              onClick={() => handleCancelSession(session.id)}
            >
              {isActionLoading ? "Cancelling..." : "Cancel Session"}
            </button>
          )}

          {type === "joined" && !isInactive(session) && (
            <button
              className="session-action-button cancel-button"
              disabled={isActionLoading}
              onClick={() => handleLeaveSession(session.id)}
            >
              {isActionLoading ? "Leaving..." : "Leave Session"}
            </button>
          )}
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchMySessions();
  }, [fetchMySessions]);

  return (
    <main className="page">
      <h1>My Sessions</h1>
      {loading && <p>Loading your sessions...</p>}

      {!loading && (
        <>
          <section>
            <h2 className="my-sessions-section">Sessions I Created</h2>
            {createdSessions.length === 0 && <p>You have not created any sessions yet.</p>}
            <div className="session-list">
              {createdSessions.map((session) => renderSessionCard(session, "created"))}
            </div>
          </section>

          <section>
            <h2 className="my-sessions-section">Sessions I Joined</h2>
            {joinedSessions.length === 0 && <p>You have not joined any sessions yet.</p>}
            <div className="session-list">
              {joinedSessions.map((session) => renderSessionCard(session, "joined"))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default MySessions;