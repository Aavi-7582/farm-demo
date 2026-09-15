// Pure compass/heading math helpers.
// Kept separate from geoMath.js (GPS distance/bearing) so orientation logic
// does not mix with navigation calculations.

// Normalize an angle in degrees to the range [-180, 180].
// Handles the 359/0 wraparound correctly.
export function normalizeAngle(deg) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

// Relative direction from the phone heading to the target bearing.
// Result is normalized to [-180, 180]:
//   0    -> target straight ahead
//   +deg -> target to the right
//   -deg -> target to the left
//   ±180 -> target behind
export function relativeAngle(targetBearing, phoneHeading) {
  return normalizeAngle(targetBearing - phoneHeading);
}

// Circular (vector) smoothing of a heading in degrees.
// Uses sin/cos components so it never suffers from the 359/0 wraparound
// problem that ordinary arithmetic averaging would have.
// `prevSin`/`prevCos` are the previous smoothed vector components.
// `alpha` is the smoothing factor (0..1); higher = more responsive.
export function smoothHeading(prevSin, prevCos, newHeadingDeg, alpha = 0.25) {
  const rad = (newHeadingDeg * Math.PI) / 180;
  const sin = prevSin * (1 - alpha) + Math.sin(rad) * alpha;
  const cos = prevCos * (1 - alpha) + Math.cos(rad) * alpha;
  let heading = (Math.atan2(sin, cos) * 180) / Math.PI;
  if (heading < 0) heading += 360;
  return { sin, cos, heading };
}

// Seed the smoothing vector from a single raw heading.
export function seedHeading(headingDeg) {
  const rad = (headingDeg * Math.PI) / 180;
  return { sin: Math.sin(rad), cos: Math.cos(rad) };
}
