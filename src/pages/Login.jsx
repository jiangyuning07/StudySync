import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {signInWithEmailAndPassword} from "firebase/auth";
import {auth} from "../firebase";

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

export default Login;