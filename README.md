# 🏃‍♂️ Circular Routes Generator (Web)

Test
A modern, premium Next.js web application that generates circular running routes (loops) based on target distance and starting coordinates. It features **gesture-based directional drawing** allowing users to select a preferred running direction, and an **iterative calibration engine** to ensure route distance accuracy.

This project is built to serve both as a standalone web app and as the backend routing API service for potential companion mobile applications.

---

## ✨ Key Features

*   **Standard Circular Loops**: Generates standard hexagonal running routes centered around a start location using OpenRouteService's experimental `round_trip` API.
*   **Gesture-Based Directional Routing**: 
    *   Right-click and drag on the map starting from your marker to specify a preferred running direction (e.g., South-West, East).
    *   The tool calculates the angle vector, generates triangular waypoints, and queries the standard ORS Directions API to create a closed loop.
*   **Multi-Pass Distance Calibration**:
    *   Compares the actual road-snapped route distance against your target distance.
    *   Applies a multi-pass calibration loop (up to 3 attempts) that dynamically adjusts route sizing scale factors to converge within a strict $\pm 10\%$ error tolerance.
*   **Seed-Based Directional Variations**:
    *   When a direction is locked, clicking **"Try Another Route"** uses a seed-based perturbation formula.
    *   It shifts angles slightly ($\pm 8^\circ$) and varies leg lengths ($\pm 12\%$) deterministically to prompt different street selection variations in the same general direction.
*   **Map-Click Coordinate Selection**: Left-click anywhere on the map to set a custom start location.
*   **Locator Navigation**: Quick-locate button to center the map on your browser's current geolocation.
*   **Stats Display**: Clean details overlay showcasing exact actual distance and variation seeds.

---

## 🛠️ Technology Stack

*   **Core**: React, Next.js 16 (App Router)
*   **Styling**: Vanilla CSS with modern dark mode theme and glassmorphic designs
*   **Mapping**: Google Maps JavaScript API (with custom drawing listeners, dynamic polyline rendering, and custom symbol vectors)
*   **Routing API**: OpenRouteService (ORS) API

---

## 🚀 Getting Started

### Prerequisites

You will need the following API keys:
1.  **Google Maps API Key**: Enabling the *Maps JavaScript API*.
2.  **OpenRouteService API Key**: A free token from [OpenRouteService](https://openrouteservice.org/).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/ciddhant13/round-trip-router-web.git
    cd round-trip-router-web
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables. Create a `.env.local` file in the root directory:
    ```env
    # Server-side API key for OpenRouteService
    ORS_API_KEY=your_openrouteservice_api_key_here
    
    # Client-side API key for Google Maps
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
    ```

4.  Start the development server:
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🌐 Deploying to Vercel

To host the application and expose the routing API for mobile apps, deploy the project to Vercel:

1.  Connect your GitHub repository to [Vercel](https://vercel.com).
2.  During the project setup, add the following environment variables in the Vercel Dashboard under **Settings > Environment Variables**:
    *   `ORS_API_KEY`
    *   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3.  Deploy. Vercel will securely inject the secrets during build and runtime.

### Mobile API Integration

Once deployed, your companion mobile app can generate calibrated circular routes by sending a `POST` request to the web backend endpoint:

*   **Endpoint**: `https://your-vercel-domain.vercel.app/api/routes`
*   **Headers**: `Content-Type: application/json`
*   **Payload Schema**:
    ```json
    {
      "coordinates": [lng, lat],
      "distanceKm": 5.0,
      "seed": 1,
      "directionAngle": -1.5707 // Optional: angle in radians (e.g. -1.5707 is South)
    }
    ```
