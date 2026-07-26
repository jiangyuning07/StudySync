import {getDisplayStatus} from "../utils/sessionUtils";

// A small coloured pill for the session's status, shown top-right of the card.
// getDisplayStatus already collapses raw state into the three user-facing values,
// so this just maps each to a colour class.
const STATUS_CLASS = {
  Active: "status-pill-active",
  Completed: "status-pill-completed",
  Cancelled: "status-pill-cancelled",
};

function SessionStatusPill({session}) {
  const status = getDisplayStatus(session);
  return (
    <span className={`status-pill ${STATUS_CLASS[status] || ""}`}>
      {status}
    </span>
  );
}

export default SessionStatusPill;
