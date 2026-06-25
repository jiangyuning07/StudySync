import {useState} from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {createUserWithEmailAndPassword, sendEmailVerification, updateProfile} from "firebase/auth";
import {doc, addDoc, setDoc, collection, serverTimestamp} from "firebase/firestore";
import {auth, db} from "../utils/firebase";
import {isValidNusEmail} from "../utils/authRules";

function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [showLoginHint, setShowLoginHint] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");
    setShowLoginHint(false);

    const cleanedEmail = email.trim();

    if (!isValidNusEmail(cleanedEmail)) {
      setMessage("Please use your NUS email in the format e0123456@u.nus.edu.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanedEmail, password);

      await updateProfile(userCredential.user, {
        displayName: name,
      });

      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        email: cleanedEmail,
        createdAt: serverTimestamp(),
      });

      setMessage("Account created. Please check your email for verification before logging in.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (error) {

      if (error.code === "auth/email-already-in-use") {
        setShowLoginHint(true);
        return;
      }

      if (error.code === "auth/weak-password") {
        setMessage("Password should be at least 6 characters.");
        return;
      }

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

      {showLoginHint && (
        <p className="message">
          This email is already registered. Please{" "}
          <Link to="/login" state={{email: email.trim()}}>
            log in
          </Link>{" "}
          instead.
        </p>
      )}
    </main>
  );
}

export default Register;