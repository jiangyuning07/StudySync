import {Navigate} from "react-router-dom";
import {useAuth} from "../AuthContext";

export default function ProtectedRoute({children}) {
  const {currentUser, canAccessApp} = useAuth();

  if (!canAccessApp) {
    return (
      <Navigate
        to="/login"
        replace
        state={
          currentUser
            ? {message: "Please log in with a verified NUS email before accessing StudySync."}
            : undefined
        }
      />
    );
  }

  return children;
}