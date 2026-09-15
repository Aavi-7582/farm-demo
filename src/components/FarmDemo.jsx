import React, { useState, useEffect } from 'react';
import {
  calculateDistance,
  calculateBearing,
  calculatePerimeter,
  getBearingName,
} from  '../utils/geoMath';
import './FarmDemo.css';

// Sample farm boundary coordinates
const SAMPLE_COORDINATES = [
  { latitude: 20.1855, longitude: 77.3055, name: 'P1 - Start' },
  { latitude: 20.1860, longitude: 77.3065, name: 'P2' },
  { latitude: 20.1865, longitude: 77.3060, name: 'P3' },
  { latitude: 20.1850, longitude: 77.3050, name: 'P4' },
];

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

  // Real GPS Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported on this device');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPos({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setAccuracy(position.coords.accuracy);
        setLocationEnabled(true);
        setLocationError(null);
        setLastUpdate(new Date().toLocaleTimeString());
      },
      (error) => {
        let errorMsg = 'Unknown error';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Please enable location access.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location unavailable. Try moving to an open area.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out.';
        }
        setLocationError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Auto-advance when close to waypoint
  useEffect(() => {
    if (!currentPos || completed) return;

    const nextWaypoint = coordinates[waypointIndex];
    const distance = calculateDistance(
      currentPos.latitude,
      currentPos.longitude,
      nextWaypoint.latitude,
      nextWaypoint.longitude
    );

    if (distance < 10 && !visitedWaypoints[waypointIndex]) {
      // Mark waypoint as visited
      const updated = [...visitedWaypoints];
      updated[waypointIndex] = true;
      setVisitedWaypoints(updated);

      // Move to next waypoint or complete
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
                On Android: Settings → Location → Permissions → Allow  
                <br />
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

  // Completion screen
  if (completed) {
    const perimeter = calculatePerimeter(coordinates);
    const perimeterKm = (perimeter / 1000).toFixed(2);
    
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
              <span>📏 Farm Perimeter:</span>
              <strong>{perimeterKm} km ({Math.round(perimeter)} m)</strong>
            </div>
            <div className="result-row">
              <span>🚩 Status:</span>
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
              <li>✓ Farm perimeter is clearly defined: <strong>{perimeterKm} km</strong></li>
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

  // Main navigation screen
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
            <svg width="200" height="200" viewBox="0 0 200 200">
              {/* Rotating arrow pointing to waypoint */}
              <g transform={`translate(100,100) rotate(${bearing})`}>
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
              <div className="bearing-value">{Math.round(bearing)}°</div>
              <div className="bearing-direction">{directionName}</div>
            </div>
          </div>
        </div>

        {/* Status & Info */}
        <div className="status-section">
          {/* Boundary Point */}
          <div className="waypoint-info">
            <h3>📍 Next Boundary Point: {nextWaypoint.name}</h3>
            <p className="boundary-instruction">Go to this point and mark it with a stone/flag</p>
            <div className="distance-display">
              <div className="distance-value">{Math.round(distance)}</div>
              <div className="distance-label">meters away</div>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, (200 - distance) / 2))}%` }}></div>
            </div>
          </div>

          {/* GPS Status */}
          <div className="gps-status">
            <h4>📍 GPS Status</h4>
            <div className="gps-detail">
              <span>Current Position:</span>
              <code>{currentPos.latitude.toFixed(6)}, {currentPos.longitude.toFixed(6)}</code>
            </div>
            <div className="gps-detail">
              <span>Accuracy:</span>
              <code>±{Math.round(accuracy)}m</code>
            </div>
            <div className="gps-detail">
              <span>Last Update:</span>
              <code>{lastUpdate}</code>
            </div>
          </div>

          {/* Boundary Points Checklist */}
          <div className="waypoint-checklist">
            <h4>🚩 Boundary Points</h4>
            {coordinates.map((coord, idx) => (
              <div
                key={idx}
                className={`waypoint-item ${visitedWaypoints[idx] ? 'visited' : ''} ${
                  waypointIndex === idx ? 'active' : ''
                }`}
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

          {/* Instructions */}
          <div className="instruction-box">
            <h4>📋 How to Mark Boundary Points:</h4>
            <p>👟 <strong>Walk</strong> towards the arrow direction</p>
            <p>📏 <strong>App shows</strong> real-time distance (updates as you walk)</p>
            <p>🎯 <strong>Get close</strong> to the boundary point ( 10 m)</p>
            <p>🚩 <strong>Place</strong> a stone/flag/marker at this location</p>
            <p>✅ <strong>Point marks green</strong> automatically when nearby</p>
            <p>📍 Keep phone facing up for better GPS accuracy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
