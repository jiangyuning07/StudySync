import {
  average,
  collection,
  count,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {db} from "./firebase";

// Reviews live in a subcollection under the space they belong to, keyed by the
// author's uid. One document per user per space falls out of that for free, and
// editing or deleting is a write to a path we can build without a lookup.
function reviewsCollection(spaceId) {
  return collection(db, "studySpaces", spaceId, "reviews");
}

function reviewDoc(spaceId, uid) {
  return doc(db, "studySpaces", spaceId, "reviews", uid);
}

// Firestore hands back its own Timestamp type. Converting at this boundary lets
// everything above it work with plain Date objects, which is what reviewUtils
// expects and what tests can construct without importing Firebase.
function toReview(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    userId: data.userId,
    userName: data.userName,
    rating: data.rating,
    comment: data.comment || "",
    createdAt: data.createdAt?.toDate?.() || null,
    updatedAt: data.updatedAt?.toDate?.() || null,
  };
}

// An aggregation query rather than reading every review document. The directory
// only needs the average and the count, and Firestore bills an aggregation at a
// fraction of the equivalent document reads, so the card can show a rating
// without pulling comments nobody has asked to see yet.
export async function fetchRatingSummary(spaceId) {
  const snapshot = await getAggregateFromServer(reviewsCollection(spaceId), {
    averageRating: average("rating"),
    reviewCount: count(),
  });

  const {averageRating, reviewCount} = snapshot.data();

  return {
    averageRating: reviewCount ? averageRating : null,
    reviewCount,
  };
}

// One aggregation per space, run in parallel. A space whose query fails falls
// back to an empty summary so a single bad document cannot blank out the whole
// directory.
export async function fetchRatingSummaries(spaceIds) {
  const entries = await Promise.all(
    spaceIds.map(async (spaceId) => {
      try {
        return [spaceId, await fetchRatingSummary(spaceId)];
      } catch (error) {
        console.error(`Failed to load rating for space ${spaceId}:`, error);
        return [spaceId, {averageRating: null, reviewCount: 0}];
      }
    })
  );

  return Object.fromEntries(entries);
}

// Called only when the user opens the comments panel, so the cost of reading
// review documents is paid by the person who wanted to read them.
export async function fetchReviews(spaceId) {
  const reviewsQuery = query(reviewsCollection(spaceId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(reviewsQuery);
  return snapshot.docs.map(toReview);
}

// Creates or edits the signed in user's review. `createdAt` is only written on
// the first save so editing a review does not push it back to the top of the
// list as though it were new.
export async function saveReview(spaceId, {uid, userName, rating, comment, isNew}) {
  const payload = {
    userId: uid,
    userName,
    rating,
    comment: (comment || "").trim(),
    updatedAt: serverTimestamp(),
  };

  if (isNew) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(reviewDoc(spaceId, uid), payload, {merge: true});
}

export async function deleteReview(spaceId, uid) {
  await deleteDoc(reviewDoc(spaceId, uid));
}
