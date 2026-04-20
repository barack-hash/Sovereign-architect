import React, { useState } from 'react';
import { Shield, Clock, BookOpen, Users } from 'lucide-react';

interface ConstraintsViewProps {
  systemConstraints: {
    minCash: number;
    maxBurn: number;
    minMonthlyBuffer?: number;
    minSleep: number;
    maxLabor: number;
    prayerStrict?: boolean;
    minStudy?: number;
    minFamily?: number;
    coreContacts?: number;
  };
  setSystemConstraints: any;
}

const ConstraintsView: React.FC<ConstraintsViewProps> = ({ systemConstraints, setSystemConstraints }) => {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(prev => (prev === section ? null : section));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {/* Panel 1: Safety Nets */}
      <div className="bg-surface-lowest border border-emerald-900/30 p-6 rounded-lg shadow-lg">
        <button
          onClick={() => toggleSection('safety')}
          className="w-full flex items-center justify-between gap-3 mb-6 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-colors"
        >
          <div className="flex items-center gap-3 text-emerald-500">
            <Shield className="w-6 h-6" />
            <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Safety Nets</h2>
          </div>
          <span className="text-emerald-500 text-lg font-bold">{openSection === 'safety' ? '-' : '+'}</span>
        </button>
        {openSection === 'safety' ? (
        <div className="space-y-4 transition-all duration-300">
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Emergency Fund Floor ($)</label>
            <input
              type="number"
              value={systemConstraints.minCash}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, minCash: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Maximum Burn Rate ($/mo)</label>
            <input
              type="number"
              value={systemConstraints.maxBurn}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, maxBurn: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Minimum Monthly Buffer ($/mo)</label>
            <input
              type="number"
              value={systemConstraints.minMonthlyBuffer ?? 0}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, minMonthlyBuffer: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        ) : null}
      </div>

      {/* Panel 2: Temporal / Time */}
      <div className="bg-surface-lowest border border-cyan-900/30 p-6 rounded-lg shadow-lg">
        <button
          onClick={() => toggleSection('temporal')}
          className="w-full flex items-center justify-between gap-3 mb-6 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-colors"
        >
          <div className="flex items-center gap-3 text-cyan-500">
            <Clock className="w-6 h-6" />
            <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Temporal / Time</h2>
          </div>
          <span className="text-cyan-500 text-lg font-bold">{openSection === 'temporal' ? '-' : '+'}</span>
        </button>
        {openSection === 'temporal' ? (
        <div className="space-y-4 transition-all duration-300">
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Absolute Min Sleep (Hrs/day)</label>
            <input
              type="number"
              value={systemConstraints.minSleep}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, minSleep: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Max Active Labor (Hrs/day)</label>
            <input
              type="number"
              value={systemConstraints.maxLabor}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, maxLabor: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        ) : null}
      </div>

      {/* Panel 3: Spiritual / Religion */}
      <div className="bg-surface-lowest border border-purple-900/30 p-6 rounded-lg shadow-lg">
        <button
          onClick={() => toggleSection('spiritual')}
          className="w-full flex items-center justify-between gap-3 mb-6 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-colors"
        >
          <div className="flex items-center gap-3 text-purple-500">
            <BookOpen className="w-6 h-6" />
            <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Spiritual / Religion</h2>
          </div>
          <span className="text-purple-500 text-lg font-bold">{openSection === 'spiritual' ? '-' : '+'}</span>
        </button>
        {openSection === 'spiritual' ? (
        <div className="space-y-4 transition-all duration-300">
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Daily Prayer / Salah Strictness (Non-Negotiable)</label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={systemConstraints.prayerStrict || false}
                onChange={(e) => setSystemConstraints({ ...systemConstraints, prayerStrict: e.target.checked })}
                className="w-4 h-4 bg-surface-lowest border border-outline-variant/20 rounded text-amber-400 focus:ring-amber-500 focus:ring-offset-surface-lowest accent-amber-500"
              />
              <span className="ml-2 text-xs font-mono text-amber-400 uppercase">{systemConstraints.prayerStrict ? 'ACTIVE' : 'INACTIVE'}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Min Weekly Study/Reading (Hrs)</label>
            <input
              type="number"
              value={systemConstraints.minStudy || 0}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, minStudy: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-amber-400 font-mono text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        ) : null}
      </div>

      {/* Panel 4: Relational & Network */}
      <div className="bg-surface-lowest border border-blue-900/30 p-6 rounded-lg shadow-lg">
        <button
          onClick={() => toggleSection('relational')}
          className="w-full flex items-center justify-between gap-3 mb-6 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-colors"
        >
          <div className="flex items-center gap-3 text-blue-500">
            <Users className="w-6 h-6" />
            <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Relational & Network</h2>
          </div>
          <span className="text-blue-500 text-lg font-bold">{openSection === 'relational' ? '-' : '+'}</span>
        </button>
        {openSection === 'relational' ? (
        <div className="space-y-4 transition-all duration-300">
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Min Family Time (Hrs/week)</label>
            <input
              type="number"
              value={systemConstraints.minFamily || 0}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, minFamily: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-blue-400 font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-headline text-on-surface-variant mb-2">Core Contacts to Maintain (Count)</label>
            <input
              type="number"
              value={systemConstraints.coreContacts || 0}
              onChange={(e) => setSystemConstraints({ ...systemConstraints, coreContacts: Number(e.target.value) || 0 })}
              className="w-full bg-surface-lowest border border-outline-variant/20 p-2 rounded text-blue-400 font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
};

export default ConstraintsView;
