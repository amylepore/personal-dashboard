/*
 * Application logic for the personal dashboard. This script handles three
 * major components: note taking with Firebase Cloud Firestore, Google
 * Calendar integration through OAuth, and fetching current weather
 * information from the Open‑Meteo API.  Users must supply their own
 * Firebase and Google API credentials for cloud functionality.  See
 * documentation in the comments below for guidance.
 */

// Import Firebase modules. These are pulled directly from Google's CDN. The
// version number can be updated as newer versions are released. See
// https://firebase.google.com/docs/web/learn-more#modular-version for
// details.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

// -----------------------------------------------------------------------------
// Firebase configuration
// -----------------------------------------------------------------------------
// Replace the following configuration object with your own Firebase project
// settings. You can obtain these values by creating a new project in the
// Firebase console (https://console.firebase.google.com/), selecting
// “Project settings”, and copying the values from the “Firebase SDK snippet”.
// Without valid credentials, the notes section will not be able to store
// anything in the cloud.
const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
  projectId: 'YOUR_FIREBASE_PROJECT_ID',
  storageBucket: 'YOUR_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_APP_ID',
};

// Initialize Firebase app and Firestore database. If the user has not
// provided real credentials yet, initialization will fail silently and
// operations will throw errors. To avoid runtime exceptions when no
// configuration is provided, wrap initialization in a try/catch block.
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (err) {
  console.warn(
    'Firebase could not be initialized. Please provide your own configuration.\n',
    err
  );
}

// -----------------------------------------------------------------------------
// Weather code interpretation
// -----------------------------------------------------------------------------
// According to the Open‑Meteo documentation, current weather is described by
// WMO weather interpretation codes. The table below summarises ranges of
// codes and their meanings【740696947894309†L852-L867】. We map individual codes
// to human‑friendly descriptions. For unsupported codes we fall back to a
// generic message.
const weatherCodeMap = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

/**
 * Convert a WMO weather code into a descriptive string. If the code isn’t
 * defined in our map, return "Unknown conditions".
 * @param {number} code
 * @returns {string}
 */
function interpretWeatherCode(code) {
  return weatherCodeMap[code] || 'Unknown conditions';
}

/**
 * Fetch current weather for a given coordinate and update the DOM
 * accordingly. We use the free Open‑Meteo API, which requires no API key.
 * See the API documentation for details【740696947894309†L852-L867】.
 * @param {number} lat - Latitude of the location
 * @param {number} lon - Longitude of the location
 * @param {string} tempElemId - DOM element ID for temperature display
 * @param {string} descElemId - DOM element ID for description display
 */
async function fetchWeather(lat, lon, tempElemId, descElemId) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=America/New_York`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Weather request failed');
    }
    const data = await response.json();
    const current = data.current_weather;
    if (!current) {
      document.getElementById(tempElemId).textContent = 'No data available';
      document.getElementById(descElemId).textContent = '';
      return;
    }
    const temperature = current.temperature;
    const code = current.weathercode;
    document.getElementById(tempElemId).textContent = `${temperature}°C`;
    document.getElementById(descElemId).textContent = interpretWeatherCode(code);
  } catch (error) {
    console.error('Error fetching weather:', error);
    document.getElementById(tempElemId).textContent = 'Error fetching weather';
    document.getElementById(descElemId).textContent = '';
  }
}

// -----------------------------------------------------------------------------
// Notes handling
// -----------------------------------------------------------------------------
/**
 * Render the notes list based on a Firestore snapshot. Each note displays
 * its text and includes a delete button. When the button is clicked, the
 * corresponding document is removed from the collection.
 * @param {QuerySnapshot} snapshot
 */
function renderNotes(snapshot) {
  const notesList = document.getElementById('notes-list');
  notesList.innerHTML = '';
  snapshot.forEach((docSnap) => {
    const li = document.createElement('li');
    li.textContent = docSnap.data().text;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      try {
        await deleteDoc(doc(db, 'notes', docSnap.id));
      } catch (e) {
        console.error('Error deleting note:', e);
      }
    });
    li.appendChild(delBtn);
    notesList.appendChild(li);
  });
}

/**
 * Initialize the notes section. Set up event listeners for adding notes and
 * subscribe to Firestore updates so that the UI reflects current data.
 */
function initNotes() {
  if (!db) {
    // If Firestore isn't configured, disable the notes section
    const saveButton = document.getElementById('save-note');
    saveButton.disabled = true;
    saveButton.textContent = 'Notes unavailable';
    return;
  }
  const notesCol = collection(db, 'notes');
  // Real‑time listener for notes collection
  onSnapshot(notesCol, (snapshot) => {
    renderNotes(snapshot);
  });
  // Handler for adding a new note
  document.getElementById('save-note').addEventListener('click', async () => {
    const input = document.getElementById('note-input');
    const text = input.value.trim();
    if (!text) return;
    try {
      await addDoc(notesCol, { text });
      input.value = '';
    } catch (e) {
      console.error('Error adding note:', e);
    }
  });
}

// -----------------------------------------------------------------------------
// Google Calendar integration
// -----------------------------------------------------------------------------
// Placeholders for Google API credentials.  To retrieve events from a private
// calendar, users must create a project in Google Cloud Console, enable the
// Calendar API, and set OAuth consent. Then obtain a client ID and API key.
// See https://developers.google.com/calendar/api/quickstart/js for guidance.
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY';
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
];
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

/**
 * Initialise Google API client library after it's loaded. This function
 * configures the client with API key and OAuth credentials, and sets up
 * handlers for sign‑in state changes. It should be called once gapi is
 * available (invoked from index.html on page load).
 */
function initClient() {
  gapi.client
    .init({
      apiKey: GOOGLE_API_KEY,
      clientId: GOOGLE_CLIENT_ID,
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES,
    })
    .then(() => {
      // Listen for sign‑in status changes and update the UI accordingly
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      // Handle current sign‑in status
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
      // Attach click handlers to the authorization buttons
      document.getElementById('authorize_button').onclick = handleAuthClick;
      document.getElementById('signout_button').onclick = handleSignoutClick;
    })
    .catch((error) => {
      console.error('Error initialising Google API client', error);
    });
}

/**
 * Called when the sign‑in status changes. If signed in, hide the authorize
 * button and show the sign‑out button, then fetch and list upcoming events.
 * @param {boolean} isSignedIn
 */
function updateSigninStatus(isSignedIn) {
  const authorizeButton = document.getElementById('authorize_button');
  const signoutButton = document.getElementById('signout_button');
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'inline-block';
    listUpcomingEvents();
  } else {
    authorizeButton.style.display = 'inline-block';
    signoutButton.style.display = 'none';
    // Clear events if user signed out
    document.getElementById('events').innerHTML = '';
  }
}

/**
 * Sign in the user upon button click. This triggers Google's OAuth flow.
 */
function handleAuthClick() {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 * Sign out the user upon button click.
 */
function handleSignoutClick() {
  gapi.auth2.getAuthInstance().signOut();
}

/**
 * List the next 10 events from the signed‑in user's primary calendar. The
 * events are displayed in a simple list with start time and summary.
 */
function listUpcomingEvents() {
  gapi.client.calendar.events
    .list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 10,
      orderBy: 'startTime',
    })
    .then((response) => {
      const events = response.result.items;
      const eventsList = document.getElementById('events');
      eventsList.innerHTML = '';
      if (events.length > 0) {
        events.forEach((event) => {
          const when = event.start.dateTime || event.start.date;
          const li = document.createElement('li');
          li.textContent = `${new Date(when).toLocaleString()} — ${event.summary}`;
          eventsList.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = 'No upcoming events found.';
        eventsList.appendChild(li);
      }
    })
    .catch((err) => {
      console.error('Error fetching events', err);
    });
}

// -----------------------------------------------------------------------------
// Bootstrap function called from index.html
// -----------------------------------------------------------------------------
/**
 * Called once the page loads and gapi is available. This attaches the
 * initClient function to gapi and starts all other components (notes,
 * weather, etc.). We expose this function on the window object so that
 * index.html can call it after gapi loads.
 */
window.initGoogle = function () {
  // Initialize the Google API client library
  gapi.load('client:auth2', initClient);
  // Initialize notes (will fail gracefully if Firebase is not configured)
  initNotes();
  // Fetch weather for Aarhus, Denmark (lat 56.1572, lon 10.2107)
  fetchWeather(56.1572, 10.2107, 'aarhus-temp', 'aarhus-desc');
  // Fetch weather for Newton, New Jersey (lat 41.0582, lon -74.7527)
  fetchWeather(41.0582, -74.7527, 'newton-temp', 'newton-desc');
};
