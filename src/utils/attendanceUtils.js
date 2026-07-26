// Pure attendance helpers. No Firebase import, so the whole thing is unit
// testable with plain objects (same pattern as sessionUtils, reviewUtils,
// recommendationUtils).

import {getSessionStartMillis} from "./sessionUtils";

// How much slack to allow around the session's own start and end. People do not
// arrive on the exact minute, so check-in opens 15 minutes before the start and
// check-out stays open 15 minutes after the end.
export const CHECK_IN_BUFFER_MS = 15 * 60 * 1000;

// The three attendance states, plus the absence of any record. Kept as
// constants so components and tests never compare against loose string literals.
export const ATTENDANCE = {
  IN: "in",
  OUT: "out",
};

// Reads one user's state out of the session's attendance map. A missing map or a
// missing key both mean "no record", i.e. the user has not checked in.
export function getAttendanceState(session, uid) {
  return session?.attendance?.[uid] || null;
}

export function hasCheckedIn(session, uid) {
  return getAttendanceState(session, uid) === ATTENDANCE.IN;
}

export function hasCheckedOut(session, uid) {
  return getAttendanceState(session, uid) === ATTENDANCE.OUT;
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
// gate the UI uses to decide whether check-in and check-out are allowed at all,
// so the physical "you have to actually be there around the right time" rule
// lives in exactly one place.
export function isWithinCheckInWindow(session, now = new Date()) {
  const start = getSessionStartMillis(session);
  const end = getSessionEndMillis(session);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

  const nowMillis = now.getTime();
  return nowMillis >= start - CHECK_IN_BUFFER_MS && nowMillis <= end + CHECK_IN_BUFFER_MS;
}

// What the user is allowed to do right now, given their current state and the
// window. Returning a single verb keeps the component's job to rendering rather
// than re-deriving the rules.
//
//   "check-in"  -> no record yet, window open
//   "check-out" -> already checked in, window open
//   null        -> nothing to do (already checked out, window closed, or a
//                   cancelled session)
export function getAvailableAction(session, uid, now = new Date()) {
  if (!session || session.status === "Cancelled") return null;

  const state = getAttendanceState(session, uid);
  if (state === ATTENDANCE.OUT) return null;

  if (!isWithinCheckInWindow(session, now)) return null;

  return state === ATTENDANCE.IN ? "check-out" : "check-in";
}

// A short human label for a user's attendance on one session, used in the
// records list. "Missed" is only asserted once the session is over and no
// check-in was ever recorded, so an upcoming session reads as "Upcoming" rather
// than prematurely branding the user absent.
export function getAttendanceLabel(session, uid, now = new Date()) {
  const state = getAttendanceState(session, uid);

  if (state === ATTENDANCE.OUT) return "Attended";
  if (state === ATTENDANCE.IN) return "Checked in";

  const end = getSessionEndMillis(session);
  if (Number.isFinite(end) && now.getTime() > end + CHECK_IN_BUFFER_MS) {
    return "Missed";
  }

  return "Upcoming";
}

// Attendance counts as "showed up" if the user checked in, whether or not they
// remembered to check out. Forgetting to check out is common and should not be
// punished as an absence; the check-in is the real signal that they attended.
export function didAttend(session, uid) {
  const state = getAttendanceState(session, uid);
  return state === ATTENDANCE.IN || state === ATTENDANCE.OUT;
}

// A session only counts toward the rate once it is genuinely over, so upcoming
// and in-progress sessions do not drag the denominator down before the user has
// had a chance to show up.
export function isCompletedForAttendance(session, uid, now = new Date()) {
  if (didAttend(session, uid)) return true;
  const end = getSessionEndMillis(session);
  return Number.isFinite(end) && now.getTime() > end + CHECK_IN_BUFFER_MS;
}

// Summarises a user's attendance across the sessions they joined. `attended` is
// how many they showed up to; `eligible` is how many have finished (or been
// attended), i.e. the ones that could count. Rate is null when nothing has
// resolved yet, which the UI shows as a dash rather than a misleading 0%.
export function summarizeAttendance(sessions, uid, now = new Date()) {
  const joined = (sessions || []).filter((session) =>
    (session.participants || []).includes(uid)
  );

  let attended = 0;
  let eligible = 0;

  for (const session of joined) {
    if (isCompletedForAttendance(session, uid, now)) {
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
