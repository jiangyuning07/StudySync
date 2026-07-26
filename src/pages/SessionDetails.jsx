import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {doc, getDoc, updateDoc} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {notifySessionCancelled} from "../utils/notifications";
import {getDisplayStatus, isInactive} from "../utils/sessionUtils";
import SessionLabels from "../components/SessionLabels";
import {useConfirm} from "../components/ConfirmDialog";

// Fetch participant details for a single session
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
  const {confirm, dialog} = useConfirm();

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

    
    const confirmed = await confirm({
      title: "Cancel this session?",
      message: "Everyone who joined will be notified.",
      confirmLabel: "Cancel session",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await updateDoc(doc(db, "sessions", session.id), {
        status: "Cancelled",
      });
      await notifySessionCancelled(session);
      const {sessionData, participantProfiles} = await getSessionDetails(session.id);
      setSession(sessionData);
      setParticipants(participantProfiles);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <main className="page session-form-page"><p>Loading session...</p></main>;

  if (!session) {
    return (
      <main className="page session-form-page">
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

  const sessionCreatorId = session.creatorId;
  const isCurrentUserSessionOwner = session.creatorId === currentUser?.uid;
  const canManageSession = isCurrentUserSessionOwner && !isInactive(session);

  return (
    <main className="page session-form-page">
      <h1>Session Details</h1>

      <section className="card session-details-card">
        <h2>{session.studySpaceName}</h2>

        <dl className="session-detail-list">
          <div>
            <dt>Date</dt>
            <dd>{session.date}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{session.startTime} - {session.endTime}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{session.duration} mins</dd>
          </div>
          <div>
            <dt>Participants</dt>
            <dd>{participants.length}/{session.maxParticipants}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{getDisplayStatus(session)}</dd>
          </div>
        </dl>

        <SessionLabels session={session} />
      </section>

      <section className="card session-details-card">
        <h2>Participants</h2>

        <ul className="participant-list">
          {participants.map((participant) => {
            const isParticipantSessionOwner = participant.uid === sessionCreatorId;

            return (
              <li key={participant.uid} className="participant-item">
                <span className="participant-name participant-name-with-badge">
                  {participant.name || "Unnamed participant"}
                  {isParticipantSessionOwner && (
                    <span className="participant-owner-badge">Owner</span>
                  )}
                </span>
                {participant.email && <small>{participant.email}</small>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="session-actions details-actions">
        <button className="session-action-button back-button" onClick={() => navigate(`/sessions`)}>
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
      {dialog}
    </main>
  );
}

export default SessionDetails;
