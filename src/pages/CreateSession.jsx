import {useState} from "react";
import {addDoc, collection, serverTimestamp} from "firebase/firestore";
import {db} from "../firebase";
import {useAuth} from "../AuthContext";

function CreateSession() {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [studyMode, setStudyMode] = useState("silent");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [message, setMessage] = useState("");
  const {currentUser} = useAuth();

  async function handleCreateSession(e) {
    e.preventDefault();
    setMessage("");

    try {
      await addDoc(collection(db, "sessions"), {
        studySpaceId: null,
        studySpaceName: location,
        date,
        time,
        duration,
        studyMode,
        maxParticipants: Number(maxParticipants),
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName,
        participants: [],
        status: "active",
        createdAt: serverTimestamp(),
      });
      setLocation("");
      setDate("");
      setTime("");
      setDuration("");
      setStudyMode("silent");
      setMaxParticipants(2);
      setMessage("Session created successfully!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <h1>Create Study Session</h1>

      <form className="form" onSubmit={handleCreateSession}>
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

        <label>Time</label>
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          type="time"
          required
        />

        <label>Duration</label>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 2 hours"
          required
        />

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

        <button type="submit">Create Session</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default CreateSession;