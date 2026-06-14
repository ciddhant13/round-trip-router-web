"use client";

import { useEffect, useRef, useState } from 'react';

export default function MapDisplay({ center, route, drawMode, onDirectionDrawn, onMapClick, directionAngle }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineInstance = useRef(null);
  const markerInstance = useRef(null);
  const gesturePolyline = useRef(null);   // live drawing line
  const arrowOverlay = useRef(null);      // direction vector after release

  const isDrawing = useRef(false);
  const gesturePoints = useRef([]);

  const [mapReady, setMapReady] = useState(false);

  // Store callbacks in refs so effects don't need to re-run on every render
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  const onDirectionDrawnRef = useRef(onDirectionDrawn);
  useEffect(() => { onDirectionDrawnRef.current = onDirectionDrawn; }, [onDirectionDrawn]);

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

      // CartoDB Dark Matter — completely free, no API key
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }
      ).addTo(map);

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
  }, [center]);

  // ── 3. Right-click drag gesture drawing ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    import('leaflet').then((L) => {
      const map = mapInstance.current;
      const container = map.getContainer();

      const finishDrawing = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        map.dragging.enable();

        // Remove live drawing line
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

        // Draw persistent direction arrow overlay
        if (arrowOverlay.current) {
          map.removeLayer(arrowOverlay.current);
          arrowOverlay.current = null;
        }
        arrowOverlay.current = L.polyline(
          [[start.lat, start.lng], [end.lat, end.lng]],
          { color: '#3b82f6', weight: 3, opacity: 0.8 }
        ).addTo(map);

        if (onDirectionDrawnRef.current) {
          onDirectionDrawnRef.current({
            angle: angleRad,
            startCoordinates: [start.lng, start.lat],
          });
        }
      };

      const onMouseDown = (e) => {
        if (e.originalEvent.button !== 2) return; // right-click only
        e.originalEvent.preventDefault();
        isDrawing.current = true;
        gesturePoints.current = [e.latlng];
        map.dragging.disable();

        // Clear previous arrow
        if (arrowOverlay.current) {
          map.removeLayer(arrowOverlay.current);
          arrowOverlay.current = null;
        }

        gesturePolyline.current = L.polyline(
          [[e.latlng.lat, e.latlng.lng]],
          { color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '6 4' }
        ).addTo(map);
      };

      const onMouseMove = (e) => {
        if (!isDrawing.current || !gesturePolyline.current) return;
        // If right button released mid-move (bitmask bit 2)
        if ((e.originalEvent.buttons & 2) === 0) { finishDrawing(); return; }
        gesturePoints.current.push(e.latlng);
        gesturePolyline.current.setLatLngs(
          gesturePoints.current.map(p => [p.lat, p.lng])
        );
      };

      const onMouseUp = (e) => {
        if (e.originalEvent.button !== 2) return;
        finishDrawing();
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

      return () => {
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup',   onMouseUp);
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
        .leaflet-container { background: #1a1d20; }
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
      `}</style>

      <div
        className="glass-panel"
        style={{ height: '500px', width: '100%', overflow: 'hidden', position: 'relative' }}
      >
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  );
}
