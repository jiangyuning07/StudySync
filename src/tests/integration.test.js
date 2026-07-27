// @vitest-environment node

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import process from "node:process";
import {deleteApp, initializeApp} from "firebase/app";
import {
  applyActionCode,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const PROJECT_ID = "demo-studysync-integration";
const PASSWORD = "password123";
const SPACE_ID = "space-1";
const SPACE_NAME = "Central Library";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const app = initializeApp(
  {apiKey: "fake-api-key", projectId: PROJECT_ID},
  "integration-tests"
);
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, `http://${AUTH_HOST}`, {disableWarnings: true});
const [firestoreHostname, firestorePort] = FIRESTORE_HOST.split(":");
connectFirestoreEmulator(db, firestoreHostname, Number(firestorePort));

async function clearEmulators() {
  await Promise.all([
    fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: "DELETE",
    }),
    fetch(
      `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}`
        + "/databases/(default)/documents",
      {method: "DELETE"}
    ),
  ]);
}

async function seedStudySpace() {
  const response = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}`
      + `/databases/(default)/documents/studySpaces/${SPACE_ID}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          name: {stringValue: SPACE_NAME},
          studyMode: {stringValue: "Silent"},
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Could not seed study space: ${await response.text()}`);
  }
}

async function verifyCurrentUser(email) {
  await sendEmailVerification(auth.currentUser);

  const response = await fetch(
    `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/oobCodes`
  );
  const {oobCodes = []} = await response.json();
  const verification = [...oobCodes].reverse().find(
    (item) => item.email === email && item.requestType === "VERIFY_EMAIL"
  );

  if (!verification) {
    throw new Error(`No verification code generated for ${email}`);
  }

  await applyActionCode(auth, verification.oobCode);
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
}

async function registerVerifiedUser(number, name) {
  const email = `e${number}@u.nus.edu`;
  const credential = await createUserWithEmailAndPassword(auth, email, PASSWORD);

  await setDoc(doc(db, "users", credential.user.uid), {
    name,
    email,
    createdAt: serverTimestamp(),
  });

  await verifyCurrentUser(email);
  const user = {
    uid: credential.user.uid,
    email,
    name,
    emailVerified: auth.currentUser.emailVerified,
  };
  await signOut(auth);
  return user;
}

async function asUser(user, operation) {
  await signInWithEmailAndPassword(auth, user.email, PASSWORD);
  try {
    return await operation();
  } finally {
    await signOut(auth);
  }
}

function sessionPayload(creator, overrides = {}) {
  return {
    studySpaceId: SPACE_ID,
    studySpaceName: SPACE_NAME,
    date: "2099-12-31",
    startTime: "10:00",
    endTime: "11:00",
    duration: 60,
    studyMode: "Silent",
    moduleCode: "CS2103T",
    studyGoal: "Review tutorial questions",
    maxParticipants: 3,
    creatorId: creator.uid,
    creatorName: creator.name,
    participants: [creator.uid],
    status: "Active",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

async function createSessionAs(creator, overrides = {}) {
  return asUser(creator, () =>
    addDoc(collection(db, "sessions"), sessionPayload(creator, overrides))
  );
}

async function joinSessionAs(user, sessionId) {
  return asUser(user, async () => {
    const sessionRef = doc(db, "sessions", sessionId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(sessionRef);
      if (!snapshot.exists()) throw new Error("Session no longer exists.");

      const session = snapshot.data();
      const participants = session.participants || [];

      if (session.creatorId === user.uid) {
        throw new Error("You cannot join your own session.");
      }
      if (session.status !== "Active") {
        throw new Error("This session is not active.");
      }
      if (participants.includes(user.uid)) return;
      if (participants.length >= session.maxParticipants) {
        throw new Error("This session is full.");
      }

      transaction.update(sessionRef, {participants: arrayUnion(user.uid)});
    });
  });
}

function checkInWindowTimes() {
  const nowInNus = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const currentMinute = nowInNus.getUTCHours() * 60 + nowInNus.getUTCMinutes();

  let dateOffset = 0;
  let startMinute = currentMinute + 5;

  if (startMinute >= 23 * 60 + 59) {
    dateOffset = 1;
    startMinute = 5;
  }

  const endMinute = Math.min(startMinute + 30, 23 * 60 + 59);
  const sessionDate = new Date(nowInNus.getTime() + dateOffset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const formatTime = (minute) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}`
      + `:${String(minute % 60).padStart(2, "0")}`;

  return {
    date: sessionDate,
    startTime: formatTime(startMinute),
    endTime: formatTime(endMinute),
    duration: endMinute - startMinute,
  };
}

describe.sequential("Firestore integration", () => {
  let creator;
  let joiner;
  let otherUser;

  beforeAll(async () => {
    await clearEmulators();
    await seedStudySpace();
    creator = await registerVerifiedUser("7000001", "Creator");
    joiner = await registerVerifiedUser("7000002", "Joiner");
    otherUser = await registerVerifiedUser("7000003", "Other User");
  }, 30_000);

  afterAll(async () => {
    await clearEmulators();
    await deleteApp(app);
  }, 20_000);

  it("registers verified NUS users and rejects duplicate email", async () => {
    expect(creator.emailVerified).toBe(true);

    await asUser(creator, async () => {
      const profile = await getDoc(doc(db, "users", creator.uid));
      expect(profile.data()).toMatchObject({
        name: "Creator",
        email: creator.email,
      });
    });

    await expect(
      createUserWithEmailAndPassword(auth, creator.email, PASSWORD)
    ).rejects.toMatchObject({code: "auth/email-already-in-use"});
  });

  it("blocks session access before NUS email verification", async () => {
    const email = "e7000004@u.nus.edu";
    const credential = await createUserWithEmailAndPassword(auth, email, PASSWORD);

    await setDoc(doc(db, "users", credential.user.uid), {
      name: "Unverified User",
      email,
      createdAt: serverTimestamp(),
    });

    await expect(getDocs(collection(db, "sessions"))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await signOut(auth);
  });

  it("creates a valid session and rejects malformed or undeclared fields", async () => {
    const sessionRef = await createSessionAs(creator);

    await asUser(creator, async () => {
      const snapshot = await getDoc(sessionRef);
      expect(snapshot.data()).toMatchObject({
        creatorId: creator.uid,
        participants: [creator.uid],
        status: "Active",
        studySpaceName: SPACE_NAME,
      });

      await expect(
        addDoc(collection(db, "sessions"), {
          creatorId: creator.uid,
          participants: [creator.uid],
          status: "Active",
          createdAt: serverTimestamp(),
        })
      ).rejects.toMatchObject({code: "permission-denied"});

      await expect(
        updateDoc(sessionRef, {unexpectedField: true})
      ).rejects.toMatchObject({code: "permission-denied"});
    });
  });

  it("joins an active session once and blocks invalid joins", async () => {
    const sessionRef = await createSessionAs(creator, {maxParticipants: 2});

    await joinSessionAs(joiner, sessionRef.id);
    await joinSessionAs(joiner, sessionRef.id);

    await asUser(joiner, async () => {
      const snapshot = await getDoc(sessionRef);
      expect(snapshot.data().participants).toEqual([creator.uid, joiner.uid]);
    });

    await expect(joinSessionAs(creator, sessionRef.id)).rejects.toThrow(
      "You cannot join your own session."
    );
    await expect(joinSessionAs(otherUser, sessionRef.id)).rejects.toThrow(
      "This session is full."
    );
  });

  it("allows a participant to leave before the session starts", async () => {
    const sessionRef = await createSessionAs(creator);
    await joinSessionAs(joiner, sessionRef.id);

    await asUser(joiner, async () => {
      const snapshot = await getDoc(sessionRef);
      await updateDoc(sessionRef, {
        participants: snapshot.data().participants.filter(
          (uid) => uid !== joiner.uid
        ),
      });

      const updated = await getDoc(sessionRef);
      expect(updated.data().participants).toEqual([creator.uid]);
    });
  });

  it("allows one check-in in the window and locks attendance and leave", async () => {
    const sessionRef = await createSessionAs(creator, checkInWindowTimes());
    await joinSessionAs(joiner, sessionRef.id);

    await asUser(joiner, async () => {
      await updateDoc(sessionRef, {[`attendance.${joiner.uid}`]: "in"});

      const checkedIn = await getDoc(sessionRef);
      expect(checkedIn.data().attendance[joiner.uid]).toBe("in");

      await expect(
        updateDoc(sessionRef, {[`attendance.${joiner.uid}`]: "in"})
      ).rejects.toMatchObject({code: "permission-denied"});

      await expect(
        updateDoc(sessionRef, {
          participants: checkedIn.data().participants.filter(
            (uid) => uid !== joiner.uid
          ),
        })
      ).rejects.toMatchObject({code: "permission-denied"});
    });
  });

  it("allows the creator to cancel and notifies joined participants", async () => {
    const sessionRef = await createSessionAs(creator);
    await joinSessionAs(joiner, sessionRef.id);

    await asUser(creator, async () => {
      await updateDoc(sessionRef, {status: "Cancelled"});
      await addDoc(collection(db, "notifications"), {
        userId: joiner.uid,
        message: "Creator cancelled the session at Central Library.",
        sessionId: sessionRef.id,
        type: "session_cancelled",
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await asUser(joiner, async () => {
      const session = await getDoc(sessionRef);
      expect(session.data().status).toBe("Cancelled");

      const notifications = await getDocs(query(
        collection(db, "notifications"),
        where("userId", "==", joiner.uid)
      ));
      expect(notifications.size).toBe(1);
      expect(notifications.docs[0].data().type).toBe("session_cancelled");
    });
  });

  it("creates, updates, and deletes the signed-in user's review", async () => {
    await asUser(joiner, async () => {
      const reviewRef = doc(db, "studySpaces", SPACE_ID, "reviews", joiner.uid);

      await setDoc(reviewRef, {
        userId: joiner.uid,
        userName: joiner.name,
        rating: 4,
        comment: "Quiet and comfortable.",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(reviewRef, {
        rating: 5,
        comment: "Excellent study environment.",
        updatedAt: serverTimestamp(),
      }, {merge: true});

      expect((await getDoc(reviewRef)).data().rating).toBe(5);
      await deleteDoc(reviewRef);
      expect((await getDoc(reviewRef)).exists()).toBe(false);
    });
  });
});
