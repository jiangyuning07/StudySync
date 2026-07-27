import { describe, it, expect } from "vitest";
import {
  isValidNusModuleCode,
  normalizeModuleCode,
  isExpired,
  isInactive,
  getDisplayStatus,
  getSessionStartMillis,
  isBeforeSessionStart,
  sortSessions,
  filterSessions,
} from "./sessionUtils";

const FUTURE_DATE = "2099-12-31";
const PAST_DATE = "2000-01-01";

function makeSession(overrides = {}) {
  return {
    date: FUTURE_DATE,
    startTime: "10:00",
    endTime: "12:00",
    status: "Active",
    ...overrides,
  };
}

// ─── NUS module codes ───────────────────────────────────────────────────────

describe("NUS module code validation", () => {
  it.each(["CS1010S", "MA1521", "GEA1000", "GEN2050X", "GESS1025"])(
    "accepts %s",
    (moduleCode) => {
      expect(isValidNusModuleCode(moduleCode)).toBe(true);
    }
  );

  it("allows an empty module code because the field is optional", () => {
    expect(isValidNusModuleCode("")).toBe(true);
  });

  it.each(["A1234", "1010CS", "CS101", "CS10101", "CS-1010", "TOOLONG1010", "CS 1010"])(
    "rejects %s",
    (moduleCode) => {
      expect(isValidNusModuleCode(moduleCode)).toBe(false);
    }
  );

  it("trims and uppercases a module code", () => {
    expect(normalizeModuleCode(" cs1010s ")).toBe("CS1010S");
  });
});

// ─── isExpired ───────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("returns false for a future session", () => {
    expect(isExpired(makeSession())).toBe(false);
  });

  it("returns true for a past session", () => {
    expect(isExpired(makeSession({ date: PAST_DATE }))).toBe(true);
  });
});

// ─── isInactive ──────────────────────────────────────────────────────────────

describe("isInactive", () => {
  it("returns false for an active future session", () => {
    expect(isInactive(makeSession())).toBe(false);
  });

  it("returns true for a cancelled session", () => {
    expect(isInactive(makeSession({ status: "Cancelled" }))).toBe(true);
  });

  it("returns true for an expired session", () => {
    expect(isInactive(makeSession({ date: PAST_DATE }))).toBe(true);
  });
});

// ─── getDisplayStatus ────────────────────────────────────────────────────────

describe("getDisplayStatus", () => {
  it("returns Active for a future active session", () => {
    expect(getDisplayStatus(makeSession())).toBe("Active");
  });

  it("returns Cancelled for a cancelled session", () => {
    expect(getDisplayStatus(makeSession({ status: "Cancelled" }))).toBe("Cancelled");
  });

  it("returns Completed for an expired session", () => {
    expect(getDisplayStatus(makeSession({ date: PAST_DATE }))).toBe("Completed");
  });
});

// ─── getSessionStartMillis ───────────────────────────────────────────────────

describe("getSessionStartMillis", () => {
  it("returns a valid timestamp for a session with date and startTime", () => {
    const ms = getSessionStartMillis(makeSession({ date: "2099-12-31", startTime: "10:00" }));
    expect(ms).toBeGreaterThan(0);
    expect(ms).not.toBe(Number.POSITIVE_INFINITY);
  });

  it("returns POSITIVE_INFINITY when date is missing", () => {
    expect(getSessionStartMillis({ startTime: "10:00" })).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns POSITIVE_INFINITY when startTime is missing", () => {
    expect(getSessionStartMillis({ date: "2099-12-31" })).toBe(Number.POSITIVE_INFINITY);
  });

  it("earlier session has smaller millis than later session", () => {
    const early = getSessionStartMillis(makeSession({ startTime: "09:00" }));
    const late = getSessionStartMillis(makeSession({ startTime: "14:00" }));
    expect(early).toBeLessThan(late);
  });
});

describe("isBeforeSessionStart", () => {
  const session = makeSession({date: "2026-07-27", startTime: "10:00"});

  it("returns true only before the session starts", () => {
    expect(isBeforeSessionStart(session, new Date("2026-07-27T09:59:59"))).toBe(true);
    expect(isBeforeSessionStart(session, new Date("2026-07-27T10:00:00"))).toBe(false);
  });

  it("returns false when the session start is invalid", () => {
    expect(isBeforeSessionStart({date: "2026-07-27"})).toBe(false);
  });
});

// ─── sortSessions ────────────────────────────────────────────────────────────

describe("sortSessions", () => {
  it("active sessions come before inactive ones", () => {
    const sessions = [
      makeSession({ status: "Cancelled", startTime: "08:00" }),
      makeSession({ startTime: "10:00" }),
      makeSession({ date: PAST_DATE, startTime: "09:00" }),
      makeSession({ startTime: "09:00" }),
    ];

    const sorted = sortSessions(sessions);
    const firstInactiveIndex = sorted.findIndex((s) => isInactive(s));
    const lastActiveIndex = sorted.map((s) => !isInactive(s)).lastIndexOf(true);

    expect(lastActiveIndex).toBeLessThan(firstInactiveIndex);
  });

  it("active sessions are sorted by start time ascending", () => {
    const sessions = [
      makeSession({ startTime: "14:00" }),
      makeSession({ startTime: "09:00" }),
      makeSession({ startTime: "11:00" }),
    ];

    const sorted = sortSessions(sessions);
    expect(sorted[0].startTime).toBe("09:00");
    expect(sorted[1].startTime).toBe("11:00");
    expect(sorted[2].startTime).toBe("14:00");
  });

  it("handles empty array", () => {
    expect(sortSessions([])).toEqual([]);
  });

  it("sessions with missing date/time go to end of active list", () => {
    const sessions = [
      makeSession({ startTime: "10:00" }),
      { status: "Active" }, // no date or startTime
      makeSession({ startTime: "09:00" }),
    ];

    const sorted = sortSessions(sessions);
    expect(sorted[0].startTime).toBe("09:00");
    expect(sorted[1].startTime).toBe("10:00");
  });
});

// ─── filterSessions ─────────────────────────────────────────────────────────

describe("filterSessions", () => {
  const sessions = [
    makeSession({
      id: "silent-cs",
      studyMode: "Silent",
      moduleCode: "CS2103T",
      studyGoal: "Review week 6 tutorial questions",
    }),
    makeSession({
      id: "discussion-ma",
      studyMode: "Discussion",
      moduleCode: "MA1521",
      studyGoal: "Prepare for midterm exam",
    }),
    makeSession({
      id: "silent-cs-alt",
      studyMode: "Silent",
      moduleCode: "CS1010S",
      studyGoal: "Complete problem set",
    }),
  ];

  it("returns all sessions when no filters are set", () => {
    expect(filterSessions(sessions)).toEqual(sessions);
  });

  it("matches study mode exactly and case-insensitively", () => {
    expect(filterSessions(sessions, {studyMode: "silent"}).map((s) => s.id))
      .toEqual(["silent-cs", "silent-cs-alt"]);
  });

  it("supports partial, case-insensitive module code searches", () => {
    expect(filterSessions(sessions, {moduleCode: "cs"}).map((s) => s.id))
      .toEqual(["silent-cs", "silent-cs-alt"]);
  });

  it("matches every study goal keyword regardless of spacing", () => {
    expect(filterSessions(sessions, {studyGoal: "  tutorial   week "}).map((s) => s.id))
      .toEqual(["silent-cs"]);
  });

  it("combines different filters with AND logic", () => {
    expect(filterSessions(sessions, {
      studyMode: "Discussion",
      moduleCode: "MA1521",
      studyGoal: "exam",
    }).map((s) => s.id)).toEqual(["discussion-ma"]);
  });

  it("shows only active, non-expired sessions when activeOnly is enabled", () => {
    const mixedSessions = [
      ...sessions,
      makeSession({id: "cancelled", status: "Cancelled"}),
      makeSession({id: "completed", date: PAST_DATE}),
    ];

    expect(filterSessions(mixedSessions, {activeOnly: true}).map((s) => s.id))
      .toEqual(["silent-cs", "discussion-ma", "silent-cs-alt"]);
  });

  it("handles sessions with missing labels", () => {
    expect(filterSessions([makeSession({id: "unlabelled"})], {studyGoal: "exam"}))
      .toEqual([]);
  });
});
