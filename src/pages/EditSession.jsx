import {useState, useEffect} from "react";
import {doc, getDoc, getDocs, updateDoc, collection, orderBy, query} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate, useParams} from "react-router-dom";

function EditSession() {
  const {id} = useParams();
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [studySpaces, setStudySpaces] = useState([]);
  const [studySpaceId, setStudySpaceId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [studyMode, setStudyMode] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  function calculateDuration(start, end) {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  }

  function handleStudySpaceChange(e) {
    const selectedId = e.target.value;
    setStudySpaceId(selectedId);

    const selectedSpace = studySpaces.find((space) => space.id === selectedId);

    if (selectedSpace?.studyMode) {
      setStudyMode(selectedSpace.studyMode);
    }
  }

  useEffect(() => {
    async function fetchStudySpacesAndSession() {
      try {
        const spacesQuery = query(collection(db, "studySpaces"), orderBy("name"));
        const spacesSnapshot = await getDocs(spacesQuery);

        const spaces = spacesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setStudySpaces(spaces);

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
          navigate(-1);
          return;
        }

        // Pre-fill the form with existing session data
        setStudySpaceId(data.studySpaceId || "");
        setDate(data.date);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setStudyMode(data.studyMode || "");
        setMaxParticipants(data.maxParticipants);
        setLoading(false);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStudySpacesAndSession();
  }, [id, currentUser.uid, navigate]);

  async function handleEditSession(e) {
    e.preventDefault();
    setMessage("");

    const selectedStudySpace = studySpaces.find((space) => space.id === studySpaceId);

    if (!selectedStudySpace) {
      setMessage("Please select a study space.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      setMessage("Session date cannot be in the past.");
      return;
    }

    if (endTime <= startTime) {
      setMessage("End time must be later than start time.");
      return;
    }

    const duration = calculateDuration(startTime, endTime);

    try {
      const sessionRef = doc(db, "sessions", id);
      await updateDoc(sessionRef, {
        studySpaceId: selectedStudySpace.id,
        studySpaceName: selectedStudySpace.name,
        date,
        startTime,
        endTime,
        duration,
        studyMode,
        maxParticipants: Number(maxParticipants),
      });
      setMessage("Session updated successfully!");
      setTimeout(() => navigate(-1), 1500);
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <main className="page"><p>Loading...</p></main>;

  return (
    <main className="page">
      <h1>Edit Session Details</h1>

      <form className="form" onSubmit={handleEditSession}>
        <label>Study Space</label>
        <select value={studySpaceId} onChange={handleStudySpaceChange} required>
          <option value="" disabled>Select a study space</option>
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
        <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)} required>
          <option value="" disabled>Select a study mode</option>
          <option value="silent">Silent</option>
          <option value="discussion">Discussion</option>
          <option value="Both">Both</option>
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