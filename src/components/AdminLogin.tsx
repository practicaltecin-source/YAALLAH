import React, { useState, FormEvent } from 'react';
import { Settings } from '../types';
import { Eye, EyeOff, ShieldCheck, Lock, Smartphone } from 'lucide-react';

interface AdminLoginProps {
  settings: Settings;
  onLoginSuccess: () => void;
}

export default function AdminLogin({ settings, onLoginSuccess }: AdminLoginProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password === settings.adminPassword) {
      setStep(2);
    } else {
      setError('Incorrect admin password. Please try again.');
    }
  };

  const handleStep2 = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin === settings.adminPin) {
      onLoginSuccess();
    } else {
      setError('Incorrect Security PIN. Please try again.');
    }
  };

  const handleBack = () => {
    setStep(1);
    setPin('');
    setError('');
  };

  return (
    <div className="view active pb-20 max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-2 mt-8 select-none">
        <div className="w-16 h-16 bg-gradient-to-br from-brand-gold-400 to-brand-gold-600 text-brand-green-900 rounded-3xl flex items-center justify-center mx-auto shadow-md">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="font-display font-bold text-brand-green-950 text-base md:text-lg">
          Administrator Login Gate
        </h2>
        <p className="text-[10px] text-brand-ink-soft/80 tracking-wide uppercase">
          Authorized Committee access only
        </p>
      </div>

      <div className="bg-brand-panel border border-brand-line rounded-2xl p-6 shadow-md space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold text-center leading-tight">
            ⚠️ {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="text-center select-none">
              <span className="text-[9px] font-extrabold bg-brand-green-100 text-brand-green-800 px-3 py-1 rounded-full border border-brand-green-600/10">
                STEP 1 OF 2
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-ink-soft">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full pl-4 pr-11 py-3 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-brand-ink placeholder:text-brand-ink-soft/40 focus:outline-none focus:border-brand-gold-500 transition-colors"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-brand-ink-soft hover:text-brand-green-800"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs md:text-sm rounded-xl cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" /> Continue Gate
            </button>
          </form>
        ) : (
          <form onSubmit={handleStep2} className="space-y-4">
            <div className="text-center select-none">
              <span className="text-[9px] font-extrabold bg-brand-gold-100 text-brand-gold-700 px-3 py-1 rounded-full border border-brand-gold-400/10">
                STEP 2 OF 2
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-ink-soft">
                Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter Security PIN"
                  className="w-full pl-4 pr-11 py-3 bg-brand-bg border border-brand-line rounded-xl text-xs md:text-sm text-brand-ink placeholder:text-brand-ink-soft/40 focus:outline-none focus:border-brand-gold-500 transition-colors tracking-widest font-mono text-center font-extrabold"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-3.5 text-brand-ink-soft hover:text-brand-green-800"
                >
                  {showPin ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                className="w-full py-3 bg-brand-green-800 hover:bg-brand-green-700 text-white font-bold text-xs md:text-sm rounded-xl cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" /> Verify &amp; Unlock
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="w-full py-2.5 bg-transparent border border-brand-line hover:bg-brand-line/35 text-brand-ink-soft font-semibold text-xs md:text-sm rounded-xl cursor-pointer transition-colors"
              >
                Back to step 1
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
