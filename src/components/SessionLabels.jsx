function formatStudyMode(studyMode) {
  const mode = studyMode?.trim();

  if (!mode) return "";

  return `${mode.charAt(0).toUpperCase()}${mode.slice(1).toLowerCase()}`;
}

function SessionLabels({session}) {
  const moduleCode = session.moduleCode?.trim().toUpperCase();
  const studyGoal = session.studyGoal?.trim();
  const studyMode = formatStudyMode(session.studyMode);
  const labels = [
    moduleCode && {
      key: "module",
      className: "module-label",
      text: `Module: ${moduleCode}`,
      title: `Module: ${moduleCode}`,
    },
    studyGoal && {
      key: "goal",
      className: "goal-label",
      text: `Goal: ${studyGoal}`,
      title: `Study goal: ${studyGoal}`,
    },
    studyMode && {
      key: "mode",
      className: "mode-label",
      text: `Mode: ${studyMode}`,
      title: `Study mode: ${studyMode}`,
    },
  ].filter(Boolean);

  if (labels.length === 0) return null;

  return (
    <div className="session-labels" aria-label="Session labels">
      {labels.map((label) => (
        <span
          className={`session-label ${label.className}`}
          key={label.key}
          title={label.title}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}

export default SessionLabels;
