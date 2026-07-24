// Pure notification helpers. No Firebase import here on purpose, so these stay
// easy to unit test (same idea as sessionUtils.js).

// The three situations a participant can be notified about.
export const NOTIFICATION_TYPES = {
  SESSION_UPDATED: "session_updated",
  SESSION_CANCELLED: "session_cancelled",
  PARTICIPANT_REMOVED: "participant_removed",
};

// A short human phrase describing which session a notification is about.
export function describeSession(session) {
  const sessionDescription = session?.studySpaceName
    ? `the session at ${session.studySpaceName}`
    : "a study session";
  const date = session?.date ? ` on ${session.date}` : "";
  return `${sessionDescription}${date}`;
}

// Everyone who should hear about an edit or a cancellation: the joined
// participants, minus the creator themselves (they made the change), with any
// explicitly excluded uids dropped and duplicates collapsed.
export function computeSessionRecipients(session, excludeUids = []) {
  const creatorId = session?.creatorId;
  const excluded = new Set([creatorId, ...excludeUids].filter(Boolean));

  return [...new Set(session?.participants || [])].filter(
    (uid) => uid && !excluded.has(uid)
  );
}

export function buildUpdatedMessage(session) {
  const who = session?.creatorName || "The session creator";
  return `${who} updated ${describeSession(session)}.`;
}

export function buildCancelledMessage(session) {
  const who = session?.creatorName || "The session creator";
  return `${who} cancelled ${describeSession(session)}.`;
}

export function buildRemovedMessage(session) {
  return `You were removed from ${describeSession(session)}.`;
}
