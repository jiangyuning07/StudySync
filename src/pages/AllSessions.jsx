import {useEffect, useState} from "react";
import {collection, getDocs, query, orderBy} from "firebase/firestore";
import {db} from "../utils/firebase";

function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchSessions() {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const sessionList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSessions(sessionList);
    setLoading(false);
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <main className="page">
      <h1>All Study Sessions</h1>
      {loading && <p>Loading sessions...</p>}
      {!loading && sessions.length === 0 && (
        <p>No study sessions created yet.</p>
      )}

      <div className="session-list">
        {sessions.map((session) => (
          <div className="card session-card" key={session.id}>
            <h2>{session.studySpaceName}</h2>
            <p><strong>Date:</strong> {session.date}</p>
            <p><strong>Time:</strong> {session.startTime} - {session.endTime} mins</p>
            <p><strong>Duration:</strong> {session.duration}</p>
            <p><strong>Study Mode:</strong> {session.studyMode}</p>
            <p><strong>Created by:</strong> {session.creatorName}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export default AllSessions;