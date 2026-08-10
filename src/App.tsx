import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import TodayPage from './pages/TodayPage'
// import CalendarPage from './pages/CalendarPage'
// import ItineraryPage from './pages/ItineraryPage'
// import PlacesPage from './pages/PlacesPage'
// import MorePage from './pages/MorePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        {/* <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/itinerary" element={<ItineraryPage />} />
        <Route path="/places" element={<PlacesPage />} />
        <Route path="/more" element={<MorePage />} /> */}
      </Routes>
    </BrowserRouter>
  )
}

export default App