// src/tests/integration.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// ─── Firebase Emulator Setup ────────────────────────────────────────────────

const app = initializeApp({
  apiKey: "fake-api-key",
  authDomain: "localhost",
  projectId: "studysync-test",
});

const db = getFirestore(app);
const auth = getAuth(app);

connectFirestoreEmulator(db, "127.0.0.1", 8080);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

// ─── Helpers ────────────────────────────────────────────────────────────────

async function registerUser(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await addDoc(collection(db, "users"), {
    uid: cred.user.uid,
    email,
    name,
  });
  return cred.user;
}

async function createSession(creatorId, overrides = {}) {
  const docRef = await addDoc(collection(db, "sessions"), {
    studySpaceId: "space-1",
    studySpaceName: "Central Library",
    date: "2099-12-31",
    startTime: "10:00",
    endTime: "12:00",
    duration: 120,
    studyMode: "Silent",
    moduleCode: "CS2103T",
    studyGoal: "Review tutorial questions",
    maxParticipants: 3,
    creatorId,
    participants: [],
    status: "Active",
    createdAt: serverTimestamp(),
    ...overrides,
  });
  return docRef.id;
}

// The join logic
async function joinSession(sessionId, currentUserUid) {
  const sessionRef = doc(db, "sessions", sessionId);

  await runTransaction(db, async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);

    if (!sessionDoc.exists()) throw new Error("Session no longer exists.");

    const session = sessionDoc.data();
    const participants = session.participants || [];

    if (session.creatorId === currentUserUid)
      throw new Error("You cannot join your own session.");

    if (session.status !== "Active")
      throw new Error("This session is not active.");

    if (participants.includes(currentUserUid)) return;

    if (participants.length >= session.maxParticipants)
      throw new Error("This session is full.");

    transaction.update(sessionRef, {
      participants: arrayUnion(currentUserUid),
    });
  });
}

// The leave logic
async function leaveSession(sessionId, currentUserUid) {
  const sessionRef = doc(db, "sessions", sessionId);
  await updateDoc(sessionRef, {
    participants: arrayRemove(currentUserUid),
  });
}

// The cancel logic
async function cancelSession(sessionId) {
  await updateDoc(doc(db, "sessions", sessionId), { status: "Cancelled" });
}

// The NUS email validation from authRules.js
function isValidNusEmail(email) {
  return /^e\d{7}@u\.nus\.edu$/i.test(email.trim());
}

// ─── Clean up ──────────────────────────────────────

async function clearSessions() {
  const snapshot = await getDocs(collection(db, "sessions"));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

async function clearUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

async function clearAuthUsers() {
  await fetch(
    "http://127.0.0.1:9099/emulator/v1/projects/studysync-test/accounts",
    { method: "DELETE" }
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await clearAuthUsers();
  await clearSessions();
  await clearUsers();
});

describe("Auth — NUS email validation", () => {
  it("accepts valid NUS email", () => {
    expect(isValidNusEmail("e1234567@u.nus.edu")).toBe(true);
  });

  it("rejects gmail", () => {
    expect(isValidNusEmail("student@gmail.com")).toBe(false);
  });

  it("rejects NUS email without e-prefix", () => {
    expect(isValidNusEmail("1234567@u.nus.edu")).toBe(false);
  });

  it("rejects NUS email with wrong digit count", () => {
    expect(isValidNusEmail("e123@u.nus.edu")).toBe(false);
  });
});

describe("Auth — Firebase emulator registration", () => {
  afterAll(async () => {
    await clearUsers();
  });

  it("registers a new user successfully", async () => {
    const user = await registerUser(
      "e1111111@u.nus.edu",
      "password123",
      "Test User"
    );
    expect(user.uid).toBeTruthy();
    expect(user.email).toBe("e1111111@u.nus.edu");
  });

  it("cannot register with duplicate email", async () => {
    await expect(
      registerUser("e1111111@u.nus.edu", "password123", "Duplicate")
    ).rejects.toThrow();
  });
});

describe("Sessions — Join", () => {
  let creatorId;
  let joinerId;

  beforeAll(async () => {
    const creator = await registerUser(
      "e2000001@u.nus.edu",
      "password123",
      "Creator"
    );
    const joiner = await registerUser(
      "e2000002@u.nus.edu",
      "password123",
      "Joiner"
    );
    creatorId = creator.uid;
    joinerId = joiner.uid;
  });

  afterAll(async () => {
    await clearSessions();
    await clearUsers();
  });

  it("user can join an active session", async () => {
    const sessionId = await createSession(creatorId);
    await joinSession(sessionId, joinerId);

    const snap = await getDoc(doc(db, "sessions", sessionId));
    expect(snap.data().participants).toContain(joinerId);
  });

  it("joining same session twice does not duplicate participant", async () => {
    const sessionId = await createSession(creatorId);
    await joinSession(sessionId, joinerId);
    await joinSession(sessionId, joinerId);

    const snap = await getDoc(doc(db, "sessions", sessionId));
    const count = snap.data().participants.filter((id) => id === joinerId).length;
    expect(count).toBe(1);
  });

  it("creator cannot join their own session", async () => {
    const sessionId = await createSession(creatorId);
    await expect(joinSession(sessionId, creatorId)).rejects.toThrow(
      "You cannot join your own session."
    );
  });

  it("user cannot join a cancelled session", async () => {
    const sessionId = await createSession(creatorId, { status: "Cancelled" });
    await expect(joinSession(sessionId, joinerId)).rejects.toThrow(
      "This session is not active."
    );
  });

  it("user cannot join a full session", async () => {
    const sessionId = await createSession(creatorId, {
      maxParticipants: 1,
      participants: ["e9999999"],
    });
    await expect(joinSession(sessionId, joinerId)).rejects.toThrow(
      "This session is full."
    );
  });

  it("throws error if session does not exist", async () => {
    await expect(joinSession("nonexistent-id", joinerId)).rejects.toThrow(
      "Session no longer exists."
    );
  });
});

describe("Sessions — Leave", () => {
  let creatorId;
  let joinerId;

  beforeAll(async () => {
    const creator = await registerUser(
      "e3000001@u.nus.edu",
      "password123",
      "Creator"
    );
    const joiner = await registerUser(
      "e3000002@u.nus.edu",
      "password123",
      "Joiner"
    );
    creatorId = creator.uid;
    joinerId = joiner.uid;
  });

  afterAll(async () => {
    await clearSessions();
    await clearUsers();
  });

  it("user can leave a session they joined", async () => {
    const sessionId = await createSession(creatorId, {
      participants: [joinerId],
    });
    await leaveSession(sessionId, joinerId);

    const snap = await getDoc(doc(db, "sessions", sessionId));
    expect(snap.data().participants).not.toContain(joinerId);
  });

  it("leaving a session you never joined does not change participants", async () => {
    const sessionId = await createSession(creatorId, { participants: [] });
    await leaveSession(sessionId, joinerId);

    const snap = await getDoc(doc(db, "sessions", sessionId));
    expect(snap.data().participants).toEqual([]);
  });
});

describe("Sessions — Cancel", () => {
  let creatorId;

  beforeAll(async () => {
    const creator = await registerUser(
      "e4000001@u.nus.edu",
      "password123",
      "Creator"
    );
    creatorId = creator.uid;
  });

  afterAll(async () => {
    await clearSessions();
    await clearUsers();
  });

  it("creator can cancel their session", async () => {
    const sessionId = await createSession(creatorId);
    await cancelSession(sessionId);

    const snap = await getDoc(doc(db, "sessions", sessionId));
    expect(snap.data().status).toBe("Cancelled");
  });
});

describe("Sessions — Create", () => {
  let creatorId;

  beforeAll(async () => {
    const creator = await registerUser(
      "e5000001@u.nus.edu",
      "password123",
      "Creator"
    );
    creatorId = creator.uid;
  });

  afterAll(async () => {
    await clearSessions();
    await clearUsers();
  });

  it("creates a session with correct fields in Firestore", async () => {
    const sessionId = await createSession(creatorId, {
      studySpaceName: "Utown Library",
      studyMode: "Discussion",
      moduleCode: "CS2109S",
      studyGoal: "Prepare for the midterm",
      maxParticipants: 5,
    });

    const snap = await getDoc(doc(db, "sessions", sessionId));
    const data = snap.data();

    expect(data.studySpaceName).toBe("Utown Library");
    expect(data.studyMode).toBe("Discussion");
    expect(data.moduleCode).toBe("CS2109S");
    expect(data.studyGoal).toBe("Prepare for the midterm");
    expect(data.maxParticipants).toBe(5);
    expect(data.status).toBe("Active");
    expect(data.creatorId).toBe(creatorId);
    expect(data.participants).toEqual([]);
  });
});

describe("Sessions — Fetch and Sort", () => {
  let creatorId;

  beforeAll(async () => {
    const creator = await registerUser(
      "e6000001@u.nus.edu",
      "password123",
      "Creator"
    );
    creatorId = creator.uid;

    // Create sessions: one cancelled, two active with different times
    await createSession(creatorId, {
      date: "2099-12-31",
      startTime: "14:00",
      endTime: "16:00",
      status: "Active",
    });
    await createSession(creatorId, {
      date: "2099-12-31",
      startTime: "09:00",
      endTime: "11:00",
      status: "Active",
    });
    await createSession(creatorId, {
      date: "2099-12-31",
      startTime: "10:00",
      endTime: "12:00",
      status: "Cancelled",
    });
  });

  afterAll(async () => {
    await clearSessions();
    await clearUsers();
  });

  it("fetches all sessions from Firestore", async () => {
    const snapshot = await getDocs(collection(db, "sessions"));
    expect(snapshot.docs.length).toBe(3);
  });

  it("active sessions come before cancelled ones after sorting", async () => {
    const snapshot = await getDocs(collection(db, "sessions"));
    const sessions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    function isInactive(s) {
      const end = new Date(`${s.date}T${s.endTime}`);
      return s.status === "Cancelled" || end < new Date();
    }

    const active = sessions.filter((s) => !isInactive(s));
    const inactive = sessions.filter((s) => isInactive(s));

    expect(active.length).toBe(2);
    expect(inactive.length).toBe(1);
    expect(inactive[0].status).toBe("Cancelled");
  });
});
