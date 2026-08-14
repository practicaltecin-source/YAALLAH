import { useState } from 'react';
import { Database, ViewName } from '../types';
import { 
  Home, 
  Trophy, 
  Award, 
  Calendar, 
  GraduationCap,
  Info, 
  Settings as SettingsIcon, 
  Lock, 
  LogOut, 
  Menu, 
  X,
  Smartphone,
  Sparkles,
  RotateCw,
  Radio,
  FileSpreadsheet,
  Search,
  Share2,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSavedSheetId } from '../googleSheets';

interface HeaderProps {
  currentView: ViewName;
  onNavigate: (view: ViewName) => void;
  isAdmin: boolean;
  onLogout: () => void;
  db: Database;
  onTogglePublicSite?: (isOffline: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({ currentView, onNavigate, isAdmin, onLogout, db, onTogglePublicSite, onRefresh, isRefreshing }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => setIsOpen(!isOpen);

  const navItems = [
    { view: 'home' as ViewName, label: 'Home', icon: Home },
    { view: 'results' as ViewName, label: 'Results', icon: Trophy },
    { view: 'scoreboard' as ViewName, label: 'Team Scoreboard', icon: Award },
    { view: 'programs' as ViewName, label: 'Programs', icon: Calendar },
    { view: 'candidateSearch' as ViewName, label: '🔍 Candidate Search', icon: Search },
    { view: 'categories' as ViewName, label: 'Categories & Classes', icon: GraduationCap },
    { view: 'about' as ViewName, label: 'About', icon: Info },
    { 
      view: (isAdmin ? 'dashboard' : 'adminGate') as ViewName, 
      label: isAdmin ? '🛡️ Admin Dashboard' : '🔒 Admin Login', 
      icon: isAdmin ? Smartphone : Lock 
    },
    ...(isAdmin ? [{ view: 'settings' as ViewName, label: '⚙️ System Settings', icon: SettingsIcon }] : []),
  ];

  const handleNav = (view: ViewName) => {
    onNavigate(view);
    setIsOpen(false);
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-brand-bg/92 backdrop-blur-md border-b border-brand-line flex items-center justify-between px-4 py-3 shadow-sm no-print">
        <button
          onClick={toggleDrawer}
          className="p-2 -ml-2 rounded-xl text-brand-green-900 active:bg-brand-line/50 transition-colors"
          aria-label="Toggle menu"
          id="hamBtn"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          {db.settings.eventLogo ? (
            <img 
              src={db.settings.eventLogo} 
              alt="Logo" 
              className="w-8 h-8 object-contain rounded-lg bg-white/80 p-0.5 border border-brand-line shadow-xs" 
            />
          ) : (
            <div className="w-8 h-8 drop-shadow-sm flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <path
                  d="M60 14c-25 4-42 25-42 48 0 26 21 47 47 47 17 0 32-9 40-23-7 4-15 6-23 6-26 0-47-21-47-47 0-13 5-24 13-31z"
                  fill="#cf9d2e"
                />
              </svg>
            </div>
          )}
          <span className="font-display font-bold text-base md:text-lg tracking-wide text-brand-green-900 truncate max-w-[150px] sm:max-w-xs">
            {db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'}
          </span>
        </div>

        {/* Live sync badge & Google Sheet button */}
        <div className="flex items-center gap-1.5">
          {isAdmin && getSavedSheetId() && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${getSavedSheetId()}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Sheet Live"
              className="p-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 text-xs font-bold cursor-pointer border border-emerald-500 shadow-2xs active:scale-95 shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span className="text-[11px] font-bold hidden sm:inline">Sheet</span>
            </a>
          )}

          <button
            onClick={onRefresh || (() => window.location.reload())}
            disabled={isRefreshing}
            title="Refresh Live Data from Backend"
            className="p-1.5 px-2.5 rounded-lg bg-emerald-100/90 hover:bg-emerald-200 text-emerald-900 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-emerald-300/60 shadow-2xs active:scale-95 disabled:opacity-70 shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 text-emerald-700 ${isRefreshing ? 'animate-spin text-emerald-900' : ''}`} />
            <span className="text-[11px] font-medium hidden xs:inline">
              {isRefreshing ? 'Syncing...' : 'Sync'}
            </span>
          </button>

          <button
            onClick={() => onNavigate(isAdmin ? 'dashboard' : 'adminGate')}
            title={isAdmin ? "Go to Admin Dashboard" : "Log in as Admin"}
            className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs active:scale-95 shrink-0 ${
              isAdmin
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                : 'bg-brand-green-800 hover:bg-brand-green-700 text-brand-gold-300 border-brand-green-600'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="text-[11px] font-extrabold">{isAdmin ? 'Admin Panel' : 'Admin Login'}</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onTogglePublicSite?.(!db.settings?.isPublicSiteOffline)}
              title={db.settings?.isPublicSiteOffline ? "Click to turn Public Link ON" : "Click to turn Public Link OFF (404 Maintenance Mode)"}
              className={`p-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border shadow-2xs active:scale-95 ${
                db.settings?.isPublicSiteOffline
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-500 animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-600'
              }`}
            >
              <span className="text-[10px]">{db.settings?.isPublicSiteOffline ? '🔴 Link OFF' : '🟢 Link ON'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 px-2 py-1 bg-brand-green-100 text-brand-green-800 rounded-full font-medium text-xs border border-brand-green-500/10">
            <div className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-brand-gold-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
            {isAdmin ? 'Admin' : 'LIVE'}
          </div>
        </div>
      </header>

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleDrawer}
              className="fixed inset-0 z-50 bg-brand-green-900/40 backdrop-blur-sm no-print"
              id="overlay"
            />

            {/* Main Drawer Body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] z-50 bg-brand-green-900 text-white flex flex-col shadow-2xl no-print"
              id="drawer"
            >
              {/* Header inside drawer */}
              <div className="p-5 border-b border-white/12 flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg viewBox="0 0 120 120" className="w-7 h-7">
                      <path
                        d="M60 14c-25 4-42 25-42 48 0 26 21 47 47 47 17 0 32-9 40-23-7 4-15 6-23 6-26 0-47-21-47-47 0-13 5-24 13-31z"
                        fill="#e0b94d"
                      />
                    </svg>
                    <span className="font-display font-bold text-md tracking-wider text-brand-gold-400 truncate max-w-[170px]">
                      {db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'}
                    </span>
                  </div>
                  <b className="text-sm font-semibold text-white/90">KALIMA 2k26 MEELAD FEST</b>
                  <small id="drawerUserTag" className="text-[10px] text-brand-gold-100 opacity-70">
                    {isAdmin ? '🛡️ SYSTEM ADMINISTRATOR' : '👥 LIVE PUBLIC VIEW'}
                  </small>
                </div>
                <button
                  onClick={toggleDrawer}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/80"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Public Link Switch inside Drawer */}
              {isAdmin && (
                <div className="mx-3 mt-3 p-3 bg-white/10 rounded-xl border border-white/20 flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1">
                      <span>🌐</span> Public Link: {db.settings?.isPublicSiteOffline ? '🔴 OFF (404)' : '🟢 ON'}
                    </span>
                    <span className="text-[10px] text-white/80 leading-tight">
                      {db.settings?.isPublicSiteOffline ? 'Public link shows 404 error' : 'Public views live scores'}
                    </span>
                  </div>
                  <button
                    onClick={() => onTogglePublicSite?.(!db.settings?.isPublicSiteOffline)}
                    className={`px-3 py-1.5 text-[11px] font-black rounded-lg cursor-pointer transition-all active:scale-95 shadow ${
                      db.settings?.isPublicSiteOffline
                        ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                        : 'bg-rose-500 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {db.settings?.isPublicSiteOffline ? 'Turn ON' : 'Turn OFF'}
                  </button>
                </div>
              )}

              {/* Navigation list */}
              <nav id="drawerNav" className="flex-1 px-3 py-4 flex flex-col gap-1.5 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNav(item.view)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-medium text-sm text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-brand-gold-500/15 text-brand-gold-400 border-l-4 border-brand-gold-500 shadow-inner'
                          : 'text-white/80 hover:bg-white/5 active:bg-white/10'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-brand-gold-400' : 'text-white/60'}`} />
                      {item.label}
                    </button>
                  );
                })}

                {/* Direct Google Sheets Live Sync Menu Option for Admin */}
                {isAdmin && (
                  <button
                    onClick={() => handleNav('dashboard')}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-xs text-emerald-300 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 transition-all cursor-pointer mt-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>📊 Google Sheets Live Sync</span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${getSavedSheetId() ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-amber-950'}`}>
                      {getSavedSheetId() ? 'Active' : 'Setup'}
                    </span>
                  </button>
                )}

                {isAdmin && (
                  <>
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      onClick={() => {
                        onLogout();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-xs text-left text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-300/80" />
                      Admin Log Out
                    </button>
                  </>
                )}
              </nav>

              {/* Drawer Footer info */}
              <div className="p-4 bg-brand-green-800/40 border-t border-white/5 text-[10px] text-white/50 text-center flex flex-col gap-1 select-none">
                <span className="flex items-center justify-center gap-1 font-semibold text-brand-gold-400/80">
                  <Sparkles className="w-3 h-3 text-brand-gold-400" /> Managed by Abdul Haseeb PC
                </span>
                <span>{db.settings.boardName || db.settings.eventName || 'KALIMA 2k26 MEELAD FEST'} &bull; v1.0</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
