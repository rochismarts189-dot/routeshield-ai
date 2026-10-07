import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Navigation, AlertCircle, Camera, LogIn, LogOut, UserCheck } from 'lucide-react';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isModerator, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path
      ? 'bg-emerald-600/20 text-emerald-400 border-b-2 border-emerald-400 font-semibold'
      : 'text-slate-300 hover:text-white hover:bg-slate-800/60';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Prominent Fictional Network Disclaimer Banner */}
      <div
        className="bg-slate-900 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs md:text-sm text-center flex items-center justify-center gap-2"
        role="region"
        aria-label="Fictional demonstration network disclaimer"
      >
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span>
          <strong>Fictional demonstration network — not live navigation.</strong> STEP_FREE is an
          algorithmic planning preference, not a certification of wheelchair safety.
        </span>
      </div>

      {/* Main Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-3 items-center justify-between">
          {/* Brand */}
          <Link
            to="/plan"
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-lg p-1"
            aria-label="RouteShield AI Home"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/50">
              <Shield className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                RouteShield <span className="text-emerald-400 text-sm font-semibold uppercase">AI</span>
              </span>
              <p className="text-[10px] text-slate-400 hidden sm:block -mt-1">
                Explainable Step-Free Pedestrian Navigation
              </p>
            </div>
          </Link>

          {/* Navigation links */}
          <nav className="order-3 w-full sm:order-none sm:w-auto flex flex-wrap items-center gap-1 sm:gap-2" aria-label="Main Navigation">
            <Link
              to="/plan"
              aria-current={location.pathname === '/plan' ? 'page' : undefined}
              className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1.5 ${isActive('/plan')}`}
            >
              <Navigation className="w-4 h-4" aria-hidden="true" />
              <span>Route Planner</span>
            </Link>

            <Link
              to="/incidents"
              aria-current={location.pathname === '/incidents' ? 'page' : undefined}
              className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1.5 ${isActive('/incidents')}`}
            >
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <span>Incidents</span>
            </Link>

            <Link
              to="/report"
              aria-current={location.pathname === '/report' ? 'page' : undefined}
              className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1.5 ${isActive('/report')}`}
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>Report Photo</span>
            </Link>
          </nav>

          {/* User state / Auth Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs text-slate-200 font-medium flex items-center gap-1 justify-end">
                    {isModerator && (
                      <span className="bg-purple-900/80 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-500/40">
                        MOD
                      </span>
                    )}
                    {user?.displayName}
                  </span>
                  <span className="text-[10px] text-slate-400">{user?.email}</span>
                </div>
                <button
                  onClick={logout}
                  className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  aria-label="Log out of session"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Login</span>
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-xs sm:text-sm text-emerald-950 font-semibold bg-emerald-400 hover:bg-emerald-300 rounded-md shadow transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Accessible Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            RouteShield AI — Community evidence becomes explainable, step-free pedestrian route warnings.
          </p>
          <p className="text-slate-400">
            Hackathon MVP: AI for Accessibility &amp; Inclusion. Built with React, Express, Supabase &amp; Gemini.
          </p>
        </div>
      </footer>
    </div>
  );
};
