import {db} from "../firebase";
import {useAuth} from "../AuthContext";
import {addDoc, collection, serverTimestamp, getDocs} from "firebase/firestore";
import {useState, useEffect} from "react";

function CreateSession() {
  const [selectedSpace, setSelectedSpace] = useState("");
  const [selectedSpaceName, setSelectedSpaceName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [studyMode, setStudyMode] = useState("silent");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [message, setMessage] = useState("");
  const {currentUser} = useAuth();
  const [studySpaces, setStudySpaces] = useState([]);

  useEffect(() => {
    async function fetchStudySpaces() {
      const snapshot = await getDocs(collection(db, "studySpaces"));
      const spaces = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStudySpaces(spaces);
    }
    fetchStudySpaces();
  }, []);

  function calculateDuration(start, end) {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    setMessage("");

    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      setMessage("Session date cannot be in the past.");
      return;
    }

    if (endTime <= startTime) {
      setMessage("End time must be after start time.");
      return;
    }

    const duration = calculateDuration(startTime, endTime);

    try {
      await addDoc(collection(db, "sessions"), {
        studySpaceId: selectedSpace,
        studySpaceName: selectedSpaceName,
        date,
        startTime,
        endTime,
        duration,
        studyMode,
        maxParticipants: Number(maxParticipants),
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName,
        participants: [],
        status: "active",
        createdAt: serverTimestamp(),
      });
      setSelectedSpace("");
      setSelectedSpaceName("");
      setDate("");
      setStartTime("");
      setEndTime("");
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
        <select
          value={selectedSpace}
          onChange={(e) => {
            const selected = studySpaces.find((s) => s.id === e.target.value);
            setSelectedSpace(selected ? selected.id : "");
            setSelectedSpaceName(selected ? selected.name : "");
          }}
          required
        >
          <option value="">Select a study space</option>
          {studySpaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>

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

        <button type="submit">Create Session</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default CreateSession;