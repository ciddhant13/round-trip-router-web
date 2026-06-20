# Changelog

All notable changes to this project will be documented in this file.

## [1.3.2] - 2026-06-20
### Added
- **Route Direction Markers**: Render white chevrons pointing in the travel direction along the route path (spaced at 1 km intervals) with a dark background moat masking the route line underneath.

### Changed
- **More Compact Title Layout**: Merged the main "Circular Routes" title and explanation directly into the route settings card, and removed the standalone page header.
- **Route Line Style**: Made the route polyline slightly thinner (weight 3.5) for a cleaner map appearance.

---

## [1.3.1] - 2026-06-14
### Fixed
- **Native DOM Touch Event Bindings**: Shifted touchstart, touchmove, touchend, and touchcancel listeners from Leaflet's map object directly to the map's native DOM container. This ensures touch events fire reliably even when Leaflet's map dragging is disabled (which normally disables Leaflet's internal touch-to-mouse translation system).
- **Viewport Scroll Prevention**: Bound DOM touch events using `{ passive: false }` to guarantee that browser scrolling is completely blocked during the swipe gesture.

---

## [1.3.0] - 2026-06-14
### Added
- **Draw Direction FAB Button**: Overlaid a floating button (`Compass` icon) on the map. Tapping this button locks map dragging instantly, letting mobile and trackpad users swipe a single finger/drag a mouse anywhere to draw the route direction streak.
- **Auto-reset State**: Drawing completes upon finger lift, resetting map dragging and turning off Draw Mode automatically.
- **Custom CSS Animation**: Added slow rotation animation for the compass icon while drawing mode is active.

---

## [1.2.2] - 2026-06-14
### Fixed
- **Active Drag Release**: Forced Leaflet's underlying `L.Draggable` state machine to terminate active touch dragging on long press (`_draggable._onUp()`).
- **Touch Event Propagation**: Blocked gesture touch move events from bubbling to Leaflet map panning by calling `stopPropagation()`.
- **Drift Threshold**: Relaxed drift tolerance to `40px` to ignore natural finger contact expansions during initial touch-hold.

---

## [1.2.1] - 2026-06-14
### Fixed
- **Mobile Touch Coordinates**: Added a coordinate fallback (`mouseEventToLatLng`) to resolve undefined `e.latlng` on touch events.
- **Selection Suppression**: Applied global CSS `user-select: none` and `-webkit-touch-callout: none` to the map container to prevent selection highlighting (e.g. magnifying glass/zoom text selection) during long press gestures.
- **Gesture Drift Tolerance**: Raised touch start drift tolerance from 15px to 25px to accommodate natural finger shaking on press-and-hold.

---

## [1.2.0] - 2026-06-14
### Added
- **Mobile Gesture Support**: Added a 500ms long-press detector to draw circular route directions on mobile touch screens.
- **Haptic Feedback**: Trigger minor vibration haptic (50ms) on mobile devices when long-press successfully locks the map into drawing mode.
- **Version Number**: Added a minimal version footer in the UI to track active deployments.

---

## [1.1.0] - 2026-06-14
### Changed
- **Brighter Dark Mode Map**: Increased CartoDB Dark Matter tile brightness filter to `brightness(2.0) contrast(1.1) saturate(1.3)` for clearer road and label visibility.
- **Inline GPX Button**: Integrated GPX export directly inline with the main "Generate Route" CTA, with smooth `max-width` and `margin-left` transitions that slide open when a route is active and collapse out when cleared.
- **Auto-expansion of CTA**: Allowed main route button to stretch full-width when GPX export is not active.
- **Layout Alignments**: Set `line-height: normal` on `.input-field` so the target input height matches the actual distance block exactly.

### Fixed
- **Geolocation Race Condition**: Resolved issue where map failed to pan to user location on load.
- **Streak Center Shift Bug**: Ensured drawing a direction streak doesn't shift the starting coordinate of the route (direction calculations now use the fixed marker coordinates).
- **Cleanup Ref Overlay**: Removed stale arrow/polyline overlay DOM references from mouse-up handlers.

---

## [1.0.0] - 2026-06-14
### Changed
- **Leaflet Migration**: Replaced Google Maps API with Leaflet.js and OpenRouteService, eliminating Google billing requirements.
- **Export GPX**: Introduced client-side GPX 1.1 file generation and download capabilities.
