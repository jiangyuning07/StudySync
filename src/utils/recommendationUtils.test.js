import {describe, it, expect} from "vitest";
import {
  buildUserProfile,
  isRecommendable,
  scoreSession,
  recommendSessions,
  recommendSpaces,
} from "./recommendationUtils";

const NOW = new Date("2026-07-24T12:00:00Z");

// A session in the far future by default, so tests opt into "starting soon"
// explicitly rather than triggering it by accident.
function makeSession(overrides = {}) {
  return {
    id: "s1",
    studySpaceId: "space-a",
    studySpaceName: "Central Library",
    moduleCode: "CS2103T",
    studyMode: "Discussion",
    studyGoal: "",
    maxParticipants: 5,
    participants: ["host"],
    creatorId: "host",
    status: "Active",
    date: "2026-08-01",
    startTime: "14:00",
    endTime: "16:00",
    ...overrides,
  };
}

describe("buildUserProfile", () => {
  it("collects modules, spaces and the favourite mode from attended sessions", () => {
    const sessions = [
      makeSession({moduleCode: "CS2103T", studySpaceId: "space-a", studyMode: "Discussion", participants: ["me"], attendance: {me: "in"}}),
      makeSession({moduleCode: "CS2103T", studySpaceId: "space-a", studyMode: "Discussion", participants: ["me"], attendance: {me: "in"}}),
      makeSession({moduleCode: "MA1521", studySpaceId: "space-b", studyMode: "Silent", participants: ["me"], attendance: {me: "in"}}),
    ];

    const profile = buildUserProfile(sessions, "me");

    expect(profile.moduleCodes).toEqual(new Set(["CS2103T", "MA1521"]));
    expect(profile.spaceIds).toEqual(new Set(["space-a", "space-b"]));
    expect(profile.spaceAttendanceCounts).toEqual({"space-a": 2, "space-b": 1});
    expect(profile.favouriteMode).toBe("Discussion");
    expect(profile.attendedCount).toBe(3);
  });

  it("ignores sessions the user did not attend", () => {
    const sessions = [makeSession({participants: ["someone-else"]})];
    const profile = buildUserProfile(sessions, "me");
    expect(profile.attendedCount).toBe(0);
    expect(profile.moduleCodes.size).toBe(0);
  });

  it("ignores joined-but-missed and cancelled sessions", () => {
    const sessions = [
      makeSession({participants: ["me"]}),
      makeSession({participants: ["me"], attendance: {me: "in"}, status: "Cancelled"}),
    ];
    expect(buildUserProfile(sessions, "me").attendedCount).toBe(0);
  });

  it("returns an empty profile for a user with no sessions", () => {
    const profile = buildUserProfile([], "me");
    expect(profile.attendedCount).toBe(0);
    expect(profile.favouriteMode).toBeNull();
  });
});

describe("isRecommendable", () => {
  it("accepts an open active session the user has not joined", () => {
    expect(isRecommendable(makeSession(), "me", NOW)).toBe(true);
  });

  it("rejects the user's own session", () => {
    expect(isRecommendable(makeSession({creatorId: "me", participants: ["me"]}), "me", NOW)).toBe(false);
  });

  it("rejects a session the user already joined", () => {
    expect(isRecommendable(makeSession({participants: ["host", "me"]}), "me", NOW)).toBe(false);
  });

  it("rejects a full session", () => {
    expect(isRecommendable(makeSession({maxParticipants: 2, participants: ["host", "other"]}), "me", NOW)).toBe(false);
  });

  it("rejects a cancelled session", () => {
    expect(isRecommendable(makeSession({status: "Cancelled"}), "me", NOW)).toBe(false);
  });
});

describe("scoreSession", () => {
  const profile = {
    moduleCodes: new Set(["CS2103T"]),
    spaceIds: new Set(["space-a"]),
    favouriteMode: "Discussion",
    attendedCount: 3,
  };

  it("adds the module, mode and space weights when all three match", () => {
    const {score, reasons} = scoreSession(makeSession(), profile, NOW);
    // 3 (module) + 2 (mode) + 2 (space) = 7, no recency because it is far off.
    expect(score).toBe(7);
    expect(reasons).toContain("Matches CS2103T");
  });

  it("adds the recency weight for a session inside the 48h window", () => {
    const soon = makeSession({
      moduleCode: "ZZ9999",
      studySpaceId: "space-z",
      studyMode: "Silent",
      date: "2026-07-25",
      startTime: "10:00",
    });
    const {score, reasons} = scoreSession(soon, profile, NOW);
    expect(score).toBe(1);
    expect(reasons).toContain("Starting soon");
  });

  it("scores zero when nothing matches", () => {
    const stranger = makeSession({
      moduleCode: "ZZ9999",
      studySpaceId: "space-z",
      studyMode: "Silent",
    });
    expect(scoreSession(stranger, profile, NOW).score).toBe(0);
  });
});

describe("recommendSessions", () => {
  const profile = {
    moduleCodes: new Set(["CS2103T"]),
    spaceIds: new Set(["space-a"]),
    favouriteMode: "Discussion",
    attendedCount: 3,
  };

  it("ranks a strong match above a weak one and drops non-matches", () => {
    const strong = makeSession({id: "strong"});
    const weak = makeSession({
      id: "weak",
      moduleCode: "ZZ9999",
      studySpaceId: "space-a",
      studyMode: "Silent",
    });
    const none = makeSession({
      id: "none",
      moduleCode: "ZZ9999",
      studySpaceId: "space-z",
      studyMode: "Silent",
    });

    const result = recommendSessions([none, weak, strong], profile, "me", {now: NOW});
    expect(result.map((r) => r.session.id)).toEqual(["strong", "weak"]);
  });

  it("never recommends the user's own or already joined sessions", () => {
    const own = makeSession({id: "own", creatorId: "me", participants: ["me"]});
    const joined = makeSession({id: "joined", participants: ["host", "me"]});
    const open = makeSession({id: "open"});

    const result = recommendSessions([own, joined, open], profile, "me", {now: NOW});
    expect(result.map((r) => r.session.id)).toEqual(["open"]);
  });

  it("respects the limit", () => {
    const sessions = Array.from({length: 5}, (_, i) => makeSession({id: `s${i}`}));
    expect(recommendSessions(sessions, profile, "me", {now: NOW, limit: 2})).toHaveLength(2);
  });

  it("cold start: with no history, returns soonest first instead of empty", () => {
    const coldProfile = buildUserProfile([], "me");
    const later = makeSession({id: "later", date: "2026-09-01", moduleCode: "ZZ9999", studySpaceId: "space-z", studyMode: "Silent"});
    const sooner = makeSession({id: "sooner", date: "2026-08-01", moduleCode: "ZZ9999", studySpaceId: "space-z", studyMode: "Silent"});

    const result = recommendSessions([later, sooner], coldProfile, "me", {now: NOW});
    expect(result.map((r) => r.session.id)).toEqual(["sooner", "later"]);
  });
});

describe("recommendSpaces", () => {
  const spaces = [
    {id: "space-a", name: "Central Library"},
    {id: "space-b", name: "COM1 Basement"},
    {id: "space-c", name: "Art Museum Cafe"},
  ];

  it("ranks most-visited spaces first", () => {
    const profile = {spaceAttendanceCounts: {"space-b": 3, "space-a": 1}};
    const result = recommendSpaces(spaces, profile, {});
    expect(result.map((s) => s.id)).toEqual(["space-b", "space-a", "space-c"]);
  });

  it("breaks ties by rating, then by name", () => {
    const profile = {spaceAttendanceCounts: {}};
    const ratings = {
      "space-a": {averageRating: 4.5},
      "space-b": {averageRating: 4.9},
      "space-c": {averageRating: 4.5},
    };
    const result = recommendSpaces(spaces, profile, ratings);
    // b wins on rating; a and c tie on rating so fall back to name order.
    expect(result.map((s) => s.id)).toEqual(["space-b", "space-c", "space-a"]);
  });

  it("respects the limit", () => {
    const profile = {spaceAttendanceCounts: {}};
    expect(recommendSpaces(spaces, profile, {}, {limit: 2})).toHaveLength(2);
  });
});
