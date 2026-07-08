/* ============================================================
   WeatherVibe – app.js
   Dashboard Edition – Vercel Serverless API Key
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────
const OWM_BASE    = 'https://api.openweathermap.org/data/2.5';
const OWM_GEO     = 'https://api.openweathermap.org/geo/1.0';
const STORAGE_KEY_UNIT = 'wv_unit';

// ─────────────────────────────────────────────────────────────
//  CUSTOM WEATHER ICONS (flat, navy-blue themed, replaces OWM PNGs)
// ─────────────────────────────────────────────────────────────
const WeatherIcons = (() => {
  // Reusable pieces -------------------------------------------------
  const sun = (cx, cy, r) => `
    <g stroke="#fb923c" stroke-width="3.2" stroke-linecap="round">
      <line x1="${cx}" y1="${cy - r - 9}" x2="${cx}" y2="${cy - r - 2}"/>
      <line x1="${cx}" y1="${cy + r + 2}" x2="${cx}" y2="${cy + r + 9}"/>
      <line x1="${cx - r - 9}" y1="${cy}" x2="${cx - r - 2}" y2="${cy}"/>
      <line x1="${cx + r + 2}" y1="${cy}" x2="${cx + r + 9}" y2="${cy}"/>
      <line x1="${cx - r - 6.3}" y1="${cy - r - 6.3}" x2="${cx - r - 1.4}" y2="${cy - r - 1.4}"/>
      <line x1="${cx + r + 1.4}" y1="${cy + r + 1.4}" x2="${cx + r + 6.3}" y2="${cy + r + 6.3}"/>
      <line x1="${cx - r - 6.3}" y1="${cy + r + 6.3}" x2="${cx - r - 1.4}" y2="${cy + r + 1.4}"/>
      <line x1="${cx + r + 1.4}" y1="${cy - r - 1.4}" x2="${cx + r + 6.3}" y2="${cy - r - 6.3}"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sunGrad)"/>`;

  const moon = (cx, cy, r) => `
    <path d="M${cx + r * 0.6} ${cy - r}
             a${r} ${r} 0 1 0 ${r * 0.3} ${r * 1.9}
             a${r * 1.25} ${r * 1.25} 0 0 1 ${-r * 0.3} ${-r * 1.9}Z"
          fill="url(#moonGrad)"/>
    <circle cx="${cx - r * 1.6}" cy="${cy - r * 1.3}" r="1.5" fill="#eaf1ff"/>
    <circle cx="${cx - r * 2.3}" cy="${cy + r * 0.3}" r="1" fill="#eaf1ff"/>`;

  const cloud = (cx, cy, scale, fill) => `
    <path transform="translate(${cx} ${cy}) scale(${scale})"
      d="M-19 10h32a11 11 0 0 0 1-22 15.5 15.5 0 0 0-29.5-5A12 12 0 0 0-28 0a11 11 0 0 0 9 10Z"
      fill="${fill}"/>`;

  const rainDrops = (cx, cy, heavy, color) => {
    const xs = heavy ? [-14, -2, 10, -8, 4] : [-10, 2, 12];
    return xs.map((dx, i) => `
      <line x1="${cx + dx}" y1="${cy + (i % 2 ? 2 : 0)}" x2="${cx + dx - 4}" y2="${cy + (i % 2 ? 2 : 0) + 12}"
        stroke="${color}" stroke-width="3" stroke-linecap="round"/>`).join('');
  };

  const snowFlakes = (cx, cy) => [-13, 0, 13].map(dx => `
    <g stroke="#c9dbf9" stroke-width="2" stroke-linecap="round" transform="translate(${cx + dx} ${cy + 6})">
      <line x1="0" y1="-5" x2="0" y2="5"/>
      <line x1="-4.3" y1="-2.5" x2="4.3" y2="2.5"/>
      <line x1="-4.3" y1="2.5" x2="4.3" y2="-2.5"/>
    </g>`).join('');

  const bolt = (cx, cy) => `
    <path d="M${cx + 3} ${cy - 6} l-9 12h6l-4 10 11-14h-6Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="0.5"/>`;

  const fogLines = (cy) => [0, 9, 18].map((dy, i) => `
    <line x1="${14 + (i % 2) * 4}" y1="${cy + dy}" x2="${50 - (i % 2) * 4}" y2="${cy + dy}"
      stroke="#9db8de" stroke-width="3.4" stroke-linecap="round" opacity="${i === 1 ? 0.6 : 0.85}"/>`).join('');

  const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#fb923c"/>
      </linearGradient>
      <linearGradient id="moonGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#cfe0fb"/><stop offset="1" stop-color="#8fb3f0"/>
      </linearGradient>
      <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f4f8ff"/><stop offset="1" stop-color="#d3e1f8"/>
      </linearGradient>
      <linearGradient id="cloudGradDark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c3d3f0"/><stop offset="1" stop-color="#9db3dd"/>
      </linearGradient>
    </defs>${inner}</svg>`;

  // Icon families, keyed like OWM codes but self-contained ----------
  const FAMILIES = {
    '01': night => wrap(night ? moon(34, 30, 12) : sun(32, 30, 13)),
    '02': night => wrap(`
      ${night ? moon(24, 24, 9) : sun(24, 22, 10)}
      ${cloud(36, 40, 1.05, 'url(#cloudGrad)')}`),
    '03': () => wrap(cloud(32, 34, 1.3, 'url(#cloudGrad)')),
    '04': () => wrap(`
      ${cloud(24, 28, 0.95, 'url(#cloudGradDark)')}
      ${cloud(38, 40, 1.15, 'url(#cloudGrad)')}`),
    '09': () => wrap(`
      ${cloud(32, 28, 1.15, 'url(#cloudGradDark)')}
      ${rainDrops(32, 42, true, '#4f8ef7')}`),
    '10': night => wrap(`
      ${night ? moon(20, 18, 7) : sun(20, 17, 8)}
      ${cloud(34, 30, 1.05, 'url(#cloudGrad)')}
      ${rainDrops(32, 44, false, '#4f8ef7')}`),
    '11': () => wrap(`
      ${cloud(32, 26, 1.1, 'url(#cloudGradDark)')}
      ${bolt(30, 40)}`),
    '13': () => wrap(`
      ${cloud(32, 26, 1.05, 'url(#cloudGrad)')}
      ${snowFlakes(32, 38)}`),
    '50': () => wrap(fogLines(28)),
  };

  function svgFor(owmCode) {
    const family = (owmCode || '01d').slice(0, 2);
    const night  = (owmCode || '01d').endsWith('n');
    const build  = FAMILIES[family] || FAMILIES['01'];
    return build(night);
  }

  function dataUri(owmCode) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgFor(owmCode));
  }

  return { dataUri };
})();

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
let state = {
  apiKey:        '',
  unit:          localStorage.getItem(STORAGE_KEY_UNIT) || 'metric',
  lastCity:      '',
  hourlyChart:   null,
  rainChart:     null,
  leafletMap:    null,
  leafletMarker: null,
  currentLayer:  null,
  activeLayerKey:'dark',
  lastCoords:    null,
  clockInterval: null,
  currentData:   null,
};

// ─────────────────────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  // screens
  loadingScreen: $('loading-screen'),
  errorScreen:   $('error-screen'),
  errorTitle:    $('error-title'),
  errorMsg:      $('error-msg'),
  retryBtn:      $('retry-btn'),
  dashboard:     $('dashboard'),

  // top bar
  cityInput:     $('city-input'),
  gpsBtn:        $('gps-btn'),
  unitToggle:    $('unit-toggle'),
  suggestions:   $('suggestions'),

  // hero
  greeting:      $('greeting'),
  clock:         $('clock'),
  heroDate:      $('hero-date'),
  heroCity:      $('hero-city'),
  heroIcon:      $('hero-icon'),
  heroDesc:      $('hero-weather-desc'),
  heroSubDesc:   $('hero-sub-desc'),
  chartCityLabel:$('chart-city-label'),

  // right panel
  rightIcon:     $('right-icon'),
  rightTemp:     $('right-temp'),
  tempUnitSym:   $('temp-unit-symbol'),
  rightDesc:     $('right-desc'),
  rightFeels:    $('right-feels'),
  statWind:      $('stat-wind'),
  statHumidity:  $('stat-humidity'),
  statPressure:  $('stat-pressure'),
  statVisibility:$('stat-visibility'),

  // forecast
  forecastList:  $('forecast-list'),
  sunPanel:      $('sun-panel'),
  sunRise:       $('sun-rise'),
  sunSet:        $('sun-set'),

  // charts
  hourlyChart:   $('hourly-chart'),
  rainChart:     $('rain-chart'),

  // map
  weatherMap:    $('weather-map'),

  // nav
  navSearch:     $('nav-search'),
  navGps:        $('nav-gps'),
  navUnit:       $('nav-unit'),
  navInfo:       $('nav-info'),

  // info modal
  infoModal:     $('info-modal'),
  closeModal:    $('close-modal'),
  infoCity:      $('info-city'),
  infoCountry:   $('info-country'),
  infoCoords:    $('info-coords'),
  infoPressure:  $('info-pressure'),

  // particles
  particles:     $('weather-particles'),
};

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
async function init() {
  applyUnit();
  startClock();
  bindEvents();
  startParticles('default');

  // Fetch API key from Vercel serverless function
  try {
    const res  = await fetch('/api/apikey');
    const data = await res.json();
    if (data.key) {
      state.apiKey = data.key;
    } else {
      throw new Error('API key tidak ditemukan di server.');
    }
  } catch (e) {
    // Fallback: try localStorage (for local dev with manually set key)
    const stored = localStorage.getItem('wv_api_key_fallback');
    if (stored) {
      state.apiKey = stored;
      console.info('Menggunakan API key dari localStorage (dev mode).');
    } else {
      showError(
        'Konfigurasi Server Bermasalah',
        'Tidak dapat mengambil API key dari server. Pastikan environment variable OWM_API_KEY sudah diset di Vercel.'
      );
      return;
    }
  }

  // Auto-detect location on load
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeather('Jakarta') // default city
    );
  } else {
    fetchWeather('Jakarta');
  }
}

// ─────────────────────────────────────────────────────────────
//  EVENTS
// ─────────────────────────────────────────────────────────────
function bindEvents() {
  // Search
  dom.cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
  dom.cityInput.addEventListener('input', debounce(handleInputSuggest, 400));
  dom.gpsBtn.addEventListener('click', handleGPS);
  dom.unitToggle.addEventListener('click', toggleUnit);
  dom.retryBtn.addEventListener('click', () => {
    if (state.lastCity) fetchWeather(state.lastCity);
    else init();
  });

  // Bottom nav
  dom.navSearch.addEventListener('click', () => {
    dom.cityInput.focus();
    setActiveNav(dom.navSearch);
  });
  dom.navGps.addEventListener('click', () => {
    handleGPS();
    setActiveNav(dom.navGps);
  });
  dom.navUnit.addEventListener('click', () => {
    toggleUnit();
    setActiveNav(dom.navUnit);
    setTimeout(() => setActiveNav(dom.navSearch), 400);
  });
  dom.navInfo.addEventListener('click', () => {
    dom.infoModal.classList.toggle('hidden');
    setActiveNav(dom.navInfo);
  });
  dom.closeModal.addEventListener('click', () => dom.infoModal.classList.add('hidden'));
  dom.infoModal.addEventListener('click', e => {
    if (e.target === dom.infoModal) dom.infoModal.classList.add('hidden');
  });

  // Map layer buttons
  document.querySelectorAll('.map-ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-ctrl-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchMapLayer(btn.dataset.layer);
    });
  });

  // Forecast tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'sunrise') {
        dom.forecastList.classList.add('hidden');
        dom.sunPanel.classList.remove('hidden');
      } else {
        dom.forecastList.classList.remove('hidden');
        dom.sunPanel.classList.add('hidden');
      }
    });
  });

  // Click outside suggestions
  document.addEventListener('click', e => {
    if (!dom.suggestions.contains(e.target) && e.target !== dom.cityInput) {
      dom.suggestions.classList.add('hidden');
    }
  });
}

function setActiveNav(btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
//  LIVE CLOCK & GREETING
// ─────────────────────────────────────────────────────────────
function startClock() {
  updateClock();
  state.clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  dom.clock.textContent = `${h}:${m}`;

  // Greeting
  const hour = now.getHours();
  let greet = 'Selamat Malam';
  if (hour >= 5  && hour < 12) greet = 'Selamat Pagi';
  else if (hour >= 12 && hour < 15) greet = 'Selamat Siang';
  else if (hour >= 15 && hour < 18) greet = 'Selamat Sore';
  dom.greeting.textContent = greet;

  // Date
  dom.heroDate.textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
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
  fetchWeather(city);
}

// ─────────────────────────────────────────────────────────────
//  AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────
async function handleInputSuggest() {
  const q = dom.cityInput.value.trim();
  if (!q || q.length < 2 || !state.apiKey) {
    dom.suggestions.classList.add('hidden');
    return;
  }
  try {
    const res  = await fetch(`${OWM_GEO}/direct?q=${encodeURIComponent(q)}&limit=5&appid=${state.apiKey}`);
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
//  GPS
// ─────────────────────────────────────────────────────────────
function handleGPS() {
  if (!navigator.geolocation) { showToast('❌ Browser tidak mendukung GPS'); return; }
  dom.gpsBtn.classList.add('loading');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      dom.gpsBtn.classList.remove('loading');
      await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      dom.gpsBtn.classList.remove('loading');
      showToast('❌ Izin lokasi ditolak');
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
    const u = state.unit;
    const [curRes, fcRes] = await Promise.all([
      fetch(`${OWM_BASE}/weather?q=${encodeURIComponent(city)}&units=${u}&lang=id&appid=${state.apiKey}`),
      fetch(`${OWM_BASE}/forecast?q=${encodeURIComponent(city)}&units=${u}&lang=id&cnt=40&appid=${state.apiKey}`),
    ]);
    if (!curRes.ok) {
      const err = await curRes.json();
      throw new Error(err.message || 'Kota tidak ditemukan');
    }
    const current  = await curRes.json();
    const forecast = await fcRes.json();
    renderAll(current, forecast);
  } catch (err) {
    showError('Gagal Memuat Data', err.message || 'Terjadi kesalahan. Coba lagi.');
  }
}

async function fetchWeatherByCoords(lat, lon) {
  showLoading();
  try {
    const u = state.unit;
    const [curRes, fcRes] = await Promise.all([
      fetch(`${OWM_BASE}/weather?lat=${lat}&lon=${lon}&units=${u}&lang=id&appid=${state.apiKey}`),
      fetch(`${OWM_BASE}/forecast?lat=${lat}&lon=${lon}&units=${u}&lang=id&cnt=40&appid=${state.apiKey}`),
    ]);
    if (!curRes.ok) throw new Error('Gagal mengambil data lokasi');
    const current  = await curRes.json();
    const forecast = await fcRes.json();
    state.lastCity = current.name;
    renderAll(current, forecast);
  } catch (err) {
    showError('Gagal Memuat Data', err.message || 'Terjadi kesalahan.');
  }
}

// ─────────────────────────────────────────────────────────────
//  RENDER ALL
// ─────────────────────────────────────────────────────────────
function renderAll(current, forecast) {
  state.currentData = current;
  renderHero(current);
  renderRightPanel(current);
  renderForecastList(forecast);
  renderHourlyChart(forecast);
  renderRainChart(forecast);
  renderInfoModal(current);
  triggerWeatherAnimation(current.weather[0].main);
  const lat = current.coord.lat;
  const lon = current.coord.lon;
  state.lastCoords = { lat, lon };
  updateMap(lat, lon, current);
  showDashboard();
}

// ─────────────────────────────────────────────────────────────
//  RENDER HERO (left panel top card)
// ─────────────────────────────────────────────────────────────
function renderHero(d) {
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  dom.heroCity.textContent  = `${d.name}, ${d.sys.country}`;
  dom.heroIcon.src          = WeatherIcons.dataUri(d.weather[0].icon);
  dom.heroDesc.textContent  = capitalise(d.weather[0].description);
  dom.heroSubDesc.textContent = `Terasa seperti ${Math.round(d.main.feels_like)}°${unitSym} · Kelembaban ${d.main.humidity}%`;
  dom.chartCityLabel.textContent = `${d.name}`;
}

// ─────────────────────────────────────────────────────────────
//  RENDER RIGHT PANEL
// ─────────────────────────────────────────────────────────────
function renderRightPanel(d) {
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  const windUnit = state.unit === 'metric' ? 'km/h' : 'mph';
  const windVal  = state.unit === 'metric'
    ? Math.round(d.wind.speed * 3.6)
    : Math.round(d.wind.speed);

  dom.rightIcon.src          = WeatherIcons.dataUri(d.weather[0].icon);
  // Update temp number without destroying the unit <span> inside
  // Structure: <div id="right-temp">NUMBER<span class="right-unit">...</span></div>
  const tempNum = dom.rightTemp.firstChild;
  if (tempNum && tempNum.nodeType === Node.TEXT_NODE) {
    tempNum.nodeValue = Math.round(d.main.temp);
  } else {
    dom.rightTemp.insertBefore(document.createTextNode(Math.round(d.main.temp)), dom.rightTemp.firstChild);
  }
  dom.tempUnitSym.textContent = unitSym;
  dom.rightDesc.textContent  = capitalise(d.weather[0].description);
  dom.rightFeels.textContent = `Terasa seperti ${Math.round(d.main.feels_like)}°${unitSym}`;
  dom.statWind.textContent   = `${windVal} ${windUnit}`;
  dom.statHumidity.textContent = `${d.main.humidity}%`;
  dom.statPressure.textContent = `${d.main.pressure} hPa`;
  dom.statVisibility.textContent = d.visibility ? `${(d.visibility / 1000).toFixed(1)} km` : '—';
  dom.sunRise.textContent    = formatTime(d.sys.sunrise, d.timezone);
  dom.sunSet.textContent     = formatTime(d.sys.sunset, d.timezone);
}

// ─────────────────────────────────────────────────────────────
//  RENDER FORECAST LIST
// ─────────────────────────────────────────────────────────────
function renderForecastList(forecast) {
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  const dailyMap = {};

  forecast.list.forEach(item => {
    const dateKey = new Date(item.dt * 1000).toDateString();
    if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
    dailyMap[dateKey].push(item);
  });

  const days = Object.entries(dailyMap).slice(0, 5);
  dom.forecastList.innerHTML = '';

  days.forEach(([dateKey, items]) => {
    const d      = new Date(dateKey);
    const dayStr = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dateStr= d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const temps  = items.map(i => i.main.temp);
    const maxT   = Math.round(Math.max(...temps));
    const minT   = Math.round(Math.min(...temps));
    const mid    = items[Math.floor(items.length / 2)];
    const pop    = Math.round((mid.pop || 0) * 100);

    const row = document.createElement('div');
    row.className = 'forecast-row';
    row.innerHTML = `
      <span class="forecast-day">${dayStr}</span>
      <img class="forecast-row-icon" src="${WeatherIcons.dataUri(mid.weather[0].icon)}" alt="${mid.weather[0].description}" />
      <div class="forecast-row-info">
        <span class="forecast-row-desc">${mid.weather[0].description}</span>
        ${pop > 0 ? `<span class="forecast-row-pop">💧 ${pop}%</span>` : ''}
      </div>
      <div class="forecast-temps">
        <span class="forecast-max">${maxT}°${unitSym}</span>
        <span class="forecast-min">${minT}°${unitSym}</span>
      </div>
    `;
    dom.forecastList.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────
//  RENDER HOURLY CHART
// ─────────────────────────────────────────────────────────────
function renderHourlyChart(forecast) {
  const unitSym = state.unit === 'metric' ? '°C' : '°F';
  const items   = forecast.list.slice(0, 8);
  const labels  = items.map(i => formatHour(new Date(i.dt * 1000)));
  const temps   = items.map(i => Math.round(i.main.temp));

  if (state.hourlyChart) state.hourlyChart.destroy();

  const ctx  = dom.hourlyChart.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, 'rgba(79, 142, 247, 0.35)');
  grad.addColorStop(1, 'rgba(79, 142, 247, 0)');

  state.hourlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Suhu (${unitSym})`,
        data: temps,
        borderColor: '#4f8ef7',
        backgroundColor: grad,
        pointBackgroundColor: '#4f8ef7',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1e3d',
          borderColor: 'rgba(79,142,247,0.4)',
          borderWidth: 1,
          titleColor: '#e8f0fe',
          bodyColor: 'rgba(232,240,254,0.7)',
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y}${unitSym}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(15,30,61,0.06)', drawBorder: false },
          ticks: { color: 'rgba(15,30,61,0.55)', font: { family: 'Inter', size: 10 } },
        },
        y: {
          grid: { color: 'rgba(15,30,61,0.06)', drawBorder: false },
          ticks: {
            color: 'rgba(15,30,61,0.55)', font: { family: 'Inter', size: 10 },
            callback: v => `${v}°`,
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  RENDER RAIN CHART (5-day forecast bar chart)
// ─────────────────────────────────────────────────────────────
function renderRainChart(forecast) {
  const dailyMap = {};
  forecast.list.forEach(item => {
    const dateKey = new Date(item.dt * 1000).toDateString();
    if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
    dailyMap[dateKey].push(item);
  });

  const days    = Object.entries(dailyMap).slice(0, 5);
  const labels  = days.map(([key]) => {
    const d = new Date(key);
    return d.toLocaleDateString('id-ID', { weekday: 'short' });
  });
  const popVals = days.map(([, items]) =>
    Math.round(Math.max(...items.map(i => (i.pop || 0) * 100)))
  );

  if (state.rainChart) state.rainChart.destroy();

  const ctx = dom.rainChart.getContext('2d');
  state.rainChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Peluang Hujan (%)',
        data: popVals,
        backgroundColor: ctx => {
          const v = ctx.parsed ? ctx.parsed.y : 0;
          if (v >= 70) return 'rgba(79,142,247,0.8)';
          if (v >= 40) return 'rgba(79,142,247,0.55)';
          return 'rgba(79,142,247,0.3)';
        },
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1e3d',
          borderColor: 'rgba(79,142,247,0.4)',
          borderWidth: 1,
          titleColor: '#e8f0fe',
          bodyColor: 'rgba(232,240,254,0.7)',
          padding: 8,
          cornerRadius: 8,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y}% kemungkinan hujan`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(15,30,61,0.55)', font: { family: 'Inter', size: 9 } },
        },
        y: {
          max: 100, min: 0,
          grid: { color: 'rgba(15,30,61,0.06)', drawBorder: false },
          ticks: {
            color: 'rgba(15,30,61,0.55)', font: { family: 'Inter', size: 9 },
            callback: v => `${v}%`,
            maxTicksLimit: 4,
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  RENDER INFO MODAL
// ─────────────────────────────────────────────────────────────
function renderInfoModal(d) {
  dom.infoCity.textContent    = d.name;
  dom.infoCountry.textContent = d.sys.country;
  dom.infoCoords.textContent  = `${d.coord.lat.toFixed(4)}°, ${d.coord.lon.toFixed(4)}°`;
  dom.infoPressure.textContent= `${d.main.pressure} hPa`;
}

// ─────────────────────────────────────────────────────────────
//  WEATHER ANIMATIONS
// ─────────────────────────────────────────────────────────────
function triggerWeatherAnimation(main) {
  dom.particles.innerHTML = '';
  const c = main.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle') || c.includes('thunderstorm')) {
    startRain();
  } else if (c.includes('snow')) {
    startSnow();
  } else if (c.includes('clear')) {
    startSunnyParticles();
  } else {
    startParticles('default');
  }
}

function startRain() {
  for (let i = 0; i < 50; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.left     = `${Math.random() * 100}vw`;
    drop.style.height   = `${12 + Math.random() * 18}px`;
    drop.style.animationDuration = `${0.4 + Math.random() * 0.6}s`;
    drop.style.animationDelay   = `${Math.random() * 2}s`;
    dom.particles.appendChild(drop);
  }
}

function startSnow() {
  const flakes = ['❄','❅','❆'];
  for (let i = 0; i < 30; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
    flake.style.left     = `${Math.random() * 100}vw`;
    flake.style.fontSize = `${0.6 + Math.random() * 1}rem`;
    flake.style.animationDuration = `${4 + Math.random() * 5}s`;
    flake.style.animationDelay   = `${Math.random() * 5}s`;
    dom.particles.appendChild(flake);
  }
}

function startSunnyParticles() {
  for (let i = 0; i < 16; i++) createParticle('#fbbf24', 3, 6, 8, 16);
}

function startParticles() {
  for (let i = 0; i < 16; i++) createParticle('rgba(79,142,247,0.4)', 2, 5, 10, 22);
}

function createParticle(color, minR, maxR, minDur, maxDur) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = minR + Math.random() * (maxR - minR);
  p.style.cssText = `
    width:${size}px; height:${size}px;
    left:${Math.random() * 100}vw;
    top:${80 + Math.random() * 20}vh;
    background:${color};
    animation-duration:${minDur + Math.random() * (maxDur - minDur)}s;
    animation-delay:${Math.random() * -15}s;
    box-shadow:0 0 ${size * 2}px ${color};
  `;
  dom.particles.appendChild(p);
}

// ─────────────────────────────────────────────────────────────
//  UI STATE
// ─────────────────────────────────────────────────────────────
function showLoading() {
  dom.loadingScreen.classList.remove('hidden');
  dom.errorScreen.classList.add('hidden');
  dom.dashboard.classList.add('hidden');
}

function showDashboard() {
  dom.loadingScreen.classList.add('hidden');
  dom.errorScreen.classList.add('hidden');
  dom.dashboard.classList.remove('hidden');
}

function showError(title, msg) {
  dom.loadingScreen.classList.add('hidden');
  dom.dashboard.classList.add('hidden');
  dom.errorTitle.textContent = title || 'Terjadi Kesalahan';
  dom.errorMsg.textContent   = msg   || 'Coba lagi nanti.';
  dom.errorScreen.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
    background:#0f1e3d; border:1px solid rgba(79,142,247,0.4); color:#e8f0fe;
    padding:10px 22px; border-radius:999px; font-size:.85rem; font-weight:500;
    z-index:9999; backdrop-filter:blur(20px); box-shadow:0 8px 32px rgba(0,0,0,0.5);
    transition:all .3s ease; opacity:0; pointer-events:none; white-space:nowrap;
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
function formatTime(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatHour(d) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────────────────────
//  MAP MODULE
// ─────────────────────────────────────────────────────────────
const MAP_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZ: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri',
    maxZ: 18,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    maxZ: 19,
  },
};

function updateMap(lat, lon, current) {
  if (!state.leafletMap) {
    state.leafletMap = L.map('weather-map', {
      center: [lat, lon], zoom: 11,
      zoomControl: false,
      attributionControl: true,
    });
    const def = MAP_LAYERS.dark;
    state.currentLayer = L.tileLayer(def.url, { attribution: def.attr, maxZoom: def.maxZ })
      .addTo(state.leafletMap);
    state.activeLayerKey = 'dark';
  } else {
    state.leafletMap.flyTo([lat, lon], 11, { duration: 1.2 });
  }

  if (state.leafletMarker) state.leafletMarker.remove();

  const iconUrl = WeatherIcons.dataUri(current.weather[0].icon);
  const unitSym = state.unit === 'metric' ? 'C' : 'F';
  const temp    = Math.round(current.main.temp);
  const windVal = state.unit === 'metric'
    ? `${Math.round(current.wind.speed * 3.6)} km/h`
    : `${Math.round(current.wind.speed)} mph`;

  const customIcon = L.divIcon({
    className: 'weather-marker-icon',
    html: `<div style="position:relative;width:44px;height:44px;">
      <div class="marker-pulse-ring"></div>
      <div class="marker-inner"><img src="${iconUrl}" alt="weather"/></div>
    </div>`,
    iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -48],
  });

  const popupHTML = `
    <div class="map-popup">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div>
          <div class="map-popup-city">${current.name}, ${current.sys.country}</div>
          <div class="map-popup-temp">${temp}°${unitSym}</div>
        </div>
        <img src="${iconUrl}" alt="" style="width:40px;height:40px;"/>
      </div>
      <div class="map-popup-row">☁️ ${capitalise(current.weather[0].description)}</div>
      <div class="map-popup-row">💧 ${current.main.humidity}%</div>
      <div class="map-popup-row">💨 ${windVal}</div>
    </div>
  `;

  state.leafletMarker = L.marker([lat, lon], { icon: customIcon })
    .addTo(state.leafletMap)
    .bindPopup(popupHTML, { maxWidth: 240, minWidth: 200 })
    .openPopup();

  setTimeout(() => state.leafletMap.invalidateSize(), 300);
}

function switchMapLayer(key) {
  if (!state.leafletMap || state.activeLayerKey === key) return;
  if (state.currentLayer) state.currentLayer.remove();
  const def = MAP_LAYERS[key] || MAP_LAYERS.dark;
  state.currentLayer = L.tileLayer(def.url, { attribution: def.attr, maxZoom: def.maxZ })
    .addTo(state.leafletMap);
  state.currentLayer.bringToBack();
  state.activeLayerKey = key;
}

// ─────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);