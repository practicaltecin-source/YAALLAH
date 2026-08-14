import { motion } from 'motion/react';
import { Database } from '../types';

interface SplashProps {
  onExplore: () => void;
  db: Database;
}

export default function Splash({ onExplore, db }: SplashProps) {
  const displayEventName = (db.settings.eventName || 'KALIMA 2k26 MEELAD FEST').toUpperCase();
  const displayBoardName = db.settings.boardName || 'KALIMA 2k26 MEELAD FEST';
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center p-6 text-brand-ink overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 30%, #f5f5f0, #e9e9df 70%)',
      }}
    >
      {/* Background Islamic Star Dust */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <pattern id="stars" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.2" fill="#5a5a40" />
            <circle cx="5" cy="10" r="0.6" fill="#5a5a40" />
            <circle cx="35" cy="30" r="0.9" fill="#5a5a40" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#stars)" />
        </svg>
      </div>

      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.8 }}
        className="w-32 h-32 relative mb-6"
      >
        <svg viewBox="0 0 120 120" fill="none" className="w-full h-full drop-shadow-[0_10px_15px_rgba(90,90,64,0.15)]">
          <path
            d="M60 14c-25 4-42 25-42 48 0 26 21 47 47 47 17 0 32-9 40-23-7 4-15 6-23 6-26 0-47-21-47-47 0-13 5-24 13-31z"
            fill="#5a5a40"
          />
          <circle cx="60" cy="34" r="3.2" fill="#f5f5f0" />
          <circle cx="80" cy="50" r="2" fill="#f5f5f0" />
          <circle cx="40" cy="20" r="1.6" fill="#f5f5f0" />
          {/* Ornamental minaret line */}
          <path d="M60 38 L60 90" stroke="#f5f5f0" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
        </svg>
      </motion.div>

      <motion.h1
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="font-display text-2xl md:text-3xl font-bold tracking-wide mb-1 text-brand-green-900"
      >
        {displayEventName}
      </motion.h1>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="text-lg md:text-xl font-medium text-brand-gold-700 mb-2 font-serif italic"
      >
        {displayBoardName}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="text-xs tracking-widest uppercase text-brand-ink-soft max-w-xs mb-8 font-sans"
      >
        Live Programs &bull; Point Tables &bull; Live Honour Board
      </motion.p>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={onExplore}
        className="px-8 py-3.5 bg-brand-green-700 hover:bg-brand-green-800 text-white rounded-full font-bold shadow-sm cursor-pointer tracking-wider text-sm md:text-base border border-brand-green-600/20 hover:brightness-105 active:scale-95 transition-all"
      >
        Explore Live Results
      </motion.button>
    </motion.div>
  );
}
