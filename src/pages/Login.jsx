import {useState} from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {signInWithEmailAndPassword} from "firebase/auth";
import {auth} from "../firebase";
import {isValidNusEmail} from "../utils/authRules";

function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [showRegisterHint, setShowRegisterHint] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");
    setShowRegisterHint(false);

    const cleanedEmail = email.trim();

    if (!isValidNusEmail(cleanedEmail)) {
      setMessage("Please use your NUS email in the format e0123456@u.nus.edu.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanedEmail, password);

      if (!user.emailVerified) {
        await signOut(auth);
        setMessage("Please verify your email before logging in.");
        return;
      }

      navigate("/");
    } catch (error) {

      if (error.code === "auth/invalid-credential") {
        setShowRegisterHint(true);
        return;
      }

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

      {showRegisterHint && (
        <p className="message">
          Login failed. Check your password, or{" "}
          <Link to="/register" state={{email: email.trim()}}>
            register
          </Link>{" "}
          first if you are new to StudySync.
        </p>
      )}
    </main>
  );
}

export default Login;