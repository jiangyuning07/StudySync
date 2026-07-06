import {useAuth} from "../AuthContext";

function Home() {
  const {currentUser} = useAuth();

  return (
    <main className="page">
      <h1>StudySync</h1>
      <p>
        Find suitable study spaces and coordinate study sessions with other NUS students.
      </p>

      <div className="card">
        <h2>Welcome to StudySync!</h2>
        <p>You are logged in as {currentUser.email}.</p>
      </div>
    </main>
  );
}

export default Home;