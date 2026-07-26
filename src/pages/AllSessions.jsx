import {useEffect, useState, useCallback, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {collection, doc, getDoc, getDocs, updateDoc, query, orderBy, arrayRemove, arrayUnion, runTransaction} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";
import {isInactive, getDisplayStatus, sortSessions, filterSessions, STUDY_MODES} from "../utils/sessionUtils";
import {notifySessionCancelled} from "../utils/notifications";
import SessionLabels from "../components/SessionLabels";

function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
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

  const setSessionActionLoading = (sessionId, isLoading) => {
    setActionLoading((prev) => ({
      ...prev,
      [sessionId]: isLoading,
    }));
  };

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

  async function handleJoinSession(sessionId) {
    if (!currentUser) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);

      await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);

        if (!sessionDoc.exists()) {
          throw new Error("Session no longer exists.");
        }

        const session = sessionDoc.data();
        const participants = session.participants || [];

        if (session.creatorId === currentUser.uid) {
          throw new Error("You cannot join your own session.");
        }

        if (session.status !== "Active") {
          throw new Error("This session is not active.");
        }

        if (participants.includes(currentUser.uid)) {
          return;
        }

        if (participants.length >= session.maxParticipants) {
          throw new Error("This session is full.");
        }

        transaction.update(sessionRef, {
          participants: arrayUnion(currentUser.uid),
        });
      });

      await fetchSessions();
    } catch (error) {
      console.error("Failed to join session:", error);
      alert(error.message || "Failed to join session.");
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  async function handleCancelSession(session) {
    const confirmed = window.confirm("Are you sure you want to cancel this session?");
    if (!confirmed) return;

    try {
      setSessionActionLoading(session.id, true);
      const sessionRef = doc(db, "sessions", session.id);

      await updateDoc(sessionRef, {
        status: "Cancelled",
      });

      await notifySessionCancelled(session);

      await fetchSessions();
    } catch (error) {
      console.error("Failed to cancel session:", error);
    } finally {
      setSessionActionLoading(session.id, false);
    }
  }

  async function handleLeaveSession(sessionId) {
    if (!currentUser) return;

    const confirmed = window.confirm("Are you sure you want to leave this session?");
    if (!confirmed) return;

    try {
      setSessionActionLoading(sessionId, true);
      const sessionRef = doc(db, "sessions", sessionId);

      await updateDoc(sessionRef, {
        participants: arrayRemove(currentUser.uid),
      });

      await fetchSessions();
    } catch (error) {
      console.error("Failed to leave session:", error);
    } finally {
      setSessionActionLoading(sessionId, false);
    }
  }

  function renderSessionCard(session) {
    const participantCount = session.participants?.length || 0;
    const creatorProfile = creatorProfiles[session.creatorId];
    const creatorName = creatorProfile?.name || "Unknown creator";
    const isCreator = session.creatorId === currentUser?.uid;
    const creatorDisplayName = isCreator ? "Me" : creatorName;
    const isJoined = session.participants?.includes(currentUser?.uid);
    const isFull = participantCount >= session.maxParticipants;
    const isActionLoading = !!actionLoading[session.id];

    return (
      <div
        className="card session-card"
        key={session.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/sessions/${session.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/sessions/${session.id}`);
          }
        }}
        style={{opacity: isInactive(session) ? 0.5 : 1}}
      >
        <h3>{session.studySpaceName}</h3>
        <p><strong>Date:</strong> {session.date}</p>
        <p><strong>Time:</strong> {session.startTime} - {session.endTime}</p>
        <p><strong>Duration:</strong> {session.duration} mins</p>
        <p><strong>Created by:</strong> {creatorDisplayName}</p>
        <p><strong>Participants:</strong> {participantCount}/{session.maxParticipants}</p>
        <p><strong>Status:</strong> {getDisplayStatus(session)}</p>
        <SessionLabels session={session} />

        {!isInactive(session) && (
          <div className="session-actions">
            {isCreator ? (
              <>
                <button
                  className="session-action-button edit-button"
                  disabled={isActionLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/sessions/${session.id}/edit`);
                  }}
                >
                  Edit
                </button>

                <button
                  className="session-action-button cancel-button"
                  disabled={isActionLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelSession(session);
                  }}
                >
                  {isActionLoading ? "Cancelling..." : "Cancel"}
                </button>
              </>
            ) : isJoined ? (
              <button
                className="session-action-button cancel-button"
                disabled={isActionLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLeaveSession(session.id);
                }}
              >
                {isActionLoading ? "Leaving..." : "Leave"}
              </button>
            ) : (
              <button
                className={`session-action-button ${isFull ? "full-button" : "edit-button"}`}
                disabled={isActionLoading || isFull}
                onClick={(e) => {
                  e.stopPropagation();
                  handleJoinSession(session.id);
                }}
              >
                {isFull ? "Full" : isActionLoading ? "Joining..." : "Join"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
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
