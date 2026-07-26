import {collection, getDocs, orderBy, query, where} from "firebase/firestore";
import {db} from "./firebase";

// The user's history. This query does not exist elsewhere in the app: AllSessions
// only ever reads sessions for browsing, but recommendations need the user's past
// sessions including completed ones, because a session that has ended still tells
// us which module and space they cared about. `array-contains` on participants is
// the only way to reconstruct that, since the creator's uid is in the array too.
export async function fetchUserSessions(uid) {
  const userSessionsQuery = query(
    collection(db, "sessions"),
    where("participants", "array-contains", uid)
  );
  const snapshot = await getDocs(userSessionsQuery);
  return snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()}));
}

// The pool to recommend from: every session, newest first. Eligibility and
// scoring are decided later by the pure layer, so this stays a plain read.
export async function fetchAllSessions() {
  const sessionsQuery = query(
    collection(db, "sessions"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(sessionsQuery);
  return snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()}));
}

export async function fetchAllSpaces() {
  const spacesQuery = query(collection(db, "studySpaces"), orderBy("name"));
  const snapshot = await getDocs(spacesQuery);
  return snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()}));
}
