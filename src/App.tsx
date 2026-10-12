import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ParkingProvider } from './context/ParkingContext';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { EventHistoryPage } from './pages/EventHistoryPage';
import { DeviceSettingsPage } from './pages/DeviceSettingsPage';
import { BackendGuidePage } from './pages/BackendGuidePage';

export default function App() {
  return (
    <BrowserRouter>
      <ParkingProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/monitoring" element={<LiveMonitoringPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/events" element={<EventHistoryPage />} />
            <Route path="/settings" element={<DeviceSettingsPage />} />
            <Route path="/guide" element={<BackendGuidePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </ParkingProvider>
    </BrowserRouter>
  );
}
