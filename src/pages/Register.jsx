import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {createUserWithEmailAndPassword, sendEmailVerification, updateProfile} from "firebase/auth";
import {addDoc, collection, serverTimestamp} from "firebase/firestore";
import {auth, db} from "../firebase";
import {isValidNusEmail} from "../utils/authRules";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

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

      await addDoc(collection(db, "users"), {
        name,
        email: cleanedEmail,
        createdAt: serverTimestamp(),
      });

      setMessage("Account created. Please check your email for verification before logging in.");
      setTimeout(() => navigate("/login"), 2000);
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

export default Register;