import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {createUserWithEmailAndPassword, sendEmailVerification, updateProfile} from "firebase/auth";
import {addDoc, collection, serverTimestamp} from "firebase/firestore";
import {auth, db} from "../firebase";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    // Previously disabled due to Firebase Auth glitches with school email
    // Appears to be working now so restored for MS1
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

export default Register;