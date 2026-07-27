// Pure attendance helpers. No Firebase import, so the whole thing is unit
// testable with plain objects (same pattern as sessionUtils, reviewUtils,
// recommendationUtils).

import {getSessionStartMillis} from "./sessionUtils";

// Slack around the session's own start and end. People do not arrive on the
// exact minute, so the check-in window opens 15 minutes before the start and
// stays open 15 minutes after the end.
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
  const end = getSessionEndMillis(session);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

  const nowMillis = now.getTime();
  return nowMillis >= start - CHECK_IN_BUFFER_MS && nowMillis <= end + CHECK_IN_BUFFER_MS;
}

// True once the check-in window has fully closed (session end + buffer). Used to
// decide when the Leave button should disappear for someone who never showed.
export function isCheckInWindowOver(session, now = new Date()) {
  const end = getSessionEndMillis(session);
  return Number.isFinite(end) && now.getTime() > end + CHECK_IN_BUFFER_MS;
}

// What the user can do right now. Returns "check-in" only when they have not
// checked in, the window is open, and the session is live. Everything else
// returns null, which is how every "button should disappear" case is expressed:
//   - already checked in  -> null (locked; the card shows "Attended")
//   - window not open yet / already closed -> null
//   - cancelled session    -> null
export function getAvailableAction(session, uid, now = new Date()) {
  if (!session || session.status === "Cancelled") return null;
  if (hasCheckedIn(session, uid)) return null;
  if (!isWithinCheckInWindow(session, now)) return null;

  return "check-in";
}

// Whether the Leave button should show for a joined session. A user may leave
// only while they have NOT checked in and the check-in window has not yet closed.
// Checking in locks them in (Leave disappears); once the window is over, leaving
// is moot because the session is done.
export function canLeaveSession(session, uid, now = new Date()) {
  if (!session || session.status === "Cancelled") return false;
  if (hasCheckedIn(session, uid)) return false;
  if (isCheckInWindowOver(session, now)) return false;

  return true;
}

// A short human label for a user's attendance on one session, used in the
// records list. "Missed" is only asserted once the session is over and no
// check-in was recorded, so an upcoming session reads as "Upcoming" rather than
// prematurely branding the user absent.
export function getAttendanceLabel(session, uid, now = new Date()) {
  if (hasCheckedIn(session, uid)) return "Attended";
  if (isCheckInWindowOver(session, now)) return "Missed";
  return "Upcoming";
}

// Attendance counts as "showed up" if the user checked in. With no check-out
// state, this is simply whether the record is "in".
export function didAttend(session, uid) {
  return hasCheckedIn(session, uid);
}

// A session counts toward the rate only once it is genuinely over and only if it
// is one the user was actually expected to attend. Sessions the user created are
// excluded: the creator is auto-added to participants but has no check-in button,
// so counting their own sessions would unfairly mark them absent. Cancelled
// sessions are excluded because they never happened.
export function countsTowardRate(session, uid, now = new Date()) {
  if (session.status === "Cancelled") return false;
  if (session.creatorId === uid) return false;
  return isCheckInWindowOver(session, now) || didAttend(session, uid);
}

// Summarises a user's attendance across the sessions they joined. `attended` is
// how many they showed up to; `eligible` is how many count toward the rate.
// Rate is null when nothing has resolved yet, shown by the UI as a dash rather
// than a misleading 0%.
export function summarizeAttendance(sessions, uid, now = new Date()) {
  const joined = (sessions || []).filter((session) =>
    (session.participants || []).includes(uid)
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
