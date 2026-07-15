import {Link} from "react-router-dom";
import {useEffect, useState} from "react";
import {collection, onSnapshot, query, where} from "firebase/firestore";
import {db} from "../utils/firebase";

function NotificationBell({currentUser}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // The bell only renders for a signed-in user, but guard anyway.
    if (!currentUser) return undefined;

    // Filter by userId only and count unread on the client. This keeps the
    // query to a single equality filter, so it works without any custom
    // Firestore index during the demo.
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const unread = snapshot.docs.filter(
          (docSnap) => docSnap.data().read === false
        ).length;
        setUnreadCount(unread);
      },
      (error) => {
        console.error("Notification listener failed:", error);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const label =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : "Notifications";

  return (
    <Link to="/notifications" className="notification-bell" aria-label={label}>
      <svg
        className="notification-bell-icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {unreadCount > 0 && (
        <span className="notification-badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;
