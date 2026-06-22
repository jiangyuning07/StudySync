import {useEffect, useState, useCallback} from "react";
import {collection, doc, getDocs, updateDoc, query, orderBy, arrayRemove, arrayUnion, runTransaction} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";

function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const {currentUser} = useAuth();

  const setSessionActionLoading = (sessionId, isLoading) => {
    setActionLoading((prev) => ({
      ...prev,
      [sessionId]: isLoading,
    }));
  };

  const fetchSessions = useCallback(async () => {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const sessionList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSessions(sessionList);
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

  async function handleLeaveSession(sessionId) {
    if (!currentUser) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);

      await updateDoc(sessionRef, {
        participants: arrayRemove(currentUser.uid),
      });

      await fetchSessions();
    } catch (error) {
      console.error("Failed to leave session:", error);
      alert("Failed to leave session.");
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <main className="page">
      <h1>All Study Sessions</h1>
      {loading && <p>Loading sessions...</p>}
      {!loading && sessions.length === 0 && (
        <p>No study sessions created yet.</p>
      )}

      <div className="session-list">
        {sessions.map((session) => {
          const participantCount = session.participants?.length || 0;
          const isCreator = session.creatorId === currentUser?.uid;
          const isJoined = session.participants?.includes(currentUser?.uid);
          const isFull = participantCount >= session.maxParticipants;
          const isActive = session.status === "Active";
          const isActionLoading = !!actionLoading[session.id];

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
              <p><strong>Created by:</strong> {session.creatorName}</p>
              <p><strong>Participants:</strong> {participantCount}/{session.maxParticipants}</p>
              <p><strong>Status:</strong> {session.status}</p>

              {isActive && !isCreator && (
                <div className="session-actions">
                  {isJoined ? (
                    <button
                      className="session-action-button cancel-button"
                      disabled={isActionLoading}
                      onClick={() => handleLeaveSession(session.id)}
                    >
                      {isActionLoading ? "Leaving..." : "Leave Session"}
                    </button>
                  ) : (
                    <button
                      className="session-action-button edit-button"
                      disabled={isActionLoading || isFull}
                      onClick={() => handleJoinSession(session.id)}
                    >
                      {isFull ? "Full" : isActionLoading ? "Joining..." : "Join Session"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default AllSessions;