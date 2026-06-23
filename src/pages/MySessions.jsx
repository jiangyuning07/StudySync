import {useCallback, useEffect, useState} from "react";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate} from "react-router-dom";
import {collection, query, where, getDocs, orderBy, doc, updateDoc} from "firebase/firestore";

function MySessions() {
  const [createdSessions, setCreatedSessions] = useState([]);
  const [joinedSessions, setJoinedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const {currentUser} = useAuth();
  const navigate = useNavigate();

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
      }));

    const joinedSessionList = joinedSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((session) => session.creatorId !== currentUser.uid);

    setCreatedSessions(createdSessionList);
    setJoinedSessions(joinedSessionList);
    setLoading(false);
  }, [currentUser]);

  async function handleCancelSession(sessionId) {
    const confirmed = window.confirm("Are you sure you want to cancel this session?");
    if (!confirmed) return;

    try {
      const sessionRef = doc(db, "sessions", sessionId);
      await updateDoc(sessionRef, {
        status: "Cancelled",
      });
      // Refresh the list after cancelling
      fetchMySessions();
    } catch (error) {
      console.error("Failed to cancel session:", error);
    }
  }

  function renderSessionCard(session, type) {
    const participantCount = session.participants?.length || 0;

    return (
      <div
        className="card session-card"
        key={session.id}
        style={{opacity: session.status === "Cancelled" ? 0.5 : 1}}
      >
        <h2>{session.studySpaceName}</h2>
        <p><strong>Date:</strong> {session.date}</p>
        <p><strong>Time:</strong> {session.startTime} - {session.endTime}</p>
        <p><strong>Duration:</strong> {session.duration} mins</p>
        <p><strong>Study Mode:</strong> {session.studyMode}</p>
        <p><strong>Participants:</strong> {participantCount}/{session.maxParticipants}</p>
        <p><strong>Status:</strong> {session.status}</p>

        <div className="session-actions">
          {type === "created" && session.status === "Active" && (
            <button
              className="session-action-button edit-button"
              onClick={() => navigate(`/sessions/${session.id}/edit`)}
            >
              Edit
            </button>
          )}

          {type === "created" && session.status === "Active" && (
            <button
              className="session-action-button cancel-button"
              onClick={() => handleCancelSession(session.id)}
            >
              Cancel Session
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