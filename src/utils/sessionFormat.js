// Pure formatting helpers for session cards. No Firebase, no React, so these are
// unit testable on their own (same pattern as the other *Utils files).

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Turns "2026-07-28" into "Tue 28 Jul". Falls back to the raw string if it does
// not parse, so a malformed date never blanks the card.
export function formatSessionDate(dateStr) {
  if (!dateStr) return "";

  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts.map(Number);
  if ([year, month, day].some(Number.isNaN)) return dateStr;

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return dateStr;

  return `${WEEKDAYS[date.getDay()]} ${day} ${MONTHS[month - 1]}`;
}

// Turns a start/end pair into a compact duration like "2h", "45m", "1h 30m".
// Handles a session that crosses midnight by adding a day. Returns "" when the
// times are missing or unparseable rather than showing a bogus "0m".
export function formatDuration(startTime, endTime) {
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  if (start === null || end === null) return "";

  let diff = end - start;
  if (diff < 0) diff += 24 * 60; // crossed midnight
  if (diff === 0) return "";

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function parseMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// The single human line the tidied card uses:
//   "Tue 28 Jul · 14:00–16:00 (2h)"
// Pieces that are missing are dropped rather than left as empty separators.
export function formatSessionWhen(session) {
  const date = formatSessionDate(session?.date);
  const start = session?.startTime || "";
  const end = session?.endTime || "";
  const duration = formatDuration(start, end);

  const timeRange = start && end ? `${start}\u2013${end}` : start || end || "";

  const main = [date, timeRange].filter(Boolean).join(" \u00b7 ");
  return duration ? `${main} (${duration})` : main;
}
