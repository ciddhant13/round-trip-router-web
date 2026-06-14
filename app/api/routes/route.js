import { NextResponse } from 'next/server';

const ORS_ENDPOINT = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

// Helper function to calculate directional triangle waypoints
function calculateTriangleWaypoints(startLng, startLat, targetLength, angleRad, seed = 1) {
  const R = 6378137; // Earth's radius in meters
  const lat0Rad = (startLat * Math.PI) / 180;
  
  // Base leg distance is targetLength / 3
  const baseD = targetLength / 3;
  
  // Pseudo-random variations based on seed
  // We use sine/cosine with distinct multipliers to get pseudo-random variations
  const angleVar1 = (Math.sin(seed * 17.3) * 8 * Math.PI) / 180; // +/- 8 degrees variation
  const angleVar2 = (Math.cos(seed * 23.7) * 8 * Math.PI) / 180; // +/- 8 degrees variation
  
  const lengthRatio = 1.0 + Math.sin(seed * 31.1) * 0.12; // +/- 12% length ratio shift
  const d1 = baseD * lengthRatio;
  const d2 = baseD * (2.0 - lengthRatio); // Keep total loop size scaling balanced
  
  // Angle offsets for P1 (+30 degrees + var1) and P2 (-30 degrees + var2) to form a triangle
  const alpha1 = angleRad + Math.PI / 6 + angleVar1;
  const alpha2 = angleRad - Math.PI / 6 + angleVar2;

  // Waypoint 1 (WNW direction from angle)
  const dLat1 = (d1 * Math.sin(alpha1) / R) * (180 / Math.PI);
  const dLng1 = (d1 * Math.cos(alpha1) / (R * Math.cos(lat0Rad))) * (180 / Math.PI);
  const wp1 = [startLng + dLng1, startLat + dLat1];

  // Waypoint 2 (WSW direction from angle)
  const dLat2 = (d2 * Math.sin(alpha2) / R) * (180 / Math.PI);
  const dLng2 = (d2 * Math.cos(alpha2) / (R * Math.cos(lat0Rad))) * (180 / Math.PI);
  const wp2 = [startLng + dLng2, startLat + dLat2];

  return [wp1, wp2];
}

// Helper function to fetch a route from OpenRouteService
async function fetchRoute(coordinates, targetLength, points, seed, scale, apiKey, directionAngle) {
  let payload;

  if (directionAngle !== undefined) {
    const startLng = coordinates[0];
    const startLat = coordinates[1];
    const [wp1, wp2] = calculateTriangleWaypoints(startLng, startLat, targetLength, parseFloat(directionAngle), parseInt(seed || 1));
    
    // Standard directions request with 4 coordinates forming a closed loop (Start -> P1 -> P2 -> Start)
    payload = {
      coordinates: [
        coordinates,
        wp1,
        wp2,
        coordinates
      ]
    };
  } else {
    // Experimental round-trip request with single coordinate pair and options
    payload = {
      coordinates: [coordinates],
      options: {
        round_trip: {
          length: targetLength,
          points: points,
          seed: seed
        }
      }
    };
  }

  try {
    const res = await fetch(ORS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error(`ORS API error for seed ${seed}, scale ${scale.toFixed(3)}, direction ${directionAngle}:`, errorData);
      return null;
    }
    const data = await res.json();
    if (data && data.features && data.features[0]) {
      data.metadata = { seed, scale, directionAngle };
      return data;
    }
    return null;
  } catch (err) {
    console.error(`ORS network error for seed ${seed}, scale ${scale.toFixed(3)}:`, err);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { coordinates, distanceKm, points, seed, directionAngle } = body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return NextResponse.json({ error: 'Invalid coordinates provided.' }, { status: 400 });
    }

    if (!distanceKm || distanceKm <= 0) {
      return NextResponse.json({ error: 'Invalid distance provided.' }, { status: 400 });
    }

    const distanceMeters = distanceKm * 1000;
    const apiKey = process.env.ORS_API_KEY;

    if (!apiKey) {
      console.error('ORS_API_KEY is not set in environment variables.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // Base scale factors mapping to counteract snapping overshoot
    const BASE_SCALES = {
      3: 0.94,
      4: 0.88,
      5: 0.85,
      6: 0.79,
      7: 0.72,
      8: 0.65,
      9: 0.68,
      10: 0.66
    };

    const routePoints = points ? parseInt(points) : 6;
    // Standard multi-stop directions (triangle) snaps closer to target, default baseScale to 0.94
    const baseScale = directionAngle !== undefined ? 0.94 : (BASE_SCALES[routePoints] || 0.79);
    const routeSeed = seed ? parseInt(seed) : 1;

    let currentScale = baseScale;
    let attempts = 0;
    const maxAttempts = 3;
    const tolerance = 0.10; // 10% tolerance
    const attemptsLog = [];

    while (attempts < maxAttempts) {
      const targetLength = distanceMeters * currentScale;
      const route = await fetchRoute(coordinates, targetLength, routePoints, routeSeed, currentScale, apiKey, directionAngle);
      
      if (route && route.features?.[0]?.properties?.summary) {
        const actualDistance = route.features[0].properties.summary.distance;
        const errorPercent = Math.abs(actualDistance - distanceMeters) / distanceMeters;
        
        console.log(`[ORS Calibration] Attempt ${attempts + 1}: scale = ${currentScale.toFixed(3)}, actual = ${(actualDistance / 1000).toFixed(2)} km, error = ${(errorPercent * 100).toFixed(1)}%`);
        
        attemptsLog.push({ route, error: errorPercent });

        // If within 10% tolerance, return immediately
        if (errorPercent <= tolerance) {
          return NextResponse.json({ route });
        }

        // Adjust scale factor for the next attempt
        const ratio = actualDistance / distanceMeters;
        currentScale = currentScale / ratio;
        
        // Clamp scale to [0.50, 1.20] to keep requests realistic
        currentScale = Math.max(0.50, Math.min(1.20, currentScale));
      } else {
        console.warn(`[ORS Calibration] Attempt ${attempts + 1} failed to retrieve valid route geometry.`);
        break;
      }
      attempts++;
    }

    // If we exited the loop without hitting the tolerance, return the best attempt
    if (attemptsLog.length > 0) {
      const bestAttempt = attemptsLog.sort((a, b) => a.error - b.error)[0];
      console.log(`[ORS Calibration] Failed to meet 10% tolerance after ${attemptsLog.length} attempts. Returning best route (Error: ${(bestAttempt.error * 100).toFixed(1)}%).`);
      return NextResponse.json({ route: bestAttempt.route });
    }

    return NextResponse.json({ error: 'Failed to generate a valid route.' }, { status: 500 });
  } catch (error) {
    console.error('Error generating routes:', error);
    return NextResponse.json({ error: 'Failed to generate routes.' }, { status: 500 });
  }
}
