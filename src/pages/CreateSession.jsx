import {useState, useEffect} from "react";
import {addDoc, collection, serverTimestamp, getDocs, query, orderBy} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {STUDY_GOAL_MAX_LENGTH} from "../utils/sessionUtils";

function CreateSession() {
  const [studySpaces, setStudySpaces] = useState([]);
  const [studySpaceId, setStudySpaceId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [studyMode, setStudyMode] = useState("");
  const [moduleCode, setModuleCode] = useState("");
  const [studyGoal, setStudyGoal] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [message, setMessage] = useState("");
  const {currentUser} = useAuth();

  useEffect(() => {
    async function fetchStudySpaces() {
      try {
        const q = query(collection(db, "studySpaces"), orderBy("name"));
        const snapshot = await getDocs(q);
        const spaces = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStudySpaces(spaces)
      } catch (error) {
        setMessage(error.message);
      }
    }
    fetchStudySpaces();
  }, []);

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

  async function handleCreateSession(e) {
    e.preventDefault();
    setMessage("");

    const selectedStudySpace = studySpaces.find((space) => space.id == studySpaceId);

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
      await addDoc(collection(db, "sessions"), {
        studySpaceId: selectedStudySpace.id,
        studySpaceName: selectedStudySpace.name,
        date,
        startTime,
        endTime,
        duration,
        studyMode,
        moduleCode: moduleCode.trim().toUpperCase(),
        studyGoal: studyGoal.trim(),
        maxParticipants: Number(maxParticipants),
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName,
        participants: [currentUser.uid],
        status: "Active",
        createdAt: serverTimestamp(),
      });
      setStudySpaceId("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setStudyMode("");
      setModuleCode("");
      setStudyGoal("");
      setMaxParticipants(2);
      setMessage("Session created successfully!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="page session-form-page">
      <h1>Create a Study Session</h1>

      <form className="form" onSubmit={handleCreateSession}>
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
          <option value="Silent">Silent</option>
          <option value="Discussion">Discussion</option>
          <option value="Both">Both</option>
        </select>

        <label htmlFor="module-code">Module Code (Optional)</label>
        <input
          id="module-code"
          value={moduleCode}
          onChange={(e) => setModuleCode(e.target.value.toUpperCase())}
          type="text"
          maxLength="16"
          placeholder="e.g. CS2103T"
        />

        <div className="field-label-row">
          <label htmlFor="study-goal">Study Goal (Optional)</label>
          <small id="study-goal-limit" className="field-limit">
            {studyGoal.length}/{STUDY_GOAL_MAX_LENGTH} characters
          </small>
        </div>
        <input
          id="study-goal"
          value={studyGoal}
          onChange={(e) => setStudyGoal(e.target.value)}
          type="text"
          maxLength={STUDY_GOAL_MAX_LENGTH}
          placeholder="e.g. Review week 6 tutorial questions"
          aria-describedby="study-goal-limit"
        />

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
