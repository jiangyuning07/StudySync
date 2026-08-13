export const STUDY_GOAL_MAX_LENGTH = 120;
export const MODULE_CODE_MAX_LENGTH = 10;
export const STUDY_MODES = ["Silent", "Discussion", "Both"];

const NUS_MODULE_CODE_PATTERN = /^[A-Z]{2,4}\d{4}[A-Z]{0,2}$/;

export function normalizeModuleCode(moduleCode) {
  return moduleCode.trim().toUpperCase();
}

export function isValidNusModuleCode(moduleCode) {
  const normalizedCode = normalizeModuleCode(moduleCode);
  return normalizedCode === "" || NUS_MODULE_CODE_PATTERN.test(normalizedCode);
}

export function isExpired(session, now = new Date()) {
  const sessionEnd = new Date(`${session.date}T${session.endTime}`);
  return sessionEnd < now;
}

export function isInactive(session, now = new Date()) {
  return session.status === "Cancelled" || isExpired(session, now);
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

export function isBeforeSessionStart(session, now = new Date()) {
  const start = getSessionStartMillis(session);
  return Number.isFinite(start) && now.getTime() < start;
}

export function sortSessions(sessions) {
  const active = sessions.filter((s) => !isInactive(s));
  const inactive = sessions.filter((s) => isInactive(s));
  const byStartTime = (a, b) => getSessionStartMillis(a) - getSessionStartMillis(b);
  return [...active.sort(byStartTime), ...inactive.sort(byStartTime)];
}

export function filterSessions(
  sessions,
  {studyMode = "", moduleCode = "", studyGoal = "", activeOnly = false} = {}
) {
  const normalizedMode = studyMode.trim().toLowerCase();
  const normalizedModuleCode = moduleCode.trim().toLowerCase();
  const goalKeywords = studyGoal
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return sessions.filter((session) => {
    const sessionMode = session.studyMode?.trim().toLowerCase() || "";
    const sessionModuleCode = session.moduleCode?.trim().toLowerCase() || "";
    const sessionGoal = session.studyGoal?.trim().toLowerCase() || "";

    return (
      (!activeOnly || !isInactive(session)) &&
      (!normalizedMode || sessionMode === normalizedMode) &&
      (!normalizedModuleCode || sessionModuleCode.includes(normalizedModuleCode)) &&
      goalKeywords.every((keyword) => sessionGoal.includes(keyword))
    );
  });
}
