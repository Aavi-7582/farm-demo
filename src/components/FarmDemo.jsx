import React, { useState, useEffect, useCallback } from 'react';
import {
  calculateDistance,
  calculateBearing,
  calculatePolygonArea,
  getBearingName,
} from '../utils/geoMath';
import './FarmDemo.css';
import sampleCoordinates from '../data/sample-coordinates.json';

// Sample farm boundary coordinates
const SAMPLE_COORDINATES = sampleCoordinates;

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

  const [gpsStatus, setGpsStatus] = useState('idle');
const [permissionState, setPermissionState] = useState('unknown');
const [isSecure, setIsSecure] = useState(true);

  // Real GPS Tracking
  const startLocationTracking = useCallback(() => {
  if (!navigator.geolocation) {
    setGpsStatus('error');
    setLocationError(
      'Geolocation is not supported by this browser.'
    );
    return;
  }

  // IMPORTANT: Geolocation requires a secure context.
  if (!window.isSecureContext) {
    setGpsStatus('error');
    setIsSecure(false);
    setLocationError(
      'GPS requires HTTPS on a phone. Open the app using an HTTPS URL.'
    );
    return;
  }

  setGpsStatus('requesting');
  setLocationError(null);

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      console.log('GPS POSITION:', position);

      const {
        latitude,
        longitude,
        accuracy: gpsAccuracy,
      } = position.coords;

      setCurrentPos({
        latitude,
        longitude,
      });

      setAccuracy(gpsAccuracy);
      setLocationEnabled(true);
      setGpsStatus('active');
      setLocationError(null);
      setLastUpdate(new Date().toLocaleTimeString());
    },

    (error) => {
      console.error('GPS ERROR:', error);

      setGpsStatus('error');

      switch (error.code) {
        case error.PERMISSION_DENIED:
          setLocationError(
            'Location permission was denied. Please allow location access for this site.'
          );
          break;

        case error.POSITION_UNAVAILABLE:
          setLocationError(
            'GPS position is currently unavailable. Move outdoors to an open area.'
          );
          break;

        case error.TIMEOUT:
          setLocationError(
            'GPS request timed out. Please wait and try again.'
          );
          break;

        default:
          setLocationError(
            `GPS error: ${error.message || 'Unknown error'}`
          );
      }
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );

  return watchId;
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
        <h1>🌾 Farm Boundary Measurement</h1>
        <p>GPS Guided Farm Measurement</p>
      </div>

      <div className="loading-screen">

        <div className="loading-icon">
          {gpsStatus === 'error' ? '⚠️' : '📍'}
        </div>

        <h2>
          {gpsStatus === 'requesting'
            ? 'Getting Your Location...'
            : gpsStatus === 'error'
            ? 'Location Setup Required'
            : 'Ready to Start'}
        </h2>

        {!isSecure ? (
          <div className="error-box">
            <p>
              ⚠️ <strong>HTTPS is required for GPS.</strong>
            </p>

            <p>
              You are currently opening this app
              over an insecure HTTP connection.
            </p>

            <p>
              Open the app using an HTTPS URL
              from Vercel or an HTTPS development tunnel.
            </p>
          </div>
        ) : locationError ? (
          <div className="error-box">
            <p>⚠️ {locationError}</p>

            <p style={{
              fontSize: '0.85rem',
              marginTop: '10px'
            }}>
              Check your phone's Location settings
              and allow this website to access location.
            </p>

            <button
              onClick={handleStartMeasurement}
              className="btn-primary"
            >
              🔄 Try Again
            </button>
          </div>
        ) : (
          <>
            <p>
              Your GPS location is needed to guide
              you around the farm boundary.
            </p>

            <div className="instruction-box">
              <p>✓ Go outdoors</p>
              <p>✓ Keep location services enabled</p>
              <p>✓ Keep the phone with you while walking</p>
              <p>✓ Allow location access when asked</p>
            </div>

            <button
              onClick={handleStartMeasurement}
              className="btn-primary"
            >
              📍 Enable Location & Start
            </button>
          </>
        )}

        <div style={{
          marginTop: '20px',
          fontSize: '0.8rem',
          color: '#777'
        }}>
          <div>
            Secure connection:{' '}
            {isSecure ? '✅ Yes' : '❌ No'}
          </div>

          <div>
            GPS API:{' '}
            {navigator.geolocation ? '✅ Available' : '❌ Unavailable'}
          </div>

          <div>
            Permission:{' '}
            {permissionState}
          </div>
        </div>

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
    const finalArea = calculatePolygonArea(coordinates);
    return (
      <div className="farm-demo-container">
        <div className="completion-screen">
          <div className="success-icon">✅</div>
          <h2>Farm Measurement Complete!</h2>
          
          <div className="result-card">
            <div className="result-row">
              <span>📍 Farm Area:</span>
              <strong>{finalArea.toFixed(2)} hectares</strong>
            </div>
            <div className="result-row">
              <span>📌 Waypoints Visited:</span>
              <strong>{coordinates.length} / {coordinates.length}</strong>
            </div>
            <div className="result-row">
              <span>🎯 GPS Accuracy:</span>
              <strong>±{Math.round(accuracy)} meters</strong>
            </div>
          </div>

          <div className="coordinates-summary">
            <h4>Boundary Coordinates</h4>
            {coordinates.map((coord, idx) => (
              <p key={idx} style={{ fontSize: '0.85rem', margin: '5px 0' }}>
                <strong>{coord.name}:</strong> {coord.latitude.toFixed(6)}, {coord.longitude.toFixed(6)}
              </p>
            ))}
          </div>

          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            🔄 Start New Measurement
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
        <h1>🌾 Farm Boundary Measurement</h1>
        <p>Using Real GPS - Walk to waypoints</p>
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
          {/* Target Waypoint */}
          <div className="waypoint-info">
            <h3>🎯 Target: {nextWaypoint.name}</h3>
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

          {/* Waypoint Checklist */}
          <div className="waypoint-checklist">
            <h4>📌 Waypoints</h4>
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
            <p>👟 Walk towards the arrow direction</p>
            <p>✅ Waypoint marks green automatically when you get close</p>
            <p>📍 Keep phone camera facing up for better GPS accuracy</p>
          </div>
        </div>
      </div>
    </div>
  );
}


useEffect(() => {
  setIsSecure(window.isSecureContext);

  if (!navigator.geolocation) {
    setGpsStatus('error');
    setLocationError(
      'This browser does not support GPS location.'
    );
    return;
  }

  if (!window.isSecureContext) {
    setGpsStatus('error');
    setLocationError(
      'This page is not running over HTTPS. GPS cannot be used here on this phone.'
    );
    return;
  }

  // Check current permission state if supported.
  if (navigator.permissions) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permission) => {
        setPermissionState(permission.state);

        permission.onchange = () => {
          setPermissionState(permission.state);
        };
      })
      .catch(() => {
        setPermissionState('unknown');
      });
  }
}, []);