import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  calculateDistance,
  calculateBearing,
  calculatePolygonArea,
  getBearingName,
} from '../utils/geoMath';

import './FarmDemo.css';
import sampleCoordinates from '../data/sample-coordinates.json';


// ============================================================
// FARM COORDINATES
// ============================================================

const SAMPLE_COORDINATES = sampleCoordinates;


// ============================================================
// FARM DEMO COMPONENT
// ============================================================

export default function FarmDemo() {

  // ==========================================================
  // STATE
  // ==========================================================

  const [coordinates] = useState(SAMPLE_COORDINATES);

  const [currentPos, setCurrentPos] = useState(null);

  const [waypointIndex, setWaypointIndex] = useState(0);

  const [visitedWaypoints, setVisitedWaypoints] = useState(
    new Array(SAMPLE_COORDINATES.length).fill(false)
  );

  const [completed, setCompleted] = useState(false);

  // GPS state
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // GPS status
  const [gpsStatus, setGpsStatus] = useState('idle');

  // Browser permission status
  const [permissionState, setPermissionState] = useState('unknown');

  // HTTPS / secure-context status
  const [isSecure, setIsSecure] = useState(true);

  // Store the active GPS watcher
  const watchIdRef = useRef(null);


  // ==========================================================
  // CLEANUP GPS WATCHER
  // ==========================================================

  const stopLocationTracking = useCallback(() => {

    if (
      watchIdRef.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;
    }

  }, []);


  // ==========================================================
  // CHECK HTTPS + LOCATION PERMISSION
  // ==========================================================

  useEffect(() => {

    // Check whether this page is running in a secure context.
    const secure = window.isSecureContext;

    setIsSecure(secure);


    // Check whether browser supports geolocation.
    if (!navigator.geolocation) {

      setGpsStatus('error');

      setLocationError(
        'This browser does not support GPS location.'
      );

      return;
    }


    // GPS on a phone requires HTTPS.
    if (!secure) {

      setGpsStatus('error');

      setLocationError(
        'This page is not running over HTTPS. GPS cannot be used here on this phone.'
      );

      return;
    }


    // Check current browser location permission.
    if (navigator.permissions) {

      navigator.permissions
        .query({
          name: 'geolocation',
        })
        .then((permission) => {

          setPermissionState(
            permission.state
          );


          // Listen for permission changes.
          permission.onchange = () => {

            setPermissionState(
              permission.state
            );
          };

        })
        .catch(() => {

          // Some browsers may not support
          // querying geolocation permissions.
          setPermissionState('unknown');

        });
    }

  }, []);


  // ==========================================================
  // START GPS TRACKING
  // ==========================================================

  const handleStartMeasurement = useCallback(() => {

    // Clear any previous error.
    setLocationError(null);

    // Update UI.
    setGpsStatus('requesting');


    // --------------------------------------------------------
    // Browser support check
    // --------------------------------------------------------

    if (!navigator.geolocation) {

      setGpsStatus('error');

      setLocationError(
        'This browser does not support GPS location.'
      );

      return;
    }


    // --------------------------------------------------------
    // HTTPS check
    // --------------------------------------------------------

    if (!window.isSecureContext) {

      setIsSecure(false);

      setGpsStatus('error');

      setLocationError(
        'GPS requires HTTPS on a phone. Open the app using an HTTPS URL.'
      );

      return;
    }


    // --------------------------------------------------------
    // Stop previous watcher if one exists
    // --------------------------------------------------------

    stopLocationTracking();


    // --------------------------------------------------------
    // Start continuous GPS tracking
    // --------------------------------------------------------

    try {

      const watchId =
        navigator.geolocation.watchPosition(

          // ==================================================
          // GPS SUCCESS
          // ==================================================

          (position) => {

            console.log(
              'GPS POSITION:',
              position
            );


            const {
              latitude,
              longitude,
              accuracy: gpsAccuracy,
            } = position.coords;


            // Update current position.
            setCurrentPos({
              latitude,
              longitude,
            });


            // Update GPS accuracy.
            setAccuracy(gpsAccuracy);


            // GPS is now working.
            setLocationEnabled(true);

            setGpsStatus('active');

            setLocationError(null);

            setPermissionState('granted');


            // Store last update time.
            setLastUpdate(
              new Date().toLocaleTimeString()
            );
          },


          // ==================================================
          // GPS ERROR
          // ==================================================

          (error) => {

            console.error(
              'GPS ERROR:',
              error
            );


            setGpsStatus('error');


            switch (error.code) {

              case error.PERMISSION_DENIED:

                setPermissionState('denied');

                setLocationError(
                  'Location permission was denied. Please allow location access for this website.'
                );

                break;


              case error.POSITION_UNAVAILABLE:

                setLocationError(
                  'GPS position is currently unavailable. Move outdoors to an open area.'
                );

                break;


              case error.TIMEOUT:

                setLocationError(
                  'GPS request timed out. Please wait a moment and try again.'
                );

                break;


              default:

                setLocationError(
                  `GPS error: ${
                    error.message ||
                    'Unknown GPS error'
                  }`
                );

                break;
            }
          },


          // ==================================================
          // GPS OPTIONS
          // ==================================================

          {
            enableHighAccuracy: true,

            timeout: 15000,

            maximumAge: 0,
          }
        );


      // Save watcher ID so it can be stopped later.
      watchIdRef.current = watchId;

    } catch (error) {

      console.error(
        'Failed to start GPS:',
        error
      );

      setGpsStatus('error');

      setLocationError(
        'Unable to start GPS tracking.'
      );
    }

  }, [stopLocationTracking]);


  // ==========================================================
  // CLEANUP WHEN COMPONENT UNMOUNTS
  // ==========================================================

  useEffect(() => {

    return () => {

      stopLocationTracking();

    };

  }, [stopLocationTracking]);


  // ==========================================================
  // AUTO-ADVANCE WAYPOINT
  // ==========================================================

  useEffect(() => {

    // No GPS position yet.
    if (!currentPos) {
      return;
    }


    // Measurement already completed.
    if (completed) {
      return;
    }


    // Make sure waypoint exists.
    const nextWaypoint =
      coordinates[waypointIndex];

    if (!nextWaypoint) {
      return;
    }


    // Calculate distance to current waypoint.
    const distance = calculateDistance(

      currentPos.latitude,

      currentPos.longitude,

      nextWaypoint.latitude,

      nextWaypoint.longitude

    );


    // --------------------------------------------------------
    // Arrival detection
    // --------------------------------------------------------

    if (
      distance < 10 &&
      !visitedWaypoints[waypointIndex]
    ) {

      console.log(
        `Reached waypoint ${waypointIndex + 1}`
      );


      // Mark waypoint as visited.
      setVisitedWaypoints((previous) => {

        const updated = [...previous];

        updated[waypointIndex] = true;

        return updated;
      });


      // ------------------------------------------------------
      // Move to next waypoint
      // ------------------------------------------------------

      if (
        waypointIndex + 1 <
        coordinates.length
      ) {

        setWaypointIndex(
          waypointIndex + 1
        );

      } else {

        // All waypoints completed.
        setCompleted(true);

      }
    }

  }, [
    currentPos,
    waypointIndex,
    visitedWaypoints,
    coordinates,
    completed,
  ]);


  // ==========================================================
  // LOADING / LOCATION SETUP SCREEN
  // ==========================================================

  if (!locationEnabled) {

    return (

      <div className="farm-demo-container">

        {/* Header */}
        <div className="header">

          <h1>
            🌾 Farm Boundary Measurement
          </h1>

          <p>
            GPS Guided Farm Measurement
          </p>

        </div>


        {/* Loading / GPS Setup */}
        <div className="loading-screen">

          {/* Icon */}
          <div className="loading-icon">

            {gpsStatus === 'error'
              ? '⚠️'
              : gpsStatus === 'requesting'
              ? '📡'
              : '📍'}

          </div>


          {/* Title */}
          <h2>

            {gpsStatus === 'requesting'
              ? 'Getting Your Location...'
              : gpsStatus === 'error'
              ? 'Location Setup Required'
              : 'Ready to Start'}

          </h2>


          {/* HTTPS ERROR */}
          {!isSecure ? (

            <div className="error-box">

              <p>
                ⚠️{' '}
                <strong>
                  HTTPS is required for GPS.
                </strong>
              </p>

              <p>
                This page is currently running
                over an insecure HTTP connection.
              </p>

              <p>
                Open the Vercel HTTPS URL on
                your phone.
              </p>

            </div>

          ) : locationError ? (

            /* GPS ERROR */
            <div className="error-box">

              <p>
                ⚠️ {locationError}
              </p>

              <p
                style={{
                  fontSize: '0.85rem',
                  marginTop: '10px',
                }}
              >
                Check your phone's Location
                settings and allow this website
                to access your location.
              </p>


              <button
                onClick={handleStartMeasurement}
                className="btn-primary"
              >
                🔄 Try Again
              </button>

            </div>

          ) : gpsStatus === 'requesting' ? (

            /* REQUESTING GPS */
            <div>

              <p>
                Waiting for your phone's GPS...
              </p>

              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#777',
                  marginTop: '10px',
                }}
              >
                Please allow location access
                when your browser asks.
              </p>

            </div>

          ) : (

            /* READY */
            <>

              <p>
                Your GPS location is needed to
                guide you around the farm boundary.
              </p>


              <div className="instruction-box">

                <p>
                  ✓ Go outdoors
                </p>

                <p>
                  ✓ Keep location services enabled
                </p>

                <p>
                  ✓ Keep the phone with you
                  while walking
                </p>

                <p>
                  ✓ Allow location access when asked
                </p>

              </div>


              <button
                onClick={handleStartMeasurement}
                className="btn-primary"
              >
                📍 Enable Location & Start
              </button>

            </>

          )}


          {/* DEBUG INFORMATION */}
          <div
            style={{
              marginTop: '20px',
              fontSize: '0.8rem',
              color: '#777',
            }}
          >

            <div>
              Secure connection:{' '}
              {isSecure
                ? '✅ Yes'
                : '❌ No'}
            </div>


            <div>
              GPS API:{' '}
              {navigator.geolocation
                ? '✅ Available'
                : '❌ Unavailable'}
            </div>


            <div>
              Permission:{' '}
              {permissionState}
            </div>


            <div>
              GPS status:{' '}
              {gpsStatus}
            </div>

          </div>

        </div>

      </div>

    );
  }


  // ==========================================================
  // WAITING FOR FIRST GPS FIX
  // ==========================================================

  if (!currentPos) {

    return (

      <div className="farm-demo-container">

        <div className="loading-screen">

          <div className="loading-spinner">
            📡
          </div>


          <h2>
            Getting GPS Fix...
          </h2>


          <p>
            Stand in an open area with a clear
            view of the sky.
          </p>


          <p
            style={{
              fontSize: '0.85rem',
              color: '#999',
              marginTop: '15px',
            }}
          >
            This may take several seconds.
          </p>


          <button
            onClick={handleStartMeasurement}
            className="btn-primary"
            style={{
              marginTop: '20px',
            }}
          >
            🔄 Refresh GPS
          </button>

        </div>

      </div>

    );
  }


  // ==========================================================
  // COMPLETION SCREEN
  // ==========================================================

  if (completed) {

    const finalArea =
      calculatePolygonArea(coordinates);


    return (

      <div className="farm-demo-container">

        <div className="completion-screen">

          <div className="success-icon">
            ✅
          </div>


          <h2>
            Farm Measurement Complete!
          </h2>


          {/* Results */}
          <div className="result-card">

            <div className="result-row">

              <span>
                📍 Farm Area:
              </span>

              <strong>
                {finalArea.toFixed(2)}
                {' '}
                hectares
              </strong>

            </div>


            <div className="result-row">

              <span>
                📌 Waypoints Visited:
              </span>

              <strong>
                {coordinates.length}
                {' / '}
                {coordinates.length}
              </strong>

            </div>


            <div className="result-row">

              <span>
                🎯 GPS Accuracy:
              </span>

              <strong>
                ±
                {accuracy !== null
                  ? Math.round(accuracy)
                  : '--'}
                {' '}
                meters
              </strong>

            </div>

          </div>


          {/* Coordinates */}
          <div className="coordinates-summary">

            <h4>
              Boundary Coordinates
            </h4>


            {coordinates.map(
              (coord, idx) => (

                <p
                  key={idx}
                  style={{
                    fontSize: '0.85rem',
                    margin: '5px 0',
                  }}
                >

                  <strong>
                    {coord.name}:
                  </strong>{' '}

                  {coord.latitude.toFixed(6)}
                  {', '}

                  {coord.longitude.toFixed(6)}

                </p>

              )
            )}

          </div>


          {/* Restart */}
          <button
            onClick={() =>
              window.location.reload()
            }
            className="btn-primary"
          >
            🔄 Start New Measurement
          </button>

        </div>

      </div>

    );
  }


  // ==========================================================
  // SAFETY CHECK
  // ==========================================================

  const nextWaypoint =
    coordinates[waypointIndex];


  if (!nextWaypoint) {

    return (

      <div className="farm-demo-container">

        <div className="error-box">

          <p>
            ⚠️ No waypoint available.
          </p>

        </div>

      </div>

    );
  }


  // ==========================================================
  // NAVIGATION CALCULATIONS
  // ==========================================================

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


  const directionName =
    getBearingName(bearing);


  // Calculate waypoint progress.
  const visitedCount =
    visitedWaypoints.filter(Boolean).length;


  const progressPercentage =
    (visitedCount /
      coordinates.length) *
    100;


  // ==========================================================
  // MAIN NAVIGATION SCREEN
  // ==========================================================

  return (

    <div className="farm-demo-container">


      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="header">

        <h1>
          🌾 Farm Boundary Measurement
        </h1>

        <p>
          Using Real GPS - Walk to waypoints
        </p>

      </div>


      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

      <div className="main-content">


        {/* ==================================================
            COMPASS & DIRECTION
        ================================================== */}

        <div className="compass-section">

          <div className="arrow-container">

            <svg
              width="200"
              height="200"
              viewBox="0 0 200 200"
            >

              {/* Compass circle */}

              <circle
                cx="100"
                cy="100"
                r="80"
                stroke="#ddd"
                strokeWidth="2"
                fill="none"
              />


              <circle
                cx="100"
                cy="100"
                r="75"
                stroke="#e8e8e8"
                strokeWidth="1"
                fill="none"
                opacity="0.5"
              />


              {/* Direction arrow */}

              <g
                transform={`translate(100,100) rotate(${bearing})`}
              >

                <polygon
                  points="0,-60 15,-20 0,0 -15,-20"
                  fill="#ff6b6b"
                  opacity="0.9"
                />


                <circle
                  cx="0"
                  cy="0"
                  r="10"
                  fill="#ff6b6b"
                />

              </g>


              {/* Cardinal directions */}

              <text
                x="100"
                y="25"
                textAnchor="middle"
                fontSize="14"
                fill="#333"
                fontWeight="600"
              >
                N
              </text>


              <text
                x="175"
                y="105"
                textAnchor="middle"
                fontSize="14"
                fill="#333"
                fontWeight="600"
              >
                E
              </text>


              <text
                x="100"
                y="185"
                textAnchor="middle"
                fontSize="14"
                fill="#333"
                fontWeight="600"
              >
                S
              </text>


              <text
                x="25"
                y="105"
                textAnchor="middle"
                fontSize="14"
                fill="#333"
                fontWeight="600"
              >
                W
              </text>

            </svg>

          </div>


          {/* Bearing information */}

          <div className="direction-info">

            <div className="bearing-display">

              <div className="bearing-value">
                {Math.round(bearing)}°
              </div>

              <div className="bearing-direction">
                {directionName}
              </div>

            </div>

          </div>

        </div>


        {/* ==================================================
            STATUS & INFORMATION
        ================================================== */}

        <div className="status-section">


          {/* =================================================
              TARGET WAYPOINT
          ================================================= */}

          <div className="waypoint-info">

            <h3>
              🎯 Target: {nextWaypoint.name}
            </h3>


            <div className="distance-display">

              <div className="distance-value">
                {Math.round(distance)}
              </div>

              <div className="distance-label">
                meters away
              </div>

            </div>


            {/* Progress */}

            <div className="progress-bar">

              <div
                className="progress-fill"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      progressPercentage
                    )
                  )}%`,
                }}
              />

            </div>

          </div>


          {/* =================================================
              GPS STATUS
          ================================================= */}

          <div className="gps-status">

            <h4>
              📍 GPS Status
            </h4>


            <div className="gps-detail">

              <span>
                Current Position:
              </span>

              <code>
                {currentPos.latitude.toFixed(6)}
                {', '}
                {currentPos.longitude.toFixed(6)}
              </code>

            </div>


            <div className="gps-detail">

              <span>
                Accuracy:
              </span>

              <code>
                ±
                {accuracy !== null
                  ? Math.round(accuracy)
                  : '--'}
                m
              </code>

            </div>


            <div className="gps-detail">

              <span>
                Last Update:
              </span>

              <code>
                {lastUpdate || '--'}
              </code>

            </div>


            <div className="gps-detail">

              <span>
                GPS Status:
              </span>

              <code>
                {gpsStatus}
              </code>

            </div>

          </div>


          {/* =================================================
              WAYPOINT CHECKLIST
          ================================================= */}

          <div className="waypoint-checklist">

            <h4>
              📌 Waypoints
            </h4>


            {coordinates.map(
              (coord, idx) => (

                <div
                  key={idx}
                  className={`
                    waypoint-item
                    ${visitedWaypoints[idx]
                      ? 'visited'
                      : ''}
                    ${waypointIndex === idx
                      ? 'active'
                      : ''}
                  `}
                >

                  <span className="waypoint-marker">

                    {visitedWaypoints[idx]
                      ? '✅'
                      : idx + 1}

                  </span>


                  <span className="waypoint-name">

                    {coord.name}

                  </span>


                  {waypointIndex === idx && (

                    <span className="current-badge">

                      Current Target

                    </span>

                  )}

                </div>

              )
            )}

          </div>


          {/* =================================================
              INSTRUCTIONS
          ================================================= */}

          <div className="instruction-box">

            <p>
              👟 Walk towards the arrow direction
            </p>

            <p>
              ✅ Waypoint marks green automatically
              when you get close
            </p>

            <p>
              📍 Keep the phone outdoors for
              better GPS accuracy
            </p>

          </div>

        </div>

      </div>

    </div>

  );
}