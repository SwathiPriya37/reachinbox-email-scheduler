'use client';

import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session?.user) return null;

  const user = session.user;

  return (
    <header className="h-14 border-b border-gray-100 bg-white flex items-center justify-between px-6 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-1">
        <span className="text-xl font-black tracking-tight text-gray-900">ON</span>
        <div className="w-5 h-5 bg-green-500 rounded-sm flex items-center justify-center">
          <span className="text-white font-black text-[10px]">B</span>
        </div>
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
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? 'User'}
              width={28}
              height={28}
              unoptimized
              className="rounded-full ring-1 ring-gray-200"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold">
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-800 leading-tight">{user.name}</p>
            <p className="text-[11px] text-gray-400 leading-tight">{user.email}</p>
          </div>
          <svg className="w-3.5 h-3.5 text-gray-400 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-slide-up">
            <div className="px-3 py-2 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
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

      {/* Close menu on outside click */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}
