import {useState, useEffect} from "react";
import {doc, getDoc, updateDoc} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate, useParams} from "react-router-dom";

function EditSession() {
  const {id} = useParams();
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [studyMode, setStudyMode] = useState("silent");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  function calculateDuration(start, end) {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  }

  useEffect(() => {
    async function fetchSession() {
      const sessionRef = doc(db, "sessions", id);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        setMessage("Session not found.");
        setLoading(false);
        return;
      }

      const data = sessionSnap.data();

      // Prevent non-creators from accessing this page
      if (data.creatorId !== currentUser.uid) {
        navigate("/my-sessions");
        return;
      }

      // Pre-fill the form with existing session data
      setLocation(data.studySpaceName);
      setDate(data.date);
      setStartTime(data.startTime);
      setEndTime(data.endTime);
      setStudyMode(data.studyMode);
      setMaxParticipants(data.maxParticipants);
      setLoading(false);
    }

    fetchSession();
  }, [id]);

  async function handleEditSession(e) {
    e.preventDefault();
    setMessage("");

    if (endTime <= startTime) {
      setMessage("End time must be after start time.");
      return;
    }

    const duration = calculateDuration(startTime, endTime);

    try {
      const sessionRef = doc(db, "sessions", id);
      await updateDoc(sessionRef, {
        studySpaceName: location,
        date,
        startTime,
        endTime,
        duration,
        studyMode,
        maxParticipants: Number(maxParticipants),
      });
      setMessage("Session updated successfully!");
      setTimeout(() => navigate("/my-sessions"), 1500);
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <main className="page"><p>Loading...</p></main>;

  return (
    <main className="page">
      <h1>Edit Session</h1>

      <form className="form" onSubmit={handleEditSession}>
        <label>Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Central Library"
          required
        />

        <label>Date</label>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          required
        />

        <label>Start Time</label>
        <input
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          type="time"
          required
        />

        <label>End Time</label>
        <input
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          type="time"
          required
        />

        {startTime && endTime && endTime > startTime && (
          <p className="message">
            Duration: {calculateDuration(startTime, endTime)} minutes
          </p>
        )}

        <label>Study Mode</label>
        <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)}>
          <option value="silent">Silent</option>
          <option value="discussion">Discussion</option>
        </select>

        <label>Max Participants</label>
        <input
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          type="number"
          min="2"
          max="20"
          required
        />

        <button type="submit">Save Changes</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default EditSession;