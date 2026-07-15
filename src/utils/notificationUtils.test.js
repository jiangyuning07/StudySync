import {describe, it, expect} from "vitest";
import {
  describeSession,
  computeSessionRecipients,
  buildUpdatedMessage,
  buildCancelledMessage,
  buildRemovedMessage,
} from "./notificationUtils";

const baseSession = {
  id: "session1",
  creatorId: "creator",
  creatorName: "Alex",
  studySpaceName: "Central Library",
  date: "2026-07-20",
  participants: ["creator", "bob", "carol"],
};

describe("describeSession", () => {
  it("combines the space name and date", () => {
    expect(describeSession(baseSession)).toBe("Central Library on 2026-07-20");
  });

  it("falls back gracefully when fields are missing", () => {
    expect(describeSession({})).toBe("a study session");
  });
});

describe("computeSessionRecipients", () => {
  it("excludes the creator so they never notify themselves", () => {
    expect(computeSessionRecipients(baseSession)).toEqual(["bob", "carol"]);
  });

  it("drops any explicitly excluded uids, such as someone just removed", () => {
    expect(computeSessionRecipients(baseSession, ["bob"])).toEqual(["carol"]);
  });

  it("collapses duplicate participant entries", () => {
    const session = {...baseSession, participants: ["creator", "bob", "bob"]};
    expect(computeSessionRecipients(session)).toEqual(["bob"]);
  });

  it("returns an empty list when the creator is studying alone", () => {
    const session = {...baseSession, participants: ["creator"]};
    expect(computeSessionRecipients(session)).toEqual([]);
  });
});

describe("message builders", () => {
  it("names the creator in the update message", () => {
    expect(buildUpdatedMessage(baseSession)).toBe(
      "Alex updated Central Library on 2026-07-20."
    );
  });

  it("names the creator in the cancel message", () => {
    expect(buildCancelledMessage(baseSession)).toBe(
      "Alex cancelled Central Library on 2026-07-20."
    );
  });

  it("addresses the removed participant directly", () => {
    expect(buildRemovedMessage(baseSession)).toBe(
      "You were removed from Central Library on 2026-07-20."
    );
  });

  it("uses a neutral fallback when the creator name is absent", () => {
    const session = {...baseSession, creatorName: undefined};
    expect(buildUpdatedMessage(session)).toBe(
      "The session creator updated Central Library on 2026-07-20."
    );
  });
});
