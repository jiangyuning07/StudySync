import {useEffect, useState} from "react";
import {GoogleMap, Marker, InfoWindow, useLoadScript} from "@react-google-maps/api";
import {collection, getDocs, orderBy, query} from "firebase/firestore";
import {db} from "../utils/firebase";

function StudySpaces() {
  const [studySpaces, setStudySpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [message, setMessage] = useState("");
  const {isLoaded} = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    async function fetchStudySpaces() {
      try {
        const q = query(collection(db, "studySpaces"), orderBy("name"));
        const snapshot = await getDocs(q);
        const spaces = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStudySpaces(spaces);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoadingSpaces(false);
      }
    }
    fetchStudySpaces();
  }, []);

  return (
    <main className="page">
      <h1>Study Space Directory</h1>
      <p>Click a pin to view the study space details.</p>

      {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <p className="warning">
          Google Maps API key missing from .env file.
        </p>
      )}

      {message && <p className="message">{message}</p>}

      {loadingSpaces ? (
        <p>Loading study spaces...</p>
      ) : isLoaded ? (
        <div className="map-container">
          <GoogleMap
            zoom={15}
            center={{lat: 1.29733, lng: 103.77665}}
            mapContainerClassName="map"
          >
            {studySpaces.map((space) => (
              <Marker
                key={space.id}
                position={{lat: space.location.lat, lng: space.location.lng}}
                onClick={() => setSelectedSpace(space)}
              />
            ))}
            {selectedSpace && (
              <InfoWindow
                position={{
                  lat: selectedSpace.location.lat,
                  lng: selectedSpace.location.lng,
                }}
                onCloseClick={() => setSelectedSpace(null)}
              >
                <div>
                  <strong>{selectedSpace.name}</strong>
                  <p>{selectedSpace.address}</p>
                  <p>{selectedSpace.openingHours}</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      ) : (
        <p>Loading map...</p>
      )}

      <section className="study-spaces-section">
        <h2>Study Spaces</h2>

        {studySpaces.length === 0 && !loadingSpaces && (
          <p>No study spaces found.</p>
        )}

        <div className="study-space-grid">
          {studySpaces.map((space) => (
            <article key={space.id} className="card study-space-card">
              <h3>{space.name}</h3>
              <p><strong>Address:</strong> {space.address}</p>
              <p><strong>Opening Hours:</strong> {space.openingHours}</p>
              <p><strong>Indoor:</strong> {space.indoor ? "Yes" : "No"}</p>
              <p><strong>Wifi:</strong> {space.wifi ? "Yes" : "No"}</p>
              <p><strong>Power Outlets:</strong> {space.powerOutlets ? "Yes" : "No"}</p>
              <p><strong>Study Mode:</strong> {space.studyMode}</p>
            </article>
          ))}
        </div>

      </section>
    </main>
  );
}

export default StudySpaces;