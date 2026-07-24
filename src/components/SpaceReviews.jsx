import {useCallback, useEffect, useState} from "react";
import StarRating from "./StarRating";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  formatRelativeTime,
  getReviewError,
  splitOwnReview,
  summarizeReviews,
  toDisplayName,
} from "../utils/reviewUtils";
import {deleteReview, fetchReviews, saveReview} from "../utils/reviews";

// How many other people's reviews to show before the Show more button. Dumping
// every comment into a grid cell would stretch the row far past the fold.
const INITIAL_VISIBLE_REVIEWS = 3;

function ReviewItem({review}) {
  return (
    <li className="review-item">
      <div className="review-item-header">
        <span className="review-author">{review.userName}</span>
        <time
          className="review-time"
          dateTime={review.createdAt?.toISOString()}
          title={review.createdAt?.toLocaleString()}
        >
          {formatRelativeTime(review.createdAt)}
        </time>
      </div>

      <StarRating value={review.rating} />

      {review.comment && <p className="review-comment">{review.comment}</p>}
    </li>
  );
}

function SpaceReviews({spaceId, currentUser, onSummaryChange}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const {ownReview, otherReviews} = splitOwnReview(reviews, currentUser?.uid);
  const visibleReviews = showAll
    ? otherReviews
    : otherReviews.slice(0, INITIAL_VISIBLE_REVIEWS);
  const hiddenCount = otherReviews.length - visibleReviews.length;

  const loadReviews = useCallback(async () => {
    try {
      const loadedReviews = await fetchReviews(spaceId);
      setReviews(loadedReviews);
      onSummaryChange(spaceId, summarizeReviews(loadedReviews));
      return loadedReviews;
    } catch (loadError) {
      console.error("Failed to load reviews:", loadError);
      setError("Could not load reviews. Try again in a moment.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [spaceId, onSummaryChange]);

  // Seed the form with the user's existing review so opening the editor shows
  // what they wrote rather than an empty box.
  function startEditing() {
    setRating(ownReview?.rating || 0);
    setComment(ownReview?.comment || "");
    setError("");
    setIsEditing(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = getReviewError({rating, comment});
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");

      await saveReview(spaceId, {
        uid: currentUser.uid,
        userName: toDisplayName(currentUser),
        rating,
        comment,
        isNew: !ownReview,
      });

      await loadReviews();
      setIsEditing(false);
      setRating(0);
      setComment("");
    } catch (saveError) {
      console.error("Failed to save review:", saveError);
      setError("Could not save your review. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete your review for this study space?");
    if (!confirmed) return;

    try {
      setSaving(true);
      await deleteReview(spaceId, currentUser.uid);
      await loadReviews();
      setIsEditing(false);
    } catch (deleteError) {
      console.error("Failed to delete review:", deleteError);
      setError("Could not delete your review. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  if (loading) {
    return <div className="space-reviews"><p className="review-status">Loading reviews...</p></div>;
  }

  return (
    <div className="space-reviews">
      <section className="own-review">
        <h4>Your review</h4>

        {ownReview && !isEditing ? (
          <div className="own-review-summary">
            <StarRating value={ownReview.rating} />
            {ownReview.comment && <p className="review-comment">{ownReview.comment}</p>}

            <div className="review-actions">
              <button type="button" className="session-action-button edit-button" onClick={startEditing}>
                Edit
              </button>
              <button
                type="button"
                className="session-action-button cancel-button"
                disabled={saving}
                onClick={handleDelete}
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <form className="review-form" onSubmit={handleSubmit}>
            <div className="review-form-rating">
              <StarRating value={rating} onChange={setRating} disabled={saving} />
              <span className="review-form-hint">
                {rating ? `${rating} of 5` : "Tap to rate"}
              </span>
            </div>

            <label className="review-comment-label" htmlFor={`review-comment-${spaceId}`}>
              Comment (optional)
            </label>
            <textarea
              id={`review-comment-${spaceId}`}
              className="review-comment-input"
              rows={3}
              value={comment}
              maxLength={REVIEW_COMMENT_MAX_LENGTH}
              placeholder="Quiet enough for focused work?"
              onChange={(event) => setComment(event.target.value)}
            />

            <div className="review-form-footer">
              <span className="review-char-count">
                {comment.length}/{REVIEW_COMMENT_MAX_LENGTH}
              </span>

              <div className="review-actions">
                {ownReview && (
                  <button
                    type="button"
                    className="session-action-button back-button"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="session-action-button edit-button" disabled={saving}>
                  {saving ? "Saving..." : ownReview ? "Update review" : "Post review"}
                </button>
              </div>
            </div>
          </form>
        )}

        {error && <p className="review-error">{error}</p>}
      </section>

      <section className="other-reviews">
        <h4>
          {otherReviews.length === 0
            ? "No other reviews yet"
            : `${otherReviews.length} ${otherReviews.length === 1 ? "review" : "reviews"}`}
        </h4>

        {otherReviews.length > 0 && (
          <ul className="review-list">
            {visibleReviews.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </ul>
        )}

        {hiddenCount > 0 && (
          <button type="button" className="review-show-more" onClick={() => setShowAll(true)}>
            Show {hiddenCount} more
          </button>
        )}
      </section>
    </div>
  );
}

export default SpaceReviews;
