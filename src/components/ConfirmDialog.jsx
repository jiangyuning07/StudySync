import {useCallback, useEffect, useRef, useState} from "react";

// A reusable in-app confirmation dialog to replace window.confirm.
//
// Usage:
//   const {confirm, dialog} = useConfirm();
//   ...
//   const ok = await confirm({
//     title: "Cancel this session?",
//     message: "Everyone who joined will be notified.",
//     confirmLabel: "Cancel session",
//     destructive: true,
//   });
//   if (ok) { ...proceed... }
//   ...
//   return (<> ...page... {dialog} </>);
//
// `confirm` returns a promise that resolves true/false, so calling code reads
// almost exactly like the old `if (window.confirm(...))` it replaces.

export function useConfirm() {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState(options || {});
    });
  }, []);

  const settle = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setState(null);
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      {...state}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return {confirm, dialog};
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  // Focus the primary button on open, and let Escape cancel. Focusing on open
  // means a keyboard user is immediately on an actionable control.
  useEffect(() => {
    confirmRef.current?.focus();

    function handleKey(event) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={onCancel}
    >
      <div className="dialog-box" onClick={(event) => event.stopPropagation()}>
        <h3 id="dialog-title" className="dialog-title">{title}</h3>
        {message && <p className="dialog-message">{message}</p>}

        <div className="dialog-actions">
          <button type="button" className="dialog-button dialog-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`dialog-button ${destructive ? "dialog-confirm-destructive" : "dialog-confirm"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
