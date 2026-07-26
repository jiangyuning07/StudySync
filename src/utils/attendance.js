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

// Check-in and check-out both write a single key into the session's `attendance`
// map: attendance.{uid}. Using dotted field paths means we touch only our own
// key and never rewrite the whole map, which is what lets the security rule
// allow a non-creator to update attendance without being able to alter anyone
// else's record (mirroring how joining only appends to `participants`).

export async function checkIn(sessionId, uid) {
  await updateDoc(doc(db, "sessions", sessionId), {
    [`attendance.${uid}`]: ATTENDANCE.IN,
  });
}

export async function checkOut(sessionId, uid) {
  await updateDoc(doc(db, "sessions", sessionId), {
    [`attendance.${uid}`]: ATTENDANCE.OUT,
  });
}
