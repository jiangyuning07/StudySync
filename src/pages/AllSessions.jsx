import {useEffect, useState, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {collection, doc, getDoc, getDocs, updateDoc, query, orderBy, arrayRemove, arrayUnion, runTransaction} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";

function isExpired(session) {
  const sessionEnd = new Date(`${session.date}T${session.endTime}`);
  return sessionEnd < new Date();
}

function isInactive(session) {
  return session.status === "Cancelled" || isExpired(session);
}

function getDisplayStatus(session) {
  if (session.status === "Cancelled") return "Cancelled";
  if (isExpired(session)) return "Completed";
  return "Active";
}

function getSessionStartMillis(session) {
  if (!session.date || !session.startTime) return Number.POSITIVE_INFINITY;

  const parsedTime = Date.parse(`${session.date} ${session.startTime}`);
  if (!Number.isNaN(parsedTime)) return parsedTime;

  const parsedIsoTime = Date.parse(`${session.date}T${session.startTime}`);
  if (!Number.isNaN(parsedIsoTime)) return parsedIsoTime;

  return Number.POSITIVE_INFINITY;
}

function sortSessions(sessions) {
  const active = sessions.filter((s) => !isInactive(s));
  const inactive = sessions.filter((s) => isInactive(s));

  const byStartTime = (a, b) => getSessionStartMillis(a) - getSessionStartMillis(b);

  return [...active.sort(byStartTime), ...inactive.sort(byStartTime)];
}

function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [creatorProfiles, setCreatorProfiles] = useState({});
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const setSessionActionLoading = (sessionId, isLoading) => {
    setActionLoading((prev) => ({
      ...prev,
      [sessionId]: isLoading,
    }));
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);

    const sessionsQuery = query(
      collection(db, "sessions"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(sessionsQuery);

    const sessionList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const creatorUids = [
      ...new Set(
        sessionList.map((session) => session.creatorId).filter(Boolean)
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
    setSessions(sortSessions(sessionList));
    setLoading(false);
  }, []);

  async function handleJoinSession(sessionId) {
    if (!currentUser) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);

      await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);

        if (!sessionDoc.exists()) {
          throw new Error("Session no longer exists.");
        }

        const session = sessionDoc.data();
        const participants = session.participants || [];

        if (session.creatorId === currentUser.uid) {
          throw new Error("You cannot join your own session.");
        }

        if (session.status !== "Active") {
          throw new Error("This session is not active.");
        }

        if (participants.includes(currentUser.uid)) {
          return;
        }

        if (participants.length >= session.maxParticipants) {
          throw new Error("This session is full.");
        }

        transaction.update(sessionRef, {
          participants: arrayUnion(currentUser.uid),
        });
      });

      await fetchSessions();
    } catch (error) {
      console.error("Failed to join session:", error);
      alert(error.message || "Failed to join session.");
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

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
    if (!currentUser) return;

    const confirmed = window.confirm("Are you sure you want to leave this session?");
    if (!confirmed) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);

      await updateDoc(sessionRef, {
        participants: arrayRemove(currentUser.uid),
      });

      await fetchSessions();
    } catch (error) {
      console.error("Failed to leave session:", error);
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  function renderSessionCard(session) {
    const participantCount = session.participants?.length || 0;
    const creatorProfile = creatorProfiles[session.creatorId];
    const creatorName = creatorProfile?.name || "Unknown creator";
    const isCreator = session.creatorId === currentUser?.uid;
    const creatorDisplayName = isCreator ? "Me" : creatorName;
    const isJoined = session.participants?.includes(currentUser?.uid);
    const isFull = participantCount >= session.maxParticipants;
    const isActionLoading = !!actionLoading[session.id];

    return (
      <div
        className="card session-card"
        key={session.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/sessions/${session.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/sessions/${session.id}`);
          }
        }}
        style={{opacity: isInactive(session) ? 0.5 : 1}}
      >
        <h3>{session.studySpaceName}</h3>
        <p><strong>Date:</strong> {session.date}</p>
        <p><strong>Time:</strong> {session.startTime} - {session.endTime}</p>
        <p><strong>Duration:</strong> {session.duration} mins</p>
        <p><strong>Study Mode:</strong> {session.studyMode}</p>
        <p><strong>Created by:</strong> {creatorDisplayName}</p>
        <p><strong>Participants:</strong> {participantCount}/{session.maxParticipants}</p>
        <p><strong>Status:</strong> {getDisplayStatus(session)}</p>

        {!isInactive(session) && (
          <div className="session-actions">
            {isCreator ? (
              <>
                <button
                  className="session-action-button edit-button"
                  disabled={isActionLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/sessions/${session.id}/edit`);
                  }}
                >
                  Edit
                </button>

                <button
                  className="session-action-button cancel-button"
                  disabled={isActionLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelSession(session.id);
                  }}
                >
                  {isActionLoading ? "Cancelling..." : "Cancel"}
                </button>
              </>
            ) : isJoined ? (
              <button
                className="session-action-button cancel-button"
                disabled={isActionLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLeaveSession(session.id);
                }}
              >
                {isActionLoading ? "Leaving..." : "Leave"}
              </button>
            ) : (
              <button
                className={`session-action-button ${isFull ? "full-button" : "edit-button"}`}
                disabled={isActionLoading || isFull}
                onClick={(e) => {
                  e.stopPropagation();
                  handleJoinSession(session.id);
                }}
              >
                {isFull ? "Full" : isActionLoading ? "Joining..." : "Join"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <main className="page">
      <h1>All Study Sessions</h1>

      {loading && <p>Loading study sessions...</p>}

      {!loading && sessions.length === 0 && (
        <p>No study sessions created yet.</p>
      )}

      {!loading && sessions.length > 0 && (
        <div className="session-list">
          {sessions.map((session) => renderSessionCard(session))}
        </div>
      )}
    </main>
  );
}

export default AllSessions;