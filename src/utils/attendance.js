import {collection, doc, getDocs, query, updateDoc, where} from "firebase/firestore";
import {db} from "./firebase";
import {ATTENDANCE} from "./attendanceUtils";

// Every session this user is a participant in, used to compute their attendance
// record. Same query MySessions and recommendations already use, so no new index
// is needed.
export async function fetchJoinedSessions(uid) {
  const joinedQuery = query(
    collection(db, "sessions"),
    where("participants", "array-contains", uid)
  );
  const snapshot = await getDocs(joinedQuery);
  return snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()}));
}

// Check-in writes a single key into the session's `attendance` map:
// attendance.{uid} = "in". A dotted field path touches only that one key and
// never rewrites the whole map, which is what lets the security rule allow a
// non-creator to record their own attendance without altering anyone else's
// (mirroring how joining only appends to `participants`).
//
// There is no check-out: checking in is final for the session.
export async function checkIn(sessionId, uid) {
  await updateDoc(doc(db, "sessions", sessionId), {
    [`attendance.${uid}`]: ATTENDANCE.IN,
  });
}
