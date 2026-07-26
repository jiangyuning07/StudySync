import {describe, it, expect} from "vitest";
import {
  CHECK_IN_BUFFER_MS,
  getAttendanceState,
  hasCheckedIn,
  hasCheckedOut,
  getSessionEndMillis,
  isWithinCheckInWindow,
  getAvailableAction,
  getAttendanceLabel,
  didAttend,
  summarizeAttendance,
  formatAttendanceRate,
} from "./attendanceUtils";

// A session running 14:00 to 16:00 on a fixed day. `now` values in the tests are
// chosen relative to this so the buffered window edges can be probed exactly.
function makeSession(overrides = {}) {
  return {
    id: "s1",
    date: "2026-07-24",
    startTime: "14:00",
    endTime: "16:00",
    status: "Active",
    participants: ["me"],
    attendance: {},
    ...overrides,
  };
}

const START = new Date("2026-07-24T14:00:00").getTime();
const END = new Date("2026-07-24T16:00:00").getTime();

describe("getAttendanceState", () => {
  it("reads the user's state from the map", () => {
    const session = makeSession({attendance: {me: "in"}});
    expect(getAttendanceState(session, "me")).toBe("in");
  });

  it("returns null when there is no record", () => {
    expect(getAttendanceState(makeSession(), "me")).toBeNull();
    expect(getAttendanceState(makeSession({attendance: undefined}), "me")).toBeNull();
  });
});

describe("hasCheckedIn / hasCheckedOut", () => {
  it("distinguishes the two states", () => {
    expect(hasCheckedIn(makeSession({attendance: {me: "in"}}), "me")).toBe(true);
    expect(hasCheckedOut(makeSession({attendance: {me: "out"}}), "me")).toBe(true);
    expect(hasCheckedIn(makeSession({attendance: {me: "out"}}), "me")).toBe(false);
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
  it("is open exactly at the buffered start edge", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START - CHECK_IN_BUFFER_MS))).toBe(true);
  });

  it("is open exactly at the buffered end edge", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(END + CHECK_IN_BUFFER_MS))).toBe(true);
  });

  it("is closed just before the buffer opens", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START - CHECK_IN_BUFFER_MS - 1))).toBe(false);
  });

  it("is closed just after the buffer ends", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(END + CHECK_IN_BUFFER_MS + 1))).toBe(false);
  });

  it("is open in the middle of the session", () => {
    expect(isWithinCheckInWindow(makeSession(), new Date(START + 60 * 1000))).toBe(true);
  });
});

describe("getAvailableAction", () => {
  const duringWindow = new Date(START + 60 * 1000);

  it("offers check-in when there is no record and the window is open", () => {
    expect(getAvailableAction(makeSession(), "me", duringWindow)).toBe("check-in");
  });

  it("offers check-out once checked in", () => {
    const session = makeSession({attendance: {me: "in"}});
    expect(getAvailableAction(session, "me", duringWindow)).toBe("check-out");
  });

  it("offers nothing once checked out", () => {
    const session = makeSession({attendance: {me: "out"}});
    expect(getAvailableAction(session, "me", duringWindow)).toBeNull();
  });

  it("offers nothing outside the window", () => {
    const early = new Date(START - CHECK_IN_BUFFER_MS - 1000);
    expect(getAvailableAction(makeSession(), "me", early)).toBeNull();
  });

  it("offers nothing for a cancelled session", () => {
    const session = makeSession({status: "Cancelled"});
    expect(getAvailableAction(session, "me", duringWindow)).toBeNull();
  });
});

describe("getAttendanceLabel", () => {
  const afterEnd = new Date(END + CHECK_IN_BUFFER_MS + 1000);
  const beforeStart = new Date(START - 60 * 60 * 1000);

  it("reads Attended after check-out", () => {
    expect(getAttendanceLabel(makeSession({attendance: {me: "out"}}), "me", afterEnd)).toBe("Attended");
  });

  it("reads Checked in while still in", () => {
    expect(getAttendanceLabel(makeSession({attendance: {me: "in"}}), "me", afterEnd)).toBe("Checked in");
  });

  it("reads Missed only once the session is over with no record", () => {
    expect(getAttendanceLabel(makeSession(), "me", afterEnd)).toBe("Missed");
  });

  it("reads Upcoming before the session with no record", () => {
    expect(getAttendanceLabel(makeSession(), "me", beforeStart)).toBe("Upcoming");
  });
});

describe("didAttend", () => {
  it("counts both in and out as attended", () => {
    expect(didAttend(makeSession({attendance: {me: "in"}}), "me")).toBe(true);
    expect(didAttend(makeSession({attendance: {me: "out"}}), "me")).toBe(true);
  });

  it("counts a missing record as not attended", () => {
    expect(didAttend(makeSession(), "me")).toBe(false);
  });
});

describe("summarizeAttendance", () => {
  const now = new Date(END + 24 * 60 * 60 * 1000); // a day after the session

  it("counts attended over finished sessions", () => {
    const sessions = [
      makeSession({id: "a", attendance: {me: "out"}}),
      makeSession({id: "b", attendance: {me: "in"}}),
      makeSession({id: "c", attendance: {}}), // finished, missed
    ];
    const summary = summarizeAttendance(sessions, "me", now);
    expect(summary).toEqual({joined: 3, attended: 2, eligible: 3, rate: 2 / 3});
  });

  it("excludes an upcoming session from the denominator", () => {
    const future = makeSession({id: "future", date: "2026-12-01", attendance: {}});
    const past = makeSession({id: "past", attendance: {me: "out"}});
    const summary = summarizeAttendance([past, future], "me", now);
    // future has not finished, so it does not count against the rate.
    expect(summary).toEqual({joined: 2, attended: 1, eligible: 1, rate: 1});
  });

  it("returns a null rate when nothing has resolved", () => {
    const future = makeSession({id: "future", date: "2026-12-01", attendance: {}});
    const summary = summarizeAttendance([future], "me", now);
    expect(summary.rate).toBeNull();
  });

  it("ignores sessions the user did not join", () => {
    const notMine = makeSession({participants: ["someone"]});
    expect(summarizeAttendance([notMine], "me", now).joined).toBe(0);
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
