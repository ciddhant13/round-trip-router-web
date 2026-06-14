"use client";

import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export default function MapDisplay({ center, route, drawMode, onDirectionDrawn, onMapClick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineInstance = useRef(null);
  const markerInstance = useRef(null);
  
  const isDrawing = useRef(false);
  const drawingPolyline = useRef(null);
  const directionArrow = useRef(null);
  const drawingListeners = useRef([]);

  // Store click handler in a ref to avoid map recreation / listener ref issues
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize and Update Map Instance
  useEffect(() => {
    const initMap = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API Key missing");
        return;
      }

      setOptions({
        apiKey,
        version: "weekly",
      });

      const { Map } = await importLibrary("maps");
      const { Marker } = await importLibrary("marker");

      // Default center to Heidelberg, Germany if center is not yet loaded
      const defaultCenter = center || { lat: 49.41461, lng: 8.681495 };

      if (!mapInstance.current && mapRef.current) {
        mapInstance.current = new Map(mapRef.current, {
          center: defaultCenter,
          zoom: 14,
          mapId: 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
            { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
          ]
        });

        // Add map click listener to select a start location
        mapInstance.current.addListener('click', (e) => {
          if (onMapClickRef.current) {
            onMapClickRef.current({
              lat: e.latLng.lat(),
              lng: e.latLng.lng()
            });
          }
        });
      }

      // Update Center and Marker
      if (center && mapInstance.current) {
        mapInstance.current.setCenter(center);
        
        if (!markerInstance.current) {
          markerInstance.current = new Marker({
            position: center,
            map: mapInstance.current,
            title: "Start/End Point"
          });
        } else {
          markerInstance.current.setPosition(center);
        }
      }
    };

    initMap();
  }, [center]);

  // Handle Drawing Mode and Gesture Tracking
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing listeners
    drawingListeners.current.forEach(l => window.google.maps.event.removeListener(l));
    drawingListeners.current = [];

    // Clear any existing arrow
    if (directionArrow.current) {
      directionArrow.current.setMap(null);
      directionArrow.current = null;
    }

    if (!drawMode) {
      // Re-enable dragging if we're turning drawMode off
      mapInstance.current.setOptions({ draggable: true });
      return;
    }

    const Polyline = window.google.maps.Polyline;
    const SymbolPath = window.google.maps.SymbolPath;

    const onMouseDown = (e) => {
      // Check for right-click: e.domEvent.button === 2 or buttons === 2
      const isRightClick = e.domEvent && (e.domEvent.button === 2 || e.domEvent.buttons === 2);
      if (!isRightClick) return;

      isDrawing.current = true;
      mapInstance.current.setOptions({ draggable: false }); // Lock panning

      if (directionArrow.current) {
        directionArrow.current.setMap(null);
        directionArrow.current = null;
      }

      drawingPolyline.current = new Polyline({
        path: [e.latLng],
        geodesic: true,
        strokeColor: "#3b82f6", // Glowing blue streak
        strokeOpacity: 0.6,
        strokeWeight: 4,
        map: mapInstance.current
      });
    };

    const onMouseMove = (e) => {
      if (!isDrawing.current || !drawingPolyline.current) return;

      // Check if right-click button is still held down.
      // e.domEvent.buttons contains a bitmask. Bit 2 (value 2) is right-click.
      const isRightClickHeld = e.domEvent && (e.domEvent.buttons & 2) !== 0;

      if (!isRightClickHeld) {
        // If they released right click while moving, finalize the drawing
        onMouseUp();
        return;
      }

      const path = drawingPolyline.current.getPath();
      path.push(e.latLng);
    };

    const onMouseUp = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      mapInstance.current.setOptions({ draggable: true }); // Re-enable panning

      if (!drawingPolyline.current) return;

      const path = drawingPolyline.current.getPath();
      const points = path.getArray();

      drawingPolyline.current.setMap(null);
      drawingPolyline.current = null;

      if (points.length < 2) return;

      const startPoint = points[0];
      const endPoint = points[points.length - 1];

      const latA = startPoint.lat();
      const lngA = startPoint.lng();
      const latB = endPoint.lat();
      const lngB = endPoint.lng();

      const dy = latB - latA;
      const dx = (lngB - lngA) * Math.cos((latA * Math.PI) / 180);
      const angleRad = Math.atan2(dy, dx);

      // Draw a visual direction indicator vector
      directionArrow.current = new Polyline({
        path: [startPoint, endPoint],
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 1.0
          },
          offset: '100%'
        }],
        map: mapInstance.current
      });

      if (onDirectionDrawn) {
        onDirectionDrawn({
          angle: angleRad,
          startCoordinates: [lngA, latA]
        });
      }
    };

    // Prevent context menu to allow right-click dragging without browser menus
    const preventContextMenu = (event) => {
      event.preventDefault();
    };

    const mapDiv = mapInstance.current.getDiv();
    if (mapDiv) {
      mapDiv.addEventListener('contextmenu', preventContextMenu);
    }

    // Window level mouseup listener to ensure right click release is always caught
    const onWindowMouseUp = () => {
      if (isDrawing.current) {
        onMouseUp();
      }
    };
    window.addEventListener('mouseup', onWindowMouseUp);

    // Attach map event listeners
    drawingListeners.current = [
      mapInstance.current.addListener('mousedown', onMouseDown),
      mapInstance.current.addListener('mousemove', onMouseMove)
    ];

    return () => {
      drawingListeners.current.forEach(l => window.google.maps.event.removeListener(l));
      drawingListeners.current = [];
      if (mapDiv) {
        mapDiv.removeEventListener('contextmenu', preventContextMenu);
      }
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [drawMode, onDirectionDrawn]);

  // Handle Route Drawing
  useEffect(() => {
    const drawRoute = async () => {
      if (!mapInstance.current || !route) return;

      setOptions({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        version: "weekly",
      });
      
      const { Polyline } = await importLibrary("maps");

      const coords = route.features[0].geometry.coordinates.map(c => ({
        lat: c[1],
        lng: c[0]
      }));

      // Clear existing polyline
      if (polylineInstance.current) {
        polylineInstance.current.setMap(null);
      }

      polylineInstance.current = new Polyline({
        path: coords,
        geodesic: true,
        strokeColor: "#a855f7",
        strokeOpacity: 0.8,
        strokeWeight: 5,
        map: mapInstance.current
      });

      // Fit map bounds to show route
      const { LatLngBounds } = await importLibrary("core");
      const bounds = new LatLngBounds();
      coords.forEach(c => bounds.extend(c));
      mapInstance.current.fitBounds(bounds, { padding: 40 });
    };

    drawRoute();
  }, [route]);

  return (
    <div className="glass-panel" style={{ height: '500px', width: '100%', overflow: 'hidden', position: 'relative' }}>
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', zIndex: 10 }}>
          <p style={{ color: 'var(--error)' }}>Missing Google Maps API Key in .env.local</p>
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
