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

// Get direction name from bearing (8-wind cardinal classification per spec)
// 0° ± 22.5°       = North
// 22.5°–67.5°       = North-East
// 67.5°–112.5°      = East
// 112.5°–157.5°     = South-East
// 157.5°–202.5°     = South
// 202.5°–247.5°     = South-West
// 247.5°–292.5°     = West
// 292.5°–337.5°     = North-West
export function getBearingName(bearing) {
  if (bearing >= 337.5 || bearing < 22.5) return 'N';
  if (bearing < 67.5) return 'NE';
  if (bearing < 112.5) return 'E';
  if (bearing < 157.5) return 'SE';
  if (bearing < 202.5) return 'S';
  if (bearing < 247.5) return 'SW';
  if (bearing < 292.5) return 'W';
  return 'NW';
}

// Check if farmer is within proximity threshold of target point
// Returns { withinThreshold: boolean, proximityState: string }
export function checkProximity(distance, threshold = 10) {
  if (distance <= threshold / 3) {
    return { withinThreshold: true, proximityState: 'TARGET_REACHED' };
  }
  if (distance <= threshold) {
    return { withinThreshold: true, proximityState: 'APPROACHING_TARGET' };
  }
  return { withinThreshold: false, proximityState: null };
}

// Helper: degrees to radians
function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Helper: radians to degrees
function toDeg(rad) {
  return rad * (180 / Math.PI);
}