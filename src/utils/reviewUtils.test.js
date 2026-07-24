import {describe, it, expect} from "vitest";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  isValidRating,
  isValidComment,
  getReviewError,
  formatAverageRating,
  formatReviewCount,
  buildStarFill,
  formatRelativeTime,
  sortReviewsNewestFirst,
  splitOwnReview,
  summarizeReviews,
  toDisplayName,
} from "./reviewUtils";

describe("isValidRating", () => {
  it("accepts whole stars from 1 to 5", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
  });

  it("rejects out of range, fractional and non numeric values", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
    expect(isValidRating("4")).toBe(false);
    expect(isValidRating(undefined)).toBe(false);
  });
});

describe("isValidComment", () => {
  it("treats an empty or missing comment as valid because it is optional", () => {
    expect(isValidComment("")).toBe(true);
    expect(isValidComment(undefined)).toBe(true);
    expect(isValidComment("   ")).toBe(true);
  });

  it("measures the trimmed length against the limit", () => {
    expect(isValidComment("a".repeat(REVIEW_COMMENT_MAX_LENGTH))).toBe(true);
    expect(isValidComment("a".repeat(REVIEW_COMMENT_MAX_LENGTH + 1))).toBe(false);
    expect(isValidComment(` ${"a".repeat(REVIEW_COMMENT_MAX_LENGTH)} `)).toBe(true);
  });
});

describe("getReviewError", () => {
  it("returns an empty string for a valid draft", () => {
    expect(getReviewError({rating: 4, comment: "Quiet after 6pm."})).toBe("");
  });

  it("complains about the rating before the comment", () => {
    const error = getReviewError({
      rating: 0,
      comment: "a".repeat(REVIEW_COMMENT_MAX_LENGTH + 1),
    });
    expect(error).toMatch(/rating/i);
  });

  it("complains about an over long comment", () => {
    const error = getReviewError({
      rating: 4,
      comment: "a".repeat(REVIEW_COMMENT_MAX_LENGTH + 1),
    });
    expect(error).toMatch(/comment/i);
  });
});

describe("formatAverageRating", () => {
  it("rounds to one decimal place", () => {
    expect(formatAverageRating(4.166666, 18)).toBe("4.2");
    expect(formatAverageRating(5, 3)).toBe("5.0");
  });

  it("returns null when there is nothing to average", () => {
    expect(formatAverageRating(null, 0)).toBeNull();
    expect(formatAverageRating(4.5, 0)).toBeNull();
  });
});

describe("formatReviewCount", () => {
  it("handles zero, one and many", () => {
    expect(formatReviewCount(0)).toBe("No reviews yet");
    expect(formatReviewCount(1)).toBe("1 review");
    expect(formatReviewCount(18)).toBe("18 reviews");
  });
});

describe("buildStarFill", () => {
  it("rounds to the nearest whole star", () => {
    expect(buildStarFill(4.2)).toEqual([true, true, true, true, false]);
    expect(buildStarFill(4.6)).toEqual([true, true, true, true, true]);
  });

  it("returns five empty stars when there is no average", () => {
    expect(buildStarFill(null)).toEqual([false, false, false, false, false]);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-24T12:00:00Z");

  it("describes recent timestamps in the largest sensible unit", () => {
    expect(formatRelativeTime(new Date("2026-07-24T11:59:30Z"), now)).toBe("just now");
    expect(formatRelativeTime(new Date("2026-07-24T11:00:00Z"), now)).toBe("1 hour ago");
    expect(formatRelativeTime(new Date("2026-07-22T12:00:00Z"), now)).toBe("2 days ago");
    expect(formatRelativeTime(new Date("2026-05-24T12:00:00Z"), now)).toBe("2 months ago");
    expect(formatRelativeTime(new Date("2025-07-24T12:00:00Z"), now)).toBe("1 year ago");
  });

  it("returns an empty string when the timestamp is missing", () => {
    expect(formatRelativeTime(null, now)).toBe("");
  });
});

describe("sortReviewsNewestFirst", () => {
  it("puts the most recent review first", () => {
    const reviews = [
      {id: "a", createdAt: new Date("2026-07-01T00:00:00Z")},
      {id: "b", createdAt: new Date("2026-07-20T00:00:00Z")},
    ];
    expect(sortReviewsNewestFirst(reviews).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the array it was given", () => {
    const reviews = [
      {id: "a", createdAt: new Date("2026-07-01T00:00:00Z")},
      {id: "b", createdAt: new Date("2026-07-20T00:00:00Z")},
    ];
    sortReviewsNewestFirst(reviews);
    expect(reviews.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("survives a review whose server timestamp has not resolved yet", () => {
    const reviews = [
      {id: "a", createdAt: null},
      {id: "b", createdAt: new Date("2026-07-20T00:00:00Z")},
    ];
    expect(sortReviewsNewestFirst(reviews).map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("splitOwnReview", () => {
  const reviews = [
    {id: "me", createdAt: new Date("2026-07-01T00:00:00Z")},
    {id: "other", createdAt: new Date("2026-07-20T00:00:00Z")},
  ];

  it("pulls the signed in user's review out of the public list", () => {
    const {ownReview, otherReviews} = splitOwnReview(reviews, "me");
    expect(ownReview.id).toBe("me");
    expect(otherReviews.map((r) => r.id)).toEqual(["other"]);
  });

  it("returns a null own review when the user has not reviewed yet", () => {
    const {ownReview, otherReviews} = splitOwnReview(reviews, "someone-else");
    expect(ownReview).toBeNull();
    expect(otherReviews).toHaveLength(2);
  });
});

describe("summarizeReviews", () => {
  it("averages the ratings it is given", () => {
    const summary = summarizeReviews([{rating: 5}, {rating: 4}, {rating: 3}]);
    expect(summary).toEqual({averageRating: 4, reviewCount: 3});
  });

  it("reports an empty list as unrated rather than zero stars", () => {
    expect(summarizeReviews([])).toEqual({averageRating: null, reviewCount: 0});
    expect(summarizeReviews(undefined)).toEqual({averageRating: null, reviewCount: 0});
  });
});

describe("toDisplayName", () => {
  it("prefers the display name", () => {
    expect(toDisplayName({displayName: "Wei Lin", email: "e0123456@u.nus.edu"})).toBe("Wei Lin");
  });

  it("falls back to the email local part so the address is never shown in full", () => {
    expect(toDisplayName({email: "e0123456@u.nus.edu"})).toBe("e0123456");
  });

  it("falls back again when there is nothing to work with", () => {
    expect(toDisplayName(null)).toBe("NUS student");
  });
});
