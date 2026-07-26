import {describe, it, expect} from "vitest";
import {
  formatSessionDate,
  formatDuration,
  formatSessionWhen,
} from "./sessionFormat";

describe("formatSessionDate", () => {
  it("formats an ISO date as weekday day month", () => {
    expect(formatSessionDate("2026-07-28")).toBe("Tue 28 Jul");
    expect(formatSessionDate("2026-01-01")).toBe("Thu 1 Jan");
  });

  it("falls back to the raw string when unparseable", () => {
    expect(formatSessionDate("not-a-date")).toBe("not-a-date");
    expect(formatSessionDate("")).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration("14:00", "16:00")).toBe("2h");
    expect(formatDuration("14:00", "14:45")).toBe("45m");
    expect(formatDuration("14:00", "15:30")).toBe("1h 30m");
  });

  it("handles crossing midnight", () => {
    expect(formatDuration("23:00", "01:00")).toBe("2h");
  });

  it("returns empty for missing or zero-length times", () => {
    expect(formatDuration("14:00", "14:00")).toBe("");
    expect(formatDuration("", "16:00")).toBe("");
    expect(formatDuration("14:00", null)).toBe("");
  });
});

describe("formatSessionWhen", () => {
  it("builds the full human line", () => {
    const session = {date: "2026-07-28", startTime: "14:00", endTime: "16:00"};
    expect(formatSessionWhen(session)).toBe("Tue 28 Jul \u00b7 14:00\u201316:00 (2h)");
  });

  it("drops the duration when it cannot be computed", () => {
    const session = {date: "2026-07-28", startTime: "14:00", endTime: "14:00"};
    expect(formatSessionWhen(session)).toBe("Tue 28 Jul \u00b7 14:00\u201314:00");
  });

  it("survives missing pieces without stray separators", () => {
    expect(formatSessionWhen({date: "2026-07-28"})).toBe("Tue 28 Jul");
    expect(formatSessionWhen({})).toBe("");
  });
});
