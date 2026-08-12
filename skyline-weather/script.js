document.addEventListener('DOMContentLoaded', () => {
// ============================
// STATE
// ============================
const state = {
  unit: 'C',          // 'C' or 'F'
  current: null,      // raw current weather object (Celsius, km/h etc.)
  hourly: [],          // array of { time, temp, code }
  daily: [],           // array of { date, max, min, code, rainChance }
  locationLabel: '',
  timezone: 'auto',   // IANA timezone of the searched location, e.g. 'Asia/Karachi'
  clockInterval: null,
  sunrise: null,
  sunset: null,
  airQuality: null    // { aqi, pm2_5, pm10, ozone } or null if unavailable
};

const DEFAULT_LOCATION = { name: 'Rawalpindi, Pakistan', lat: 33.5651, lon: 73.0169 };

// ============================
// DOM refs
// ============================
const els = {
  navToggle: document.getElementById('navToggle'),
  mainNav: document.getElementById('main-nav'),
  unitToggle: document.getElementById('unitToggle'),
  searchForm: document.getElementById('searchForm'),
  citySearch: document.getElementById('citySearch'),
  suggestions: document.getElementById('suggestions'),
  searchHint: document.getElementById('searchHint'),
  locateBtn: document.getElementById('locateBtn'),
  currentSection: document.getElementById('current'),
  locationName: document.getElementById('locationName'),
  locationDate: document.getElementById('locationDate'),
  tempIcon: document.getElementById('tempIcon'),
  tempValue: document.getElementById('tempValue'),
  conditionLabel: document.getElementById('conditionLabel'),
  currentStats: document.getElementById('currentStats'),
  hourlyScroll: document.getElementById('hourlyScroll'),
  hourlyGraph: document.getElementById('hourlyGraph'),
  dailyGrid: document.getElementById('dailyGrid'),
  sunmoonGrid: document.getElementById('sunmoonGrid'),
  aqCard: document.getElementById('aqCard'),
};

// ============================
// Colorful city skyline — procedurally generated once on load.
// Buildings alternate between ink/mocha shades; windows are lit
// in mocha or blue (both brand colors) and twinkle independently.
// ============================
function generateSkyline() {
  const group = document.getElementById('skylineGroup');
  if (!group) return;

  const viewWidth = 1200;
  const baseline = 220;
  const buildingShades = ['var(--ink)', 'var(--mocha-deep)'];
  const windowColors = ['var(--mocha)', 'var(--blue-deep)', 'var(--blue)'];
  const gap = 6;

  let x = 0;
  let i = 0;
  let markup = '';

  while (x < viewWidth) {
    const w = Math.min(50 + Math.random() * 55, viewWidth - x);
    const h = 65 + Math.random() * 100;
    const y = baseline - h;
    const shade = buildingShades[i % 2];

    markup += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${shade}"/>`;

    // Window grid for this building
    const cols = Math.max(2, Math.floor(w / 21));
    const rows = Math.max(2, Math.floor(h / 24));
    const cellW = w / cols;
    const cellH = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.42) continue; // some windows stay dark
        const wx = x + c * cellW + cellW / 2 - 2.5;
        const wy = y + r * cellH + cellH / 2 - 2.5;
        const color = windowColors[Math.floor(Math.random() * windowColors.length)];
        const delay = (Math.random() * 5).toFixed(2);
        const dur = (3 + Math.random() * 3).toFixed(2);
        markup += `<rect class="win" x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="5" height="5" fill="${color}" style="animation-delay:${delay}s;animation-duration:${dur}s;"/>`;
      }
    }

    x += w + gap;
    i++;
  }

  group.innerHTML = markup;
}
generateSkyline();

// Pause hero animations when scrolled off-screen — saves battery/CPU
// on longer scroll sessions without affecting the visible experience.
const heroBanner = document.getElementById('heroBanner');
if (heroBanner && 'IntersectionObserver' in window) {
  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      heroBanner.classList.toggle('paused', !entry.isIntersecting);
    });
  }, { threshold: 0 });
  heroObserver.observe(heroBanner);
}

// ============================
// Mobile nav toggle
// ============================
els.navToggle.addEventListener('click', () => {
  const isOpen = els.mainNav.classList.toggle('open');
  els.navToggle.setAttribute('aria-expanded', isOpen);
});
els.mainNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    els.mainNav.classList.remove('open');
    els.navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ============================
// Button click ripple — works for every .btn, including ones
// added later by JS (event delegation on document).
// ============================
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

// ============================
// Weather icon lookup (WMO codes) — drawn in brand palette
// ============================
function weatherIcon(code, size = 64, isDay = true) {
  const c = {
    sun: 'var(--mocha)',
    moon: 'var(--blue-deep)',
    cloud: 'var(--ink-soft)',
    cloudLight: 'var(--grey)',
    drop: 'var(--blue-deep)',
    bolt: 'var(--mocha-deep)'
  };
  const s = size;

  const sun = `<circle cx="32" cy="32" r="12" fill="${c.sun}"/>
    <g stroke="${c.sun}" stroke-width="3" stroke-linecap="round">
      <line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/>
      <line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/>
      <line x1="13" y1="13" x2="19" y2="19"/><line x1="45" y1="45" x2="51" y2="51"/>
      <line x1="13" y1="51" x2="19" y2="45"/><line x1="45" y1="19" x2="51" y2="13"/>
    </g>`;

  const moon = `<path d="M38 16a17 17 0 1 0 12 27 13 13 0 0 1-12-27z" fill="${c.moon}"/>
    <g fill="${c.moon}" opacity="0.6"><circle cx="14" cy="16" r="1.6"/><circle cx="10" cy="26" r="1.2"/><circle cx="20" cy="10" r="1"/></g>`;

  const orb = isDay ? sun : moon;

  const cloud = `<path d="M18 44a10 10 0 0 1-1-19.9A13 13 0 0 1 42 21a9 9 0 0 1 4 17H18z" fill="${c.cloud}"/>`;
  const cloudSoft = `<path d="M18 44a10 10 0 0 1-1-19.9A13 13 0 0 1 42 21a9 9 0 0 1 4 17H18z" fill="${c.cloudLight}" stroke="${c.cloud}" stroke-width="1.5"/>`;

  const drops = `<g stroke="${c.drop}" stroke-width="3" stroke-linecap="round">
    <line x1="22" y1="48" x2="19" y2="56"/><line x1="32" y1="48" x2="29" y2="56"/><line x1="42" y1="48" x2="39" y2="56"/>
  </g>`;

  const snow = `<g fill="${c.drop}"><circle cx="20" cy="52" r="2.2"/><circle cx="32" cy="55" r="2.2"/><circle cx="44" cy="52" r="2.2"/></g>`;
  const bolt = `<path d="M30 46 22 58h7l-3 8 12-14h-7l4-6z" fill="${c.bolt}"/>`;
  const fogLines = `<g stroke="${c.cloud}" stroke-width="2.5" stroke-linecap="round"><line x1="14" y1="50" x2="50" y2="50"/><line x1="14" y1="56" x2="44" y2="56"/></g>`;

  let svg;
  if (code === 0) svg = orb;
  else if ([1, 2].includes(code)) svg = orb + `<g transform="translate(6,10) scale(0.9)">${cloudSoft}</g>`;
  else if (code === 3) svg = cloud;
  else if ([45, 48].includes(code)) svg = cloud + fogLines;
  else if ([51, 53, 55, 56, 57, 80, 81, 82].includes(code)) svg = cloud + drops;
  else if ([61, 63, 65, 66, 67].includes(code)) svg = cloud + drops;
  else if ([71, 73, 75, 77, 85, 86].includes(code)) svg = cloud + snow;
  else if ([95, 96, 99].includes(code)) svg = cloud + bolt;
  else svg = cloud;

  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">${svg}</svg>`;
}

function weatherLabel(code) {
  const map = {
    0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Foggy, icy fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
    56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm'
  };
  return map[code] || 'Unknown';
}

// ============================
// Unit conversion helpers
// ============================
function displayTemp(celsius) {
  const val = state.unit === 'C' ? celsius : (celsius * 9) / 5 + 32;
  return `${Math.round(val)}°${state.unit}`;
}

// ============================
// Fetch with timeout — prevents infinite "Loading…" on slow/dead connections
// (Uses Promise.race instead of AbortController — AbortSignal can't be
// postMessage-cloned inside some sandboxed preview environments.)
// ============================
function timeoutAfter(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  return Promise.race([fetch(url), timeoutAfter(timeoutMs)]);
}

// ============================
// Fetch: geocoding
// ============================
async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
  const res = await fetchWithTimeout(url, 7000);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.results || [];
}

// ============================
// Fetch: air quality (separate free Open-Meteo endpoint, global coverage)
// ============================
async function fetchAirQuality(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'us_aqi,pm2_5,pm10,ozone,dust,grass_pollen,birch_pollen,alder_pollen',
    timezone: 'auto'
  });
  try {
    const res = await fetchWithTimeout(`https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`, 10000);
    if (!res.ok) return null;
    const data = await res.json();
    return data.current || null;
  } catch {
    return null; // Air quality is a bonus feature — never block the main forecast on it
  }
}

// ============================
// Fetch: weather
// ============================
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day,uv_index',
    hourly: 'temperature_2m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7'
  });
  const res = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

// ============================
// Load + render a location
// ============================
async function loadLocation(lat, lon, label) {
  const card = document.querySelector('.current-inner');
  els.currentSection.setAttribute('aria-busy', 'true');
  if (card) card.classList.add('is-loading');
  els.locationName.textContent = 'Loading…';
  els.searchHint.textContent = '';
  els.searchHint.classList.remove('error');

  try {
    const [data, aq] = await Promise.all([
      fetchWeather(lat, lon),
      fetchAirQuality(lat, lon)
    ]);
    state.current = data.current;
    state.locationLabel = label;
    state.timezone = data.timezone || 'auto';
    state.sunrise = data.daily.sunrise ? data.daily.sunrise[0] : null;
    state.sunset = data.daily.sunset ? data.daily.sunset[0] : null;
    state.airQuality = aq;

    // hourly: slice next 24 entries starting at current time
    const nowIndex = data.hourly.time.indexOf(data.current.time);
    const startIndex = nowIndex >= 0 ? nowIndex : 0;
    state.hourly = data.hourly.time.slice(startIndex, startIndex + 24).map((t, i) => ({
      time: t,
      temp: data.hourly.temperature_2m[startIndex + i],
      code: data.hourly.weather_code[startIndex + i],
      isDay: data.hourly.is_day[startIndex + i] === 1
    }));

    state.daily = data.daily.time.map((d, i) => ({
      date: d,
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      code: data.daily.weather_code[i],
      rainChance: data.daily.precipitation_probability_max[i]
    }));

    renderAll();
    startLiveClock();
  } catch (err) {
    console.error('Skyline: failed to load weather —', err);
    const isTimeout = err.message === 'TIMEOUT';
    els.locationName.textContent = 'Could not load weather';
    els.tempValue.textContent = '--°';
    els.tempIcon.innerHTML = '';
    els.conditionLabel.textContent = isTimeout
      ? 'Request timed out. Check your internet connection.'
      : 'Something went wrong loading this location.';
    els.currentStats.innerHTML = `
      <button type="button" class="btn btn-primary retry-btn" id="retryBtn">Try again</button>
    `;
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', () => loadLocation(lat, lon, label));
  } finally {
    els.currentSection.setAttribute('aria-busy', 'false');
    if (card) card.classList.remove('is-loading');
  }
}

// ============================
// Render
// ============================
function renderAll() {
  renderCurrent();
  renderHourly();
  renderDaily();
  renderSunMoon();
  renderAirQuality();
}

function renderCurrent() {
  const c = state.current;
  if (!c) return;
  const isDay = c.is_day === 1;

  els.locationName.textContent = state.locationLabel;
  renderClock();
  els.tempIcon.innerHTML = weatherIcon(c.weather_code, 72, isDay);
  els.tempValue.textContent = displayTemp(c.temperature_2m);
  els.conditionLabel.textContent = weatherLabel(c.weather_code);

  const uv = getUvInfo(c.uv_index);
  const compassDir = degreesToCompass(c.wind_direction_10m);

  els.currentStats.innerHTML = `
    <div class="stat-card"><span class="stat-label">Feels like</span><span class="stat-value">${displayTemp(c.apparent_temperature)}</span></div>
    <div class="stat-card"><span class="stat-label">Humidity</span><span class="stat-value">${Math.round(c.relative_humidity_2m)}%</span></div>
    <div class="stat-card stat-card-wind">
      <span class="stat-label">Wind</span>
      <div class="wind-row">
        ${windCompassIcon(c.wind_direction_10m, 30)}
        <span class="stat-value">${Math.round(c.wind_speed_10m)} km/h ${compassDir}</span>
      </div>
    </div>
    <div class="stat-card"><span class="stat-label">Pressure</span><span class="stat-value">${Math.round(c.surface_pressure)} hPa</span></div>
    <div class="stat-card"><span class="stat-label">UV Index</span><span class="stat-value" style="color:${uv.color}">${Math.round(c.uv_index)} · ${uv.label}</span></div>
  `;

  updateHeroBanner(isDay, c.weather_code);
}

// ============================
// Wind direction — compass icon + cardinal label
// ============================
function degreesToCompass(deg) {
  if (deg == null) return '';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function windCompassIcon(deg = 0, size = 28) {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="none" stroke="var(--ink-soft)" stroke-width="1.5" opacity="0.4"/>
    <text x="16" y="7" text-anchor="middle" font-size="6" fill="var(--ink-soft)" font-family="var(--font-body)">N</text>
    <g transform="rotate(${deg} 16 16)">
      <path d="M16 6 L20 20 L16 17 L12 20 Z" fill="var(--blue-deep)"/>
    </g>
  </svg>`;
}

// ============================
// UV Index — standard WHO risk categories
// ============================
function getUvInfo(uv) {
  if (uv == null) return { label: '—', color: 'var(--ink-soft)' };
  if (uv < 3) return { label: 'Low', color: 'var(--aqi-good)' };
  if (uv < 6) return { label: 'Moderate', color: 'var(--aqi-moderate)' };
  if (uv < 8) return { label: 'High', color: 'var(--aqi-sensitive)' };
  if (uv < 11) return { label: 'Very High', color: 'var(--aqi-unhealthy)' };
  return { label: 'Extreme', color: 'var(--aqi-very-unhealthy)' };
}

// Shows the real current time, live, in the searched location's own timezone —
// not the weather API's data snapshot (which can lag behind by 15-60 min).
function renderClock() {
  try {
    els.locationDate.textContent = new Date().toLocaleString('en-US', {
      timeZone: state.timezone === 'auto' ? undefined : state.timezone,
      weekday: 'long', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    els.locationDate.textContent = new Date().toLocaleString('en-US', {
      weekday: 'long', hour: '2-digit', minute: '2-digit'
    });
  }
}

function startLiveClock() {
  if (state.clockInterval) clearInterval(state.clockInterval);
  state.clockInterval = setInterval(renderClock, 30000);
}

function updateHeroBanner(isDay, code) {
  const orb = document.getElementById('heroOrb');
  const tagline = document.getElementById('heroTagline');
  if (!orb) return;
  orb.setAttribute('fill', isDay ? 'var(--mocha)' : 'var(--blue-deep)');
  if (tagline) tagline.textContent = isDay ? 'Live conditions, refined.' : 'Quiet skies tonight.';
  updateWeatherEffects(code);
}

function updateWeatherEffects(code) {
  const rainLayer = document.getElementById('rainLayer');
  const snowLayer = document.getElementById('snowLayer');
  const stormFlash = document.getElementById('stormFlash');
  if (!rainLayer || !snowLayer || !stormFlash) return;

  const isRain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
  const isStorm = [95, 96, 99].includes(code);

  rainLayer.classList.toggle('active', isRain || isStorm);
  snowLayer.classList.toggle('active', isSnow);
  stormFlash.classList.toggle('active', isStorm);
}

// ============================
// Moon phase — calculated client-side (no API needed).
// Simplified synodic-month algorithm referenced to a known new moon.
// ============================
function getMoonPhase(date) {
  const synodicMonth = 29.53058867;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14); // Jan 6, 2000 18:14 UTC — a known new moon
  const daysSince = (date.getTime() - knownNewMoon) / 86400000;
  let phaseFraction = (daysSince % synodicMonth) / synodicMonth;
  if (phaseFraction < 0) phaseFraction += 1;

  const names = [
    'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'
  ];
  const index = Math.round(phaseFraction * 8) % 8;
  const illumination = Math.round((1 - Math.cos(phaseFraction * 2 * Math.PI)) / 2 * 100);

  return { name: names[index], phaseFraction, illumination };
}

function moonPhaseIcon(phaseFraction, size = 56) {
  const r = 45, cx = 50, cy = 50;
  const k = (1 - Math.cos(phaseFraction * 2 * Math.PI)) / 2; // 0..1 illumination
  const waxing = phaseFraction < 0.5;
  const rx = Math.abs(Math.cos(phaseFraction * 2 * Math.PI)) * r;

  let overlay = '';
  if (k > 0.001 && k < 0.999) {
    const outerSweep = waxing ? 1 : 0;
    const innerSweep = k < 0.5 ? outerSweep : 1 - outerSweep;
    overlay = `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z" fill="var(--blue-deep)"/>`;
  } else if (k >= 0.999) {
    overlay = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--blue-deep)"/>`;
  }

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--ink)"/>
    ${overlay}
  </svg>`;
}

function sunriseIcon(size = 56) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 20a14 14 0 0 1 14 14H18a14 14 0 0 1 14-14z" fill="var(--mocha)"/>
    <g stroke="var(--mocha)" stroke-width="3" stroke-linecap="round">
      <line x1="32" y1="4" x2="32" y2="12"/>
      <line x1="10" y1="20" x2="16" y2="24"/>
      <line x1="54" y1="20" x2="48" y2="24"/>
    </g>
    <line x1="8" y1="40" x2="56" y2="40" stroke="var(--ink-soft)" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 48 32 40 40 48" fill="none" stroke="var(--mocha-deep)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function renderSunMoon() {
  if (!els.sunmoonGrid) return;

  const sunriseTime = state.sunrise ? new Date(state.sunrise).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
  const sunsetTime = state.sunset ? new Date(state.sunset).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

  let dayLength = '—';
  if (state.sunrise && state.sunset) {
    const mins = Math.round((new Date(state.sunset) - new Date(state.sunrise)) / 60000);
    dayLength = `${Math.floor(mins / 60)}h ${mins % 60}m of daylight`;
  }

  const moon = getMoonPhase(new Date());

  els.sunmoonGrid.innerHTML = `
    <div class="sunmoon-card">
      ${sunriseIcon(56)}
      <div>
        <h3>Sunrise &amp; Sunset</h3>
        <div class="sunmoon-times">
          <div><span>Rise</span><span>${sunriseTime}</span></div>
          <div><span>Set</span><span>${sunsetTime}</span></div>
        </div>
        <p class="moon-illum">${dayLength}</p>
      </div>
    </div>
    <div class="sunmoon-card">
      ${moonPhaseIcon(moon.phaseFraction, 56)}
      <div>
        <h3>Moon Phase</h3>
        <p class="moon-phase-name">${moon.name}</p>
        <p class="moon-illum">${moon.illumination}% illuminated</p>
      </div>
    </div>
  `;
}

// ============================
// Air Quality — muted, grounded status colors (not typical neon AQI colors)
// ============================
function getAqiInfo(aqi) {
  if (aqi <= 50) return { label: 'Good', color: 'var(--aqi-good)', desc: 'Air quality is satisfactory. Enjoy the outdoors as usual.' };
  if (aqi <= 100) return { label: 'Moderate', color: 'var(--aqi-moderate)', desc: 'Acceptable air quality. Unusually sensitive people should consider limiting prolonged outdoor exertion.' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: 'var(--aqi-sensitive)', desc: 'Sensitive groups (children, elderly, respiratory conditions) may experience health effects.' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'var(--aqi-unhealthy)', desc: 'Everyone may begin to experience health effects. Limit prolonged outdoor exertion.' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: 'var(--aqi-very-unhealthy)', desc: 'Health alert: everyone may experience more serious health effects. Avoid outdoor activity.' };
  return { label: 'Hazardous', color: 'var(--aqi-hazardous)', desc: 'Health warning of emergency conditions. The entire population is likely to be affected.' };
}

// ============================
// Dust & pollen — informal severity scales (no official WHO breakpoints
// exist for these the way they do for AQI, so these are reasonable,
// commonly-used thresholds rather than a regulatory standard).
// ============================
function getDustLevel(value) {
  if (value == null) return null;
  if (value < 50) return { label: 'Low', color: 'var(--aqi-good)' };
  if (value < 150) return { label: 'Moderate', color: 'var(--aqi-moderate)' };
  if (value < 300) return { label: 'High', color: 'var(--aqi-unhealthy)' };
  return { label: 'Extreme', color: 'var(--aqi-hazardous)' };
}

function getPollenLevel(value) {
  if (value == null) return null;
  if (value < 1) return { label: 'None', color: 'var(--aqi-good)' };
  if (value < 20) return { label: 'Low', color: 'var(--aqi-good)' };
  if (value < 50) return { label: 'Moderate', color: 'var(--aqi-moderate)' };
  if (value < 150) return { label: 'High', color: 'var(--aqi-unhealthy)' };
  return { label: 'Extreme', color: 'var(--aqi-hazardous)' };
}

function renderAirQuality() {
  if (!els.aqCard) return;
  const aq = state.airQuality;

  if (!aq || aq.us_aqi == null) {
    els.aqCard.innerHTML = `<p class="condition-label">Air quality data isn't available for this location right now.</p>`;
    return;
  }

  const info = getAqiInfo(aq.us_aqi);
  const barWidth = Math.min(100, Math.round((aq.us_aqi / 300) * 100));

  const dustLevel = getDustLevel(aq.dust);
  const pollenReadings = [
    { name: 'Grass Pollen', value: aq.grass_pollen },
    { name: 'Birch Pollen', value: aq.birch_pollen },
    { name: 'Alder Pollen', value: aq.alder_pollen }
  ];
  const hasPollenData = pollenReadings.some(p => p.value != null);

  let allergyHtml = `<div class="allergy-card"><h3>Allergy Outlook</h3>`;

  if (dustLevel) {
    allergyHtml += `
      <div class="allergy-row">
        <span class="allergy-label">Dust</span>
        <span class="allergy-level" style="color:${dustLevel.color}">${dustLevel.label}</span>
      </div>`;
  }

  if (hasPollenData) {
    pollenReadings.forEach(p => {
      const lvl = getPollenLevel(p.value);
      if (!lvl) return;
      allergyHtml += `
        <div class="allergy-row">
          <span class="allergy-label">${p.name}</span>
          <span class="allergy-level" style="color:${lvl.color}">${lvl.label}</span>
        </div>`;
    });
  } else {
    allergyHtml += `<p class="allergy-note">Pollen forecasts are currently only available for European locations (CAMS data coverage). Dust is shown globally.</p>`;
  }

  allergyHtml += `</div>`;

  els.aqCard.innerHTML = `
    <div class="aq-headline">
      <span class="aq-number">${Math.round(aq.us_aqi)}</span>
      <span class="aq-badge" style="background:${info.color}">${info.label}</span>
    </div>
    <div class="aq-bar-track"><div class="aq-bar-fill" style="width:${barWidth}%; background:${info.color}"></div></div>
    <p class="aq-description">${info.desc}</p>
    <div class="aq-pollutants">
      <div class="aq-pollutant"><span class="pol-label">PM2.5</span><span class="pol-value">${aq.pm2_5 != null ? Math.round(aq.pm2_5) : '—'} µg/m³</span></div>
      <div class="aq-pollutant"><span class="pol-label">PM10</span><span class="pol-value">${aq.pm10 != null ? Math.round(aq.pm10) : '—'} µg/m³</span></div>
      <div class="aq-pollutant"><span class="pol-label">Ozone</span><span class="pol-value">${aq.ozone != null ? Math.round(aq.ozone) : '—'} µg/m³</span></div>
      <div class="aq-pollutant"><span class="pol-label">US AQI</span><span class="pol-value">${Math.round(aq.us_aqi)}</span></div>
    </div>
    ${allergyHtml}
  `;
}

function renderHourly() {
  els.hourlyScroll.innerHTML = state.hourly.map(h => {
    const time = new Date(h.time).toLocaleTimeString('en-US', { hour: 'numeric' });
    return `
      <article class="hour-card">
        <span class="hour-time">${time}</span>
        ${weatherIcon(h.code, 32, h.isDay)}
        <span class="hour-temp">${displayTemp(h.temp)}</span>
      </article>
    `;
  }).join('');

  renderHourlyGraph();
}

function renderHourlyGraph() {
  if (!els.hourlyGraph || state.hourly.length < 2) {
    if (els.hourlyGraph) els.hourlyGraph.innerHTML = '';
    return;
  }

  const temps = state.hourly.map(h => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = Math.max(max - min, 1); // avoid divide-by-zero on flat lines

  const w = 600, h = 110, padTop = 22, padBottom = 24;
  const plotH = h - padTop - padBottom;
  const stepX = w / (temps.length - 1);

  const points = temps.map((t, i) => {
    const x = i * stepX;
    const y = padTop + plotH - ((t - min) / range) * plotH;
    return { x, y, t };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${h} L 0 ${h} Z`;

  // Label every 4th hour to avoid crowding
  const labels = points.map((p, i) => {
    if (i % 4 !== 0) return '';
    const time = new Date(state.hourly[i].time).toLocaleTimeString('en-US', { hour: 'numeric' });
    return `<text x="${p.x.toFixed(1)}" y="${h - 4}" font-size="9" fill="var(--ink-soft)" text-anchor="middle" font-family="var(--font-body)">${time}</text>`;
  }).join('');

  const dots = points.map((p, i) => {
    const isNow = i === 0;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isNow ? 3.5 : 2}" fill="${isNow ? 'var(--mocha)' : 'var(--blue-deep)'}"/>`;
  }).join('');

  els.hourlyGraph.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="hourly-graph-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--blue-deep)" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="var(--blue-deep)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#hourlyFill)"/>
      <path d="${linePath}" fill="none" stroke="var(--blue-deep)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderDaily() {
  els.dailyGrid.innerHTML = state.daily.map((d, i) => {
    const label = i === 0 ? 'Today' : new Date(d.date).toLocaleDateString('en-US', { weekday: 'long' });
    return `
      <article class="day-card">
        <span class="day-name">${label}</span>
        ${weatherIcon(d.code, 30)}
        <span class="day-range"><span class="day-max">${displayTemp(d.max)}</span><span class="day-min">${displayTemp(d.min)}</span></span>
        <span class="rain-chance">💧 ${d.rainChance}%</span>
      </article>
    `;
  }).join('');
}

// ============================
// Unit toggle
// ============================
els.unitToggle.addEventListener('click', () => {
  state.unit = state.unit === 'C' ? 'F' : 'C';
  els.unitToggle.querySelectorAll('.unit').forEach(el => {
    el.classList.toggle('active', el.dataset.unit === state.unit);
  });
  if (state.current) renderAll();
});

// ============================
// Dark mode toggle
// (Session-only — not persisted across reloads, since this page can run
// as an embedded artifact where localStorage isn't available.)
// ============================
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  // Respect the visitor's OS-level preference on first load
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.setAttribute('aria-pressed', 'true');
    themeToggle.setAttribute('aria-label', 'Switch to light mode');
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      themeToggle.setAttribute('aria-pressed', 'false');
      themeToggle.setAttribute('aria-label', 'Switch to dark mode');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeToggle.setAttribute('aria-pressed', 'true');
      themeToggle.setAttribute('aria-label', 'Switch to light mode');
    }
  });
}

// ============================
// Search + suggestions (debounced)
// ============================
let debounceTimer = null;
let currentResults = [];
let highlightedIndex = -1;
let searchRequestId = 0; // guards against slow/stale responses overwriting newer ones

els.citySearch.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const query = els.citySearch.value.trim();
  if (query.length < 2) {
    hideSuggestions();
    els.searchHint.textContent = '';
    els.searchHint.classList.remove('error');
    return;
  }

  els.searchHint.textContent = 'Searching…';
  els.searchHint.classList.remove('error');

  debounceTimer = setTimeout(async () => {
    const thisRequestId = ++searchRequestId;
    try {
      const results = await geocodeCity(query);
      if (thisRequestId !== searchRequestId) return; // a newer keystroke already superseded this
      currentResults = results;
      showSuggestions(results);
      els.searchHint.textContent = results.length ? '' : `No matches for "${query}" yet — keep typing or press Search.`;
    } catch {
      if (thisRequestId !== searchRequestId) return;
      hideSuggestions();
      els.searchHint.textContent = 'Search timed out. Check your connection and try again.';
      els.searchHint.classList.add('error');
    }
  }, 300);
});

// Builds a clean "City, Region, Country" label — skipping any part that
// duplicates another (e.g. searching "China" returns name="China",
// country="China", which would otherwise read "China, China").
function buildLocationLabel(result, includeCountry = true) {
  const parts = [result.name];
  if (result.admin1 && result.admin1 !== result.name) parts.push(result.admin1);
  if (includeCountry && result.country && result.country !== result.name && result.country !== result.admin1) {
    parts.push(result.country);
  }
  return parts.join(', ');
}

function showSuggestions(results) {
  highlightedIndex = -1;
  if (!results.length) {
    els.suggestions.hidden = true;
    return;
  }
  els.suggestions.innerHTML = results.map((r, i) => {
    const primary = buildLocationLabel(r, false);
    const showCountry = r.country && r.country !== r.name && r.country !== r.admin1;
    return `
    <li role="option" tabindex="-1" data-index="${i}">
      ${primary}
      ${showCountry ? `<div class="muted">${r.country}</div>` : ''}
    </li>
  `;
  }).join('');
  els.suggestions.hidden = false;

  els.suggestions.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => selectResult(results[Number(li.dataset.index)]));
  });
}

function hideSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = '';
}

function selectResult(result) {
  const label = buildLocationLabel(result, true);
  els.citySearch.value = result.name;
  hideSuggestions();
  loadLocation(result.latitude, result.longitude, label);
}

// Keyboard navigation for suggestions
els.citySearch.addEventListener('keydown', (e) => {
  const items = els.suggestions.querySelectorAll('li');
  if (els.suggestions.hidden || !items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
    updateHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIndex = Math.max(highlightedIndex - 1, 0);
    updateHighlight(items);
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

function updateHighlight(items) {
  items.forEach((li, i) => li.classList.toggle('highlighted', i === highlightedIndex));
  if (highlightedIndex >= 0) items[highlightedIndex].scrollIntoView({ block: 'nearest' });
}

els.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (highlightedIndex >= 0 && currentResults[highlightedIndex]) {
    selectResult(currentResults[highlightedIndex]);
  } else if (currentResults.length) {
    selectResult(currentResults[0]);
  } else if (els.citySearch.value.trim()) {
    geocodeCity(els.citySearch.value.trim()).then(results => {
      if (results.length) selectResult(results[0]);
      else {
        els.searchHint.textContent = `No location found for "${els.citySearch.value.trim()}".`;
        els.searchHint.classList.add('error');
      }
    });
  }
});

document.addEventListener('click', (e) => {
  if (!els.searchForm.contains(e.target)) hideSuggestions();
});

// ============================
// Voice search — native Web Speech API, no library.
// Only shown if the browser actually supports it.
// ============================
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceBtn = document.getElementById('voiceBtn');

if (SpeechRecognitionAPI && voiceBtn) {
  voiceBtn.hidden = false;

  const recognition = new SpeechRecognitionAPI();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let isListening = false;

  voiceBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch {
      // recognition.start() throws if called while already active — ignore
    }
  });

  recognition.addEventListener('start', () => {
    isListening = true;
    voiceBtn.classList.add('listening');
    voiceBtn.setAttribute('aria-label', 'Listening…');
    els.searchHint.textContent = 'Listening… say a city name.';
    els.searchHint.classList.remove('error');
  });

  recognition.addEventListener('result', (e) => {
    const transcript = e.results[0][0].transcript.trim();
    els.citySearch.value = transcript;
    els.searchHint.textContent = `Heard "${transcript}" — searching…`;
    geocodeCity(transcript).then(results => {
      if (results.length) {
        selectResult(results[0]);
      } else {
        els.searchHint.textContent = `No location found for "${transcript}".`;
        els.searchHint.classList.add('error');
      }
    }).catch(() => {
      els.searchHint.textContent = 'Could not search that location. Please try again.';
      els.searchHint.classList.add('error');
    });
  });

  recognition.addEventListener('error', (e) => {
    const messages = {
      'not-allowed': 'Microphone access was blocked. Check your browser permissions.',
      'no-speech': 'No speech detected. Try again.',
      'network': 'Voice search needs an internet connection.'
    };
    els.searchHint.textContent = messages[e.error] || 'Voice search failed. Try typing instead.';
    els.searchHint.classList.add('error');
  });

  recognition.addEventListener('end', () => {
    isListening = false;
    voiceBtn.classList.remove('listening');
    voiceBtn.setAttribute('aria-label', 'Search by voice');
  });
}

// ============================
// Geolocation
// ============================
els.locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    els.searchHint.textContent = 'Geolocation is not supported by your browser.';
    els.searchHint.classList.add('error');
    return;
  }
  els.searchHint.textContent = 'Locating you…';
  els.searchHint.classList.remove('error');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      els.searchHint.textContent = '';
      loadLocation(pos.coords.latitude, pos.coords.longitude, 'Your location');
    },
    (err) => {
      let message = 'Could not get your location. Try searching a city instead.';
      if (err.code === 1) {
        message = 'Location access was blocked. If you\'re testing inside an embedded preview (like CodePen\'s split editor), open the page in a full browser tab and try again — embedded previews often block location access.';
      } else if (err.code === 2) {
        message = 'Your location is currently unavailable. Check that Location Services are turned on for this browser.';
      } else if (err.code === 3) {
        message = 'Getting your location took too long. Try again, or search for a city instead.';
      }
      els.searchHint.textContent = message;
      els.searchHint.classList.add('error');
    },
    { timeout: 10000 }
  );
});

// ============================
// Initial load
// ============================
loadLocation(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, DEFAULT_LOCATION.name);

// ============================
// PWA — register service worker for installability + offline app shell.
// Silently no-ops where unsupported (file://, sandboxed preview iframes).
// ============================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Expected to fail in sandboxed previews or when opened via file:// —
      // the app works fully without it, this is a progressive enhancement.
    });
  });
}

});
