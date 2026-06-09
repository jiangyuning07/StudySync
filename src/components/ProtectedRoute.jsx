import {Navigate} from "react-router-dom";
import {useAuth} from "../AuthContext";
import {isValidNusEmail} from "../utils/authRules";

export default function ProtectedRoute({children}) {
  const {currentUser} = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isValidNusEmail(currentUser.email)) {
    return (
      <main className="page">
        <h1>Access Restricted</h1>
        <p className="message">Please use your NUS email ending with @u.nus.edu.</p>
      </main>
    );
  }

  if (!currentUser.emailVerified) {
    return (
      <main className="page">
        <h1>Email Verification Required</h1>
        <p className="message">
          Please verify your NUS email before accessing StudySync.
        </p>
      </main>
    );
  }

  return children;
}