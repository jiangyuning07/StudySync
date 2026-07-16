import {useState, useEffect} from "react";
import {doc, getDoc, getDocs, updateDoc, collection, orderBy, query, arrayRemove} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {useNavigate, useParams} from "react-router-dom";
import {
  notifySessionUpdated,
  notifyParticipantsRemoved,
} from "../utils/notifications";

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
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [sessionCreatorId, setSessionCreatorId] = useState("");
  const [removedParticipantId, setRemovedParticipantId] = useState([]);
  const [originalDetails, setOriginalDetails] = useState(null);

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
          navigate(`/sessions/${id}`);
          return;
        }

        setSessionCreatorId(data.creatorId);

        const participantIds = data.participants || [];
        const participantProfiles = await Promise.all(
          participantIds.map(async (uid) => {
            const userSnap = await getDoc(doc(db, "users", uid));

            if (!userSnap.exists()) {
              return {uid, name: "Unknown participant"};
            }

            return {uid, ...userSnap.data()};
          })
        );
        setParticipants(participantProfiles);
        setParticipantCount(participantProfiles.length);

        // Pre-fill the form with existing session data
        setStudySpaceId(data.studySpaceId || "");
        setDate(data.date);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setStudyMode(data.studyMode || "");
        setMaxParticipants(data.maxParticipants);

        setOriginalDetails({
          studySpaceId: data.studySpaceId || "",
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          studyMode: data.studyMode || "",
          maxParticipants: data.maxParticipants,
        });
        setLoading(false);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStudySpacesAndSession();
  }, [id, currentUser.uid, navigate]);

  function handleRemoveParticipant(participant) {
    // Standalone safeguard to ensure session creators cannot be removed from session
    if (participant.uid === sessionCreatorId) {
      setMessage("Session creator cannot be removed.");
      return;
    }

    const label = participant.name;
    const confirmed = window.confirm(`Are you sure you want to remove ${label} from this session?`);

    if (!confirmed) return;

    setParticipants((currentParticipants) =>
      currentParticipants.filter((item) => item.uid !== participant.uid)
    );

    setParticipantCount((currentCount) => currentCount - 1);

    setRemovedParticipantId((currentIds) => [
      ...currentIds,
      participant.uid,
    ]);
  }

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

    if (Number(maxParticipants) < participantCount) {
      setMessage(`Max participants cannot be less than the current number of joined participants (${participantCount}).`);
      return;
    }

    try {
      const sessionRef = doc(db, "sessions", id);
      const updateData = {
        studySpaceId: selectedStudySpace.id,
        studySpaceName: selectedStudySpace.name,
        date,
        startTime,
        endTime,
        duration,
        studyMode,
        maxParticipants: Number(maxParticipants),
      };

      if (removedParticipantId.length > 0) {
        updateData.participants = arrayRemove(...removedParticipantId);
      }

      await updateDoc(sessionRef, updateData);

      const detailsChanged =
        !originalDetails ||
        originalDetails.studySpaceId !== selectedStudySpace.id ||
        originalDetails.date !== date ||
        originalDetails.startTime !== startTime ||
        originalDetails.endTime !== endTime ||
        originalDetails.studyMode !== studyMode ||
        Number(originalDetails.maxParticipants) !== Number(maxParticipants);

      const remainingUids = participants.map((participant) => participant.uid);

      const sessionForNotify = {
        id,
        creatorId: sessionCreatorId,
        creatorName: currentUser.displayName,
        studySpaceName: selectedStudySpace.name,
        date,
        participants: remainingUids,
      };

      if (detailsChanged) {
        await notifySessionUpdated(sessionForNotify, {
          excludeUids: removedParticipantId,
        });
      }

      if (removedParticipantId.length > 0) {
        await notifyParticipantsRemoved(sessionForNotify, removedParticipantId);
      }

      setMessage("Session updated successfully!");
      setTimeout(() => navigate(`/sessions/${id}`), 1500);
      } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <main className="page session-form-page"><p>Loading...</p></main>;

  return (
    <main className="page session-form-page">
      <h1>Edit Session Details</h1>

      <form className="form edit-session-form" onSubmit={handleEditSession}>
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

        <details className="edit-participants-dropdown">
          <summary>
            <label>Manage Participants</label> ({participants.length})
          </summary>

          <ul className="participant-list">
            {participants.map((participant) => {
              const isSessionCreator = participant.uid === sessionCreatorId;

              return (
                <li
                  key={participant.uid}
                  className="participant-item participant-edit-item"
                >
                  <span className="participant-name-with-badge">
                    {participant.name || "Unnamed participant"}

                    {isSessionCreator && (
                      <span className="participant-owner-badge">Owner</span>
                    )}
                  </span>
                  {participant.email && <small>{participant.email}</small>}
                  
                  <button
                    type="button"
                    className="remove-participant-button"
                    onClick={() => handleRemoveParticipant(participant)}
                    aria-label={`Remove ${participant.name || "participant"}`}
                    disabled={isSessionCreator}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </details>

        <button type="submit">Save Changes</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default EditSession;