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

// Calculate total perimeter of farm boundary
export function calculatePerimeter(coordinates) {
  let totalDistance = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const lat1 = coordinates[i].latitude;
    const lon1 = coordinates[i].longitude;
    const lat2 = coordinates[(i + 1) % n].latitude;
    const lon2 = coordinates[(i + 1) % n].longitude;
    
    totalDistance += calculateDistance(lat1, lon1, lat2, lon2);
  }
  
  return totalDistance; // Returns meters
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