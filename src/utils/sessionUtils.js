export const STUDY_GOAL_MAX_LENGTH = 120;

export function isExpired(session) {
  const sessionEnd = new Date(`${session.date}T${session.endTime}`);
  return sessionEnd < new Date();
}

export function isInactive(session) {
  return session.status === "Cancelled" || isExpired(session);
}

export function getDisplayStatus(session) {
  if (session.status === "Cancelled") return "Cancelled";
  if (isExpired(session)) return "Completed";
  return "Active";
}

export function getSessionStartMillis(session) {
  if (!session.date || !session.startTime) return Number.POSITIVE_INFINITY;

  const parsedTime = Date.parse(`${session.date} ${session.startTime}`);
  if (!Number.isNaN(parsedTime)) return parsedTime;

  const parsedIsoTime = Date.parse(`${session.date}T${session.startTime}`);
  if (!Number.isNaN(parsedIsoTime)) return parsedIsoTime;

  return Number.POSITIVE_INFINITY;
}

export function sortSessions(sessions) {
  const active = sessions.filter((s) => !isInactive(s));
  const inactive = sessions.filter((s) => isInactive(s));
  const byStartTime = (a, b) => getSessionStartMillis(a) - getSessionStartMillis(b);
  return [...active.sort(byStartTime), ...inactive.sort(byStartTime)];
}
