import {useState} from "react";
import {GoogleMap, Marker, InfoWindow, useLoadScript} from "@react-google-maps/api";
import {sampleStudySpaces} from "../data/sampleStudySpaces";

function StudySpaces() {
  const [selectedSpace, setSelectedSpace] = useState(null);
  const {isLoaded} = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  return (
    <main className="page">
      <h1>Study Space Directory</h1>
      <p>Click a pin to view the study space name.</p>

      {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
        <p className="warning">
          Google Maps API key missing from .env file.
        </p>
      )}

      {isLoaded ? (
        <div className="map-container">
          <GoogleMap
            zoom={15}
            center={{lat: 1.29733, lng: 103.77665}}
            mapContainerClassName="map"
          >
            {sampleStudySpaces.map((space) => (
              <Marker
                key={space.id}
                position={{lat: space.lat, lng: space.lng}}
                onClick={() => setSelectedSpace(space)}
              />
            ))}
            {selectedSpace && (
              <InfoWindow
                position={{
                  lat: selectedSpace.lat,
                  lng: selectedSpace.lng,
                }}
                onCloseClick={() => setSelectedSpace(null)}
              >
                <div>
                  <strong>{selectedSpace.name}</strong>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      ) : (
        <p>Loading map...</p>
      )}

      <section className="card">
        <h2>Sample Study Spaces</h2>
        {sampleStudySpaces.map((space) => (
          <p key={space.id}>{space.name}</p>
        ))}
      </section>
    </main>
  );
}

export default StudySpaces;