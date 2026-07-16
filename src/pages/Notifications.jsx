import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {db} from "../utils/firebase";
import {useAuth} from "../AuthContext";

function toMillis(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
  if (typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
  return 0;
}

function formatTimestamp(createdAt) {
  const millis = toMillis(createdAt);
  if (!millis) return "Just now";
  return new Date(millis).toLocaleString();
}

function Notifications() {
  const {currentUser} = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!currentUser) return undefined;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Newest first. Sorted on the client so no composite index is needed.
        items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        setMessage(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.read === false).length,
    [notifications]
  );

  async function markAsRead(notificationId) {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {read: true});
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((item) => item.read === false);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((item) => {
        batch.update(doc(db, "notifications", item.id), {read: true});
      });
      await batch.commit();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleOpen(notification) {
    if (notification.read === false) {
      markAsRead(notification.id);
    }
    if (notification.sessionId) {
      navigate(`/sessions/${notification.sessionId}`);
    }
  }

  return (
    <main className="page">
      <div className="notifications-header">
        <h1>Notifications</h1>

        {unreadCount > 0 && (
          <button
            type="button"
            className="session-action-button secondary-button"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading && <p>Loading notifications...</p>}

      {!loading && notifications.length === 0 && (
        <p>You have no notifications yet.</p>
      )}

      {!loading && notifications.length > 0 && (
        <ul className="notification-list">
          {notifications.map((notification) => {
            const isUnread = notification.read === false;

            return (
              <li
                key={notification.id}
                className={`notification-item ${isUnread ? "unread" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => handleOpen(notification)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleOpen(notification);
                  }
                }}
              >
                <div className="notification-content">
                  {isUnread && (
                    <span
                      className="notification-dot"
                      aria-label="Unread"
                    />
                  )}
                  <div>
                    <p className="notification-message">{notification.message}</p>
                    <small className="notification-time">
                      {formatTimestamp(notification.createdAt)}
                    </small>
                  </div>
                </div>

                {isUnread && (
                  <button
                    type="button"
                    className="mark-read-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                  >
                    Mark as read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default Notifications;
