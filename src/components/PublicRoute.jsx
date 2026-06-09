import {Navigate} from "react-router-dom";
import {useAuth} from "../AuthContext";
import {isFullyVerifiedNusUser} from "../utils/authRules";

export default function PublicRoute({children}) {
  const {currentUser} = useAuth();

  if (isFullyVerifiedNusUser(currentUser)) {
    return <Navigate to="/" replace />;
  }

  return children;
}