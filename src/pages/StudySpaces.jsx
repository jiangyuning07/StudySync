import {useCallback, useEffect, useState} from "react";
import {GoogleMap, Marker, InfoWindow, useLoadScript} from "@react-google-maps/api";
import {collection, getDocs, orderBy, query} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import StarRating from "../components/StarRating";
import SpaceReviews from "../components/SpaceReviews";
import {fetchRatingSummaries} from "../utils/reviews";
import {formatAverageRating, formatReviewCount} from "../utils/reviewUtils";

const EMPTY_SUMMARY = {averageRating: null, reviewCount: 0};

function StudySpaces() {
  const [studySpaces, setStudySpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [message, setMessage] = useState("");
  const [ratingSummaries, setRatingSummaries] = useState({});
  const [expandedSpaceId, setExpandedSpaceId] = useState(null);
  const {currentUser} = useAuth();
  const {isLoaded} = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Wrapped in useCallback because SpaceReviews lists this in a dependency
  // array. A fresh function on every render would restart its effect forever.
  const handleSummaryChange = useCallback((spaceId, summary) => {
    setRatingSummaries((previous) => ({...previous, [spaceId]: summary}));
  }, []);

  function toggleReviews(spaceId) {
    setExpandedSpaceId((previous) => (previous === spaceId ? null : spaceId));
  }

  useEffect(() => {
    async function fetchStudySpaces() {
      try {
        const q = query(collection(db, "studySpaces"), orderBy("name"));
        const snapshot = await getDocs(q);
        const spaces = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStudySpaces(spaces);

        // Ratings load after the spaces themselves so the directory renders
        // straight away and fills in stars a moment later, rather than showing
        // nothing until every aggregation query has come back.
        const summaries = await fetchRatingSummaries(spaces.map((space) => space.id));
        setRatingSummaries(summaries);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoadingSpaces(false);
      }
    }
    fetchStudySpaces();
  }, []);

  function renderRatingRow(spaceId) {
    const {averageRating, reviewCount} = ratingSummaries[spaceId] || EMPTY_SUMMARY;
    const formattedAverage = formatAverageRating(averageRating, reviewCount);

    if (!formattedAverage) {
      return <p className="space-rating space-rating-empty">No reviews yet</p>;
    }

    return (
      <p className="space-rating">
        <StarRating value={averageRating} />
        <span className="space-rating-value">{formattedAverage}</span>
        <span className="space-rating-count">({reviewCount})</span>
        <span className="sr-only">{formatReviewCount(reviewCount)}</span>
      </p>
    );
  }

  return (
    <main className="page">
      <h1>Study Space Directory</h1>
      <p>Click a pin to view the study space details.</p>

      {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <p className="warning">
          Google Maps API key missing from .env file.
        </p>
      )}

      {message && <p className="message">{message}</p>}

      {loadingSpaces ? (
        <p>Loading study spaces...</p>
      ) : isLoaded ? (
        <div className="map-container">
          <GoogleMap
            zoom={15}
            center={{lat: 1.29733, lng: 103.77665}}
            mapContainerClassName="map"
          >
            {studySpaces.map((space) => (
              <Marker
                key={space.id}
                position={{lat: space.location.lat, lng: space.location.lng}}
                onClick={() => setSelectedSpace(space)}
              />
            ))}
            {selectedSpace && (
              <InfoWindow
                position={{
                  lat: selectedSpace.location.lat,
                  lng: selectedSpace.location.lng,
                }}
                onCloseClick={() => setSelectedSpace(null)}
              >
                <div>
                  <strong>{selectedSpace.name}</strong>
                  <p>{selectedSpace.address}</p>
                  <p>{selectedSpace.openingHours}</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      ) : (
        <p>Loading map...</p>
      )}

      <section className="study-spaces-section">
        <h2>Study Spaces</h2>

        {studySpaces.length === 0 && !loadingSpaces && (
          <p>No study spaces found.</p>
        )}

        <div className="study-space-grid">
          {studySpaces.map((space) => {
            const isExpanded = expandedSpaceId === space.id;

            return (
              <article key={space.id} className="card study-space-card">
                <h3>{space.name}</h3>

                {renderRatingRow(space.id)}

                <p><strong>Address:</strong> {space.address}</p>
                <p><strong>Opening Hours:</strong> {space.openingHours}</p>
                <p><strong>Indoor:</strong> {space.indoor ? "Yes" : "No"}</p>
                <p><strong>Wifi:</strong> {space.wifi ? "Yes" : "No"}</p>
                <p><strong>Power Outlets:</strong> {space.powerOutlets ? "Yes" : "No"}</p>
                <p><strong>Study Mode:</strong> {space.studyMode}</p>

                <button
                  type="button"
                  className="review-toggle"
                  aria-expanded={isExpanded}
                  aria-controls={`reviews-${space.id}`}
                  onClick={() => toggleReviews(space.id)}
                >
                  {isExpanded ? "Hide comments" : "Show comments"}
                </button>

                {isExpanded && (
                  <div id={`reviews-${space.id}`}>
                    <SpaceReviews
                      spaceId={space.id}
                      currentUser={currentUser}
                      onSummaryChange={handleSummaryChange}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>

      </section>
    </main>
  );
}

export default StudySpaces;
