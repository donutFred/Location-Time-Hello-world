// ---------- Time ----------
function updateClock() {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const tzName =
    Intl.DateTimeFormat(undefined, { timeZoneName: "long" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "Local Time";

  document.getElementById("clock").textContent = formatted;
  document.getElementById("tz").textContent = tzName;
}

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

updateClock();
setInterval(updateClock, 1000);

// ---------- Geolocation ----------
const locStatus = document.getElementById("locationStatus");
const locData = document.getElementById("locationData");
const locErr = document.getElementById("locationError");

function setPageSectionsVisible(visible) {
  const cards = document.querySelectorAll("main.container .card");
  const footer = document.querySelector("footer");
  cards.forEach((card) => {
    // always keep current-grid visible even when location fails
    if (card.classList.contains("current-grid")) {
      card.style.display = "grid";
    } else {
      card.style.display = visible ? "" : "none";
    }
  });
  if (footer) footer.style.display = visible ? "block" : "none";
}

// Weather elements
const wxStatus = document.getElementById("weatherStatus");
const wxData = document.getElementById("weatherData");
const wxErr = document.getElementById("weatherError");

// Leaflet instances
let map, marker, accuracyCircle;

// Alert settings with localStorage persistence
const SETTINGS_KEY = "weatherWarningSettings";
const DEFAULT_SETTINGS = {
  maxWindGustAlarm: 50,
  maxWindGustCaution: 30,
  minTempAlarm: 0,
  minTempCaution: 10,
  maxTempAlarm: 40,
  maxTempCaution: 30,
};
let settings = loadSettings();

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.warn("Settings load failed", e);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Settings save failed", e);
  }
}

function updateScaleBar(config) {
  const {
    barId,
    fillId,
    cautionMarkerId,
    alarmMarkerId,
    cautionInputWrapperId,
    alarmInputWrapperId,
    normalLabelId,
    cautionLabelId,
    alarmLabelId,
    cautionValue,
    alarmValue,
    unit,
  } = config;

  const bar = document.getElementById(barId);
  const barFill = document.getElementById(fillId);
  const cautionMarker = document.getElementById(cautionMarkerId);
  const alarmMarker = document.getElementById(alarmMarkerId);
  const cautionInputWrapper = document.getElementById(cautionInputWrapperId);
  const alarmInputWrapper = document.getElementById(alarmInputWrapperId);
  const normalLabel = document.getElementById(normalLabelId);
  const cautionLabel = document.getElementById(cautionLabelId);
  const alarmLabel = document.getElementById(alarmLabelId);

  if (
    !bar ||
    !barFill ||
    !cautionMarker ||
    !alarmMarker ||
    !cautionInputWrapper ||
    !alarmInputWrapper ||
    !normalLabel ||
    !cautionLabel ||
    !alarmLabel
  )
    return;

  const caution = Number(cautionValue || 0);
  const alarm = Number(alarmValue || 0);
  const max = Math.max(alarm, caution, 100);

  const cautionPct = Math.min(100, (caution / max) * 100);
  const alarmPct = Math.min(100, (alarm / max) * 100);

  const normalColour = config.normalColour || "transparent";
  const cautionColour = config.cautionColour;
  const alarmColour = config.alarmColour;

  barFill.style.background = `linear-gradient(to right, ${normalColour} 0%, ${normalColour} ${cautionPct}%, ${cautionColour} ${cautionPct}%, ${cautionColour} ${alarmPct}%, ${alarmColour} ${alarmPct}%, ${alarmColour} 100%)`;

  cautionMarker.style.left = `${cautionPct}%`;
  alarmMarker.style.left = `${alarmPct}%`;

  cautionInputWrapper.style.left = `${cautionPct}%`;
  alarmInputWrapper.style.left = `${alarmPct}%`;

  cautionLabel.textContent = `Caution (${caution} ${unit})`;
  alarmLabel.textContent = `Alarm (${alarm} ${unit})`;
  normalLabel.textContent = "Normal";

  cautionLabel.style.color = "rgba(255,165,0,1)";
  alarmLabel.style.color = "rgba(255,0,0,1)";
  normalLabel.style.color = "#9bb6d6";

  cautionMarker.style.backgroundColor = "rgba(255,165,0,1)";
  alarmMarker.style.backgroundColor = "rgba(255,0,0,1)";
}

function updateWindGustBar(currentSettings = settings) {
  updateScaleBar({
    barId: "gustScaleBar",
    fillId: "gustScaleFill",
    cautionMarkerId: "gustCautionMarker",
    alarmMarkerId: "gustAlarmMarker",
    cautionInputWrapperId: "cautionInputWrapper",
    alarmInputWrapperId: "alarmInputWrapper",
    normalLabelId: "gustNormalLabel",
    cautionLabelId: "gustCautionLabel",
    alarmLabelId: "gustAlarmLabel",
    cautionValue: currentSettings.maxWindGustCaution,
    alarmValue: currentSettings.maxWindGustAlarm,
    unit: "km/h",
    normalColour: "transparent",
    cautionColour: "rgba(255,165,0,0.2)",
    alarmColour: "rgba(255,0,0,0.25)",
  });
}

function updateTempScaleBar(currentSettings = settings) {
  updateScaleBar({
    barId: "tempScaleBar",
    fillId: "tempScaleFill",
    cautionMarkerId: "tempCautionMarker",
    alarmMarkerId: "tempAlarmMarker",
    cautionInputWrapperId: "tempCautionInputWrapper",
    alarmInputWrapperId: "tempAlarmInputWrapper",
    normalLabelId: "tempNormalLabel",
    cautionLabelId: "tempCautionLabel",
    alarmLabelId: "tempAlarmLabel",
    cautionValue: currentSettings.maxTempCaution,
    alarmValue: currentSettings.maxTempAlarm,
    unit: "°C",
    normalColour: "transparent",
    cautionColour: "rgba(135,206,250,0.35)",
    alarmColour: "rgba(30,58,138,0.45)",
  });
}

function applySettingsToUI(currentSettings = settings) {
  document.getElementById("maxWindGustAlarm").value =
    currentSettings.maxWindGustAlarm;
  document.getElementById("maxWindGustCaution").value =
    currentSettings.maxWindGustCaution;
  document.getElementById("minTempAlarm").value = currentSettings.minTempAlarm;
  document.getElementById("minTempCaution").value =
    currentSettings.minTempCaution;
  document.getElementById("maxTempAlarm").value = currentSettings.maxTempAlarm;
  document.getElementById("maxTempCaution").value =
    currentSettings.maxTempCaution;

  updateWindGustBar(currentSettings);
  updateTempScaleBar(currentSettings);
}

function readSettingsFromUI() {
  const loaded = {
    maxWindGustAlarm: Number(document.getElementById("maxWindGustAlarm").value),
    maxWindGustCaution: Number(
      document.getElementById("maxWindGustCaution").value,
    ),
    minTempAlarm: Number(document.getElementById("minTempAlarm").value),
    minTempCaution: Number(document.getElementById("minTempCaution").value),
    maxTempAlarm: Number(document.getElementById("maxTempAlarm").value),
    maxTempCaution: Number(document.getElementById("maxTempCaution").value),
  };

  // normalize relationships
  if (loaded.maxWindGustAlarm <= loaded.maxWindGustCaution) {
    loaded.maxWindGustCaution = Math.max(0, loaded.maxWindGustAlarm - 1);
  }
  if (loaded.maxWindGustCaution >= loaded.maxWindGustAlarm) {
    loaded.maxWindGustAlarm = loaded.maxWindGustCaution + 1;
  }

  if (loaded.minTempAlarm >= loaded.minTempCaution) {
    loaded.minTempCaution = loaded.minTempAlarm + 1;
  }
  if (loaded.minTempCaution <= loaded.minTempAlarm) {
    loaded.minTempAlarm = loaded.minTempCaution - 1;
  }

  if (loaded.maxTempAlarm <= loaded.maxTempCaution) {
    loaded.maxTempCaution = Math.max(0, loaded.maxTempAlarm - 1);
  }
  if (loaded.maxTempCaution >= loaded.maxTempAlarm) {
    loaded.maxTempAlarm = loaded.maxTempCaution + 1;
  }

  return loaded;
}

function initSettingsListeners() {
  [
    "maxWindGustAlarm",
    "maxWindGustCaution",
    "minTempAlarm",
    "minTempCaution",
    "maxTempAlarm",
    "maxTempCaution",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      // live validation only; no re-coloring until Save
      const value = Number(el.value);
      if (Number.isNaN(value)) return;

      // enforce relationships in UI entries
      if (
        id === "maxWindGustAlarm" &&
        value <= Number(document.getElementById("maxWindGustCaution").value)
      ) {
        document.getElementById("maxWindGustCaution").value = Math.max(
          0,
          value - 1,
        );
      }
      if (
        id === "maxWindGustCaution" &&
        value >= Number(document.getElementById("maxWindGustAlarm").value)
      ) {
        document.getElementById("maxWindGustAlarm").value = value + 1;
      }
      if (
        id === "minTempAlarm" &&
        value >= Number(document.getElementById("minTempCaution").value)
      ) {
        document.getElementById("minTempCaution").value = value + 1;
      }
      if (
        id === "minTempCaution" &&
        value <= Number(document.getElementById("minTempAlarm").value)
      ) {
        document.getElementById("minTempAlarm").value = value - 1;
      }
      if (
        id === "maxTempAlarm" &&
        value <= Number(document.getElementById("maxTempCaution").value)
      ) {
        document.getElementById("maxTempCaution").value = Math.max(
          0,
          value - 1,
        );
      }
      if (
        id === "maxTempCaution" &&
        value >= Number(document.getElementById("maxTempAlarm").value)
      ) {
        document.getElementById("maxTempAlarm").value = value + 1;
      }
    });
  });

  const saveBtn = document.getElementById("saveSettingsButton");
  const status = document.getElementById("settingsSavedMessage");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      settings = readSettingsFromUI();
      saveSettings();
      applySettingsToUI();
      if (window.cachedForecast && window.cachedForecast.time?.length) {
        buildForecast(window.cachedForecast);
      }
      if (status) {
        status.style.display = "inline";
        setTimeout(() => {
          status.style.display = "none";
        }, 2000);
      }
    });
  }
}

function initMapIfNeeded(lat, lon, zoom = 8) {
  if (!map) {
    map = L.map("map").setView([lat, lon], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  } else {
    map.setView([lat, lon], map.getZoom() || zoom);
  }
}

function showPosition(pos) {
  setPageSectionsVisible(true);
  const retryButton = document.getElementById("retryLocationButton");
  if (retryButton) retryButton.style.display = "none";

  const { latitude, longitude, accuracy } = pos.coords;

  // Update location text UI
  document.getElementById("lat").textContent = latitude.toFixed(6);
  document.getElementById("lon").textContent = longitude.toFixed(6);
  locData.classList.remove("hidden");
  locErr.classList.add("hidden");
  locStatus.textContent = "Location resolved. Loading weather...";

  // Update weather status while we fetch new weather
  wxStatus.textContent = "Loading weather...";
  wxStatus.style.display = "block";
  wxErr.classList.add("hidden");

  // Init/center map first
  initMapIfNeeded(latitude, longitude);

  // Place/Update marker & accuracy circle
  if (!marker) {
    marker = L.marker([latitude, longitude]).addTo(map);
  } else {
    marker.setLatLng([latitude, longitude]);
  }

  if (!accuracyCircle) {
    accuracyCircle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: "#22d3ee",
      fillColor: "#22d3ee",
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);
  } else {
    accuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy);
  }

  // Address and weather for these coordinates
  fetchAddress(latitude, longitude);
  fetchWeather(latitude, longitude);
}

// initialize settings UI + events
applySettingsToUI();
initSettingsListeners();

// release date (adjust as needed)
const RELEASE_DATE = "2026-03-15";
const releaseDateEl = document.getElementById("releaseDate");
if (releaseDateEl) {
  releaseDateEl.textContent = RELEASE_DATE;
}

function showError(err) {
  locData.classList.add("hidden");
  locErr.classList.remove("hidden");
  wxData.classList.add("hidden");
  wxStatus.textContent = "";

  setPageSectionsVisible(false);
  const retryButton = document.getElementById("retryLocationButton");
  if (retryButton) retryButton.style.display = "block";

  switch (err.code) {
    case err.PERMISSION_DENIED:
      locStatus.textContent = "Permission denied.";
      locErr.textContent =
        "This app needs your location to work. Please allow location access to continue.";
      wxErr.classList.remove("hidden");
      wxErr.textContent = "Weather requires your approximate location.";
      break;
    case err.POSITION_UNAVAILABLE:
      locStatus.textContent = "Location unavailable.";
      locErr.textContent = "We couldn’t determine your location.";
      wxErr.classList.remove("hidden");
      wxErr.textContent = "Weather requires a location.";
      break;
    case err.TIMEOUT:
      locStatus.textContent = "Location timed out.";
      locErr.textContent = "Getting your position took too long.";
      wxErr.classList.remove("hidden");
      wxErr.textContent = "Weather requires a location.";
      break;
    default:
      locStatus.textContent = "Location error.";
      locErr.textContent = "An unknown error occurred.";
      wxErr.classList.remove("hidden");
      wxErr.textContent = "Weather requires a location.";
  }
}

// Hide non-essential panels until location is resolved
setPageSectionsVisible(false);

// Request location when the page loads (HTTPS required on most browsers)
if ("geolocation" in navigator) {
  locStatus.textContent = "Waiting for your location...";
  navigator.geolocation.getCurrentPosition(showPosition, showError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
} else {
  setPageSectionsVisible(false);
  locStatus.textContent = "Geolocation not supported in this browser.";
  wxStatus.textContent = "Weather requires a location.";
}

// Retry button
const retryButton = document.getElementById("retryLocationButton");
if (retryButton) {
  retryButton.addEventListener("click", () => {
    retryButton.style.display = "none";
    locStatus.textContent = "Retrying location...";
    locErr.classList.add("hidden");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(showPosition, showError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    } else {
      locStatus.textContent = "Geolocation not supported in this browser.";
    }
  });
}

// ---------- Weather (Open‑Meteo, no API key) ----------
const WMO_DESCRIPTIONS = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const WMO_ICONS = {
  0: "☀️",
  1: "🌤",
  2: "⛅",
  3: "☁️",
  45: "🌫",
  48: "🌫",
  51: "🌦",
  53: "🌦",
  55: "🌧",
  56: "🌧❄️",
  57: "🌧❄️",
  61: "🌧",
  63: "🌧",
  65: "⛈",
  66: "🌧❄️",
  67: "🌧❄️",
  71: "🌨",
  73: "🌨",
  75: "🌨",
  77: "🌨",
  80: "🌦",
  81: "🌧",
  82: "⛈",
  85: "❄️",
  86: "❄️",
  95: "⛈",
  96: "⛈",
  99: "⛈",
};

function getWeatherIcon(code, isDay) {
  const icon = WMO_ICONS[code] || "🌈";
  if (!isDay) {
    if (code === 0) return "🌙";
    if ([1, 2, 3, 45, 48].includes(code)) return "🌜";
  }
  return icon;
}

function degToCompass(deg) {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

function bearingArrow(deg) {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return "—";
  const d = ((deg % 360) + 360) % 360;
  if (d >= 337.5 || d < 22.5) return "↑";
  if (d >= 22.5 && d < 67.5) return "↗";
  if (d >= 67.5 && d < 112.5) return "→";
  if (d >= 112.5 && d < 157.5) return "↘";
  if (d >= 157.5 && d < 202.5) return "↓";
  if (d >= 202.5 && d < 247.5) return "↙";
  if (d >= 247.5 && d < 292.5) return "←";
  return "↖";
}

function extractSuburb(address) {
  if (!address || typeof address !== "object") return null;
  const keys = [
    "suburb",
    "neighbourhood",
    "city_district",
    "quarter",
    "town",
    "village",
    "city",
    "municipality",
    "county",
    "state",
  ];

  const found = keys.map((k) => address[k]).find(Boolean);
  return found || null;
}

async function fetchAddress(lat, lon) {
  const addrEl = document.getElementById("address");
  try {
    addrEl.textContent = "Fetching general location…";
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": "WeatherWarning/1.0",
        },
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const suburb = extractSuburb(data.address);
    const state = data.address?.state;
    const country = data.address?.country;
    if (suburb) {
      addrEl.textContent = [suburb, state, country].filter(Boolean).join(", ");
    } else {
      const general =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        data.address?.state;
      addrEl.textContent = general
        ? [general, state, country].filter(Boolean).join(", ")
        : data.display_name
          ? data.display_name.split(",").slice(-3).join(", ")
          : "Approximate location";
    }
  } catch (err) {
    console.warn("Reverse geocode failed", err);
    addrEl.textContent = "Approximate location unknown";
  }
}

function formatBucket(hour) {
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Daytime";
  if (hour >= 18 && hour < 24) return "Evening";
  return "Night";
}

function formatHour12(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const base = normalized % 12 || 12;
  return { hour: base, suffix };
}

function formatHourRange(startHour, endHour) {
  const start = formatHour12(startHour);
  const end = formatHour12(endHour);

  const startPart = `${start.hour}`;
  const endPart = `${end.hour}${end.suffix}`;

  if (start.suffix === end.suffix) {
    if (start.hour === 11 && end.hour === 12 && start.suffix === "AM") {
      // crosses AM->PM at 12
      return `${start.hour}${start.suffix}-${endPart}`;
    }
    return `${startPart}-${endPart}`;
  }

  return `${start.hour}${start.suffix}-${endPart}`;
}

function getDayName(date, weekdayStyle = "long") {
  return date.toLocaleDateString(undefined, { weekday: weekdayStyle });
}

function getSegmentTimeClass(date) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 8) return "time-twilight-morning";
  if (hour >= 8 && hour < 18) return "time-day";
  if (hour >= 18 && hour < 20) return "time-twilight-evening";
  return "time-night";
}

function getWeatherSeverity(code) {
  if (code === undefined || code === null) return 0;
  // lower is better; higher is more severe.
  if (code <= 1) return 1;
  if (code <= 3) return 2;
  if (code <= 48) return 3;
  if (code <= 51) return 4;
  if (code <= 57) return 5;
  if (code <= 67) return 6;
  if (code <= 77) return 7;
  if (code <= 80) return 5;
  if (code <= 86) return 6;
  if (code <= 99) return 8;
  return 9;
}

function updateLookaheadSummary(segments) {
  const container = document.getElementById("lookaheadSummary");
  if (!container) return;

  if (!segments || segments.length === 0) {
    container.textContent = "no concern";
    return;
  }

  const maxGust = Math.max(
    ...segments.map((s) => (s.maxGust !== undefined ? s.maxGust : 0)),
  );
  const maxWind = Math.max(
    ...segments.map((s) => (s.maxWind !== undefined ? s.maxWind : 0)),
  );
  const minTemp = Math.min(
    ...segments.map((s) => (s.minTemp !== undefined ? s.minTemp : Infinity)),
  );
  const maxTemp = Math.max(
    ...segments.map((s) => (s.maxTemp !== undefined ? s.maxTemp : -Infinity)),
  );

  const gustStatus =
    maxGust >= settings.maxWindGustAlarm
      ? "alarm"
      : maxGust >= settings.maxWindGustCaution
        ? "warning"
        : "normal";
  const tempStatus =
    maxTemp >= settings.maxTempAlarm || minTemp <= settings.minTempAlarm
      ? "alarm"
      : maxTemp >= settings.maxTempCaution || minTemp <= settings.minTempCaution
        ? "warning"
        : "normal";

  const bestCondition = segments.reduce((best, segment) => {
    if (segment.code === undefined) return best;
    const severity = getWeatherSeverity(segment.code);
    if (!best || severity > best.severity) {
      return { severity, code: segment.code };
    }
    return best;
  }, null);

  const conditions = [];
  conditions.push({
    priority: gustStatus === "alarm" ? 3 : gustStatus === "warning" ? 2 : 1,
    label: `Wind Gust: ${maxGust} km/h (${gustStatus})`,
  });
  conditions.push({
    priority: tempStatus === "alarm" ? 3 : tempStatus === "warning" ? 2 : 1,
    label: `Temperature spread: ${isFinite(minTemp) ? Math.round(minTemp) + "°C" : "—"} to ${isFinite(maxTemp) ? Math.round(maxTemp) + "°C" : "—"} (${tempStatus})`,
  });
  if (bestCondition && bestCondition.severity > 2) {
    conditions.push({
      priority: bestCondition.severity,
      label: `Condition: ${WMO_DESCRIPTIONS[bestCondition.code] || "Unknown"}`,
    });
  }

  conditions.sort((a, b) => b.priority - a.priority);

  const hasConcern = conditions.some((c) => c.priority > 1);

  if (!hasConcern) {
    container.textContent = "no concern";
    return;
  }

  const lines = [];
  lines.push(`<div><strong>Winds</strong></div>`);
  lines.push(
    `<div>${conditions.find((c) => c.label.startsWith("Wind Gust")).label}</div>`,
  );
  lines.push(`<div><strong>Temperature</strong></div>`);
  lines.push(
    `<div>${conditions.find((c) => c.label.startsWith("Temperature spread")).label}</div>`,
  );

  const additional = conditions.filter(
    (c) =>
      !c.label.startsWith("Wind Gust") &&
      !c.label.startsWith("Temperature spread"),
  );
  if (additional.length) {
    lines.push(`<div><strong>Other</strong></div>`);
    additional.forEach((item) => lines.push(`<div>${item.label}</div>`));
  }

  container.innerHTML = lines.join("");
}

function buildForecast(data) {
  const headerRow = document.getElementById("forecast24HeaderRow");
  const body24 = document.getElementById("forecast24Body");
  const rowsSummary = document.getElementById("forecastRowsSummary");

  headerRow.innerHTML = "<th></th>";
  body24.innerHTML = "";
  rowsSummary.innerHTML = "";

  const times = data.time || [];
  const temps = data.temperature_2m || [];
  const feels = data.apparent_temperature_2m || [];
  const codes = data.weathercode || [];
  const gusts = data.windgusts_10m || [];
  const windDirs = data.winddirection_10m || [];
  const windSpeeds = data.wind_speed_10m || [];

  // next full hour
  const now = new Date();
  const nextFullHour = new Date(now);
  nextFullHour.setMinutes(0, 0, 0);
  nextFullHour.setHours(nextFullHour.getHours() + 1);
  const startIndex = times.findIndex(
    (t) => new Date(t).getTime() >= nextFullHour.getTime(),
  );
  const start = startIndex >= 0 ? startIndex : 0;
  const end = Math.min(start + 24, times.length);

  const forecast24Heading = document.getElementById("forecast24Heading");
  if (forecast24Heading) {
    forecast24Heading.textContent = "Next 24 hours";
  }

  // group into 2-hour intervals (12 segments max)
  const segments = [];
  for (let segStart = start; segStart < end; segStart += 2) {
    const segEnd = Math.min(segStart + 2, end);
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let minFeel = Infinity;
    let maxFeel = -Infinity;
    let maxWind = -Infinity;
    let windDir = undefined;
    let maxGust = -Infinity;
    let gustDir = undefined;
    let bestCode = undefined;
    let bestSeverity = -Infinity;
    let bestWind = -Infinity;

    for (let idx = segStart; idx < segEnd; idx++) {
      const temp = temps[idx];
      const feel = feels[idx];
      const wind = windSpeeds[idx];
      const gust = gusts[idx];
      const code = codes[idx];
      const dir = windDirs[idx];

      if (temp !== undefined) {
        minTemp = Math.min(minTemp, temp);
        maxTemp = Math.max(maxTemp, temp);
      }
      if (feel !== undefined) {
        minFeel = Math.min(minFeel, feel);
        maxFeel = Math.max(maxFeel, feel);
      }
      if (wind !== undefined && wind > maxWind) {
        maxWind = wind;
        windDir = dir;
      }
      if (gust !== undefined && gust > maxGust) {
        maxGust = gust;
        gustDir = dir;
      }

      const severity = code !== undefined ? getWeatherSeverity(code) : 0;
      const keyScale = Math.max(gust || 0, wind || 0);
      if (
        severity > bestSeverity ||
        (severity === bestSeverity && keyScale > bestWind)
      ) {
        bestSeverity = severity;
        bestWind = keyScale;
        bestCode = code;
      }
    }

    const startDate = new Date(times[segStart]);
    const startHour = startDate.getHours();
    const labelHour2 = (startHour + 1) % 24;

    segments.push({
      label: formatHourRange(startHour, labelHour2),
      date: startDate,
      timeClass: getSegmentTimeClass(startDate),
      code: bestCode,
      minTemp: minTemp === Infinity ? undefined : minTemp,
      maxTemp: maxTemp === -Infinity ? undefined : maxTemp,
      minFeel: minFeel === Infinity ? undefined : minFeel,
      maxFeel: maxFeel === -Infinity ? undefined : maxFeel,
      maxWind: maxWind === -Infinity ? undefined : maxWind,
      windDir,
      maxGust: maxGust === -Infinity ? undefined : maxGust,
      gustDir,
    });
  }

  // draw 24-hour symbol row and label row
  const symbolRow = document.getElementById("forecast24SymbolRow");

  const symbolRanges = [];
  segments.forEach((segment) => {
    const symbol =
      segment.timeClass === "time-day"
        ? "☀"
        : segment.timeClass === "time-night"
          ? "🌙"
          : "☀";

    if (
      !symbolRanges.length ||
      symbolRanges[symbolRanges.length - 1].symbol !== symbol
    ) {
      symbolRanges.push({
        symbol,
        span: 1,
        timeClass: segment.timeClass,
      });
    } else {
      symbolRanges[symbolRanges.length - 1].span += 1;
    }
  });

  if (symbolRow) {
    symbolRow.innerHTML = "<th></th>";
    symbolRanges.forEach((range) => {
      const symbolCell = document.createElement("th");
      symbolCell.classList.add("symbol-cell");
      symbolCell.classList.add(
        range.timeClass === "time-day" ? "sun-symbol" : "moon-symbol",
      );
      symbolCell.colSpan = range.span;
      symbolCell.textContent = range.symbol;
      symbolRow.appendChild(symbolCell);
    });
  }

  segments.forEach((segment) => {
    const cell = document.createElement("th");
    cell.textContent = segment.label;
    cell.classList.add(segment.timeClass);
    headerRow.appendChild(cell);
  });

  const rowDef = (label) => {
    const row = document.createElement("tr");
    const cell = document.createElement("th");
    cell.textContent = label;
    row.appendChild(cell);
    return row;
  };

  const dayRow = document.createElement("tr");
  const dayLabelCell = document.createElement("th");
  dayLabelCell.textContent = "Day";
  dayRow.appendChild(dayLabelCell);

  let currentDayName = null;
  let currentDayCell = null;
  let daySpan = 0;

  segments.forEach((segment, index) => {
    const dayName = getDayName(segment.date);
    const dayLabel = `${dayName} ${segment.date.getDate()}`;
    if (dayName !== currentDayName) {
      if (currentDayCell) {
        currentDayCell.colSpan = daySpan;
      }
      currentDayName = dayName;
      daySpan = 1;
      currentDayCell = document.createElement("th");
      currentDayCell.textContent = dayLabel;
      dayRow.appendChild(currentDayCell);
    } else {
      daySpan += 1;
      if (currentDayCell) {
        currentDayCell.textContent = dayLabel;
      }
    }
    if (index === segments.length - 1 && currentDayCell) {
      currentDayCell.colSpan = daySpan;
    }
  });

  const conditionRow = rowDef("Condition");
  const tempRow = rowDef("Temp");
  const windRow = rowDef("Wind");
  const gustRow = rowDef("Max Gust");

  segments.forEach((segment) => {
    const condCell = document.createElement("td");
    condCell.innerHTML = `<span class="condition-icon">${getWeatherIcon(segment.code, true)}</span> <span class="condition-text">${WMO_DESCRIPTIONS[segment.code] || "—"}</span>`;
    conditionRow.appendChild(condCell);

    const tempCell = document.createElement("td");
    tempCell.innerHTML =
      segment.minTemp !== undefined
        ? `<span class="digits">${Math.round(segment.minTemp)}</span><span class="unit">-${Math.round(segment.maxTemp)}°C</span>`
        : "—";
    if (segment.minTemp !== undefined) {
      if (segment.minTemp <= settings.minTempAlarm)
        tempCell.classList.add("forecast-alarm-cold");
      else if (segment.minTemp <= settings.minTempCaution)
        tempCell.classList.add("forecast-caution-cold");
      else if (segment.maxTemp >= settings.maxTempAlarm)
        tempCell.classList.add("forecast-alarm");
      else if (segment.maxTemp >= settings.maxTempCaution)
        tempCell.classList.add("forecast-warning");
    }
    tempRow.appendChild(tempCell);

    const windCell = document.createElement("td");
    windCell.innerHTML =
      segment.maxWind !== undefined
        ? `<span class="digits">${Math.round(segment.maxWind)}</span><span class="unit"> km/h </span><span class="unit">${segment.windDir !== undefined ? bearingArrow(segment.windDir) + " " + degToCompass(segment.windDir) : ""}</span>`
        : "—";
    windRow.appendChild(windCell);

    const gustCell = document.createElement("td");
    gustCell.innerHTML =
      segment.maxGust !== undefined
        ? `<span class="digits">${Math.round(segment.maxGust)}</span><span class="unit"> km/h </span><span class="unit">${segment.gustDir !== undefined ? bearingArrow(segment.gustDir) + " " + degToCompass(segment.gustDir) : ""}</span>`
        : "—";
    if (segment.maxGust !== undefined) {
      if (segment.maxGust >= settings.maxWindGustAlarm)
        gustCell.classList.add("forecast-alarm");
      else if (segment.maxGust >= settings.maxWindGustCaution)
        gustCell.classList.add("forecast-warning");
    }
    gustRow.appendChild(gustCell);
  });

  body24.append(conditionRow, dayRow, tempRow, windRow, gustRow);
  updateLookaheadSummary(segments);

  // summary 25h-7d by day with morning/day/evening/night columns
  const dayStats = {}; // {day: stats}
  for (let i = 24; i < Math.min(times.length, 168); i++) {
    const d = new Date(times[i]);
    const dayKey = d.toLocaleDateString();
    const bucketKey = formatBucket(d.getHours()).toLowerCase();

    const temp = temps[i];
    const gust = gusts[i];
    const code = codes[i];
    const dir = windDirs[i];

    if (!dayStats[dayKey]) {
      dayStats[dayKey] = {
        date: d,
        periods: {
          morning: {
            minTemp: Infinity,
            maxTemp: -Infinity,
            maxGust: -Infinity,
            bestCode: undefined,
            bestSeverity: -Infinity,
            maxGustDir: undefined,
          },
          daytime: {
            minTemp: Infinity,
            maxTemp: -Infinity,
            maxGust: -Infinity,
            bestCode: undefined,
            bestSeverity: -Infinity,
            maxGustDir: undefined,
          },
          evening: {
            minTemp: Infinity,
            maxTemp: -Infinity,
            maxGust: -Infinity,
            bestCode: undefined,
            bestSeverity: -Infinity,
            maxGustDir: undefined,
          },
          night: {
            minTemp: Infinity,
            maxTemp: -Infinity,
            maxGust: -Infinity,
            bestCode: undefined,
            bestSeverity: -Infinity,
            maxGustDir: undefined,
          },
        },
      };
    }

    const entry = dayStats[dayKey];
    const period = entry.periods[bucketKey];
    if (!period) continue;

    if (temp !== undefined) {
      period.minTemp = Math.min(period.minTemp, temp);
      period.maxTemp = Math.max(period.maxTemp, temp);
    }
    if (gust !== undefined && gust > period.maxGust) {
      period.maxGust = gust;
      period.maxGustDir = dir;
    }
    if (code !== undefined) {
      const severity = getWeatherSeverity(code);
      if (severity > period.bestSeverity) {
        period.bestSeverity = severity;
        period.bestCode = code;
      }
    }
  }

  const summaryRows = Object.values(dayStats).sort((a, b) => a.date - b.date);

  const header = document.getElementById("forecastSummaryHeader");
  if (header) {
    header.innerHTML = "";
    const topRow = document.createElement("tr");
    const dayHeader = document.createElement("th");
    dayHeader.textContent = "Day";
    dayHeader.rowSpan = 2;
    topRow.appendChild(dayHeader);

    const groups = [
      { label: "Conditions", span: 4 },
      { label: "Temperature (min-max)", span: 4 },
      { label: "Max Wind Gusts", span: 4 },
    ];

    groups.forEach((group) => {
      const th = document.createElement("th");
      th.colSpan = group.span;
      th.textContent = group.label;
      topRow.appendChild(th);
    });

    const subRow = document.createElement("tr");
    ["Condition", "Temp", "Max Gust"].forEach(() => {
      ["Morning", "Daytime", "Evening", "Night"].forEach((periodName) => {
        const th = document.createElement("th");
        th.textContent = periodName;
        subRow.appendChild(th);
      });
    });

    header.append(topRow, subRow);
  }

  summaryRows.forEach((entry) => {
    const row = document.createElement("tr");
    const dayCell = document.createElement("td");
    dayCell.textContent = `${getDayName(entry.date, "short")} ${entry.date.getDate()}`;
    row.appendChild(dayCell);

    const buckets = ["morning", "daytime", "evening", "night"];

    // conditions first
    buckets.forEach((bucket) => {
      const period = entry.periods[bucket];
      const condCell = document.createElement("td");
      if (period && period.bestCode !== undefined) {
        condCell.innerHTML = `${getWeatherIcon(period.bestCode, true)} ${WMO_DESCRIPTIONS[period.bestCode] || "—"}`;
      } else {
        condCell.textContent = "—";
      }
      row.appendChild(condCell);
    });

    // temps next
    buckets.forEach((bucket) => {
      const period = entry.periods[bucket];
      const tempCell = document.createElement("td");
      if (
        period &&
        period.minTemp !== Infinity &&
        period.maxTemp !== -Infinity
      ) {
        tempCell.textContent = `${Math.round(period.minTemp)}-${Math.round(period.maxTemp)}°C`;
        if (period.minTemp <= settings.minTempAlarm)
          tempCell.classList.add("forecast-alarm-cold");
        else if (period.minTemp <= settings.minTempCaution)
          tempCell.classList.add("forecast-caution-cold");
        else if (period.maxTemp >= settings.maxTempAlarm)
          tempCell.classList.add("forecast-alarm");
        else if (period.maxTemp >= settings.maxTempCaution)
          tempCell.classList.add("forecast-warning");
      } else {
        tempCell.textContent = "—";
      }
      row.appendChild(tempCell);
    });

    // max gust next
    buckets.forEach((bucket) => {
      const period = entry.periods[bucket];
      const gustCell = document.createElement("td");
      if (period && period.maxGust !== -Infinity) {
        gustCell.textContent = `${Math.round(period.maxGust)} km/h ${period.maxGustDir !== undefined ? bearingArrow(period.maxGustDir) + " " + degToCompass(period.maxGustDir) : ""}`;
        if (period.maxGust >= settings.maxWindGustAlarm)
          gustCell.classList.add("forecast-alarm");
        else if (period.maxGust >= settings.maxWindGustCaution)
          gustCell.classList.add("forecast-warning");
      } else {
        gustCell.textContent = "—";
      }
      row.appendChild(gustCell);
    });

    rowsSummary.appendChild(row);
  });
}

async function fetchWeather(lat, lon) {
  try {
    wxStatus.textContent = "Loading weather...";

    // Open‑Meteo current + hourly forecast for 7 days
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,weathercode,winddirection_10m,wind_speed_10m,windgusts_10m,relativehumidity_2m` +
      `&forecast_days=7` +
      `&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const c = data.current_weather;
    if (!c) throw new Error("No current weather in response");

    const todayHumidity = data.hourly?.relativehumidity_2m?.[0];
    const todayTemp = c.temperature;
    const todayWindSpeed = c.windspeed;
    const todayWindDir = c.winddirection;

    const desc = WMO_DESCRIPTIONS[c.weathercode] ?? `Code ${c.weathercode}`;
    const windDirText =
      typeof todayWindDir === "number"
        ? `${degToCompass(todayWindDir)} (${Math.round(todayWindDir)}°)`
        : "—";

    const readableDesc = desc;
    setTextById("wxDesc", readableDesc);
    setTextById("wxIcon", getWeatherIcon(c.weathercode, true));
    setTextById("wxIconLabel", readableDesc);
    setTextById(
      "wxTemp",
      todayTemp !== undefined ? `${Math.round(todayTemp)}°C` : "—",
    );
    setTextById(
      "wxFeels",
      todayTemp !== undefined ? `${Math.round(todayTemp)}°C` : "—",
    );
    setTextById(
      "wxWind",
      todayWindSpeed !== undefined && todayWindDir !== undefined
        ? `${Math.round(todayWindSpeed)} km/h ${bearingArrow(todayWindDir)} ${degToCompass(todayWindDir)}`
        : "—",
    );
    setTextById(
      "wxHum",
      todayHumidity !== undefined ? `${Math.round(todayHumidity)}%` : "—",
    );
    setTextById("updatedInfo", `Updated: ${c.time}`);

    // Forecast table (hourly + 6h steps) from hourly payload
    const hourly = data.hourly || {};

    // Cache forecast data for settings changes
    window.cachedForecast = {
      time: hourly.time || [],
      temperature_2m: hourly.temperature_2m || [],
      weathercode: hourly.weathercode || [],
      windgusts_10m: hourly.windgusts_10m || [],
      winddirection_10m: hourly.winddirection_10m || [],
      wind_speed_10m: hourly.wind_speed_10m || [],
    };

    const hasForecast =
      Array.isArray(hourly.time) &&
      Array.isArray(hourly.temperature_2m) &&
      Array.isArray(hourly.weathercode) &&
      Array.isArray(hourly.winddirection_10m) &&
      Array.isArray(hourly.wind_speed_10m) &&
      Array.isArray(hourly.windgusts_10m);

    if (hasForecast) {
      buildForecast(hourly);
      document.getElementById("forecastData").classList.remove("hidden");
      document.getElementById("forecastError").classList.add("hidden");
      document.getElementById("forecastStatus").textContent = "Forecast ready.";
    } else {
      document.getElementById("forecastData").classList.add("hidden");
      document.getElementById("forecastError").classList.remove("hidden");
      document.getElementById("forecastError").textContent =
        "Forecast data not available.";
      document.getElementById("forecastStatus").textContent = "";
    }

    wxData.classList.remove("hidden");
    wxErr.classList.add("hidden");
    wxStatus.textContent = "";
    wxStatus.style.display = "none";
  } catch (e) {
    wxData.classList.add("hidden");
    wxErr.classList.remove("hidden");
    wxErr.textContent = `Could not load weather data: ${e.message || e}`;

    document.getElementById("forecastData").classList.add("hidden");
    document.getElementById("forecastError").classList.remove("hidden");
    document.getElementById("forecastError").textContent =
      `Forecast unavailable: ${e.message || e}`;
    document.getElementById("forecastStatus").textContent = "";

    wxStatus.textContent = "Could not load weather data.";
    wxStatus.style.display = "block";
    console.error(e);
  }
}
