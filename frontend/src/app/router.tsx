import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { PlannerPage } from '../pages/PlannerPage';
import { ReportPage } from '../pages/ReportPage';
import { IncidentsPage } from '../pages/IncidentsPage';
import { IncidentPage } from '../pages/IncidentPage';
import { AuthPage } from '../pages/AuthPage';

const RootLayout: React.FC = () => {
  return (
    <AuthProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthProvider>
  );
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/plan" replace />,
      },
      {
        path: 'plan',
        element: <PlannerPage />,
      },
      {
        path: 'report',
        element: <ReportPage />,
      },
      {
        path: 'incidents',
        element: <IncidentsPage />,
      },
      {
        path: 'incidents/:id',
        element: <IncidentPage />,
      },
      {
        path: 'login',
        element: <AuthPage mode="login" />,
      },
      {
        path: 'register',
        element: <AuthPage mode="register" />,
      },
      {
        path: '*',
        element: <Navigate to="/plan" replace />,
      },
    ],
  },
]);
