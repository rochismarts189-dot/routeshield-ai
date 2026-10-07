import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertTriangle, LogIn, UserPlus } from 'lucide-react';

interface AuthPageProps {
  mode: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestedRedirect = searchParams.get('redirect') || '/plan';
  const redirectUrl = requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//') ? requestedRedirect : '/plan';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (password.length < 12) {
        setError('Password must be at least 12 characters');
        return;
      }
      if (new TextEncoder().encode(password).length > 72) {
        setError('Password exceeds the 72-byte limit');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, displayName, password);
      }
      navigate(redirectUrl);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <div className="text-center space-y-2">
        <div className="brand-mark w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-950 mx-auto mb-5">
          <Shield className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {mode === 'login' ? 'Welcome back.' : 'Help clear the way.'}
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          {mode === 'login'
            ? 'Sign in to submit visual evidence and review accessibility warnings'
            : 'Register to contribute community evidence and verification'}
        </p>
      </div>

      <div className="surface p-6 sm:p-8 space-y-5">
        {error && (
          <div
            className="bg-red-950/60 border border-red-800 text-red-200 p-3.5 rounded-lg text-xs flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          {mode === 'register' && (
            <div>
              <label htmlFor="name-input" className="text-slate-300 font-semibold block mb-1">
                Display Name (1–80 characters) *
              </label>
              <input
                id="name-input"
                type="text"
                required
                autoComplete="nickname"
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jane Walker"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="email-input" className="text-slate-300 font-semibold block mb-1">
              Email Address *
            </label>
            <input
              id="email-input"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="password-input" className="text-slate-300 font-semibold block mb-1">
              Password {mode === 'register' ? '(12–128 characters)' : ''} *
            </label>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 12 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {mode === 'register' && (
              <span className="text-[10px] text-slate-400 block mt-1">
                Passwords must be at least 12 characters.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="primary-button w-full"
          >
            {mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800 text-xs text-slate-400">
          {mode === 'login' ? (
            <p>
              Don&apos;t have an account?{' '}
              <Link
                to={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Register now
              </Link>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <Link
                to={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Sign in here
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
