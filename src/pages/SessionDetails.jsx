import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {arrayUnion, doc, getDoc, runTransaction, updateDoc} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {notifySessionCancelled} from "../utils/notifications";
import {getDisplayStatus, isBeforeSessionStart, isInactive} from "../utils/sessionUtils";
import {canLeaveSession, getAvailableAction} from "../utils/attendanceUtils";
import {checkIn} from "../utils/attendance";
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
  const [activeAction, setActiveAction] = useState(null);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshSession() {
    const {sessionData, participantProfiles} = await getSessionDetails(id);
    setSession(sessionData);
    setParticipants(participantProfiles);
    setMessage(sessionData ? "" : "Session not found.");
  }

  async function handleJoinSession() {
    if (!session || !currentUser) return;

    try {
      setMessage("");
      setActiveAction("join");
      const sessionRef = doc(db, "sessions", session.id);

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);

        if (!sessionSnap.exists()) {
          throw new Error("Session no longer exists.");
        }

        const latestSession = sessionSnap.data();
        const participantIds = latestSession.participants || [];

        if (latestSession.creatorId === currentUser.uid) {
          throw new Error("You cannot join your own session.");
        }

        if (latestSession.status !== "Active") {
          throw new Error("This session is not active.");
        }

        if (participantIds.includes(currentUser.uid)) return;

        if (participantIds.length >= latestSession.maxParticipants) {
          throw new Error("This session is full.");
        }

        transaction.update(sessionRef, {
          participants: arrayUnion(currentUser.uid),
        });
      });

      navigate("/my-sessions");
    } catch (error) {
      console.error("Failed to join session:", error);
      setMessage("Could not join this session. It may be full or no longer available.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleLeaveSession() {
    if (!session || !currentUser) return;

    const confirmed = await confirm({
      title: "Leave this session?",
      message: "You'll be removed from the participant list.",
      confirmLabel: "Leave",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setMessage("");
      setActiveAction("leave");
      const sessionRef = doc(db, "sessions", session.id);

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);

        if (!sessionSnap.exists()) {
          throw new Error("Session no longer exists.");
        }

        const latestSession = sessionSnap.data();
        if (!canLeaveSession(latestSession, currentUser.uid)) {
          throw new Error("Registration can no longer be withdrawn.");
        }

        transaction.update(sessionRef, {
          participants: (latestSession.participants || [])
            .filter((uid) => uid !== currentUser.uid),
        });
      });

      navigate("/my-sessions");
    } catch (error) {
      console.error("Failed to leave session:", error);
      setMessage(error.message);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleAttendance() {
    if (!session || !currentUser) return;
    if (getAvailableAction(session, currentUser.uid) !== "check-in") return;

    try {
      setMessage("");
      setActiveAction("check-in");
      await checkIn(session.id, currentUser.uid);
      await refreshSession();
    } catch (error) {
      console.error("Failed to check in:", error);
      setMessage(error.message);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleCancelSession() {
    if (!session) return;

    const currentTime = new Date();
    if (!isBeforeSessionStart(session, currentTime)) {
      setNow(currentTime);
      setMessage("This session can no longer be cancelled after it starts.");
      return;
    }

    const confirmed = await confirm({
      title: "Cancel this session?",
      message: "Everyone who joined will be notified.",
      confirmLabel: "Cancel session",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setMessage("");
      setActiveAction("cancel");
      await updateDoc(doc(db, "sessions", session.id), {
        status: "Cancelled",
      });
      await notifySessionCancelled(session);
      await refreshSession();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActiveAction(null);
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
  const isJoined = session.participants?.includes(currentUser?.uid);
  const inactive = isInactive(session);
  const isFull = participants.length >= session.maxParticipants;
  const canJoinSession = !isCurrentUserSessionOwner && !isJoined && !inactive;
  const canManageSession = isCurrentUserSessionOwner
    && !inactive
    && isBeforeSessionStart(session, now);
  const attendanceAction = getAvailableAction(session, currentUser?.uid, now);
  const canLeave = canLeaveSession(session, currentUser?.uid, now);
  const actionLoading = activeAction !== null;

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
                  {(participant.yearOfStudy || participant.major) && (
                  <span className="participant-meta">
                    {[participant.yearOfStudy, participant.major]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                
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

        {canJoinSession && (
          <button
            className={`session-action-button ${isFull ? "full-button" : "join-button"}`}
            disabled={actionLoading || isFull}
            onClick={handleJoinSession}
          >
            {isFull ? "Full" : activeAction === "join" ? "Joining..." : "Join"}
          </button>
        )}

        {canManageSession && (
          <button
            className="session-action-button edit-button"
            disabled={actionLoading}
            onClick={() => {
              const currentTime = new Date();
              if (!isBeforeSessionStart(session, currentTime)) {
                setNow(currentTime);
                return;
              }
              navigate(`/sessions/${session.id}/edit`);
            }}
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
            {activeAction === "cancel" ? "Cancelling..." : "Cancel"}
          </button>
        )}

        {attendanceAction === "check-in" && (
          <button
            className="session-action-button checkin-button"
            disabled={actionLoading}
            onClick={handleAttendance}
          >
            {activeAction === "check-in" ? "Saving..." : "Check in"}
          </button>
        )}

        {canLeave && (
          <button
            className="session-action-button cancel-button"
            disabled={actionLoading}
            onClick={handleLeaveSession}
          >
            {activeAction === "leave" ? "Leaving..." : "Leave"}
          </button>
        )}
      </div>

      {message && <p className="message">{message}</p>}
      {dialog}
    </main>
  );
}

export default SessionDetails;
