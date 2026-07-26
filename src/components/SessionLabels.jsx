function formatStudyMode(studyMode) {
  const mode = studyMode?.trim();

  if (!mode) return "";

  return `${mode.charAt(0).toUpperCase()}${mode.slice(1).toLowerCase()}`;
}

function SessionLabels({session}) {
  const moduleCode = session.moduleCode?.trim().toUpperCase();
  const studyGoal = session.studyGoal?.trim();
  const studyMode = formatStudyMode(session.studyMode);

  // The label text itself no longer carries a "Module:" / "Mode:" / "Goal:"
  // prefix. The colour and shape already read as a tag, and a module code or a
  // mode name is self-describing, so the prefix was pure noise. The full,
  // prefixed description is kept in the title attribute for hover / screen
  // readers, where the extra context is actually useful.
  const labels = [
    studyMode && {
      key: "mode",
      className: "mode-label",
      text: studyMode,
      title: `Study mode: ${studyMode}`,
    },
    moduleCode && {
      key: "module",
      className: "module-label",
      text: moduleCode,
      title: `Module: ${moduleCode}`,
    },
    studyGoal && {
      key: "goal",
      className: "goal-label",
      text: studyGoal,
      title: `Study goal: ${studyGoal}`,
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
