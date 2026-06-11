import {useEffect, useState} from "react";
import {db} from "../firebase";
import {useAuth} from "../AuthContext";
import {useNavigate} from "react-router-dom";
import {collection, query, where, getDocs, orderBy, doc, updateDoc} from "firebase/firestore";

function MySessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  async function fetchMySessions() {
    const q = query(
      collection(db, "sessions"),
      where("creatorId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    const sessionList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSessions(sessionList);
    setLoading(false);
  }

  async function handleCancelSession(sessionId) {
    const confirmed = window.confirm("Are you sure you want to cancel this session?");
    if (!confirmed) return;

    try {
      const sessionRef = doc(db, "sessions", sessionId);
      await updateDoc(sessionRef, {
        status: "cancelled",
      });
      // Refresh the list after cancelling
      fetchMySessions();
    } catch (error) {
      console.error("Failed to cancel session:", error);
    }
  }

  useEffect(() => {
    fetchMySessions();
  }, []);

  return (
    <main className="page">
      <h1>My Sessions</h1>
      {loading && <p>Loading your sessions...</p>}
      {!loading && sessions.length === 0 && (
        <p>You have not created any sessions yet.</p>
      )}

      <div className="session-list">
        {sessions.map((session) => (
          <div className="card" key={session.id} style={{opacity: session.status === "cancelled" ? 0.5 : 1}}>
            <h2>{session.studySpaceName}</h2>
            <p><strong>Date:</strong> {session.date}</p>
            <p><strong>Time:</strong> {session.startTime} - {session.endTime}</p>
            <p><strong>Duration:</strong> {session.duration} mins</p>
            <p><strong>Study Mode:</strong> {session.studyMode}</p>
            <p><strong>Participants:</strong> {session.participants.length}/{session.maxParticipants}</p>
            <p><strong>Status:</strong> {session.status}</p>

            {session.status === "active" && (
              <button onClick={() => navigate(`/sessions/${session.id}/edit`)}>
                Edit
              </button>
            )}

            {session.status === "active" && (
              <button onClick={() => handleCancelSession(session.id)}>
                Cancel Session
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

export default MySessions;