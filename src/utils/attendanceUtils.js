// Pure attendance helpers. No Firebase import, so the whole thing is unit
// testable with plain objects (same pattern as sessionUtils, reviewUtils,
// recommendationUtils).

import {getSessionStartMillis, isBeforeSessionStart} from "./sessionUtils";

// Check-in opens 15 minutes before the session starts and closes 15 minutes
// after it starts. The end time is unrelated to check-in eligibility.
export const CHECK_IN_BUFFER_MS = 15 * 60 * 1000;

// Attendance is a two-state model: a user has either checked in ("in") or has no
// record at all. There is no check-out. Checking in is final for that session.
export const ATTENDANCE = {
  IN: "in",
};

// Reads one user's state out of the session's attendance map. A missing map or a
// missing key both mean "no record", i.e. the user has not checked in.
export function getAttendanceState(session, uid) {
  return session?.attendance?.[uid] || null;
}

export function hasCheckedIn(session, uid) {
  return getAttendanceState(session, uid) === ATTENDANCE.IN;
}

// End of the session in millis, mirroring getSessionStartMillis from sessionUtils
// so both ends of the window are derived the same way.
export function getSessionEndMillis(session) {
  if (!session?.date || !session?.endTime) return Number.POSITIVE_INFINITY;

  const parsedTime = Date.parse(`${session.date} ${session.endTime}`);
  if (!Number.isNaN(parsedTime)) return parsedTime;

  const parsedIsoTime = Date.parse(`${session.date}T${session.endTime}`);
  if (!Number.isNaN(parsedIsoTime)) return parsedIsoTime;

  return Number.POSITIVE_INFINITY;
}

// True when `now` falls inside the buffered session window. This is the single
// gate for whether check-in is allowed at all, so the "you have to be there
// around the right time" rule lives in exactly one place.
export function isWithinCheckInWindow(session, now = new Date()) {
  const start = getSessionStartMillis(session);
  if (!Number.isFinite(start)) return false;

  const nowMillis = now.getTime();
  return nowMillis >= start - CHECK_IN_BUFFER_MS
    && nowMillis <= start + CHECK_IN_BUFFER_MS;
}

// True once the start-centred check-in window has fully closed.
export function isCheckInWindowOver(session, now = new Date()) {
  const start = getSessionStartMillis(session);
  return Number.isFinite(start) && now.getTime() > start + CHECK_IN_BUFFER_MS;
}

export function isSessionOver(session, now = new Date()) {
  const end = getSessionEndMillis(session);
  return Number.isFinite(end) && now.getTime() >= end;
}

// What the user can do right now. Returns "check-in" only when they have not
// checked in, the window is open, and the session is live. Everything else
// returns null, which is how every "button should disappear" case is expressed:
//   - already checked in  -> null (locked; the card shows "Attended")
//   - window not open yet / already closed -> null
//   - cancelled session    -> null
export function getAvailableAction(session, uid, now = new Date()) {
  if (!session || session.status !== "Active") return null;
  if (!(session.participants || []).includes(uid)) return null;
  if (getAttendanceState(session, uid) !== null) return null;
  if (!isWithinCheckInWindow(session, now)) return null;

  return "check-in";
}

// Registration may be withdrawn only before the session starts. Any attendance
// record locks the participant into the historical session record.
export function canLeaveSession(session, uid, now = new Date()) {
  if (!session || session.status !== "Active") return false;
  if (session.creatorId === uid) return false;
  if (!(session.participants || []).includes(uid)) return false;
  if (getAttendanceState(session, uid) !== null) return false;

  return isBeforeSessionStart(session, now);
}

// A short human label for a user's attendance on one session. An unchecked
// session is Upcoming before it starts, Ongoing while in progress, and becomes
// Missed when it ends.
export function getAttendanceLabel(session, uid, now = new Date()) {
  if (session?.status === "Cancelled") return "Cancelled";
  if (hasCheckedIn(session, uid)) return "Attended";
  if (isSessionOver(session, now)) return "Missed";

  const start = getSessionStartMillis(session);
  if (Number.isFinite(start) && now.getTime() < start) return "Upcoming";

  return "Ongoing";
}

// Attendance counts as "showed up" if the user checked in. With no check-out
// state, this is simply whether the record is "in".
export function didAttend(session, uid) {
  return session?.status !== "Cancelled" && hasCheckedIn(session, uid);
}

// A checked-in session counts immediately as attended. An unchecked session
// enters the denominator when it ends and becomes Missed. Cancelled sessions
// never enter attendance statistics.
export function countsTowardRate(session, uid, now = new Date()) {
  if (session.status === "Cancelled") return false;
  return isSessionOver(session, now) || didAttend(session, uid);
}

// Summarises a user's attendance across the sessions they joined. `attended` is
// how many they showed up to; `eligible` is how many count toward the rate.
// Rate is null when nothing has resolved yet, shown by the UI as a dash rather
// than a misleading 0%.
export function summarizeAttendance(sessions, uid, now = new Date()) {
  const joined = (sessions || []).filter((session) =>
    session.status !== "Cancelled"
      && (session.participants || []).includes(uid)
  );

  let attended = 0;
  let eligible = 0;

  for (const session of joined) {
    if (countsTowardRate(session, uid, now)) {
      eligible += 1;
      if (didAttend(session, uid)) attended += 1;
    }
  }

  return {
    joined: joined.length,
    attended,
    eligible,
    rate: eligible === 0 ? null : attended / eligible,
  };
}

// Formats the rate for display. Kept separate from the calculation so the number
// and its presentation can be tested independently.
export function formatAttendanceRate(rate) {
  if (rate === null || rate === undefined) return "\u2013"; // en dash
  return `${Math.round(rate * 100)}%`;
}
