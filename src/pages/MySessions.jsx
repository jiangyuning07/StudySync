import {useCallback, useEffect, useState} from "react";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate} from "react-router-dom";
import {collection, query, where, getDoc, getDocs, orderBy, doc, updateDoc, arrayRemove} from "firebase/firestore";
import {isExpired, isInactive, getDisplayStatus, getSessionStartMillis, sortSessions} from "../utils/sessionUtils";
import {notifySessionCancelled} from "../utils/notifications";
import SessionLabels from "../components/SessionLabels";

function MySessions() {
  const [createdSessions, setCreatedSessions] = useState([]);
  const [joinedSessions, setJoinedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [creatorProfiles, setCreatorProfiles] = useState({});
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const setSessionActionLoading = (sessionId, isLoading) => {
    setActionLoading((prev) => ({
      ...prev,
      [sessionId]: isLoading,
    }));
  };

  // Fetch participants for all sessions the current user created and creators for all sessions joined
  const fetchMySessions = useCallback(async () => {
    if (!currentUser) {
      setCreatedSessions([]);
      setJoinedSessions([]);
      setParticipantProfiles({});
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

    const participantUids = [
      ...new Set(
        createdSessionList.flatMap((session) => session.participants || [])
      ),
    ];

    const creatorUids = [
      ...new Set(
        joinedSessionList.map((session) => session.creatorId).filter(Boolean)
      ),
    ];

    const participantProfileEntries = await Promise.all(
      participantUids.map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));

        if (!userSnap.exists()) {
          return [uid, {uid, name: "Unknown participant"}];
        }

        return [uid, {uid, ...userSnap.data()}];
      })
    );

    const creatorProfileEntries = await Promise.all(
      creatorUids.map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));

        if (!userSnap.exists()) {
          return [uid, {uid, name: "Unknown creator"}];
        }

        return [uid, {uid, ...userSnap.data()}];
      })
    );

    setParticipantProfiles(Object.fromEntries(participantProfileEntries));
    setCreatorProfiles(Object.fromEntries(creatorProfileEntries));
    setCreatedSessions(sortSessions(createdSessionList));
    setJoinedSessions(sortSessions(joinedSessionList));
    setLoading(false);
  }, [currentUser]);

  async function handleCancelSession(session) {
    const confirmed = window.confirm("Are you sure you want to cancel this session?");
    if (!confirmed) return;

    try {
      setSessionActionLoading(session.id, true);
      const sessionRef = doc(db, "sessions", session.id);

      await updateDoc(sessionRef, {
        status: "Cancelled",
      });

      await notifySessionCancelled(session);

      await fetchMySessions();
    } catch (error) {
      console.error("Failed to cancel session:", error);
    } finally {
      setSessionActionLoading(session.id, false);
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

      await fetchMySessions();
    } catch (error) {
      console.error("Failed to leave session:", error);
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  function renderSessionCard(session, type) {
    const participantCount = session.participants?.length || 0;
    const creatorProfile = creatorProfiles[session.creatorId];
    const creatorName = creatorProfile?.name || "Unknown creator";
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
        {type === "joined" && (
          <p><strong>Created by:</strong> {creatorName}</p>
        )}

        <p><strong>Participants:</strong> {participantCount}/{session.maxParticipants}</p>
        <p><strong>Status:</strong> {getDisplayStatus(session)}</p>
        <SessionLabels session={session} />

        <div className="session-actions">
          {type === "created" && !isInactive(session) && (
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
          )}

          {type === "created" && !isInactive(session) && (
            <button
              className="session-action-button cancel-button"
              disabled={isActionLoading}
              onClick={(e) => {
                e.stopPropagation();
                handleCancelSession(session);
              }}
            >
              {isActionLoading ? "Cancelling..." : "Cancel"}
            </button>
          )}

          {type === "joined" && !isInactive(session) && (
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
