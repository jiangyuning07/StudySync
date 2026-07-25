import {useState} from "react";
import {RATING_MAX, buildStarFill} from "../utils/reviewUtils";

const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z";

function Star({filled}) {
  return (
    <svg
      className={`star ${filled ? "star-filled" : "star-empty"}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

// Read only mode. The whole row carries a single aria-label so a screen reader
// announces "rated 4.2 out of 5" instead of reading five decorative shapes.
function StarRatingDisplay({value, size}) {
  const stars = buildStarFill(value);

  return (
    <span
      className={`star-rating star-rating-${size}`}
      role="img"
      aria-label={value ? `Rated ${value.toFixed(1)} out of 5` : "Not yet rated"}
    >
      {stars.map((filled, index) => (
        <Star key={index} filled={filled} />
      ))}
    </span>
  );
}

// Input mode. Each star is a real button so the control is reachable by keyboard
// and announces its own meaning; hovering previews the value without committing
// it, which is what makes a star input feel responsive.
function StarRatingInput({value, onChange, disabled}) {
  const [hoveredValue, setHoveredValue] = useState(0);
  const previewValue = hoveredValue || value;
  const stars = buildStarFill(previewValue);

  return (
    <span
      className="star-rating star-rating-input"
      onMouseLeave={() => setHoveredValue(0)}
    >
      {stars.map((filled, index) => {
        const starValue = index + 1;

        return (
          <button
            type="button"
            key={starValue}
            className="star-button"
            disabled={disabled}
            aria-label={`${starValue} ${starValue === 1 ? "star" : "stars"}`}
            aria-pressed={value === starValue}
            onMouseEnter={() => setHoveredValue(starValue)}
            onFocus={() => setHoveredValue(starValue)}
            onBlur={() => setHoveredValue(0)}
            onClick={() => onChange(starValue)}
          >
            <Star filled={filled} />
          </button>
        );
      })}
    </span>
  );
}

function StarRating({value = 0, onChange, size = "small", disabled = false}) {
  if (onChange) {
    return <StarRatingInput value={value} onChange={onChange} disabled={disabled} />;
  }

  return <StarRatingDisplay value={value} size={size} />;
}

export {RATING_MAX};
export default StarRating;
