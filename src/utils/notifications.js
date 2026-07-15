import {collection, doc, serverTimestamp, writeBatch} from "firebase/firestore";
import {db} from "./firebase";
import {
  NOTIFICATION_TYPES,
  computeSessionRecipients,
  buildUpdatedMessage,
  buildCancelledMessage,
  buildRemovedMessage,
} from "./notificationUtils";

// Re-export so existing imports of NOTIFICATION_TYPES from this module keep working.
export {NOTIFICATION_TYPES} from "./notificationUtils";

// Writes one notification document per recipient in a single batch.
// Kept private so callers go through the intention-named functions below.
async function writeNotifications(recipientUids, {message, sessionId, type}) {
  const uniqueRecipients = [...new Set(recipientUids)].filter(Boolean);
  if (uniqueRecipients.length === 0) return;

  const batch = writeBatch(db);

  uniqueRecipients.forEach((uid) => {
    const ref = doc(collection(db, "notifications"));
    batch.set(ref, {
      userId: uid,
      message,
      sessionId: sessionId || null,
      type: type || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

// Call after a creator saves edits to a session. `excludeUids` lets the caller
// skip anyone who was removed in the same save, so they only get the removal
// notice rather than both.
export async function notifySessionUpdated(session, {excludeUids = []} = {}) {
  const recipients = computeSessionRecipients(session, excludeUids);
  await writeNotifications(recipients, {
    message: buildUpdatedMessage(session),
    sessionId: session?.id,
    type: NOTIFICATION_TYPES.SESSION_UPDATED,
  });
}

// Call after a creator cancels a session, from any screen.
export async function notifySessionCancelled(session) {
  const recipients = computeSessionRecipients(session);
  await writeNotifications(recipients, {
    message: buildCancelledMessage(session),
    sessionId: session?.id,
    type: NOTIFICATION_TYPES.SESSION_CANCELLED,
  });
}

// Call after a creator removes one or more participants (Issue 5).
export async function notifyParticipantsRemoved(session, removedUids) {
  await writeNotifications(removedUids, {
    message: buildRemovedMessage(session),
    sessionId: session?.id,
    type: NOTIFICATION_TYPES.PARTICIPANT_REMOVED,
  });
}
