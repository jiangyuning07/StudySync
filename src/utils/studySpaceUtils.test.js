import {describe, expect, it} from "vitest";
import {filterStudySpaces} from "./studySpaceUtils";

const spaces = [
  {
    id: "library",
    name: "Central Library",
    address: "12 Kent Ridge Crescent",
    studyMode: "Silent",
    indoor: true,
    wifi: true,
    powerOutlets: true,
  },
  {
    id: "courtyard",
    name: "Arts Courtyard",
    address: "9 Arts Link",
    studyMode: "Discussion",
    indoor: false,
    wifi: true,
    powerOutlets: false,
  },
  {
    id: "commons",
    name: "Tech Commons",
    address: "21 Lower Kent Ridge Road",
    studyMode: "Both",
    indoor: true,
    wifi: false,
    powerOutlets: true,
  },
];

const ratingSummaries = {
  library: {averageRating: 4.6, reviewCount: 10},
  courtyard: {averageRating: 3.8, reviewCount: 4},
};

describe("filterStudySpaces", () => {
  it("returns every space when no filters are set", () => {
    expect(filterStudySpaces(spaces, ratingSummaries)).toEqual(spaces);
  });

  it("matches every name or address keyword case-insensitively", () => {
    expect(filterStudySpaces(spaces, ratingSummaries, {search: "KENT library"}))
      .toEqual([spaces[0]]);
  });

  it("matches study mode exactly and case-insensitively", () => {
    expect(filterStudySpaces(spaces, ratingSummaries, {studyMode: "both"}))
      .toEqual([spaces[2]]);
  });

  it("filters by minimum rating and excludes unrated spaces", () => {
    expect(filterStudySpaces(spaces, ratingSummaries, {minimumRating: "4"}))
      .toEqual([spaces[0]]);
  });

  it("combines amenities with the other filters using AND logic", () => {
    expect(filterStudySpaces(spaces, ratingSummaries, {
      indoorOnly: true,
      wifiOnly: true,
      powerOutletsOnly: true,
      studyMode: "Silent",
    })).toEqual([spaces[0]]);
  });
});
