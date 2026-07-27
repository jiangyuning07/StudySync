import {useEffect, useState, useCallback, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {collection, doc, getDoc, getDocs, query, orderBy} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {isInactive, sortSessions, filterSessions, STUDY_MODES} from "../utils/sessionUtils";
import SessionLabels from "../components/SessionLabels";
import SessionStatusPill from "../components/SessionStatusPill";
import {formatSessionWhen} from "../utils/sessionFormat";

function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatorProfiles, setCreatorProfiles] = useState({});
  const [studyModeFilter, setStudyModeFilter] = useState("");
  const [moduleCodeFilter, setModuleCodeFilter] = useState("");
  const [studyGoalFilter, setStudyGoalFilter] = useState("");
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const moduleCodes = useMemo(
    () => [...new Set(sessions.map((session) => session.moduleCode?.trim().toUpperCase()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [sessions]
  );
  const filteredSessions = useMemo(
    () => filterSessions(sessions, {
      studyMode: studyModeFilter,
      moduleCode: moduleCodeFilter,
      studyGoal: studyGoalFilter,
      activeOnly: activeOnlyFilter,
    }),
    [sessions, studyModeFilter, moduleCodeFilter, studyGoalFilter, activeOnlyFilter]
  );
  const hasActiveFilters = Boolean(
    studyModeFilter || moduleCodeFilter.trim() || studyGoalFilter.trim() || activeOnlyFilter
  );

  function clearFilters() {
    setStudyModeFilter("");
    setModuleCodeFilter("");
    setStudyGoalFilter("");
    setActiveOnlyFilter(false);
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true);

    const sessionsQuery = query(
      collection(db, "sessions"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(sessionsQuery);

    const sessionList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const creatorUids = [
      ...new Set(
        sessionList.map((session) => session.creatorId).filter(Boolean)
      ),
    ];

    const creatorProfileEntries = await Promise.all(
      creatorUids.map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));

        if (!userSnap.exists()) {
          return [uid, {uid, name: "Unknown creator"}];
        }

        return [uid, {uid, ...userSnap.data()}];
      })
    );

    setCreatorProfiles(Object.fromEntries(creatorProfileEntries));
    setSessions(sortSessions(sessionList));
    setLoading(false);
  }, []);

  function renderSessionCard(session) {
    const participantCount = session.participants?.length || 0;
    const creatorProfile = creatorProfiles[session.creatorId];
    const creatorName = creatorProfile?.name || "Unknown creator";
    const isCreator = session.creatorId === currentUser?.uid;
    const creatorDisplayName = isCreator ? "Me" : creatorName;
    const isJoined = session.participants?.includes(currentUser?.uid);

    return (
      <div
        className={`card session-card${isInactive(session) ? " session-inactive" : ""}`}
        key={session.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/sessions/${session.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/sessions/${session.id}`);
          }
        }}
      >
        <div className="session-card-header">
          <h3>{session.studySpaceName}</h3>
          <SessionStatusPill session={session} />
        </div>
        <p className="session-when">{formatSessionWhen(session)}</p>
        <p className="session-meta">
          {creatorDisplayName} · {participantCount} of {session.maxParticipants} joined
          {isJoined && " · Joined"}
        </p>
        <SessionLabels session={session} />
      </div>
    );
  }

  useEffect(() => {
    // Initial Firestore synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSessions();
  }, [fetchSessions]);

  return (
    <main className="page all-sessions-page">
      <div className="all-sessions-heading">
        <h1>All Study Sessions</h1>
        <button
          type="button"
          className={`all-sessions-filter-toggle${showFilters ? " active" : ""}`}
          aria-expanded={showFilters}
          aria-controls="all-sessions-directory"
          onClick={() => setShowFilters((previous) => !previous)}
        >
          Filter
        </button>
      </div>

      {loading && <p>Loading study sessions...</p>}

      {!loading && sessions.length === 0 && (
        <p>No study sessions created yet.</p>
      )}

      {!loading && sessions.length > 0 && (
        <div
          id="all-sessions-directory"
          className={`all-sessions-layout${showFilters ? " filters-visible" : ""}`}
        >
          {showFilters && (
            <aside className="session-filters" aria-label="Filter study sessions">
              <div className="session-filters-header">
                <h2>Filter sessions</h2>
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters}>Clear all</button>
                )}
              </div>

              <div className="session-filter-group">
                <label className="session-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={activeOnlyFilter}
                    onChange={(event) => setActiveOnlyFilter(event.target.checked)}
                  />
                  <span>Active sessions only</span>
                </label>
              </div>

              <div className="session-filter-group">
                <label htmlFor="study-mode-filter">Study mode</label>
                <select
                  id="study-mode-filter"
                  value={studyModeFilter}
                  onChange={(event) => setStudyModeFilter(event.target.value)}
                >
                  <option value="">All study modes</option>
                  {STUDY_MODES.map((studyMode) => (
                    <option key={studyMode} value={studyMode}>{studyMode}</option>
                  ))}
                </select>
              </div>

              <div className="session-filter-group">
                <label htmlFor="module-code-filter">Module code</label>
                <div className="session-filter-input-wrapper module-code-filter-input-wrapper">
                  <input
                    id="module-code-filter"
                    list="module-code-options"
                    value={moduleCodeFilter}
                    onChange={(event) => setModuleCodeFilter(event.target.value.toUpperCase())}
                    type="text"
                    placeholder="Type or select a code"
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                  {moduleCodeFilter && (
                    <button
                      type="button"
                      className="session-filter-clear"
                      onClick={() => setModuleCodeFilter("")}
                      aria-label="Clear module code"
                    >
                      ×
                    </button>
                  )}
                </div>
                <datalist id="module-code-options">
                  {moduleCodes.map((moduleCode) => (
                    <option key={moduleCode} value={moduleCode} />
                  ))}
                </datalist>
              </div>

              <div className="session-filter-group">
                <label htmlFor="study-goal-filter">Study goal</label>
                <div className="session-filter-input-wrapper">
                  <input
                    id="study-goal-filter"
                    value={studyGoalFilter}
                    onChange={(event) => setStudyGoalFilter(event.target.value)}
                    type="text"
                    placeholder="Search by keywords"
                  />
                  {studyGoalFilter && (
                    <button
                      type="button"
                      className="session-filter-clear"
                      onClick={() => setStudyGoalFilter("")}
                      aria-label="Clear study goal"
                    >
                      ×
                    </button>
                  )}
                </div>
                <small>Use one or more words from the goal.</small>
              </div>
            </aside>
          )}

          <section className="session-results">
            <p className="session-result-count" aria-live="polite">
              {filteredSessions.length} {filteredSessions.length === 1 ? "session" : "sessions"}
            </p>

            {filteredSessions.length > 0 ? (
              <div className="session-list">
                {filteredSessions.map((session) => renderSessionCard(session))}
              </div>
            ) : (
              <div className="session-empty-state">
                <h2>No matching sessions</h2>
                <p>Try changing or clearing your filters.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default AllSessions;
