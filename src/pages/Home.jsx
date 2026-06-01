import {Link} from "react-router-dom";
import {useAuth} from "../AuthContext";

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

export default Home;