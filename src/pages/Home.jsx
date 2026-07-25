import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext";
import RecommendedSessionCard from "../components/RecommendedSessionCard";
import StarRating from "../components/StarRating";
import {formatAverageRating} from "../utils/reviewUtils";
import {
  buildUserProfile,
  recommendSessions,
  recommendSpaces,
} from "../utils/recommendationUtils";
import {
  fetchAllSessions,
  fetchAllSpaces,
  fetchUserSessions,
} from "../utils/recommendations";
import {fetchRatingSummaries} from "../utils/reviews";

const MAX_SESSION_RECS = 3;
const MAX_SPACE_RECS = 3;

function Home() {
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sessionRecs, setSessionRecs] = useState([]);
  const [spaceRecs, setSpaceRecs] = useState([]);
  const [ratingSummaries, setRatingSummaries] = useState({});
  const [hasHistory, setHasHistory] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      try {
        // Three reads in parallel. The user's history, the pool of all sessions,
        // and the space directory are independent, so there is no reason to wait
        // on one before starting the next.
        const [userSessions, allSessions, allSpaces] = await Promise.all([
          fetchUserSessions(currentUser.uid),
          fetchAllSessions(),
          fetchAllSpaces(),
        ]);

        const ratings = await fetchRatingSummaries(allSpaces.map((space) => space.id));

        const profile = buildUserProfile(userSessions, currentUser.uid);

        const sessions = recommendSessions(allSessions, profile, currentUser.uid, {
          limit: MAX_SESSION_RECS,
        });
        const spaces = recommendSpaces(allSpaces, profile, ratings, {
          limit: MAX_SPACE_RECS,
        });

        if (cancelled) return;

        setRatingSummaries(ratings);
        setSessionRecs(sessions);
        setSpaceRecs(spaces);
        setHasHistory(profile.attendedCount > 0);
      } catch (loadError) {
        console.error("Failed to load recommendations:", loadError);
        if (!cancelled) setError("Could not load recommendations right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [currentUser.uid]);

  // Honest framing. If we have no history for this user, the section is a set of
  // sensible defaults rather than personalised picks, and it should say so.
  const sessionHeading = hasHistory ? "Recommended for you" : "Happening soon";
  const spaceHeading = hasHistory ? "Places you might like" : "Popular study spaces";

  function renderSpaceRating(spaceId) {
    const summary = ratingSummaries[spaceId];
    const formatted = formatAverageRating(summary?.averageRating, summary?.reviewCount);

    if (!formatted) {
      return <span className="space-rating-empty">No reviews yet</span>;
    }

    return (
      <span className="space-rating">
        <StarRating value={summary.averageRating} />
        <span className="space-rating-value">{formatted}</span>
        <span className="space-rating-count">({summary.reviewCount})</span>
      </span>
    );
  }

  return (
    <main className="page">
      <h1>StudySync</h1>
      <p>
        Find suitable study spaces and coordinate study sessions with other NUS students.
      </p>

      <section className="discovery">
        <h2>Discovery</h2>

        {loading && <p className="discovery-status">Loading recommendations...</p>}
        {error && <p className="discovery-status discovery-error">{error}</p>}

        {!loading && !error && (
          <>
            <section className="discovery-group">
              <h3>{sessionHeading}</h3>

              {sessionRecs.length === 0 ? (
                <p className="discovery-empty">
                  No open sessions to suggest yet.{" "}
                  <button className="link-button" onClick={() => navigate("/create-session")}>
                    Create one
                  </button>
                  .
                </p>
              ) : (
                <div className="recommendation-grid">
                  {sessionRecs.map(({session, reasons}) => (
                    <RecommendedSessionCard
                      key={session.id}
                      session={session}
                      reasons={reasons}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="discovery-group">
              <h3>{spaceHeading}</h3>

              {spaceRecs.length === 0 ? (
                <p className="discovery-empty">No study spaces to suggest yet.</p>
              ) : (
                <div className="recommendation-grid">
                  {spaceRecs.map((space) => (
                    <div
                      key={space.id}
                      className="card recommendation-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("/spaces")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate("/spaces");
                        }
                      }}
                    >
                      <h4>{space.name}</h4>
                      {renderSpaceRating(space.id)}
                      <p className="recommendation-space-mode">{space.studyMode}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default Home;
