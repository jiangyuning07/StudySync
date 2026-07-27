import {describe, it, expect} from "vitest";
import {
  CHECK_IN_BUFFER_MS,
  getAttendanceState,
  hasCheckedIn,
  getSessionEndMillis,
  isWithinCheckInWindow,
  isCheckInWindowOver,
  isSessionOver,
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
  it("is open at both start-centred buffered edges", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START - CHECK_IN_BUFFER_MS))).toBe(true);
    expect(isWithinCheckInWindow(makeSession(), new Date(START + CHECK_IN_BUFFER_MS))).toBe(true);
  });

  it("is closed just outside either edge", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START - CHECK_IN_BUFFER_MS - 1))).toBe(false);
    expect(isWithinCheckInWindow(makeSession(), new Date(START + CHECK_IN_BUFFER_MS + 1))).toBe(false);
    expect(isWithinCheckInWindow(makeSession(), new Date(END))).toBe(false);
  });
});

describe("isCheckInWindowOver", () => {
  it("is true only after start + buffer", () => {
    expect(isCheckInWindowOver(makeSession(), new Date(START + CHECK_IN_BUFFER_MS))).toBe(false);
    expect(isCheckInWindowOver(makeSession(), new Date(START + CHECK_IN_BUFFER_MS + 1))).toBe(true);
  });
});

describe("isSessionOver", () => {
  it("becomes true at the session end", () => {
    expect(isSessionOver(makeSession(), new Date(END - 1))).toBe(false);
    expect(isSessionOver(makeSession(), new Date(END))).toBe(true);
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
    expect(getAvailableAction(makeSession(), "me", new Date(START + CHECK_IN_BUFFER_MS + 1000))).toBeNull();
  });

  it("offers nothing for a cancelled session", () => {
    expect(getAvailableAction(makeSession({status: "Cancelled"}), "me", duringWindow)).toBeNull();
  });

  it("offers nothing to a user outside participants", () => {
    expect(getAvailableAction(
      makeSession({participants: ["someone-else"]}),
      "me",
      duringWindow
    )).toBeNull();
  });
});

describe("canLeaveSession", () => {
  const beforeStart = new Date(START - 1);
  const afterStart = new Date(START);

  it("allows leaving when not checked in and the session has not started", () => {
    expect(canLeaveSession(makeSession(), "me", beforeStart)).toBe(true);
  });

  it("blocks leaving once checked in", () => {
    expect(canLeaveSession(makeSession({attendance: {me: "in"}}), "me", beforeStart)).toBe(false);
  });

  it("blocks leaving once the session starts", () => {
    expect(canLeaveSession(makeSession(), "me", afterStart)).toBe(false);
  });

  it("blocks leaving a cancelled session", () => {
    expect(canLeaveSession(makeSession({status: "Cancelled"}), "me", beforeStart)).toBe(false);
  });
});

describe("getAttendanceLabel", () => {
  const afterEnd = new Date(END);
  const beforeStart = new Date(START - 60 * 60 * 1000);
  const duringSession = new Date(START + 60 * 60 * 1000);

  it("reads Attended once checked in", () => {
    expect(getAttendanceLabel(makeSession({attendance: {me: "in"}}), "me", afterEnd)).toBe("Attended");
  });

  it("reads Missed only once the session is over with no record", () => {
    expect(getAttendanceLabel(makeSession(), "me", afterEnd)).toBe("Missed");
  });

  it("reads Upcoming before the session with no record", () => {
    expect(getAttendanceLabel(makeSession(), "me", beforeStart)).toBe("Upcoming");
  });

  it("reads Ongoing while an unchecked session is in progress", () => {
    expect(getAttendanceLabel(makeSession(), "me", duringSession)).toBe("Ongoing");
  });

  it("reads Cancelled regardless of attendance", () => {
    expect(getAttendanceLabel(
      makeSession({status: "Cancelled", attendance: {me: "in"}}),
      "me",
      afterEnd
    )).toBe("Cancelled");
  });
});

describe("didAttend", () => {
  it("counts a check-in as attended", () => {
    expect(didAttend(makeSession({attendance: {me: "in"}}), "me")).toBe(true);
  });

  it("counts a missing record as not attended", () => {
    expect(didAttend(makeSession(), "me")).toBe(false);
  });

  it("does not count a cancelled check-in as attended", () => {
    expect(didAttend(
      makeSession({status: "Cancelled", attendance: {me: "in"}}),
      "me"
    )).toBe(false);
  });
});

describe("countsTowardRate", () => {
  const afterEnd = new Date(END);
  const future = new Date(START - 24 * 60 * 60 * 1000);

  it("counts a finished session the user did not create", () => {
    expect(countsTowardRate(makeSession(), "me", afterEnd)).toBe(true);
  });

  it("counts a creator's session under the same attendance rules", () => {
    expect(countsTowardRate(makeSession({creatorId: "me"}), "me", afterEnd)).toBe(true);
  });

  it("excludes a cancelled session", () => {
    expect(countsTowardRate(makeSession({status: "Cancelled"}), "me", afterEnd)).toBe(false);
  });

  it("excludes an unchecked session that has not finished", () => {
    expect(countsTowardRate(makeSession(), "me", future)).toBe(false);
  });

  it("counts a check-in immediately as attended", () => {
    expect(countsTowardRate(
      makeSession({attendance: {me: "in"}}),
      "me",
      future
    )).toBe(true);
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

  it("applies the same rate to the user's own created sessions", () => {
    const sessions = [
      makeSession({id: "mine", creatorId: "me", attendance: {}}),
      makeSession({id: "theirs", attendance: {me: "in"}}),
    ];
    const summary = summarizeAttendance(sessions, "me", now);
    expect(summary).toEqual({joined: 2, attended: 1, eligible: 2, rate: 0.5});
  });

  it("excludes cancelled sessions from the rate", () => {
    const sessions = [
      makeSession({id: "x", status: "Cancelled", attendance: {}}),
      makeSession({id: "y", attendance: {me: "in"}}),
    ];
    const summary = summarizeAttendance(sessions, "me", now);
    expect(summary).toEqual({joined: 1, attended: 1, eligible: 1, rate: 1});
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
