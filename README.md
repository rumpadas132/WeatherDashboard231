# Weather Dashboard

A modern React + Vite weather application that provides real-time weather forecasts, interactive maps, and data visualization.

## Features

- Real-time weather data from OpenWeather API
- Interactive weather maps using Leaflet
- Weather charts and graphs with Chart.js
- PDF export functionality
- Responsive design
- Fast development with Vite

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenWeather API key

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Add your API key**
   - Get a free API key from [OpenWeather](https://openweathermap.org/api)
   - Update `.env` with your API key:
     ```
     VITE_OPENWEATHER_API_KEY=your_api_key_here
     ```

## Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Deployment on Render

### Steps:
1. Push the code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Static Site"
4. Connect your GitHub repository
5. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
6. Add Environment Variables:
   - Key: `VITE_OPENWEATHER_API_KEY`
   - Value: Your OpenWeather API key
7. Click "Create Static Site"

### Environment Variables on Render

Set the following environment variables in Render dashboard:
- `VITE_OPENWEATHER_API_KEY`: Your OpenWeather API key

## Project Structure

```
src/
├── App.jsx         # Main app component
├── App.css         # App styles
├── main.jsx        # Entry point
├── index.css       # Global styles
└── assets/         # Images and other assets
```

## Technologies Used

- React 19
- Vite
- Axios
- Chart.js
- Leaflet
- jsPDF & html2canvas (for PDF export)
- ESLint

## License

MIT
