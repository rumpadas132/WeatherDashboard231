import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY
const DEFAULT_LOCATION = 'London, UK'

const formatTime = (value) => new Date(value * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const formatDate = (value) => new Date(value * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const weatherIconUrl = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`

const getThemeBackground = (weatherMain) => {
  if (!weatherMain) {
    return 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)'
  }

  const main = weatherMain.toLowerCase()
  if (main.includes('clear')) {
    return 'linear-gradient(180deg, #ffecb3 0%, #93c5fd 100%)'
  }
  if (main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm')) {
    return 'linear-gradient(180deg, #c7d2fe 0%, #64748b 100%)'
  }
  if (main.includes('cloud')) {
    return 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%)'
  }
  if (main.includes('snow')) {
    return 'linear-gradient(180deg, #dbeafe 0%, #e2eaf7 100%)'
  }

  return 'linear-gradient(180deg, #f0fdf4 0%, #dbeafe 100%)'
}

function App() {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [units, setUnits] = useState('metric')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('Enter a city or choose saved search')

  const dashboardRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const dailyForecast = useMemo(() => {
    if (!forecast?.list) return []

    const grouped = forecast.list.reduce((result, item) => {
      const key = formatDate(item.dt)
      if (!result[key]) {
        result[key] = {
          date: key,
          min: item.main.temp_min,
          max: item.main.temp_max,
          humidity: item.main.humidity,
          wind: item.wind.speed,
          count: 1,
          icon: item.weather[0].icon,
          description: item.weather[0].description,
        }
      } else {
        result[key].min = Math.min(result[key].min, item.main.temp_min)
        result[key].max = Math.max(result[key].max, item.main.temp_max)
        result[key].humidity += item.main.humidity
        result[key].wind += item.wind.speed
        result[key].count += 1
      }
      return result
    }, {})

    return Object.values(grouped).slice(0, 5).map((day) => ({
      ...day,
      humidity: Math.round(day.humidity / day.count),
      wind: Number((day.wind / day.count).toFixed(1)),
    }))
  }, [forecast])

  const chartData = useMemo(() => {
    return {
      labels: dailyForecast.map((day) => day.date),
      datasets: [
        {
          label: 'High',
          data: dailyForecast.map((day) => Math.round(day.max)),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Low',
          data: dailyForecast.map((day) => Math.round(day.min)),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(251, 191, 36, 0.2)',
          tension: 0.3,
          fill: true,
        },
      ],
    }
  }, [dailyForecast])

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Temperature Trend' },
    },
    scales: {
      y: { beginAtZero: false, ticks: { callback: (value) => `${value}°` } },
    },
  }

  const saveHistory = (item) => {
    const existing = history.filter((entry) => entry.name !== item.name || entry.country !== item.country)
    const next = [item, ...existing].slice(0, 5)
    setHistory(next)
    localStorage.setItem('weather-search-history', JSON.stringify(next))
  }

  const fetchWeatherByCoords = async (location, name, country) => {
    if (!API_KEY) {
      setError('Missing OpenWeather API key. Set VITE_OPENWEATHER_API_KEY in your environment.')
      setStatusMessage('OpenWeather API key is required')
      return
    }

    setLoading(true)
    setError('')
    setStatusMessage('Loading weather data...')

    try {
      const coords = { lat: location.lat, lon: location.lon }
      const [weatherRes, forecastRes] = await Promise.all([
        axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { ...coords, units, appid: API_KEY },
        }),
        axios.get('https://api.openweathermap.org/data/2.5/forecast', {
          params: { ...coords, units, appid: API_KEY },
        }),
      ])

      const locationEntry = {
        name,
        country,
        lat: coords.lat,
        lon: coords.lon,
      }

      setWeather(weatherRes.data)
      setForecast(forecastRes.data)
      setSelectedLocation(locationEntry)
      saveHistory(locationEntry)
      setSuggestions([])
      setStatusMessage('Weather loaded successfully')
    } catch (err) {
      setError('Could not load weather data. Please check the city name or try again later.')
      setStatusMessage('Unable to load weather data')
    } finally {
      setLoading(false)
    }
  }

  const searchCity = async (term) => {
    if (!API_KEY) {
      setError('Missing OpenWeather API key. Set VITE_OPENWEATHER_API_KEY in your environment.')
      setStatusMessage('OpenWeather API key is required')
      return
    }

    if (!term.trim()) {
      setError('Enter a city name to search')
      return
    }

    setLoading(true)
    setError('')
    setStatusMessage('Finding city...')

    try {
      const response = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
        params: { q: term, limit: 5, appid: API_KEY },
      })

      if (!response.data.length) {
        setError('No results found. Try a different city or use city, country format.')
        setStatusMessage('No city found')
        setSuggestions([])
        return
      }

      const options = response.data.map((item) => ({
        name: item.name,
        country: item.country || item.state || 'Unknown',
        lat: item.lat,
        lon: item.lon,
      }))

      setSuggestions(options)
      const primary = options[0]
      await fetchWeatherByCoords(primary, primary.name, primary.country)
    } catch (err) {
      setError('Search failed. Please check your connection and try again.')
      setStatusMessage('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    searchCity(query)
  }

  const handleSuggestionClick = (item) => {
    setQuery(`${item.name}, ${item.country}`)
    fetchWeatherByCoords(item, item.name, item.country)
  }

  const handleHistoryClick = (item) => {
    setQuery(`${item.name}, ${item.country}`)
    fetchWeatherByCoords(item, item.name, item.country)
  }

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return
    setLoading(true)
    setStatusMessage('Creating PDF...')

    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = (canvas.height * pageWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
      pdf.save(`${selectedLocation?.name || 'weather'}-dashboard.pdf`)
      setStatusMessage('PDF exported successfully')
    } catch (err) {
      setError('PDF export failed. Please try again.')
      setStatusMessage('PDF export failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('weather-search-history') || '[]')
    if (savedHistory.length) {
      const first = savedHistory[0]
      setHistory(savedHistory)
      setQuery(`${first.name}, ${first.country}`)
      fetchWeatherByCoords(first, first.name, first.country)
    } else {
      setQuery(DEFAULT_LOCATION)
      searchCity(DEFAULT_LOCATION)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) {
      delete L.Icon.Default.prototype._getIconUrl

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      })

      mapRef.current = L.map('weather-map', {
        center: [20, 0],
        zoom: 2,
        scrollWheelZoom: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return
    const coords = [selectedLocation.lat, selectedLocation.lon]
    mapRef.current.setView(coords, 8, { animate: true })

    if (markerRef.current) {
      markerRef.current.setLatLng(coords)
    } else {
      markerRef.current = L.marker(coords).addTo(mapRef.current)
    }
  }, [selectedLocation])

  const temperatureUnit = units === 'metric' ? '°C' : '°F'
  const feelsLike = weather?.main?.feels_like
  const wind = weather?.wind?.speed
  const humidity = weather?.main?.humidity
  const iconCode = weather?.weather?.[0]?.icon
  const weatherMain = weather?.weather?.[0]?.main

  return (
    <div className="app" style={{ background: getThemeBackground(weatherMain) }}>
      <div className="container" ref={dashboardRef}>
        <header className="topbar">
          <div>
            <h1>Weather Dashboard</h1>
            <p className="status">{statusMessage}</p>
          </div>
          <div className="buttons">
            <button type="button" className="btn btn-primary" onClick={handleExportPDF} disabled={loading}>
              Export PDF
            </button>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-button ${units === 'metric' ? 'active' : ''}`}
                onClick={() => setUnits('metric')}
              >
                °C
              </button>
              <button
                type="button"
                className={`toggle-button ${units === 'imperial' ? 'active' : ''}`}
                onClick={() => setUnits('imperial')}
              >
                °F
              </button>
            </div>
          </div>
        </header>

        <section className="card search-card">
          <form className="search-group" onSubmit={handleSubmit} aria-label="Search location">
            <input
              type="text"
              placeholder="Search city, country"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-secondary" disabled={loading}>
              Search
            </button>
          </form>

          {suggestions.length > 1 && (
            <div className="suggestions">
              <p>Did you mean:</p>
              <div className="history-list">
                {suggestions.slice(0, 5).map((option) => (
                  <button
                    key={`${option.name}-${option.lat}-${option.lon}`}
                    type="button"
                    className="history-button"
                    onClick={() => handleSuggestionClick(option)}
                  >
                    {option.name}, {option.country}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="history-panel">
              <h2>Recent searches</h2>
              <div className="history-list">
                {history.map((item) => (
                  <button
                    key={`${item.name}-${item.country}`}
                    type="button"
                    className="history-button"
                    onClick={() => handleHistoryClick(item)}
                  >
                    {item.name}, {item.country}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {error && <div className="card error-card">{error}</div>}

        <div className="panel-grid">
          <div className="main-panel">
            <section className="card weather-card">
              <div className="weather-summary">
                <div>
                  <p className="section-label">Current location</p>
                  <h2>{selectedLocation ? `${selectedLocation.name}, ${selectedLocation.country}` : 'Waiting for selection'}</h2>
                  <p className="weather-description">{weather?.weather?.[0]?.description || 'Search for a city to load weather'}</p>
                </div>
                {iconCode && <img src={weatherIconUrl(iconCode)} alt={weather?.weather?.[0]?.description} />}
              </div>

              <div className="weather-details">
                <div className="temperature-row">
                  <span className="temperature-value">{weather ? `${Math.round(weather.main.temp)}${temperatureUnit}` : '--'}</span>
                  <span className="temperature-caption">Feels like {weather ? `${Math.round(feelsLike)}${temperatureUnit}` : '--'}</span>
                </div>

                <div className="weather-stats">
                  <div className="metric">
                    <small>Humidity</small>
                    <strong>{humidity ? `${humidity}%` : '--'}</strong>
                  </div>
                  <div className="metric">
                    <small>Wind speed</small>
                    <strong>{wind ? `${wind} ${units === 'metric' ? 'm/s' : 'mph'}` : '--'}</strong>
                  </div>
                  <div className="metric">
                    <small>Sunrise</small>
                    <strong>{weather ? formatTime(weather.sys.sunrise) : '--'}</strong>
                  </div>
                  <div className="metric">
                    <small>Sunset</small>
                    <strong>{weather ? formatTime(weather.sys.sunset) : '--'}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="card chart-card">
              <Line options={chartOptions} data={chartData} />
            </section>

            <section className="card map-card">
              <div className="map-container" id="weather-map" aria-label="Weather location map" />
            </section>
          </div>

          <aside className="sidebar-panel">
            <section className="card forecast-card">
              <div className="forecast-header">
                <h2>5-day forecast</h2>
                <span className="forecast-note">Min / Max temperatures</span>
              </div>
              <div className="forecast-grid">
                {dailyForecast.length > 0 ? (
                  dailyForecast.map((day) => (
                    <article key={day.date} className="forecast-item">
                      <p className="forecast-date">{day.date}</p>
                      <img src={weatherIconUrl(day.icon)} alt={day.description} />
                      <p className="forecast-temp">
                        <strong>{Math.round(day.max)}{temperatureUnit}</strong> / {Math.round(day.min)}{temperatureUnit}
                      </p>
                      <p className="forecast-meta">Humidity {day.humidity}%</p>
                      <p className="forecast-meta">Wind {day.wind} {units === 'metric' ? 'm/s' : 'mph'}</p>
                    </article>
                  ))
                ) : (
                  <p className="status">Forecast data will appear after search.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default App
