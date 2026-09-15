import React, { useState, useEffect, useRef } from 'react';
import {
  calculateDistance,
  calculateBearing,
  getBearingName,
  checkProximity,
} from '../utils/geoMath';
import './FarmDemo.css';
// Single source of truth for the sample perimeter coordinates (P1 -> P2 -> P3 -> P4)
import SAMPLE_COORDINATES from '../data/sample-coordinates.json';
import { relativeAngle } from '../utils/compassMath';
import useDeviceHeading, { COMPASS_STATUS } from '../hooks/useDeviceHeading';

export default function FarmDemo() {
  const [coordinates] = useState(SAMPLE_COORDINATES);
  const [currentPos, setCurrentPos] = useState(null);
  const [waypointIndex, setWaypointIndex] = useState(0);
  const [visitedWaypoints, setVisitedWaypoints] = useState(
    new Array(SAMPLE_COORDINATES.length).fill(false)
  );
  const [completed, setCompleted] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [locationState, setLocationState] = useState('SEARCHING_FOR_LOCATION');
  const [gpsAccuracyDisplay, setGpsAccuracyDisplay] = useState(null);
  const markPointRef = useRef(null);

  // Dedicated device-heading (compass) mechanism, separate from GPS navigation.
  const {
    heading,
    status: compassStatus,
    requestPermission,
  } = useDeviceHeading();

  // Real GPS Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported on this device');
      setLocationState('GPS_UNAVAILABLE');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setCurrentPos({ latitude: lat, longitude: lon });
        setAccuracy(position.coords.accuracy);
        setLocationEnabled(true);
        setLocationError(null);
        setLastUpdate(new Date().toLocaleTimeString());

        // Update location state based on accuracy and distance
        if (!currentPos || !coordinates[waypointIndex]) {
          setLocationState('LOCATION_AVAILABLE');
          return;
        }

        const nextWaypoint = coordinates[waypointIndex];
        const distance = calculateDistance(
          currentPos.latitude,
          currentPos.longitude,
          nextWaypoint.latitude,
          nextWaypoint.longitude
        );

        // Set GPS accuracy display
        setGpsAccuracyDisplay(`±${Math.round(position.coords.accuracy)}m`);

        // Determine location state per spec §9
        if (position.coords.accuracy > 50) {
          setLocationState('LOW_ACCURACY');
        } else if (distance > 50) {
          setLocationState('TARGET_FAR');
        } else if (distance > 15) {
          setLocationState('APPROACHING_TARGET');
        } else if (distance > 5) {
          setLocationState('TARGET_REACHED');
        } else {
          setLocationState('POINT_MARKED');
        }
      },
      (error) => {
        let errorMsg = 'Unknown error';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Please enable location access.';
          setLocationState('GPS_UNAVAILABLE');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location unavailable. Try moving to an open area.';
          setLocationState('LOW_ACCURACY');
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out.';
          setLocationState('GPS_UNAVAILABLE');
        }
        setLocationError(errorMsg);
        setLocationEnabled(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentPos, waypointIndex, visitedWaypoints, coordinates, completed]);

  // Auto-advance when close to waypoint (per spec §3, §4 proximity thresholds)
  useEffect(() => {
    if (!currentPos || completed) return;

    const nextWaypoint = coordinates[waypointIndex];
    const distance = calculateDistance(
      currentPos.latitude,
      currentPos.longitude,
      nextWaypoint.latitude,
      nextWaypoint.longitude
    );

    // Spec: 15m = "Walk toward the green direction", 5m = "You are near", <=5m = "Point reached"
    if (distance < 15 && !visitedWaypoints[waypointIndex]) {
      // Mark waypoint as visited per spec §4
      const updated = [...visitedWaypoints];
      updated[waypointIndex] = true;
      setVisitedWaypoints(updated);

      // Move to next waypoint or complete per spec §5
      if (waypointIndex + 1 < coordinates.length) {
        setWaypointIndex(waypointIndex + 1);
      } else {
        setCompleted(true);
      }
    }
  }, [currentPos, waypointIndex, visitedWaypoints, coordinates, completed]);

  // Request location permission
  const handleRequestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {}
      );
    }
  };

  // Manual MARK POINT action per spec §4
  const handleMarkPoint = () => {
    // Mark the current waypoint
    const updated = [...visitedWaypoints];
    updated[waypointIndex] = true;
    setVisitedWaypoints(updated);

    // Advance to next waypoint or complete per spec §4
    if (waypointIndex + 1 < coordinates.length) {
      setWaypointIndex(waypointIndex + 1);
    } else {
      setCompleted(true);
    }
  };

  // Loading state - waiting for location
  if (!locationEnabled) {
    return (
      <div className="farm-demo-container">
        <div className="header">
          <h1>🎯 Farm Boundary Navigation</h1>
          <p>Mark your farm boundaries for fencing</p>
        </div>

        <div className="loading-screen">
          <div className="loading-icon">📍</div>
          <h2>Requesting Location Access...</h2>
          <p>Your location is needed to guide you to each farm boundary point</p>
          {locationError ? (
            <div className="error-box">
              <p>⚠️ {locationError}</p>
              <p style={{ fontSize: '0.85rem', marginTop: '10px' }}>
                On Android: Settings → Location → Permissions → Allow<br />
                On iPhone: Settings → Privacy → Location Services → Allow
              </p>
              <button onClick={handleRequestLocation} className="btn-primary">
                🔄 Retry
              </button>
            </div>
          ) : (
            <div className="instruction-box">
              <p>✓ Make sure you're in an open area (outdoors)</p>
              <p>✓ Location permission popup will appear</p>
              <p>✓ Click "Allow" to continue</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for first GPS fix
  if (!currentPos) {
    return (
      <div className="farm-demo-container">
        <div className="loading-screen">
          <div className="loading-spinner">📡</div>
          <h2>Getting GPS Fix...</h2>
          <p>Stand in an open area with clear sky view</p>
          <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '15px' }}>
            This usually takes 10-30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Completion screen - per spec §11, do NOT calculate/emphasize farm area
  if (completed) {
    return (
      <div className="farm-demo-container">
        <div className="completion-screen">
          <div className="success-icon">✅</div>
          <h2>All Boundary Points Marked!</h2>

          <div className="result-card">
            <div className="result-row">
              <span>🎯 Boundary Points Marked:</span>
              <strong>{coordinates.length} / {coordinates.length}</strong>
            </div>
            <div className="result-row">
              <span>📏 Status:</span>
              <strong style={{ color: '#28a745' }}>Ready for Fencing</strong>
            </div>
          </div>

          <div className="marked-points">
            <h4>✅ Marked Boundary Points:</h4>
            {coordinates.map((coord, idx) => (
              <div key={idx} className="point-item">
                <span className="point-check">✅</span>
                <div className="point-info">
                  <strong>{coord.name}</strong>
                  <code>{coord.latitude.toFixed(6)}, {coord.longitude.toFixed(6)}</code>
                </div>
              </div>
            ))}
          </div>

          <div className="action-box">
            <h4>📋 Next Steps:</h4>
            <ul>
              <li>✓ All boundary points are marked on your field</li>
              <li>✓ You have physical markers at each boundary point</li>
              <li>✓ Farm boundary is clearly defined for fencing</li>
              <li>✓ Ready to proceed with fencing or land documentation</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            🔄 Mark Another Farm
          </button>
        </div>
      </div>
    );
  }

  // Main navigation screen per spec
  const nextWaypoint = coordinates[waypointIndex];

  const distance = calculateDistance(
    currentPos.latitude,
    currentPos.longitude,
    nextWaypoint.latitude,
    nextWaypoint.longitude
  );
  const bearing = calculateBearing(
    currentPos.latitude,
    currentPos.longitude,
    nextWaypoint.latitude,
    nextWaypoint.longitude
  );
  const directionName = getBearingName(bearing);

  // Relative direction: target bearing minus phone heading, normalized to [-180, 180].
  const hasHeading = heading != null;
  const relative = hasHeading ? relativeAngle(bearing, heading) : null;
  // Arrow points relative to where the phone faces when a heading is available;
  // otherwise fall back to the absolute target bearing.
  const arrowRotation = hasHeading ? relative : bearing;
  const relativeLabel = !hasHeading
    ? 'Compass unavailable'
    : Math.abs(relative) <= 10
    ? 'Walk straight'
    : relative > 0
    ? 'Turn right'
    : 'Turn left';

  // Proximity check per spec §3, §8
  const proximity = checkProximity(distance, 15); // 15m configurable threshold
  const progressWidth = proximity.withinThreshold ? 100 : Math.max(0, Math.min(100, (200 - distance) / 2));

  return (
    <div className="farm-demo-container">
      <div className="header">
        <h1>🎯 Farm Boundary Navigation</h1>
        <p>Mark your farm boundaries for fencing - Real GPS Guided</p>
      </div>

      <div className="main-content">
        {/* Compass & Direction */}
        <div className="compass-section">
          <div className="arrow-container">
            {/* Rotating arrow pointing to waypoint */}
            <svg width="200" height="200" viewBox="0 0 200 200">
              <g transform={`translate(100,100) rotate(${arrowRotation})`}>
                <polygon
                  points="0,-60 15,-20 0,0 -15,-20"
                  fill="#ff6b6b"
                  opacity="0.9"
                />
                <circle cx="0" cy="0" r="10" fill="#ff6b6b" />
              </g>

              {/* Compass circle */}
              <circle cx="100" cy="100" r="80" stroke="#ddd" strokeWidth="2" fill="none" />
              <circle cx="100" cy="100" r="75" stroke="#e8e8e8" strokeWidth="1" fill="none" opacity="0.5" />

              {/* Cardinal directions */}
              <text x="100" y="25" textAnchor="middle" fontSize="14" fill="#333" fontWeight="600">N</text>
              <text x="175" y="105" textAnchor="middle" fontSize="14" fill="#333" fontWeight="600">E</text>
              <text x="100" y="185" textAnchor="middle" fontSize="14" fill="#333" fontWeight="600">S</text>
              <text x="25" y="105" textAnchor="middle" fontSize="14" fill="#333" fontWeight="600">W</text>
            </svg>
          </div>

          <div className="direction-info">
            <div className="bearing-display">
              <div className="bearing-value">
                {hasHeading ? `${Math.round(relative)}°` : '--'}
              </div>
              <div className="bearing-direction">{relativeLabel}</div>
              <div className="bearing-absolute">
                Target bearing: {Math.round(bearing)}° {directionName}
              </div>
            </div>

            {/* Compass status + calibration help */}
            <div className="compass-status">
              {compassStatus === COMPASS_STATUS.ACTIVE && (
                <span className="compass-ok">🧭 Compass active</span>
              )}
              {compassStatus === COMPASS_STATUS.WAITING && (
                <span className="compass-wait">
                  🧭 Waiting for orientation data…
                </span>
              )}
              {compassStatus === COMPASS_STATUS.UNAVAILABLE && (
                <span className="compass-off">
                  🧭 Compass unavailable on this device
                </span>
              )}
              {compassStatus === COMPASS_STATUS.PERMISSION_REQUIRED && (
                <span className="compass-perm">
                  🧭 Compass permission required
                  <button
                    onClick={requestPermission}
                    className="btn-primary compass-perm-btn"
                  >
                    Enable Compass
                  </button>
                </span>
              )}
              <p className="compass-help">
                Hold your phone flat with the screen facing up for best direction
                accuracy.
              </p>
            </div>

            {/* Manual MARK POINT button when within proximity threshold */}
            {proximity.withinThreshold && !completed ? (
              <div className="mark-point-btn">
                <button
                  onClick={handleMarkPoint}
                  className="btn-primary"
                  aria-label="Mark current point as boundary point"
                >
                  🟢 MARK POINT
                </button>
                <p style={{ fontSize: '0.85rem', marginTop: '8px', color: '#28a745' }}>
                  {proximity.proximityState === 'TARGET_REACHED'
                    ? 'You are near the boundary point'
                    : 'Walk toward the green direction'}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Status & Info */}
        <div className="status-section">
          {/* Boundary Point */}
          <div className="waypoint-info">
            <h3>📍 Next Boundary Point: {nextWaypoint.name}</h3>
            <p className="boundary-instruction">
              Go to this point and mark it with a stone/flag
            </p>

            <div className="distance-display">
              <div className="distance-value">{Math.round(distance)}</div>
              <div className="distance-label">meters away</div>
            </div>

            {/* Progress bar showing proximity */}
            <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${progressWidth}%` }}
                          ></div>
                        </div>

            {/* GPS Status */}
            <div className="gps-status">
              <h4>📍 GPS Status</h4>
              <div className="gps-detail">
                <span>Current Position:</span>
                <code>
                  {currentPos.latitude.toFixed(6)}, {currentPos.longitude.toFixed(
                    6
                  )}
                </code>
              </div>
              <div className="gps-detail">
                <span>Accuracy:</span>
                <code>{gpsAccuracyDisplay || '±0m'}</code>
              </div>
              <div className="gps-detail">
                <span>Last Update:</span>
                <code>{lastUpdate}</code>
              </div>
              <div className="gps-detail">
                <span>Location State:</span>
                <code>{locationState}</code>
              </div>
            </div>
          </div>

          {/* Boundary Points Checklist per spec §10 */}
          <div className="waypoint-checklist">
            <h4>🚩 Boundary Points</h4>
            {coordinates.map((coord, idx) => (
              <div
                key={idx}
                className={`waypoint-item ${
                  visitedWaypoints[idx] ? 'visited' : ''
                } ${waypointIndex === idx ? 'active' : ''}`}
              >
                <span className="waypoint-marker">
                  {visitedWaypoints[idx] ? '✅' : idx + 1}
                </span>
                <span className="waypoint-name">{coord.name}</span>
                {waypointIndex === idx && (
                  <span className="current-badge">Current Target</span>
                )}
              </div>
            ))}
          </div>

          {/* Instructions per spec */}
          <div className="instruction-box">
            <h4>📋 How to Mark Boundary Points:</h4>
            <p>👟 <strong>Walk</strong> towards the arrow direction</p>
            <p>📏 <strong>App shows</strong> real-time distance (updates as you walk)</p>
            <p>
              🎯 <strong>Get close</strong> to the boundary point{' '}
              {distance < 15 ? '(within 15 m)' : ''}
            </p>
            <p>
              🚩 <strong>Place</strong> a stone/flag/marker at this location
            </p>
            <p>
              ✅ <strong>Point marks</strong> automatically when nearby{' '}
              {distance < 15 ? '(within 15 m threshold)' : ''}
            </p>
            <p>
              🎯 <strong>Tap MARK POINT</strong> button when within threshold
            </p>
            <p>📍 Keep phone facing up for better GPS accuracy</p>
          </div>
        </div>
      </div>
    </div>
  );
}