import {useEffect, useState} from "react";
import {collection, query, where, getDocs, orderBy} from "firebase/firestore";
import {db} from "../firebase";
import {useAuth} from "../AuthContext";

function MySessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const {currentUser} = useAuth();

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
          <div className="card" key={session.id}>
            <h2>{session.studySpaceName}</h2>
            <p><strong>Date:</strong> {session.date}</p>
            <p><strong>Time:</strong> {session.time}</p>
            <p><strong>Duration:</strong> {session.duration}</p>
            <p><strong>Study Mode:</strong> {session.studyMode}</p>
            <p><strong>Participants:</strong> {session.participants.length}/{session.maxParticipants}</p>
            <p><strong>Status:</strong> {session.status}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export default MySessions;