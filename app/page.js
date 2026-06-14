"use client";

import { useState, useEffect } from 'react';
import LocationForm from '@/components/LocationForm';
import MapDisplay from '@/components/MapDisplay';
import { Route as RouteIcon, Download } from 'lucide-react';

export default function Home() {
  const [center, setCenter] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [seed, setSeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [lastSubmission, setLastSubmission] = useState(null);

  // Lifted states for coords and location text to allow selection from map clicks
  const [coords, setCoords] = useState(null);
  const [locationText, setLocationText] = useState('');

  // Shared states for directional routing
  const [distance, setDistance] = useState(5);
  const [directionAngle, setDirectionAngle] = useState(null);

  // Default to current location on load or fallback to Vidhana Soudha, Bengaluru
  useEffect(() => {
    const fallbackCenter = { lat: 12.979693, lng: 77.590674 };
    const fallbackCoords = [77.590674, 12.979693];

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCenter({ lat, lng });
          setCoords([lng, lat]);
          setLocationText("Using current location");
        },
        (error) => {
          console.warn("Geolocation permission denied or error, falling back to Bengaluru Vidhana Soudha:", error);
          setCenter(fallbackCenter);
          setCoords(fallbackCoords);
          setLocationText("Bengaluru Vidhana Soudha");
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    } else {
      setCenter(fallbackCenter);
      setCoords(fallbackCoords);
      setLocationText("Bengaluru Vidhana Soudha");
    }
  }, []);

  // Center the map without generating routes (used when Draw Mode is active)
  const handleLocate = (data) => {
    setCenter({ lat: data.coordinates[1], lng: data.coordinates[0] });
    setCoords(data.coordinates);
    setLocationText("Using current location");
    setDirectionAngle(null); // Reset direction angle on new location selection
    setActiveRoute(null); // Clear previous route
    setGlobalError(null);
  };

  // Set coordinate and center when map is clicked
  const handleMapClick = ({ lat, lng }) => {
    const newCoords = [lng, lat];
    setCenter({ lat, lng });
    setCoords(newCoords);
    setLocationText("Selected from Map");
    setDirectionAngle(null); // Reset direction angle on new location selection
    setActiveRoute(null); // Clear previous route
    setGlobalError(null);
  };

  // Triggers route generation from map gesture.
  // Deliberately ignores startCoordinates — the gesture angle is all that matters.
  // The route always starts from the already-placed marker (coords state).
  const handleDirectionDrawn = ({ angle }) => {
    setDirectionAngle(angle);
    handleGenerateRoutes({
      coordinates: coords,
      distanceKm: distance,
      directionAngle: angle
    });
  };

  const handleGenerateRoutes = async (data) => {
    setIsGenerating(true);
    setGlobalError(null);

    // If directionAngle is not provided in data, use the stateful directionAngle
    const finalAngle = data.directionAngle !== undefined ? data.directionAngle : directionAngle;

    const requestData = {
      ...data,
      directionAngle: finalAngle !== null ? finalAngle : undefined
    };

    // Detect if the user changed the location coordinates, target distance, or direction
    const isNewRequest = !lastSubmission ||
      lastSubmission.coordinates[0] !== requestData.coordinates[0] ||
      lastSubmission.coordinates[1] !== requestData.coordinates[1] ||
      lastSubmission.distanceKm !== requestData.distanceKm ||
      lastSubmission.directionAngle !== requestData.directionAngle;

    let targetSeed = seed;
    if (isNewRequest) {
      targetSeed = 1;
      setSeed(1);
    } else {
      targetSeed = seed + 1;
      setSeed(seed + 1);
    }

    setLastSubmission(requestData);
    setCenter({ lat: requestData.coordinates[1], lng: requestData.coordinates[0] });

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestData,
          seed: targetSeed
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate route');
      }

      const result = await res.json();

      if (result.route) {
        setActiveRoute(result.route);
      } else {
        setGlobalError("No route could be generated for this location and distance.");
        setActiveRoute(null);
      }
    } catch (err) {
      setGlobalError(err.message || "An unexpected error occurred.");
      setActiveRoute(null);
    } finally {
      setIsGenerating(false);
    }
  };

  // Export the active route as a GPX file
  const handleExportGPX = () => {
    if (!activeRoute) return;

    const coords = activeRoute.features[0].geometry.coordinates;
    const distanceKm = (activeRoute.features[0].properties.summary.distance / 1000).toFixed(2);
    const now = new Date().toISOString();

    const trkpts = coords
      .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"><ele>0</ele></trkpt>`)
      .join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Round Trip Router" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Round Trip Route – ${distanceKm} km</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>Round Trip Route – ${distanceKm} km</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `round-trip-route-${distanceKm}km.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        <header className="animate-fade-in" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-full)', marginBottom: '1rem', boxShadow: 'var(--shadow-md)' }}>
            <RouteIcon size={32} className="text-gradient" />
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Circular <span className="text-gradient">Routes</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
            Right-click & drag on the map (or use the "Draw Direction" button) to set your route's heading.
          </p>
        </header>

        {globalError && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: 'var(--error)', marginBottom: '2rem', textAlign: 'center' }}>
            {globalError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>

          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <LocationForm
              onSubmit={handleGenerateRoutes}
              onLocate={handleLocate}
              isGenerating={isGenerating}
              hasActiveRoute={!!activeRoute}
              distance={distance}
              setDistance={setDistance}
              coords={coords}
              setCoords={setCoords}
              locationText={locationText}
              setLocationText={setLocationText}
              setDirectionAngle={setDirectionAngle}
              actualDistance={activeRoute ? (activeRoute.features[0].properties.summary.distance / 1000).toFixed(2) : null}
              directionAngle={directionAngle}
              onExportGPX={handleExportGPX}
            />
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <MapDisplay
              center={center}
              route={activeRoute}
              drawMode={true}
              onDirectionDrawn={handleDirectionDrawn}
              onMapClick={handleMapClick}
              directionAngle={directionAngle}
            />
          </div>

        </div>

        <footer style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.5 }}>
          v1.3.0
        </footer>
      </div>
    </main>
  );
}
