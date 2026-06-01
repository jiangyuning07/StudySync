import {useEffect, useState} from "react";
import {Routes, Route, Link, useNavigate} from "react-router-dom";
import {createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, updateProfile} from "firebase/auth";
import {addDoc, collection, getDocs, serverTimestamp, query, orderBy} from "firebase/firestore";
import {GoogleMap, Marker, InfoWindow, useLoadScript} from "@react-google-maps/api";
import {auth, db} from "./firebase";
import {useAuth} from "./AuthContext";
import ProtectedRoute from "./ProtectedRoute";

const sampleStudySpaces = [
  {
    id: 1,
    name: "Central Library",
    lat: 1.29662,
    lng: 103.77326,
  },
  {
    id: 2,
    name: "UTown Education Resource Centre",
    lat: 1.30575,
    lng: 103.77268,
  },
  {
    id: 3,
    name: "COM3 Study Area",
    lat: 1.29476,
    lng: 103.77459,
  }
];

function Navbar() {
  const {currentUser, logout} = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">StudySync</Link>

      <div className="nav-links">
        {currentUser && (
          <>
            <Link to="/spaces">Study Spaces</Link>
            <Link to="/create-session">Create Session</Link>
            <Link to="/sessions">All Sessions</Link>
          </>
        )}

        {!currentUser ? (
          <>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
          </>
        ) : (
          <button onClick={handleLogout}>Logout</button>
        )}
      </div>
    </nav>
  );
}

function Home() {
  const {currentUser} = useAuth();

  return (
    <main className="page">
      <h1>StudySync</h1>
      <p>
        Find suitable study spaces and coordinate study sessions with other NUS students.
      </p>

      {currentUser ? (
        <div className="card">
          <h2>Welcome to StudySync!</h2>
          <p>You are logged in as {currentUser.email}.</p>

          {!currentUser.emailVerified && (
            <p className="warning">
              Your email is not verified yet. Please check your inbox.
            </p>
          )}
        </div>
      ) : (
        <div className="button-row">
          <Link className="primary-button" to="/register">Get Started</Link>
          <Link className="secondary-button" to="/login">Login</Link>
        </div>
      )}
    </main>
  );
}

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    if (!email.endsWith("@u.nus.edu")) {
      setMessage("Please use your NUS email, ending with @u.nus.edu.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(userCredential.user, {
        displayName: name,
      });

      await sendEmailVerification(userCredential.user);
      //console.log("Verification email sent");

      await addDoc(collection(db, "users"), {
        name,
        email,
        createdAt: serverTimestamp(),
      });

      setMessage("Account created. Please check your email for verification.");
      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <h1>Register</h1>

      <form className="form" onSubmit={handleRegister}>
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
        />

        <label>NUS Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e0123456@u.nus.edu"
          required
        />

        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          required
        />

        <button type="submit">Sign Up</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <h1>Login</h1>

      <form className="form" onSubmit={handleLogin}>
        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e0123456@u.nus.edu"
          required
        />

        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          required
        />

        <button type="submit">Login</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

function StudySpaces() {
  const [selectedSpace, setSelectedSpace] = useState(null);
  const {isLoaded} = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  return (
    <main className="page">
      <h1>Study Space Directory</h1>
      <p>Click a pin to view the study space name.</p>

      {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <p className="warning">
          Google Maps API key missing from .env file.
        </p>
      )}

      {isLoaded ? (
        <div className="map-container">
          <GoogleMap
            zoom={15}
            center={{lat: 1.29733, lng: 103.77665}}
            mapContainerClassName="map"
          >
            {sampleStudySpaces.map((space) => (
              <Marker
                key={space.id}
                position={{lat: space.lat, lng: space.lng}}
                onClick={() => setSelectedSpace(space)}
              />
            ))}
            {selectedSpace && (
              <InfoWindow
                position={{
                  lat: selectedSpace.lat,
                  lng: selectedSpace.lng,
                }}
                onCloseClick={() => setSelectedSpace(null)}
              >
                <div>
                  <strong>{selectedSpace.name}</strong>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      ) : (
        <p>Loading map...</p>
      )}

      <section className="card">
        <h2>Sample Study Spaces</h2>
        {sampleStudySpaces.map((space) => (
          <p key={space.id}>{space.name}</p>
        ))}
      </section>
    </main>
  );
}

function CreateSession() {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [message, setMessage] = useState("");
  const {currentUser} = useAuth();

  async function handleCreateSession(e) {
    e.preventDefault();
    setMessage("");

    try {
      await addDoc(collection(db, "sessions"), {
        location,
        date,
        time,
        duration,
        createdBy: currentUser.email,
        createdAt: serverTimestamp(),
      });
      setLocation("");
      setDate("");
      setTime("");
      setDuration("");
      setMessage("Session created successfully!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <h1>Create Study Session</h1>

      <form className="form" onSubmit={handleCreateSession}>
        <label>Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Central Library"
          required
        />

        <label>Date</label>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          required
        />

        <label>Time</label>
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          type="time"
          required
        />

        <label>Duration</label>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 2 hours"
          required
        />

        <button type="submit">Create Session</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchSessions() {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const sessionList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSessions(sessionList);
    setLoading(false);
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <main className="page">
      <h1>All Study Sessions</h1>
      {loading && <p>Loading sessions...</p>}
      {!loading && sessions.length === 0 && (
        <p>No study sessions created yet.</p>
      )}

      <div className="session-list">
        {sessions.map((session) => (
          <div className="card" key={session.id}>
            <h2>{session.location}</h2>
            <p><strong>Date:</strong> {session.date}</p>
            <p><strong>Time:</strong> {session.time}</p>
            <p><strong>Duration:</strong> {session.duration}</p>
            <p><strong>Created by:</strong> {session.createdBy}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/spaces"
          element={
            <ProtectedRoute>
              <StudySpaces />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-session"
          element={
            <ProtectedRoute>
              <CreateSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <AllSessions />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;