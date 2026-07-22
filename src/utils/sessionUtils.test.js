import { describe, it, expect } from "vitest";
import {
  isValidNusModuleCode,
  normalizeModuleCode,
  isExpired,
  isInactive,
  getDisplayStatus,
  getSessionStartMillis,
  sortSessions,
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
