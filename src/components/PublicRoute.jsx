import {Navigate} from "react-router-dom";
import {useAuth} from "../AuthContext";

export default function PublicRoute({children}) {
  const {canAccessApp} = useAuth();

  if (canAccessApp) {
    return <Navigate to="/" replace />;
  }

  return children;
}