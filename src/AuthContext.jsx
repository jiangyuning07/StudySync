import {createContext, useContext, useEffect, useState} from "react";
import {auth} from "./utils/firebase";
import {onAuthStateChanged, signOut} from "firebase/auth";
import {isFullyVerifiedNusUser} from "./utils/authRules";

const AuthContext = createContext();

export function AuthProvider({children}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function logout() {
    await signOut(auth);
  }

  const canAccessApp = isFullyVerifiedNusUser(currentUser);

  const value = {
    currentUser,
    canAccessApp,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}