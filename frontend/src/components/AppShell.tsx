import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Navigation, Camera, LogOut, Layers, ArrowUpRight, Info } from 'lucide-react';

const navigation = [
  { path: '/plan', label: 'Route Planner', icon: Navigation },
  { path: '/incidents', label: 'Incidents', icon: Layers },
  { path: '/report', label: 'Report Photo', icon: Camera },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isModerator, logout } = useAuth();
  const { pathname } = useLocation();
  return (
    <div className="app-shell min-h-screen text-slate-100 flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-4 items-center justify-between">
          <Link to="/plan" className="flex items-center gap-3 rounded-xl" aria-label="RouteShield AI Home">
            <span className="brand-mark w-11 h-11 rounded-xl flex items-center justify-center text-emerald-950"><Shield className="w-6 h-6" aria-hidden="true" /></span>
            <span><span className="block text-xl font-bold tracking-tight">RouteShield <span className="text-emerald-300">AI</span></span><span className="block text-xs text-slate-400 tracking-wide">Every journey deserves a clear path.</span></span>
          </Link>
          <nav className="order-3 w-full md:order-none md:w-auto flex gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-800" aria-label="Main Navigation">
            {navigation.map(({ path, label, icon: Icon }) => {
              const active = pathname === path || (path === '/incidents' && pathname.startsWith('/incidents/'));
              return <Link key={path} to={path} aria-current={active ? 'page' : undefined} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-emerald-400/10 text-emerald-300 shadow-[inset_0_0_0_1px_#34d39940]' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="w-4 h-4 shrink-0" aria-hidden="true" /><span>{label}</span></Link>;
            })}
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? <><div className="hidden sm:block text-right"><span className="block text-sm font-medium">{user?.displayName}</span><span className="text-xs text-slate-400">{isModerator ? 'Moderator' : 'Community contributor'}</span></div><button onClick={logout} className="secondary-button" aria-label="Log out of session"><LogOut className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Logout</span></button></> : <><Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white rounded-lg px-2 py-2">Login</Link><Link to="/register" className="primary-button">Join community<ArrowUpRight className="w-4 h-4" aria-hidden="true" /></Link></>}
          </div>
        </div>
      </header>
      <div className="border-b border-slate-800/70 bg-slate-900/50" role="region" aria-label="Fictional demonstration network disclaimer"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-300"><span className="flex items-center gap-2"><Info className="w-3.5 h-3.5 text-emerald-300 shrink-0" aria-hidden="true" /><strong className="font-medium">Fictional demonstration network — not live navigation.</strong></span><span className="text-slate-400">Step-free is a planning preference, not a wheelchair safety certification.</span></div></div>
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">{children}</main>
      <footer className="border-t border-slate-800/70 py-6 text-sm text-slate-400"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-300" aria-hidden="true" /><span>Community evidence. Clearer journeys.</span></p><p className="text-xs">AI for Accessibility &amp; Inclusion · Maple Ward demo</p></div></footer>
    </div>
  );
};
