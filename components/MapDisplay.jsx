"use client";

import { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';

export default function MapDisplay({ center, route, drawMode, onDirectionDrawn, onMapClick, directionAngle }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineInstance = useRef(null);
  const markerInstance = useRef(null);
  const gesturePolyline = useRef(null);   // live drawing line
  const arrowOverlay = useRef(null);      // unused — kept for future use

  const isDrawing = useRef(false);
  const gesturePoints = useRef([]);

  const [mapReady, setMapReady] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const isDrawModeRef = useRef(false);

  // Store callbacks in refs so effects don't need to re-run on every render
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  const onDirectionDrawnRef = useRef(onDirectionDrawn);
  useEffect(() => { onDirectionDrawnRef.current = onDirectionDrawn; }, [onDirectionDrawn]);

  // Keep draw mode ref in sync and disable map panning while active
  useEffect(() => {
    isDrawModeRef.current = isDrawMode;
    if (mapInstance.current) {
      if (isDrawMode) {
        mapInstance.current.dragging.disable();
      } else {
        mapInstance.current.dragging.enable();
      }
    }
  }, [isDrawMode]);

  // ── 1. Initialise Leaflet map once ────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    // Leaflet touches `window` on import — must be dynamic
    import('leaflet').then((L) => {
      // Fix default icon asset paths broken by webpack bundling
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const defaultCenter = { lat: 12.979693, lng: 77.590674 };
      const startCenter = center || defaultCenter;

      const map = L.map(mapRef.current, {
        center: [startCenter.lat, startCenter.lng],
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
        // Disable double-click zoom so it doesn't interfere with gesture drawing
        doubleClickZoom: false,
      });

      // CartoDB Dark Matter — free, no API key, dark base tiles.
      // A CSS filter is applied to the tile pane afterwards to lift road/label
      // contrast so the map doesn't look flat.
      const tileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }
      ).addTo(map);

      // Boost road/label visibility without blowing out the dark background
      tileLayer.on('load', () => {
        map.getPanes().tilePane.style.filter = 'brightness(2.0) contrast(1.1) saturate(1.3)';
      });

      // Map click → pick start location
      map.on('click', (e) => {
        if (onMapClickRef.current) {
          onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      mapInstance.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Pan map & update marker when center changes ─────────────────────────
  // NOTE: mapReady is included in deps to handle the race condition where
  // geolocation resolves before Leaflet finishes its async import/init.
  // Adding mapReady ensures this effect re-runs once the map is available.
  useEffect(() => {
    if (!mapInstance.current || !center) return;

    import('leaflet').then((L) => {
      mapInstance.current.setView([center.lat, center.lng], mapInstance.current.getZoom());

      if (!markerInstance.current) {
        markerInstance.current = L.marker([center.lat, center.lng])
          .addTo(mapInstance.current);
      } else {
        markerInstance.current.setLatLng([center.lat, center.lng]);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, mapReady]);

  // ── 3. Right-click drag gesture drawing ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    import('leaflet').then((L) => {
      const map = mapInstance.current;
      const container = map.getContainer();

      let touchTimeout = null;
      let touchStartLatLng = null;

      const finishDrawing = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        
        setIsDrawMode(false);
        map.dragging.enable();

        // Remove live drawing line immediately
        if (gesturePolyline.current) {
          map.removeLayer(gesturePolyline.current);
          gesturePolyline.current = null;
        }

        const pts = gesturePoints.current;
        gesturePoints.current = [];
        if (pts.length < 2) return;

        const start = pts[0];
        const end   = pts[pts.length - 1];

        const dy = end.lat - start.lat;
        const dx = (end.lng - start.lng) * Math.cos((start.lat * Math.PI) / 180);
        const angleRad = Math.atan2(dy, dx);

        // No persistent arrow on map — direction is shown via the UI compass pill
        if (onDirectionDrawnRef.current) {
          onDirectionDrawnRef.current({
            angle: angleRad,
            startCoordinates: [start.lng, start.lat],
          });
        }
      };

      const onMouseDown = (e) => {
        const isRightClick = e.originalEvent.button === 2;
        if (!isRightClick && !isDrawModeRef.current) return;
        
        e.originalEvent.preventDefault();
        isDrawing.current = true;
        gesturePoints.current = [e.latlng];
        map.dragging.disable();

        gesturePolyline.current = L.polyline(
          [[e.latlng.lat, e.latlng.lng]],
          { color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '6 4' }
        ).addTo(map);
      };

      const onMouseMove = (e) => {
        if (!isDrawing.current || !gesturePolyline.current) return;
        
        const isRightClickDrag = (e.originalEvent.buttons & 2) !== 0;
        const isLeftClickDrag = (e.originalEvent.buttons & 1) !== 0;
        
        if (!isRightClickDrag && !isLeftClickDrag) { 
          finishDrawing(); 
          return; 
        }

        gesturePoints.current.push(e.latlng);
        gesturePolyline.current.setLatLngs(
          gesturePoints.current.map(p => [p.lat, p.lng])
        );
      };

      const onMouseUp = (e) => {
        const isRightClick = e.originalEvent.button === 2;
        if (isRightClick || isDrawModeRef.current) {
          finishDrawing();
        }
      };

      const onDomTouchStart = (e) => {
        if (!isDrawModeRef.current) return;
        if (e.touches && e.touches.length !== 1) return;

        // Prevent browser gestures / zoom / pull-to-refresh
        e.preventDefault();

        const touch = e.touches[0];
        const latlng = map.mouseEventToLatLng(touch);
        if (!latlng) return;

        isDrawing.current = true;
        gesturePoints.current = [latlng];

        gesturePolyline.current = L.polyline(
          [[latlng.lat, latlng.lng]],
          { color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '6 4' }
        ).addTo(map);
      };

      const onDomTouchMove = (e) => {
        if (!isDrawing.current) return;
        if (e.touches && e.touches.length !== 1) return;

        e.preventDefault();
        e.stopPropagation();

        const touch = e.touches[0];
        const latlng = map.mouseEventToLatLng(touch);
        if (!latlng) return;

        gesturePoints.current.push(latlng);
        gesturePolyline.current.setLatLngs(
          gesturePoints.current.map(p => [p.lat, p.lng])
        );
      };

      const onDomTouchEnd = () => {
        if (isDrawing.current) {
          finishDrawing();
        }
      };

      const onDomTouchCancel = () => {
        if (isDrawing.current) {
          isDrawing.current = false;
          setIsDrawMode(false);
          map.dragging.enable();
          if (gesturePolyline.current) {
            map.removeLayer(gesturePolyline.current);
            gesturePolyline.current = null;
          }
          gesturePoints.current = [];
        }
      };

      // Window-level safety net for mouseup outside the map
      const onWindowMouseUp = () => { if (isDrawing.current) finishDrawing(); };

      // Suppress context menu on the map container
      const preventContextMenu = (e) => e.preventDefault();
      container.addEventListener('contextmenu', preventContextMenu);
      window.addEventListener('mouseup', onWindowMouseUp);

      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup',   onMouseUp);

      container.addEventListener('touchstart', onDomTouchStart, { passive: false });
      container.addEventListener('touchmove',  onDomTouchMove,  { passive: false });
      container.addEventListener('touchend',   onDomTouchEnd);
      container.addEventListener('touchcancel', onDomTouchCancel);

      return () => {
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup',   onMouseUp);
        container.removeEventListener('touchstart', onDomTouchStart);
        container.removeEventListener('touchmove',  onDomTouchMove);
        container.removeEventListener('touchend',   onDomTouchEnd);
        container.removeEventListener('touchcancel', onDomTouchCancel);
        container.removeEventListener('contextmenu', preventContextMenu);
        window.removeEventListener('mouseup', onWindowMouseUp);
        map.dragging.enable();
      };
    });
  }, [mapReady]);

  // ── 4. Clear direction arrow when directionAngle is reset ─────────────────
  useEffect(() => {
    if ((directionAngle === null || directionAngle === undefined) && mapInstance.current && arrowOverlay.current) {
      mapInstance.current.removeLayer(arrowOverlay.current);
      arrowOverlay.current = null;
    }
  }, [directionAngle]);

  // ── 5. Draw / update route polyline ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    import('leaflet').then((L) => {
      // Clear old polyline
      if (polylineInstance.current) {
        mapInstance.current.removeLayer(polylineInstance.current);
        polylineInstance.current = null;
      }

      if (!route) return;

      const latlngs = route.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      polylineInstance.current = L.polyline(latlngs, {
        color:   '#ff6600',
        weight:  5,
        opacity: 1.0,
      }).addTo(mapInstance.current);

      // Fit the map to the route bounds
      mapInstance.current.fitBounds(polylineInstance.current.getBounds(), { padding: [40, 40] });
    });
  }, [route, mapReady]);

  return (
    <>
      {/* Leaflet CSS — loaded once globally via a link tag */}
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { 
          background: #1a1d20; 
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        .leaflet-container * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        .leaflet-control-attribution {
          background: rgba(15, 17, 21, 0.75) !important;
          color: #6b7280 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #9ca3af !important; }
        .leaflet-control-zoom a {
          background: #1a1d24 !important;
          color: #9ca3af !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        .leaflet-control-zoom a:hover {
          background: #2d333f !important;
          color: #f8fafc !important;
        }
        @keyframes slow-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-slow {
          animation: slow-spin 6s linear infinite;
        }
      `}</style>

      <div
        className="glass-panel"
        style={{ height: '500px', width: '100%', overflow: 'hidden', position: 'relative' }}
      >
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Floating Draw Mode Action Button */}
        <button
          type="button"
          onClick={() => setIsDrawMode(!isDrawMode)}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.1rem',
            borderRadius: 'var(--radius-md)',
            background: isDrawMode ? '#ff6600' : 'var(--bg-secondary)',
            border: '1px solid ' + (isDrawMode ? '#ff6600' : 'rgba(255, 255, 255, 0.15)'),
            color: isDrawMode ? '#ffffff' : 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.2s ease',
            letterSpacing: '0.02em',
            userSelect: 'none',
          }}
          onMouseEnter={e => {
            if (!isDrawMode) {
              e.currentTarget.style.borderColor = '#ff6600';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={e => {
            if (!isDrawMode) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          <Compass 
            size={16} 
            className={isDrawMode ? "spin-slow" : ""} 
            style={{ 
              transition: 'transform 0.2s ease',
              color: isDrawMode ? '#ffffff' : 'inherit'
            }} 
          />
          {isDrawMode ? 'Draw Direction...' : 'Draw Direction'}
        </button>
      </div>
    </>
  );
}
