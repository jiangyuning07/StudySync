import {useCallback, useEffect, useMemo, useState} from "react";
import {GoogleMap, Marker, InfoWindow, useLoadScript} from "@react-google-maps/api";
import {collection, getDocs, orderBy, query} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import StarRating from "../components/StarRating";
import SpaceReviews from "../components/SpaceReviews";
import {fetchRatingSummaries} from "../utils/reviews";
import {formatAverageRating, formatReviewCount} from "../utils/reviewUtils";
import {filterStudySpaces} from "../utils/studySpaceUtils";

const EMPTY_SUMMARY = {averageRating: null, reviewCount: 0};

function StudySpaces() {
  const [studySpaces, setStudySpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [message, setMessage] = useState("");
  const [ratingSummaries, setRatingSummaries] = useState({});
  const [expandedSpaceId, setExpandedSpaceId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [studyModeFilter, setStudyModeFilter] = useState("");
  const [minimumRatingFilter, setMinimumRatingFilter] = useState("");
  const [indoorOnlyFilter, setIndoorOnlyFilter] = useState(false);
  const [wifiOnlyFilter, setWifiOnlyFilter] = useState(false);
  const [powerOutletsOnlyFilter, setPowerOutletsOnlyFilter] = useState(false);
  const {currentUser} = useAuth();
  const {isLoaded} = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const studyModes = useMemo(
    () => [...new Set(studySpaces.map((space) => space.studyMode?.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [studySpaces]
  );
  const filteredStudySpaces = useMemo(
    () => filterStudySpaces(studySpaces, ratingSummaries, {
      search: searchFilter,
      studyMode: studyModeFilter,
      minimumRating: minimumRatingFilter,
      indoorOnly: indoorOnlyFilter,
      wifiOnly: wifiOnlyFilter,
      powerOutletsOnly: powerOutletsOnlyFilter,
    }),
    [
      studySpaces,
      ratingSummaries,
      searchFilter,
      studyModeFilter,
      minimumRatingFilter,
      indoorOnlyFilter,
      wifiOnlyFilter,
      powerOutletsOnlyFilter,
    ]
  );
  const hasActiveFilters = Boolean(
    searchFilter.trim() ||
    studyModeFilter ||
    minimumRatingFilter ||
    indoorOnlyFilter ||
    wifiOnlyFilter ||
    powerOutletsOnlyFilter
  );

  function clearFilters() {
    setSearchFilter("");
    setStudyModeFilter("");
    setMinimumRatingFilter("");
    setIndoorOnlyFilter(false);
    setWifiOnlyFilter(false);
    setPowerOutletsOnlyFilter(false);
  }

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
        <div className="study-spaces-heading">
          <h2>Study Spaces</h2>
          <button
            type="button"
            className={`study-spaces-filter-toggle${showFilters ? " active" : ""}`}
            aria-expanded={showFilters}
            aria-controls="study-space-directory"
            onClick={() => setShowFilters((previous) => !previous)}
          >
            Filter
          </button>
        </div>

        {studySpaces.length === 0 && !loadingSpaces && (
          <p>No study spaces found.</p>
        )}

        <div
          id="study-space-directory"
          className={`study-spaces-layout${showFilters ? " filters-visible" : ""}`}
        >
          {showFilters && (
            <aside className="session-filters" aria-label="Filter study spaces">
              <div className="session-filters-header">
                <h2>Filter spaces</h2>
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters}>Clear all</button>
                )}
              </div>

              <div className="session-filter-group">
                <label htmlFor="study-space-search-filter">Name or address</label>
                <div className="session-filter-input-wrapper">
                  <input
                    id="study-space-search-filter"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    type="text"
                    placeholder="Search by keywords"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      className="session-filter-clear"
                      onClick={() => setSearchFilter("")}
                      aria-label="Clear name or address"
                    >
                      ×
                    </button>
                  )}
                </div>
                <small>Use one or more words from the name or address.</small>
              </div>

              <div className="session-filter-group">
                <label htmlFor="study-space-mode-filter">Study mode</label>
                <select
                  id="study-space-mode-filter"
                  value={studyModeFilter}
                  onChange={(event) => setStudyModeFilter(event.target.value)}
                >
                  <option value="">All study modes</option>
                  {studyModes.map((studyMode) => (
                    <option key={studyMode} value={studyMode}>{studyMode}</option>
                  ))}
                </select>
              </div>

              <div className="session-filter-group">
                <label htmlFor="study-space-rating-filter">Minimum rating</label>
                <select
                  id="study-space-rating-filter"
                  value={minimumRatingFilter}
                  onChange={(event) => setMinimumRatingFilter(event.target.value)}
                >
                  <option value="">Any rating</option>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating === 5 ? "5 stars" : `${rating}+ stars`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="session-filter-group space-amenity-filters">
                <span className="space-filter-group-label">Amenities</span>
                <label className="session-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={indoorOnlyFilter}
                    onChange={(event) => setIndoorOnlyFilter(event.target.checked)}
                  />
                  <span>Indoor only</span>
                </label>
                <label className="session-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={wifiOnlyFilter}
                    onChange={(event) => setWifiOnlyFilter(event.target.checked)}
                  />
                  <span>Wi-Fi available</span>
                </label>
                <label className="session-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={powerOutletsOnlyFilter}
                    onChange={(event) => setPowerOutletsOnlyFilter(event.target.checked)}
                  />
                  <span>Power outlets available</span>
                </label>
              </div>
            </aside>
          )}

          <div className="study-space-results">
            <p className="session-result-count" aria-live="polite">
              {filteredStudySpaces.length} {filteredStudySpaces.length === 1 ? "space" : "spaces"}
            </p>

            {filteredStudySpaces.length > 0 ? (
              <div className="study-space-grid">
                {filteredStudySpaces.map((space) => {
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
            ) : studySpaces.length > 0 ? (
              <div className="session-empty-state">
                <h2>No matching spaces</h2>
                <p>Try changing or clearing your filters.</p>
              </div>
            ) : null}
          </div>
        </div>

      </section>
    </main>
  );
}

export default StudySpaces;
