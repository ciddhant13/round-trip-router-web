"use client";

import { useState } from 'react';
import LocationForm from '@/components/LocationForm';
import MapDisplay from '@/components/MapDisplay';
import { Route as RouteIcon, Compass } from 'lucide-react';

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

  // Triggers route generation from map gesture
  const handleDirectionDrawn = ({ angle, startCoordinates }) => {
    setDirectionAngle(angle); // Store direction angle state
    handleGenerateRoutes({
      coordinates: startCoordinates,
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
            Discover unique, non-overlapping running loops tailored to your distance and starting location.
          </p>
        </header>

        {globalError && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: 'var(--error)', marginBottom: '2rem', textAlign: 'center' }}>
            {globalError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          
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
            />

            {activeRoute && (
              <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Compass style={{ color: 'var(--accent-primary)' }} /> Route Details
                </h3>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Actual Route Distance</span>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {(activeRoute.features[0].properties.summary.distance / 1000).toFixed(2)} km
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <span>Shape: {activeRoute.metadata?.directionAngle !== undefined ? '3 points (Triangle)' : '6 points (Hexagon)'}</span>
                  <span>Variation seed: {activeRoute.metadata?.seed || seed}</span>
                </div>
              </div>
            )}

            {!activeRoute && center && (
              <div className="glass-panel animate-fade-in" style={{ padding: '1rem', marginTop: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px dashed var(--accent-primary)', color: 'white', textAlign: 'center', fontSize: '0.875rem' }}>
                ✨ <strong>Draw a Direction (Optional)</strong>: Right-click and drag your mouse on the map starting from your marker to specify your running direction! Or just click "Generate Route" to create a standard circular route.
              </div>
            )}
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '200ms', position: 'sticky', top: '2rem' }}>
            <MapDisplay 
              center={center} 
              route={activeRoute} 
              drawMode={true}
              onDirectionDrawn={handleDirectionDrawn}
              onMapClick={handleMapClick}
            />
          </div>

        </div>
      </div>
    </main>
  );
}
