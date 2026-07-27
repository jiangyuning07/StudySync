import {describe, it, expect} from "vitest";
import {
  CHECK_IN_BUFFER_MS,
  getAttendanceState,
  hasCheckedIn,
  getSessionEndMillis,
  isWithinCheckInWindow,
  isCheckInWindowOver,
  getAvailableAction,
  canLeaveSession,
  getAttendanceLabel,
  didAttend,
  countsTowardRate,
  summarizeAttendance,
  formatAttendanceRate,
} from "./attendanceUtils";

// A session running 14:00 to 16:00 on a fixed day. `now` values are chosen
// relative to this so the buffered window edges can be probed exactly.
function makeSession(overrides = {}) {
  return {
    id: "s1",
    date: "2026-07-24",
    startTime: "14:00",
    endTime: "16:00",
    status: "Active",
    creatorId: "host",
    participants: ["me"],
    attendance: {},
    ...overrides,
  };
}

const START = new Date("2026-07-24T14:00:00").getTime();
const END = new Date("2026-07-24T16:00:00").getTime();

describe("getAttendanceState / hasCheckedIn", () => {
  it("reads the user's state from the map", () => {
    expect(getAttendanceState(makeSession({attendance: {me: "in"}}), "me")).toBe("in");
    expect(hasCheckedIn(makeSession({attendance: {me: "in"}}), "me")).toBe(true);
  });

  it("returns null / false when there is no record", () => {
    expect(getAttendanceState(makeSession(), "me")).toBeNull();
    expect(hasCheckedIn(makeSession(), "me")).toBe(false);
  });
});

describe("getSessionEndMillis", () => {
  it("computes the end instant", () => {
    expect(getSessionEndMillis(makeSession())).toBe(END);
  });

  it("returns infinity when fields are missing", () => {
    expect(getSessionEndMillis({date: "2026-07-24"})).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isWithinCheckInWindow", () => {
  it("is open at both buffered edges and in the middle", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START - CHECK_IN_BUFFER_MS))).toBe(true);
    expect(isWithinCheckInWindow(makeSession(), new Date(END + CHECK_IN_BUFFER_MS))).toBe(true);
    expect(isWithinCheckInWindow(makeSession(), new Date(START + 60 * 1000))).toBe(true);
  });

  it("is closed just outside either edge", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START - CHECK_IN_BUFFER_MS - 1))).toBe(false);
    expect(isWithinCheckInWindow(makeSession(), new Date(END + CHECK_IN_BUFFER_MS + 1))).toBe(false);
  });
});

describe("isCheckInWindowOver", () => {
  it("is true only after end + buffer", () => {
    expect(isCheckInWindowOver(makeSession(), new Date(END + CHECK_IN_BUFFER_MS))).toBe(false);
    expect(isCheckInWindowOver(makeSession(), new Date(END + CHECK_IN_BUFFER_MS + 1))).toBe(true);
  });
});

describe("getAvailableAction", () => {
  const duringWindow = new Date(START + 60 * 1000);

  it("offers check-in when not checked in and the window is open", () => {
    expect(getAvailableAction(makeSession(), "me", duringWindow)).toBe("check-in");
  });

  it("offers nothing once checked in (locked)", () => {
    expect(getAvailableAction(makeSession({attendance: {me: "in"}}), "me", duringWindow)).toBeNull();
  });

  it("offers nothing outside the window", () => {
    expect(getAvailableAction(makeSession(), "me", new Date(START - CHECK_IN_BUFFER_MS - 1000))).toBeNull();
    expect(getAvailableAction(makeSession(), "me", new Date(END + CHECK_IN_BUFFER_MS + 1000))).toBeNull();
  });

  it("offers nothing for a cancelled session", () => {
    expect(getAvailableAction(makeSession({status: "Cancelled"}), "me", duringWindow)).toBeNull();
  });
});

describe("canLeaveSession", () => {
  const beforeWindowCloses = new Date(START + 60 * 1000);
  const afterWindowCloses = new Date(END + CHECK_IN_BUFFER_MS + 1000);

  it("allows leaving when not checked in and the window is still open", () => {
    expect(canLeaveSession(makeSession(), "me", beforeWindowCloses)).toBe(true);
  });

  it("blocks leaving once checked in", () => {
    expect(canLeaveSession(makeSession({attendance: {me: "in"}}), "me", beforeWindowCloses)).toBe(false);
  });

  it("blocks leaving once the check-in window has closed", () => {
    expect(canLeaveSession(makeSession(), "me", afterWindowCloses)).toBe(false);
  });

  it("blocks leaving a cancelled session", () => {
    expect(canLeaveSession(makeSession({status: "Cancelled"}), "me", beforeWindowCloses)).toBe(false);
  });
});

describe("getAttendanceLabel", () => {
  const afterEnd = new Date(END + CHECK_IN_BUFFER_MS + 1000);
  const beforeStart = new Date(START - 60 * 60 * 1000);

  it("reads Attended once checked in", () => {
    expect(getAttendanceLabel(makeSession({attendance: {me: "in"}}), "me", afterEnd)).toBe("Attended");
  });

  it("reads Missed only once the session is over with no record", () => {
    expect(getAttendanceLabel(makeSession(), "me", afterEnd)).toBe("Missed");
  });

  it("reads Upcoming before the session with no record", () => {
    expect(getAttendanceLabel(makeSession(), "me", beforeStart)).toBe("Upcoming");
  });
});

describe("didAttend", () => {
  it("counts a check-in as attended", () => {
    expect(didAttend(makeSession({attendance: {me: "in"}}), "me")).toBe(true);
  });

  it("counts a missing record as not attended", () => {
    expect(didAttend(makeSession(), "me")).toBe(false);
  });
});

describe("countsTowardRate", () => {
  const afterEnd = new Date(END + CHECK_IN_BUFFER_MS + 1000);
  const future = new Date(START - 24 * 60 * 60 * 1000);

  it("counts a finished session the user did not create", () => {
    expect(countsTowardRate(makeSession(), "me", afterEnd)).toBe(true);
  });

  it("excludes a session the user created", () => {
    expect(countsTowardRate(makeSession({creatorId: "me"}), "me", afterEnd)).toBe(false);
  });

  it("excludes a cancelled session", () => {
    expect(countsTowardRate(makeSession({status: "Cancelled"}), "me", afterEnd)).toBe(false);
  });

  it("excludes a session that has not finished", () => {
    expect(countsTowardRate(makeSession(), "me", future)).toBe(false);
  });
});

describe("summarizeAttendance", () => {
  const now = new Date(END + 24 * 60 * 60 * 1000);

  it("counts attended over eligible finished sessions", () => {
    const sessions = [
      makeSession({id: "a", attendance: {me: "in"}}),
      makeSession({id: "b", attendance: {}}), // finished, missed
      makeSession({id: "c", attendance: {me: "in"}}),
    ];
    const summary = summarizeAttendance(sessions, "me", now);
    expect(summary).toEqual({joined: 3, attended: 2, eligible: 3, rate: 2 / 3});
  });

  it("excludes the user's own created sessions from the rate", () => {
    const sessions = [
      makeSession({id: "mine", creatorId: "me", attendance: {}}),
      makeSession({id: "theirs", attendance: {me: "in"}}),
    ];
    const summary = summarizeAttendance(sessions, "me", now);
    // "mine" is joined (participant) but not eligible; only "theirs" counts.
    expect(summary).toEqual({joined: 2, attended: 1, eligible: 1, rate: 1});
  });

  it("excludes cancelled sessions from the rate", () => {
    const sessions = [
      makeSession({id: "x", status: "Cancelled", attendance: {}}),
      makeSession({id: "y", attendance: {me: "in"}}),
    ];
    const summary = summarizeAttendance(sessions, "me", now);
    expect(summary).toEqual({joined: 2, attended: 1, eligible: 1, rate: 1});
  });

  it("returns a null rate when nothing has resolved", () => {
    const future = makeSession({id: "f", date: "2026-12-01", attendance: {}});
    expect(summarizeAttendance([future], "me", now).rate).toBeNull();
  });

  it("ignores sessions the user did not join", () => {
    expect(summarizeAttendance([makeSession({participants: ["someone"]})], "me", now).joined).toBe(0);
  });
});

describe("formatAttendanceRate", () => {
  it("renders a percentage", () => {
    expect(formatAttendanceRate(0.6667)).toBe("67%");
    expect(formatAttendanceRate(1)).toBe("100%");
    expect(formatAttendanceRate(0)).toBe("0%");
  });

  it("renders a dash when there is no rate", () => {
    expect(formatAttendanceRate(null)).toBe("\u2013");
  });
});
