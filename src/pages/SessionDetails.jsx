import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {doc, getDoc, updateDoc} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";

function isExpired(session) {
  const sessionEnd = new Date(`${session.date}T${session.endTime}`);
  return sessionEnd < new Date();
}

function isInactive(session) {
  return session.status === "Cancelled" || isExpired(session);
}

async function getSessionDetails(id) {
  const sessionSnap = await getDoc(doc(db, "sessions", id));

  if (!sessionSnap.exists()) {
    return {
      sessionData: null,
      participantProfiles: [],
    };
  }

  const sessionData = {
    id: sessionSnap.id,
    ...sessionSnap.data(),
  };
  const participantIds = sessionData.participants || [];

  const participantProfiles = await Promise.all(
    participantIds.map(async (uid) => {
      const userSnap = await getDoc(doc(db, "users", uid));

      if (!userSnap.exists()) {
        return {uid, name: "Unknown participant"};
      }

      return {uid, ...userSnap.data()};
    })
  );

  return {
    sessionData,
    participantProfiles,
  };
}

function SessionDetails() {
  const {id} = useParams();
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const {sessionData, participantProfiles} = await getSessionDetails(id);

        if (ignore) return;

        setSession(sessionData);
        setParticipants(participantProfiles);
        setMessage(sessionData ? "" : "Session not found.");
      } catch (error) {
        if (!ignore) setMessage(error.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleCancelSession() {
    if (!session) return;

    const confirmed = window.confirm("Are you sure you want to cancel this session?");
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await updateDoc(doc(db, "sessions", session.id), {
        status: "Cancelled",
      });
      const {sessionData, participantProfiles} = await getSessionDetails(session.id);
      setSession(sessionData);
      setParticipants(participantProfiles);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <main className="page"><p>Loading session...</p></main>;

  if (!session) {
    return (
      <main className="page">
        <h1>Session Details</h1>
        {message && <p className="message">{message}</p>}
        <div className="session-actions details-actions">
          <button className="session-action-button secondary-button" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </main>
    );
  }

  const isCreator = session.creatorId === currentUser?.uid;
  const canManageSession = isCreator && !isInactive(session);

  return (
    <main className="page">
      <h1>Session Details</h1>

      <section className="card session-details-card">
        <h2>Participants</h2>

        {participants.length === 0 ? (
          <p>No participants yet.</p>
        ) : (
          <ul className="participant-list">
            {participants.map((participant) => (
              <li key={participant.uid} className="participant-item">
                <span className="participant-name">{participant.name || "Unnamed participant"}</span>
                {participant.email && <small>{participant.email}</small>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="session-actions details-actions">
        <button className="session-action-button back-button" onClick={() => navigate(-1)}>
          Back
        </button>

        {canManageSession && (
          <button
            className="session-action-button edit-button"
            disabled={actionLoading}
            onClick={() => navigate(`/sessions/${session.id}/edit`)}
          >
            Edit
          </button>
        )}

        {canManageSession && (
          <button
            className="session-action-button cancel-button"
            disabled={actionLoading}
            onClick={handleCancelSession}
          >
            {actionLoading ? "Cancelling..." : "Cancel"}
          </button>
        )}
      </div>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default SessionDetails;