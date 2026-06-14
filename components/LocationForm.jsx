"use client";

import { useState } from 'react';
import { MapPin, Navigation, Route as RouteIcon, Loader2, RefreshCw, X } from 'lucide-react';

export default function LocationForm({ 
  onSubmit, 
  onLocate, 
  isGenerating, 
  hasActiveRoute, 
  distance, 
  setDistance,
  coords,
  setCoords,
  locationText,
  setLocationText,
  setDirectionAngle,
  actualDistance,
  directionAngle
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState(null);
  const [isCompassHovered, setIsCompassHovered] = useState(false);

  const handleClearDirection = () => {
    if (setDirectionAngle) setDirectionAngle(null);
  };

  // States to track dynamic button CTA text
  const [lastSubmittedText, setLastSubmittedText] = useState('');
  const [lastSubmittedDistance, setLastSubmittedDistance] = useState(5);

  const isInputChanged = locationText !== lastSubmittedText || distance !== lastSubmittedDistance;
  const showTryAnother = hasActiveRoute && !isInputChanged;

  const handleUseLocation = () => {
    setError(null);
    setIsLocating(true);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lon = position.coords.longitude;
        const lat = position.coords.latitude;
        setCoords([lon, lat]);
        setLocationText("Using current location");
        
        // ONLY locate and center map, do NOT automatically submit a route request
        onLocate({ coordinates: [lon, lat] });
      },
      (err) => {
        setIsLocating(false);
        console.error("Geolocation Error: ", err);
        setError(`Failed to get location (${err.message}). Try entering an address manually.`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!locationText.trim()) return;
    
    setError(null);
    
    // If we already have coordinates from Geolocation or Map Click, skip geocoding
    if (coords) {
      setLastSubmittedText(locationText);
      setLastSubmittedDistance(distance);
      onSubmit({
        coordinates: coords,
        distanceKm: distance,
        points: 6
      });
      return;
    }
    
    setIsLocating(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const { lon, lat } = data[0];
        const newCoords = [parseFloat(lon), parseFloat(lat)];
        setCoords(newCoords);
        
        setLastSubmittedText(locationText);
        setLastSubmittedDistance(distance);
        onSubmit({
          coordinates: newCoords,
          distanceKm: distance,
          points: 6
        });
      } else {
        setError("Location not found. Try being more specific.");
      }
    } catch (err) {
      setError("Error finding location.");
    } finally {
      setIsLocating(false);
    }
  };

  const getCardinalDirection = (angleRad) => {
    if (angleRad === null || angleRad === undefined) return '';
    const degrees = (90 - (angleRad * 180 / Math.PI) + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 600, 
        marginBottom: '1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RouteIcon className="text-gradient" /> Route Settings
        </div>
        
        {/* Sleek cardinal direction pill with smart hover reset */}
        {directionAngle !== null && directionAngle !== undefined && (
          <button
            type="button"
            onClick={handleClearDirection}
            onMouseEnter={() => setIsCompassHovered(true)}
            onMouseLeave={() => setIsCompassHovered(false)}
            title="Clear preferred direction"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              background: 'transparent',
              border: isCompassHovered ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 102, 0, 0.5)',
              color: isCompassHovered ? 'var(--error)' : '#ff6600',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              outline: 'none',
              flexShrink: 0
            }}
          >
            {isCompassHovered ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>Reset</span>
                <X size={12} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <svg 
                  viewBox="0 0 24 24" 
                  strokeWidth="2.5" 
                  stroke="#ff6600" 
                  fill="none" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  style={{ 
                    width: '14px', 
                    height: '14px', 
                    transform: `rotate(${90 - (directionAngle * 180 / Math.PI)}deg)`,
                    transition: 'transform 0.4s ease',
                    pointerEvents: 'none'
                  }}
                >
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <polyline points="5 11 12 4 19 11" />
                </svg>
                <span>{getCardinalDirection(directionAngle)}</span>
              </div>
            )}
          </button>
        )}
      </h2>
      
      {error && (
        <div style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Starting Point</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter a city, street, or landmark" 
              value={locationText}
              onChange={(e) => {
                setLocationText(e.target.value);
                setCoords(null); // Clear coordinates since manual text changed
                if (setDirectionAngle) setDirectionAngle(null); // Reset direction angle
              }}
              disabled={isLocating || isGenerating}
            />
            <button 
              type="button" 
              onClick={handleUseLocation}
              disabled={isLocating || isGenerating}
              className="button-primary"
              style={{ padding: '0.75rem', minWidth: '48px', background: 'var(--bg-secondary)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)' }}
              title="Use My Location"
            >
              {isLocating ? <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Navigation size={20} />}
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', gap: actualDistance ? '1rem' : '0px', transition: 'all 0.3s ease' }}>
            {/* Target Distance Column */}
            <div style={{ flex: 1, width: actualDistance ? '50%' : '100%', minWidth: 0, transition: 'all 0.3s ease' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Target Distance (km)</label>
              <input 
                type="number" 
                className="input-field" 
                min="1" 
                max="50" 
                step="0.1"
                value={distance}
                onChange={(e) => setDistance(parseFloat(e.target.value))}
                disabled={isGenerating}
              />
            </div>
            
            {/* Actual Distance Column */}
            <div style={{ 
              width: actualDistance ? '50%' : '0%', 
              opacity: actualDistance ? 1 : 0, 
              overflow: 'hidden', 
              minWidth: 0,
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap'
            }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ff6600', fontSize: '0.875rem', fontWeight: 600 }}>Actual Distance (km)</label>
              <div className="input-field" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 700, 
                color: '#0f1115', 
                borderColor: '#ff6600',
                background: '#ff6600',
                fontSize: '1.125rem'
              }}>
                {actualDistance}
              </div>
            </div>
          </div>
        </div>

        {/* Points selector removed from UI, hardcoded to 6 (Hexagon) for optimal circular routes */}


        <button 
          type="submit" 
          className="button-primary" 
          disabled={!locationText.trim() || isLocating || isGenerating}
          style={{ 
            marginTop: '0.5rem',
            background: showTryAnother ? 'rgba(99, 102, 241, 0.2)' : undefined,
            color: showTryAnother ? 'white' : undefined,
            border: showTryAnother ? '1px solid var(--accent-primary)' : undefined,
            boxShadow: showTryAnother ? 'var(--shadow-glow)' : undefined
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              {showTryAnother ? 'Finding Another Route...' : 'Generating Route...'}
            </>
          ) : showTryAnother ? (
            <>
              <RefreshCw size={20} />
              Try Another Route
            </>
          ) : (
            <>
              <MapPin size={20} />
              Generate Route
            </>
          )}
        </button>
      </form>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
