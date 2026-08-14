import { User, Info, Shield, Cpu, CheckCircle2, QrCode, Lock, RefreshCw, Zap } from 'lucide-react';
import { Database } from '../types';

interface AboutProps {
  db: Database;
}

export default function About({ db }: AboutProps) {
  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-gold-500" />
        <h2 className="font-display font-bold text-brand-green-900 text-sm md:text-base">
          About the Application & Developer
        </h2>
      </div>

      {/* 1. Developer Profile (First Section) */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5 text-brand-green-900">
          <div className="p-2 bg-brand-green-100/80 rounded-xl text-brand-green-900 shrink-0">
            <User className="w-4 h-4 text-brand-gold-600" />
          </div>
          <h3 className="font-display font-bold text-xs md:text-sm">
            Developed & Managed by Abdul Haseeb PC
          </h3>
        </div>

        <p className="text-xs text-brand-ink-soft leading-relaxed border-t border-brand-line/60 pt-3">
          Abdul Haseeb PC is a versatile Computer & Digital Services Professional with comprehensive experience in administrative data entry, accounting, web application development, graphic design, photo/video editing, digital content creation, and multilingual services across Arabic, English, Malayalam, and Urdu. Combining technical capability, creative execution, and high accuracy, he delivers practical and reliable digital solutions tailored to individual and institutional needs.
        </p>
      </div>

      {/* 2. Platform Mission (Second Section) */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5 text-brand-green-900">
          <div className="p-2 bg-brand-green-100/80 rounded-xl text-brand-green-900">
            <Info className="w-4 h-4 text-brand-gold-600" />
          </div>
          <h3 className="font-display font-bold text-xs md:text-sm">Platform Mission</h3>
        </div>
        <p className="text-xs text-brand-ink-soft leading-relaxed">
          The Event Result Management System is a high-performance digital application engineered for seamlessly coordinating, compiling, and publishing live competition outcomes for arts, cultural, and academic festivals. Built with modern web standards, the platform eliminates manual evaluation delays, provides instantaneous live scoreboard broadcasts, ensures transparent rank distribution, and offers effortless multi-user synchronization across web and cloud environments.
        </p>
      </div>

      {/* 3. Administration & Security (Third Section) */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5 text-brand-green-900">
          <div className="p-2 bg-brand-green-100/80 rounded-xl text-brand-green-900">
            <Shield className="w-4 h-4 text-brand-gold-600" />
          </div>
          <h3 className="font-display font-bold text-xs md:text-sm">Administration & Security</h3>
        </div>
        <p className="text-xs text-brand-ink-soft leading-relaxed">
          Platform controls and sensitive operations are protected under a multi-layered authentication framework requiring an administrator password complemented by a secondary Security PIN gate. Only fully authenticated operators can alter candidate scores, manage team records, or publish final stage evaluations, ensuring maximum data integrity, zero unauthorized modifications, and complete security compliance.
        </p>
      </div>

      {/* 4. Technical Specifications (Fourth Section) */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 md:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5 text-brand-green-900">
          <div className="p-2 bg-brand-green-100/80 rounded-xl text-brand-green-900">
            <Cpu className="w-4 h-4 text-brand-gold-600" />
          </div>
          <h3 className="font-display font-bold text-xs md:text-sm">Technical Specifications</h3>
        </div>
        <div className="grid grid-cols-1 gap-2.5 pt-1 text-xs text-brand-ink-soft">
          <div className="flex items-start gap-2 bg-brand-bg p-2.5 rounded-xl border border-brand-line/60">
            <Zap className="w-4 h-4 text-brand-green-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-brand-green-900 block">Core Application Engine:</span>
              <span className="text-[11px]">High-Performance Reactive Engine • Single-Page Responsive UI • Realtime State Computation</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-brand-bg p-2.5 rounded-xl border border-brand-line/60">
            <Lock className="w-4 h-4 text-brand-green-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-brand-green-900 block">Security & Access Control:</span>
              <span className="text-[11px]">Multi-Layered Admin Authentication • Encrypted Security PIN Gate • Isolated Authorization Levels</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-brand-bg p-2.5 rounded-xl border border-brand-line/60">
            <QrCode className="w-4 h-4 text-brand-green-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-brand-green-900 block">Smart Utilities & Scanner:</span>
              <span className="text-[11px]">Integrated Camera Barcode / QR Scanner • Instant Results Tabulation • Multi-Format Data Reporting</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-brand-bg p-2.5 rounded-xl border border-brand-line/60">
            <RefreshCw className="w-4 h-4 text-brand-green-700 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-brand-green-900 block">System Version & Sync Engine:</span>
              <span className="text-[11px]">Version 2.4.0 (Production Build) • Continuous Multi-Channel Synchronization • Resilient Offline Storage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
