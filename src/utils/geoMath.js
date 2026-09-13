// Haversine: Calculate distance between two coords (meters)
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing (0-360 degrees)
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

// Move point towards bearing by distance
export function movePoint(lat, lon, bearing, distanceMeters) {
  const R = 6371000;
  const angularDistance = distanceMeters / R;
  const bearingRad = toRad(bearing);
  
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );
  
  return {
    latitude: toDeg(lat2),
    longitude: toDeg(lon2),
  };
}

export function calculatePolygonArea(coordinates) {
  if (!coordinates || coordinates.length < 3) {
    return 0;
  }

  const R = 6371000;

  // Use first point as local origin
  const originLat = toRad(coordinates[0].latitude);
  const originLon = toRad(coordinates[0].longitude);

  const projected = coordinates.map((point) => {
    const lat = toRad(point.latitude);
    const lon = toRad(point.longitude);

    const x = (lon - originLon) * Math.cos(originLat) * R;
    const y = (lat - originLat) * R;

    return { x, y };
  });

  let area = 0;

  for (let i = 0; i < projected.length; i++) {
    const current = projected[i];
    const next = projected[(i + 1) % projected.length];

    area += current.x * next.y;
    area -= next.x * current.y;
  }

  const areaInSquareMeters = Math.abs(area) / 2;

  return areaInSquareMeters / 10000;
}

// Get direction name from bearing
export function getBearingName(bearing) {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

// Helper: degrees to radians
function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Helper: radians to degrees
function toDeg(rad) {
  return rad * (180 / Math.PI);
}