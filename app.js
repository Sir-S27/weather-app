/* ============================================================
   WeatherVibe – app.js
   Full-featured weather app with OpenWeatherMap API
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const OWM_GEO = 'https://api.openweathermap.org/geo/1.0';
const ICON_BASE = 'https://openweathermap.org/img/wn';
const STORAGE_KEY_API = 'wv_api_key';
const STORAGE_KEY_UNIT = 'wv_unit';

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
let state = {
  apiKey: localStorage.getItem(STORAGE_KEY_API) || '',
  unit: localStorage.getItem(STORAGE_KEY_UNIT) || 'metric',  // metric | imperial
  lastCity: '',
  tempChart: null,
  // Map state
  leafletMap: null,
  leafletMarker: null,
  currentLayer: null,
  lastCoords: null,   // { lat, lon }
};

// ─────────────────────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  cityInput: $('city-input'),
  searchBtn: $('search-btn'),
  gpsBtn: $('gps-btn'),
  unitToggle: $('unit-toggle'),
  suggestions: $('suggestions'),
  apiNotice: $('api-notice'),
  apiKeyInput: $('api-key-input'),
  saveApiBtn: $('save-api-btn'),
  closeApiBtn: $('close-api-notice'),
  mainContent: $('main-content'),
  loading: $('loading-screen'),
  errorCard: $('error-card'),
  errorMsg: $('error-msg'),
  retryBtn: $('retry-btn'),
  emptyState: $('empty-state'),
  particles: $('weather-particles'),

  // current
  cityName: $('city-name'),
  countryDate: $('country-date'),
  weatherIcon: $('weather-icon'),
  mainTemp: $('main-temp'),
  tempUnitSym: $('temp-unit-symbol'),
  weatherDesc: $('weather-desc'),
  feelsLike: $('feels-like'),
  humidity: $('humidity'),
  windSpeed: $('wind-speed'),
  visibility: $('visibility'),
  pressure: $('pressure'),
  sunrise: $('sunrise'),
  sunset: $('sunset'),

  // sections
  forecastGrid: $('forecast-grid'),
  hourlyScroll: $('hourly-scroll'),
  tempChart: $('temp-chart'),

  // map & location
  weatherMap: $('weather-map'),
  locFullAddr: $('loc-full-address'),
  locDistrict: $('loc-district'),
  locCity: $('loc-city'),
  locState: $('loc-state'),
  locCoords: $('loc-coords'),
};

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
async function init() {
  applyUnit();
  dom.apiNotice.classList.add('hidden');

  // Ambil API key dari Netlify function
  try {
    const res = await fetch('/.netlify/functions/apikey');
    const data = await res.json();
    if (data.key) {
      state.apiKey = data.key;
      localStorage.setItem(STORAGE_KEY_API, data.key);
    }
  } catch (e) {
    console.warn('Gagal ambil API key:', e);
  }

  // Event listeners
  dom.searchBtn.addEventListener('click', handleSearch);
  dom.cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
  dom.cityInput.addEventListener('input', debounce(handleInputSuggest, 400));
  dom.gpsBtn.addEventListener('click', handleGPS);
  dom.unitToggle.addEventListener('click', toggleUnit);
  dom.saveApiBtn.addEventListener('click', saveApiKey);
  dom.closeApiBtn.addEventListener('click', () => dom.apiNotice.classList.add('hidden'));
  dom.retryBtn.addEventListener('click', () => { if (state.lastCity) fetchWeather(state.lastCity); });

  // Quick city chips
  document.querySelectorAll('.city-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      dom.cityInput.value = btn.dataset.city;
      handleSearch();
    });
  });

  // Click outside suggestions
  document.addEventListener('click', e => {
    if (!dom.suggestions.contains(e.target) && e.target !== dom.cityInput) {
      dom.suggestions.classList.add('hidden');
    }
  });

  startParticles('default');
}

// ─────────────────────────────────────────────────────────────
//  API KEY MANAGEMENT
// ─────────────────────────────────────────────────────────────
function showApiNotice() {
  dom.apiNotice.classList.remove('hidden');
}

function saveApiKey() {
  const key = dom.apiKeyInput.value.trim();
  if (!key) {
    dom.apiKeyInput.style.borderColor = '#ef4444';
    setTimeout(() => dom.apiKeyInput.style.borderColor = '', 1500);
    return;
  }
  state.apiKey = key;
  localStorage.setItem(STORAGE_KEY_API, key);
  dom.apiNotice.classList.add('hidden');
  showToast('✅ API Key tersimpan! Silakan cari kota.');
}

// ─────────────────────────────────────────────────────────────
//  UNIT TOGGLE
// ─────────────────────────────────────────────────────────────
function applyUnit() {
  const isCelsius = state.unit === 'metric';
  dom.unitToggle.textContent = isCelsius ? '°C' : '°F';
  dom.unitToggle.classList.toggle('active', !isCelsius);
}

function toggleUnit() {
  state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem(STORAGE_KEY_UNIT, state.unit);
  applyUnit();
  if (state.lastCity) fetchWeather(state.lastCity);
}

// ─────────────────────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────────────────────
function handleSearch() {
  const city = dom.cityInput.value.trim();
  if (!city) return;
  dom.suggestions.classList.add('hidden');
  if (!checkApiKey()) return;
  fetchWeather(city);
}

function checkApiKey() {
  if (!state.apiKey) {
    showApiNotice();
    showToast('⚠️ Masukkan API key dulu!');
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
//  AUTOCOMPLETE SUGGESTIONS
// ─────────────────────────────────────────────────────────────
async function handleInputSuggest() {
  const q = dom.cityInput.value.trim();
  if (!q || q.length < 2 || !state.apiKey) {
    dom.suggestions.classList.add('hidden');
    return;
  }
  try {
    const res = await fetch(`${OWM_GEO}/direct?q=${encodeURIComponent(q)}&limit=5&appid=${state.apiKey}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      dom.suggestions.classList.add('hidden');
      return;
    }
    renderSuggestions(data);
  } catch (_) {
    dom.suggestions.classList.add('hidden');
  }
}

function renderSuggestions(cities) {
  dom.suggestions.innerHTML = '';
  cities.forEach(c => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `<span>📍</span><span>${c.name}${c.state ? ', ' + c.state : ''}, ${c.country}</span>`;
    item.addEventListener('click', () => {
      dom.cityInput.value = c.name;
      dom.suggestions.classList.add('hidden');
      fetchWeather(c.name);
    });
    dom.suggestions.appendChild(item);
  });
  dom.suggestions.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  GPS LOCATION
// ─────────────────────────────────────────────────────────────
function handleGPS() {
  if (!checkApiKey()) return;
  if (!navigator.geolocation) {
    showToast('❌ Browser tidak mendukung GPS');
    return;
  }
  dom.gpsBtn.classList.add('loading');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      dom.gpsBtn.classList.remove('loading');
      const { latitude: lat, longitude: lon } = pos.coords;
      await fetchWeatherByCoords(lat, lon);
    },
    err => {
      dom.gpsBtn.classList.remove('loading');
      showToast('❌ Izin lokasi ditolak atau gagal');
    }
  );
}

// ─────────────────────────────────────────────────────────────
//  FETCH WEATHER
// ─────────────────────────────────────────────────────────────
async function fetchWeather(city) {
  state.lastCity = city;
  showLoading();
  try {
    const units = state.unit;
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${OWM_BASE}/weather?q=${encodeURIComponent(city)}&units=${units}&lang=id&appid=${state.apiKey}`),
      fetch(`${OWM_BASE}/forecast?q=${encodeURIComponent(city)}&units=${units}&lang=id&cnt=40&appid=${state.apiKey}`),
    ]);

    if (!currentRes.ok) {
      const err = await currentRes.json();
      throw new Error(err.message || 'Kota tidak ditemukan');
    }

    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    renderAll(current, forecast);
  } catch (err) {
    showError(err.message);
  }
}

async function fetchWeatherByCoords(lat, lon) {
  state.lastCity = `${lat},${lon}`;
  showLoading();
  try {
    const units = state.unit;
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${OWM_BASE}/weather?lat=${lat}&lon=${lon}&units=${units}&lang=id&appid=${state.apiKey}`),
      fetch(`${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&units=${units}&lang=id&cnt=40&appid=${state.apiKey}`),
    ]);

    if (!currentRes.ok) throw new Error('Gagal mengambil data lokasi');

    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    state.lastCity = current.name;
    renderAll(current, forecast);
  } catch (err) {
    showError(err.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────
function renderAll(current, forecast) {
  renderCurrent(current);
  renderForecast(forecast);
  renderHourly(forecast);
  renderChart(forecast);
  triggerWeatherAnimation(current.weather[0].main);
  // Map
  const lat = current.coord.lat;
  const lon = current.coord.lon;
  state.lastCoords = { lat, lon };
  updateMap(lat, lon, current);
  fetchReverseGeocode(lat, lon);
  // Setup map layer buttons
  initMapLayerControls();
  showMain();
}

function renderCurrent(d) {
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  const windUnit = state.unit === 'metric' ? 'km/h' : 'mph';
  const windVal = state.unit === 'metric'
    ? Math.round(d.wind.speed * 3.6)
    : Math.round(d.wind.speed);

  dom.cityName.textContent = d.name;
  dom.countryDate.textContent = `${d.sys.country} · ${formatDate(new Date())}`;
  dom.weatherIcon.src = `${ICON_BASE}/${d.weather[0].icon}@2x.png`;
  dom.weatherIcon.alt = d.weather[0].description;
  dom.mainTemp.textContent = Math.round(d.main.temp);
  dom.tempUnitSym.textContent = unitSym;
  dom.weatherDesc.textContent = d.weather[0].description;
  dom.feelsLike.textContent = `Terasa seperti ${Math.round(d.main.feels_like)}°${unitSym}`;
  dom.humidity.textContent = `${d.main.humidity}%`;
  dom.windSpeed.textContent = `${windVal} ${windUnit}`;
  dom.visibility.textContent = d.visibility ? `${(d.visibility / 1000).toFixed(1)} km` : '—';
  dom.pressure.textContent = `${d.main.pressure} hPa`;
  dom.sunrise.textContent = formatTime(d.sys.sunrise, d.timezone);
  dom.sunset.textContent = formatTime(d.sys.sunset, d.timezone);
}

function renderForecast(forecast) {
  // Group by day (pick midday slot or first of each day)
  const dailyMap = {};
  forecast.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toLocaleDateString('id-ID', { weekday: 'short' });
    const dateKey = date.toDateString();
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { dayKey, items: [] };
    }
    dailyMap[dateKey].items.push(item);
  });

  const days = Object.values(dailyMap).slice(0, 5);
  const unitSym = state.unit === 'metric' ? 'C' : 'F';

  dom.forecastGrid.innerHTML = '';
  days.forEach((day, idx) => {
    const temps = day.items.map(i => i.main.temp);
    const maxT = Math.round(Math.max(...temps));
    const minT = Math.round(Math.min(...temps));
    const midItem = day.items[Math.floor(day.items.length / 2)];
    const icon = midItem.weather[0].icon;
    const pop = Math.round((midItem.pop || 0) * 100);

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.style.animationDelay = `${idx * 0.07}s`;
    card.innerHTML = `
      <span class="forecast-day">${day.dayKey}</span>
      <img class="forecast-icon" src="${ICON_BASE}/${icon}@2x.png" alt="icon" />
      <span class="forecast-temp-max">${maxT}°${unitSym}</span>
      <span class="forecast-temp-min">${minT}°${unitSym}</span>
      ${pop > 0 ? `<span class="forecast-rain">💧 ${pop}%</span>` : ''}
    `;
    dom.forecastGrid.appendChild(card);
  });
}

function renderHourly(forecast) {
  dom.hourlyScroll.innerHTML = '';
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  const now = new Date();

  forecast.list.slice(0, 8).forEach((item, idx) => {
    const date = new Date(item.dt * 1000);
    const isNow = idx === 0;
    const card = document.createElement('div');
    card.className = `hourly-card${isNow ? ' current-hour' : ''}`;
    card.innerHTML = `
      <span class="hourly-time">${isNow ? 'Sekarang' : formatHour(date)}</span>
      <img class="hourly-icon" src="${ICON_BASE}/${item.weather[0].icon}@2x.png" alt="icon" />
      <span class="hourly-temp">${Math.round(item.main.temp)}°${unitSym}</span>
    `;
    dom.hourlyScroll.appendChild(card);
  });
}

function renderChart(forecast) {
  const unitSym = state.unit === 'metric' ? '°C' : '°F';
  const labels = [];
  const maxTemps = [];
  const minTemps = [];
  const popArr = [];

  const dailyMap = {};
  forecast.list.forEach(item => {
    const dateKey = new Date(item.dt * 1000).toDateString();
    if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
    dailyMap[dateKey].push(item);
  });

  Object.entries(dailyMap).slice(0, 5).forEach(([dateKey, items]) => {
    const d = new Date(dateKey);
    labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
    maxTemps.push(Math.round(Math.max(...items.map(i => i.main.temp_max))));
    minTemps.push(Math.round(Math.min(...items.map(i => i.main.temp_min))));
    popArr.push(Math.round(Math.max(...items.map(i => (i.pop || 0) * 100))));
  });

  if (state.tempChart) state.tempChart.destroy();

  const ctx = dom.tempChart.getContext('2d');
  const gradMax = ctx.createLinearGradient(0, 0, 0, 220);
  gradMax.addColorStop(0, 'rgba(108,99,255,0.7)');
  gradMax.addColorStop(1, 'rgba(108,99,255,0)');

  const gradMin = ctx.createLinearGradient(0, 0, 0, 220);
  gradMin.addColorStop(0, 'rgba(72,207,173,0.5)');
  gradMin.addColorStop(1, 'rgba(72,207,173,0)');

  state.tempChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: `Suhu Maks (${unitSym})`,
          data: maxTemps,
          borderColor: '#a78bfa',
          backgroundColor: gradMax,
          pointBackgroundColor: '#a78bfa',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: `Suhu Min (${unitSym})`,
          data: minTemps,
          borderColor: '#48cfad',
          backgroundColor: gradMin,
          pointBackgroundColor: '#48cfad',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Peluang Hujan (%)',
          data: popArr,
          backgroundColor: 'rgba(96,165,250,0.3)',
          borderColor: 'rgba(96,165,250,0.7)',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: 'rgba(232,234,246,0.7)',
            font: { family: 'Inter', size: 11 },
            boxWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,12,41,0.95)',
          borderColor: 'rgba(108,99,255,0.4)',
          borderWidth: 1,
          titleColor: '#e8eaf6',
          bodyColor: 'rgba(232,234,246,0.75)',
          padding: 12,
          cornerRadius: 10,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(232,234,246,0.55)', font: { family: 'Inter', size: 11 } },
        },
        y: {
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'rgba(232,234,246,0.55)',
            font: { family: 'Inter', size: 11 },
            callback: v => `${v}°`,
          },
        },
        y1: {
          position: 'right',
          max: 100,
          min: 0,
          grid: { drawOnChartArea: false },
          ticks: {
            color: 'rgba(96,165,250,0.6)',
            font: { family: 'Inter', size: 11 },
            callback: v => `${v}%`,
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  WEATHER ANIMATIONS (rain / snow / sunny particles)
// ─────────────────────────────────────────────────────────────
function triggerWeatherAnimation(main) {
  // clear existing
  dom.particles.innerHTML = '';

  const condition = main.toLowerCase();

  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunderstorm')) {
    startRain();
  } else if (condition.includes('snow')) {
    startSnow();
  } else if (condition.includes('clear')) {
    startSunnyParticles();
  } else if (condition.includes('cloud') || condition.includes('mist') || condition.includes('fog')) {
    startCloudParticles();
  } else {
    startParticles('default');
  }
}

function startRain() {
  for (let i = 0; i < 60; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.left = `${Math.random() * 100}vw`;
    drop.style.height = `${10 + Math.random() * 20}px`;
    drop.style.animationDuration = `${0.4 + Math.random() * 0.6}s`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    dom.particles.appendChild(drop);
  }
}

function startSnow() {
  const flakes = ['❄', '❅', '❆', '✦'];
  for (let i = 0; i < 35; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.fontSize = `${0.8 + Math.random() * 1.2}rem`;
    flake.style.animationDuration = `${3 + Math.random() * 5}s`;
    flake.style.animationDelay = `${Math.random() * 5}s`;
    dom.particles.appendChild(flake);
  }
}

function startSunnyParticles() {
  for (let i = 0; i < 20; i++) {
    createParticle('#f7b733', 4, 8, 6, 14);
  }
}

function startCloudParticles() {
  for (let i = 0; i < 15; i++) {
    createParticle('rgba(200,210,240,0.6)', 6, 12, 8, 18);
  }
}

function startParticles(type) {
  for (let i = 0; i < 18; i++) {
    createParticle('rgba(108,99,255,0.4)', 3, 7, 8, 20);
  }
}

function createParticle(color, minR, maxR, minDur, maxDur) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = minR + Math.random() * (maxR - minR);
  p.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${Math.random() * 100}vw;
    top: ${80 + Math.random() * 20}vh;
    background: ${color};
    animation-duration: ${minDur + Math.random() * (maxDur - minDur)}s;
    animation-delay: ${Math.random() * -15}s;
    box-shadow: 0 0 ${size * 2}px ${color};
  `;
  dom.particles.appendChild(p);
}

// ─────────────────────────────────────────────────────────────
//  UI STATE HELPERS
// ─────────────────────────────────────────────────────────────
function showLoading() {
  dom.mainContent.classList.add('hidden');
  dom.errorCard.classList.add('hidden');
  dom.emptyState.classList.add('hidden');
  dom.loading.classList.remove('hidden');
}

function showMain() {
  dom.loading.classList.add('hidden');
  dom.errorCard.classList.add('hidden');
  dom.emptyState.classList.add('hidden');
  dom.mainContent.classList.remove('hidden');
}

function showError(msg) {
  dom.loading.classList.add('hidden');
  dom.mainContent.classList.add('hidden');
  dom.emptyState.classList.add('hidden');
  dom.errorMsg.textContent = msg || 'Terjadi kesalahan. Coba lagi.';
  dom.errorCard.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(15,12,41,0.95);
    border: 1px solid rgba(108,99,255,0.4);
    color: #e8eaf6;
    padding: 12px 24px;
    border-radius: 999px;
    font-size: .9rem;
    font-weight: 500;
    z-index: 9999;
    backdrop-filter: blur(20px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    transition: all .3s ease;
    opacity: 0;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────────────────────
//  DATE & TIME HELPERS
// ─────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatHour(d) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─────────────────────────────────────────────────────────────
//  DEBOUNCE UTIL
// ─────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─────────────────────────────────────────────────────────────
//  MAP MODULE
// ─────────────────────────────────────────────────────────────

/** Map tile layer definitions */
const MAP_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZ: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri — Source: Esri, USGS, NOAA',
    maxZ: 18,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZ: 17,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
    maxZ: 19,
  },
};

/**
 * Initialize or update the Leaflet map at given coords.
 * @param {number} lat
 * @param {number} lon
 * @param {object} currentWeather – OWM current weather response
 */
function updateMap(lat, lon, currentWeather) {
  // First-time init
  if (!state.leafletMap) {
    state.leafletMap = L.map('weather-map', {
      center: [lat, lon],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    // Default street layer
    const def = MAP_LAYERS.street;
    state.currentLayer = L.tileLayer(def.url, {
      attribution: def.attr,
      maxZoom: def.maxZ,
    }).addTo(state.leafletMap);

    state.activeLayerKey = 'street';
  } else {
    // Pan smoothly to new location
    state.leafletMap.flyTo([lat, lon], 12, { duration: 1.4 });
  }

  // Remove old marker
  if (state.leafletMarker) {
    state.leafletMarker.remove();
  }

  // Build custom icon HTML
  const iconUrl = `${ICON_BASE}/${currentWeather.weather[0].icon}@2x.png`;
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  const temp = Math.round(currentWeather.main.temp);

  const customIcon = L.divIcon({
    className: 'weather-marker-icon',
    html: `
      <div style="position:relative; width:44px; height:44px;">
        <div class="marker-pulse-ring"></div>
        <div class="marker-inner">
          <img src="${iconUrl}" alt="weather" />
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -48],
  });

  // Popup content
  const windVal = state.unit === 'metric'
    ? `${Math.round(currentWeather.wind.speed * 3.6)} km/h`
    : `${Math.round(currentWeather.wind.speed)} mph`;

  const popupHTML = `
    <div class="map-popup">
      <div class="map-popup-top">
        <div>
          <div class="map-popup-city">${currentWeather.name}, ${currentWeather.sys.country}</div>
          <div class="map-popup-temp">${temp}°${unitSym}</div>
        </div>
        <img class="map-popup-icon" src="${iconUrl}" alt="${currentWeather.weather[0].description}" />
      </div>
      <div class="map-popup-row">☁️ ${capitalise(currentWeather.weather[0].description)}</div>
      <div class="map-popup-row">💧 Kelembaban: ${currentWeather.main.humidity}%</div>
      <div class="map-popup-row">💨 Angin: ${windVal}</div>
      <div class="map-popup-row">🌡️ Terasa: ${Math.round(currentWeather.main.feels_like)}°${unitSym}</div>
      <div class="map-popup-row" style="margin-top:8px; font-size:.75rem; color:rgba(232,234,246,0.4);">
        ${lat.toFixed(4)}°, ${lon.toFixed(4)}°
      </div>
    </div>
  `;

  state.leafletMarker = L.marker([lat, lon], { icon: customIcon })
    .addTo(state.leafletMap)
    .bindPopup(popupHTML, { maxWidth: 260, minWidth: 220 })
    .openPopup();

  // Invalidate size in case map was hidden during render
  setTimeout(() => state.leafletMap.invalidateSize(), 300);
}

/** Switch map tile layer */
function switchMapLayer(key) {
  if (!state.leafletMap || state.activeLayerKey === key) return;
  if (state.currentLayer) state.currentLayer.remove();
  const def = MAP_LAYERS[key];
  state.currentLayer = L.tileLayer(def.url, {
    attribution: def.attr,
    maxZoom: def.maxZ,
  }).addTo(state.leafletMap);
  state.currentLayer.bringToBack();
  state.activeLayerKey = key;
}

/** Wire up map layer toggle buttons (idempotent) */
function initMapLayerControls() {
  if (dom._mapControlsInited) return;
  dom._mapControlsInited = true;

  document.querySelectorAll('.map-ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-ctrl-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchMapLayer(btn.dataset.layer);
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  REVERSE GEOCODING – Nominatim (OpenStreetMap, no key needed)
// ─────────────────────────────────────────────────────────────
async function fetchReverseGeocode(lat, lon) {
  // Show loading state
  dom.locFullAddr.textContent = 'Memuat alamat...';
  dom.locFullAddr.className = 'loc-detail-val loc-loading';
  dom.locDistrict.textContent = '—';
  dom.locCity.textContent = '—';
  dom.locState.textContent = '—';
  dom.locCoords.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=id`,
      { headers: { 'Accept-Language': 'id', 'User-Agent': 'WeatherVibe/1.0' } }
    );
    if (!res.ok) throw new Error('Gagal reverse geocode');
    const data = await res.json();
    renderLocationDetail(data, lat, lon);
  } catch (_) {
    dom.locFullAddr.textContent = 'Tidak dapat memuat detail alamat.';
    dom.locFullAddr.className = 'loc-detail-val';
  }
}

/** Render the detailed location panel from Nominatim response */
function renderLocationDetail(data, lat, lon) {
  const addr = data.address || {};

  // Full display name – trim to avoid super-long strings
  const fullName = (data.display_name || '—').split(',').slice(0, 6).join(',');
  dom.locFullAddr.textContent = fullName;
  dom.locFullAddr.className = 'loc-detail-val';

  // District / subdistrict
  const district =
    addr.suburb ||
    addr.subdistrict ||
    addr.quarter ||
    addr.neighbourhood ||
    addr.village ||
    addr.hamlet ||
    '—';
  dom.locDistrict.textContent = district;

  // City / regency
  const city =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.county ||
    addr.district ||
    '—';
  dom.locCity.textContent = city;

  // State / province
  const province = addr.state || addr.region || addr.province || '—';
  dom.locState.textContent = province;

  // Coordinates with DMS notation
  dom.locCoords.textContent = `${toDMS(lat, 'lat')}  ${toDMS(lon, 'lon')}`;
}

/** Convert decimal degrees to DMS string (e.g. 6°12'34" S) */
function toDMS(deg, type) {
  const dir = type === 'lat'
    ? (deg >= 0 ? 'N' : 'S')
    : (deg >= 0 ? 'E' : 'W');
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mAll = (abs - d) * 60;
  const m = Math.floor(mAll);
  const s = ((mAll - m) * 60).toFixed(1);
  return `${d}°${m}'${s}" ${dir}`;
}

// ─────────────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────────────
function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

