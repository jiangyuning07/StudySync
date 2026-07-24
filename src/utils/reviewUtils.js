// Pure review helpers. No Firebase import here on purpose, so these stay easy
// to unit test (same idea as sessionUtils.js and notificationUtils.js).

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 300;

// A rating has to be a whole number of stars inside the allowed range. Halves
// are rejected because the input only ever produces integers, so a fractional
// value means something went wrong rather than that the user meant it.
export function isValidRating(rating) {
  return Number.isInteger(rating) && rating >= RATING_MIN && rating <= RATING_MAX;
}

// The comment is optional. Only its length is constrained, and the check runs
// on the trimmed value so a box full of spaces counts as empty.
export function isValidComment(comment) {
  return (comment || "").trim().length <= REVIEW_COMMENT_MAX_LENGTH;
}

// Returns an empty string when the draft is safe to submit, otherwise the
// message to show the user. Returning a string rather than throwing keeps the
// calling component free of try/catch for what is ordinary user error.
export function getReviewError({rating, comment}) {
  if (!isValidRating(rating)) {
    return "Please choose a rating from 1 to 5 stars.";
  }

  if (!isValidComment(comment)) {
    return `Please keep your comment under ${REVIEW_COMMENT_MAX_LENGTH} characters.`;
  }

  return "";
}

// Rounds to one decimal so the directory shows 4.2 rather than 4.166666.
// Returns null when there is nothing to average, which the card renders as
// "No reviews yet" instead of a misleading row of empty stars.
export function formatAverageRating(average, reviewCount) {
  if (!reviewCount || average === null || average === undefined) return null;
  return average.toFixed(1);
}

export function formatReviewCount(reviewCount) {
  if (!reviewCount) return "No reviews yet";
  return reviewCount === 1 ? "1 review" : `${reviewCount} reviews`;
}

// Five booleans describing which stars to fill for a given average. The average
// is rounded to the nearest whole star because the display has no half state.
export function buildStarFill(average) {
  const filled = Math.round(average || 0);
  return Array.from({length: RATING_MAX}, (_, index) => index < filled);
}

// Study space reviews go stale quickly, so "5 days ago" tells a reader more
// about how much to trust a comment than an absolute date would. `now` is a
// parameter rather than a call to Date.now() inside, so tests can pin it.
export function formatRelativeTime(date, now = new Date()) {
  if (!date) return "";

  const elapsedSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (elapsedSeconds < 60) return "just now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return elapsedMinutes === 1 ? "1 minute ago" : `${elapsedMinutes} minutes ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return elapsedHours === 1 ? "1 hour ago" : `${elapsedHours} hours ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) {
    return elapsedDays === 1 ? "1 day ago" : `${elapsedDays} days ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) {
    return elapsedMonths === 1 ? "1 month ago" : `${elapsedMonths} months ago`;
  }

  const elapsedYears = Math.floor(elapsedMonths / 12);
  return elapsedYears === 1 ? "1 year ago" : `${elapsedYears} years ago`;
}

// Newest first. Reviews without a timestamp sort last rather than crashing the
// comparison, which happens briefly for a review the user just posted while the
// server timestamp is still resolving.
export function sortReviewsNewestFirst(reviews) {
  return [...(reviews || [])].sort((a, b) => {
    const aTime = a.createdAt ? a.createdAt.getTime() : 0;
    const bTime = b.createdAt ? b.createdAt.getTime() : 0;
    return bTime - aTime;
  });
}

// The signed in user's own review is shown separately at the top of the panel,
// so it is filtered out of the public list to avoid showing it twice.
export function splitOwnReview(reviews, uid) {
  const sorted = sortReviewsNewestFirst(reviews);
  return {
    ownReview: sorted.find((review) => review.id === uid) || null,
    otherReviews: sorted.filter((review) => review.id !== uid),
  };
}

// After the user posts, edits or deletes a review, the panel already holds the
// full list, so the card's rating can be recomputed locally instead of paying
// for a second aggregation query that might not see the write yet.
export function summarizeReviews(reviews) {
  const list = reviews || [];
  const reviewCount = list.length;

  if (reviewCount === 0) {
    return {averageRating: null, reviewCount: 0};
  }

  const total = list.reduce((sum, review) => sum + (review.rating || 0), 0);
  return {averageRating: total / reviewCount, reviewCount};
}

// Falls back through the two places a name can live before giving up. The email
// local part is used rather than the full address so reviews never leak someone
// else's email onto a public card.
export function toDisplayName(user) {
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;

  const email = user?.email?.trim();
  if (email) return email.split("@")[0];

  return "NUS student";
}
