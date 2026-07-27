import {useNavigate} from "react-router-dom";
import SessionLabels from "./SessionLabels";

// A preview card, not the full session card from AllSessions. Joining happens on
// the detail page, so this only has to say enough to make someone click through:
// where, when, how full, and crucially *why* it was recommended.
function RecommendedSessionCard({session, reasons}) {
  const navigate = useNavigate();
  const participantCount = session.participants?.length || 0;

  return (
    <div
      className="card recommendation-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/sessions/${session.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/sessions/${session.id}`);
        }
      }}
    >
      <h3>{session.studySpaceName}</h3>
      <p><strong>Date:</strong> {session.date}</p>
      <p><strong>Time:</strong> {session.startTime} - {session.endTime}</p>
      <p><strong>Spots:</strong> {participantCount}/{session.maxParticipants}</p>

      <SessionLabels session={session} />

      {reasons && reasons.length > 0 && (
        <ul className="recommendation-reasons">
          {reasons.map((reason) => (
            <li key={reason}>#{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RecommendedSessionCard;
