'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

/** Deterministic gradient hue derived from name — same name always gets same color */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function useLiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const time = useLiveClock();

  if (!session?.user) return null;

  const user = session.user;
  const name = user.name ?? 'User';
  const initials = getInitials(name);
  const hue = nameToHue(name);
  const avatarStyle = {
    background: `linear-gradient(135deg, hsl(${hue},65%,52%), hsl(${(hue + 40) % 360},70%,44%))`,
  };

  return (
    <header className="h-14 border-b border-gray-100 bg-white flex items-center justify-between px-6 flex-shrink-0">
      {/* ONB Logo */}
      <div className="flex items-center">
        <span className="text-2xl font-black font-mono tracking-tighter text-gray-900 select-none">
          ONB
        </span>
      </div>

      {/* Centre — live clock pill */}
      <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
        {time}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          id="user-menu-btn"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          {/* Initials avatar — always shown, no profile photo */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold select-none shadow-sm"
            style={avatarStyle}
            title={name}
          >
            {initials}
          </div>

          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-800 leading-tight">{name}</p>
            <p className="text-[11px] text-gray-400 leading-tight">{user.email}</p>
          </div>
          <svg className="w-3.5 h-3.5 text-gray-400 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-slide-up">
            <div className="px-3 py-2.5 border-b border-gray-50 flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                style={avatarStyle}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
                <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              id="logout-btn"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}
    </header>
  );
}
