// Pure recommendation helpers. No Firebase import, so the whole scoring layer is
// unit testable with plain objects (same pattern as sessionUtils, reviewUtils).
//
// The approach is deliberately rule based rather than any kind of model. We have
// three honest signals about a user: the module codes they have studied, the
// study mode they pick most, and the spaces they have actually shown up to. A
// weighted sum over those is transparent, cheap, and easy to defend in a review.

import {isInactive, getSessionStartMillis} from "./sessionUtils";
import {didAttend} from "./attendanceUtils";

// How much each matching signal adds to a session's score. Kept as one object so
// the weighting lives in a single visible place and is trivial to tune.
export const SESSION_WEIGHTS = {
  moduleMatch: 3,
  modeMatch: 2,
  spaceMatch: 2,
  startingSoon: 1,
};

// A session starting within this window earns the recency nudge. Two days is
// short enough that "soon" still carries meaning.
export const STARTING_SOON_MS = 48 * 60 * 60 * 1000;

// Builds a profile only from sessions where the user actually checked in.
// Registration, missed sessions, and cancelled sessions are not attendance.
export function buildUserProfile(userSessions, uid) {
  const attended = (userSessions || []).filter((session) =>
    (session.participants || []).includes(uid) && didAttend(session, uid)
  );

  const moduleCodes = new Set();
  const spaceIds = new Set();
  const spaceAttendanceCounts = {};
  const modeCounts = {};

  for (const session of attended) {
    const moduleCode = session.moduleCode?.trim().toUpperCase();
    if (moduleCode) moduleCodes.add(moduleCode);

    if (session.studySpaceId) {
      spaceIds.add(session.studySpaceId);
      spaceAttendanceCounts[session.studySpaceId] =
        (spaceAttendanceCounts[session.studySpaceId] || 0) + 1;
    }

    const mode = session.studyMode?.trim();
    if (mode) modeCounts[mode] = (modeCounts[mode] || 0) + 1;
  }

  return {
    moduleCodes,
    spaceIds,
    spaceAttendanceCounts,
    // The mode the user picks most often. "Both" is a real selectable mode, so
    // it is treated like any other rather than given special handling.
    favouriteMode: pickTopKey(modeCounts),
    attendedCount: attended.length,
  };
}

function pickTopKey(counts) {
  let topKey = null;
  let topCount = 0;
  // Object insertion order is stable in JS, so the first key to reach the top
  // count wins ties. Arbitrary but deterministic, which is what tests rely on.
  for (const [key, count] of Object.entries(counts)) {
    if (count > topCount) {
      topKey = key;
      topCount = count;
    }
  }
  return topKey;
}

// A session is only worth recommending if the user could actually act on it:
// still active, not their own, not already joined, and not full.
export function isRecommendable(session, uid, now = new Date()) {
  if (isInactive(session, now)) return false;
  if (session.creatorId === uid) return false;

  const participants = session.participants || [];
  if (participants.includes(uid)) return false;
  if (participants.length >= session.maxParticipants) return false;

  return true;
}

// The score is a sum of matched signals. Returning the breakdown alongside the
// total lets the UI say *why* something is recommended ("Matches CS2103T"),
// which is far more persuasive than a bare ordering.
export function scoreSession(session, profile, now = new Date()) {
  const reasons = [];
  let score = 0;

  const moduleCode = session.moduleCode?.trim().toUpperCase();
  if (moduleCode && profile.moduleCodes.has(moduleCode)) {
    score += SESSION_WEIGHTS.moduleMatch;
    reasons.push(`Matches ${moduleCode}`);
  }

  const mode = session.studyMode?.trim();
  if (mode && profile.favouriteMode && mode === profile.favouriteMode) {
    score += SESSION_WEIGHTS.modeMatch;
    reasons.push(`${mode} study`);
  }

  if (session.studySpaceId && profile.spaceIds.has(session.studySpaceId)) {
    score += SESSION_WEIGHTS.spaceMatch;
    reasons.push(`At ${session.studySpaceName || "a space you've used"}`);
  }

  const startMillis = getSessionStartMillis(session);
  const untilStart = startMillis - now.getTime();
  if (untilStart >= 0 && untilStart <= STARTING_SOON_MS) {
    score += SESSION_WEIGHTS.startingSoon;
    reasons.push("Starting soon");
  }

  return {score, reasons};
}

// Recommends sessions in score order. For a user with history, sessions matching
// nothing (score 0) are dropped so the section shows real matches rather than
// padding. For a brand new user with no profile, everything scores 0, so we fall
// back to soonest first, which keeps the section populated on day one.
export function recommendSessions(sessions, profile, uid, options = {}) {
  const {limit = 3, now = new Date()} = options;

  const eligible = (sessions || []).filter((session) =>
    isRecommendable(session, uid, now)
  );

  const hasHistory = profile.attendedCount > 0;

  const scored = eligible.map((session) => ({
    session,
    ...scoreSession(session, profile, now),
  }));

  const kept = hasHistory
    ? scored.filter((entry) => entry.score > 0)
    : scored;

  kept.sort((a, b) => {
    // With history: higher score first, ties broken by soonest start so the
    // more urgent of two equally good sessions surfaces. Without history: score
    // is uniformly 0, so this collapses to a pure soonest-first ordering.
    if (b.score !== a.score) return b.score - a.score;
    return getSessionStartMillis(a.session) - getSessionStartMillis(b.session);
  });

  return kept.slice(0, limit);
}

// Ranks spaces by how often the user has studied there, then by average rating,
// then by name for a stable order. Rating only separates spaces the user has
// visited equally often, so it refines the personal signal without overriding it.
// A user with no history falls straight through to rating-then-name, which is a
// reasonable "best spaces" list.
export function recommendSpaces(spaces, profile, ratingSummaries = {}, options = {}) {
  const {limit = 3} = options;

  const attendanceCounts = profile.spaceAttendanceCounts || {};

  return [...(spaces || [])]
    .map((space) => ({
      space,
      visits: attendanceCounts[space.id] || 0,
      // Unrated spaces sort below rated ones rather than above them.
      rating: ratingSummaries[space.id]?.averageRating ?? -1,
    }))
    .sort((a, b) => {
      if (b.visits !== a.visits) return b.visits - a.visits;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.space.name.localeCompare(b.space.name);
    })
    .slice(0, limit)
    .map((entry) => entry.space);
}
