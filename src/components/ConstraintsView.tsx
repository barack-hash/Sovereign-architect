import React from 'react';
import { Shield, Clock, BookOpen, Users } from 'lucide-react';

interface ConstraintsViewProps {
  systemConstraints: {
    minCash: number;
    maxBurn: number;
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {/* Panel 1: Financial Redlines */}
      <div className="bg-surface-lowest border border-emerald-900/30 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3 mb-6 text-emerald-500">
          <Shield className="w-6 h-6" />
          <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Financial Redlines</h2>
        </div>
        <div className="space-y-4">
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
        </div>
      </div>

      {/* Panel 2: Temporal / Time */}
      <div className="bg-surface-lowest border border-cyan-900/30 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3 mb-6 text-cyan-500">
          <Clock className="w-6 h-6" />
          <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Temporal / Time</h2>
        </div>
        <div className="space-y-4">
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
      </div>

      {/* Panel 3: Spiritual / Religion */}
      <div className="bg-surface-lowest border border-purple-900/30 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3 mb-6 text-purple-500">
          <BookOpen className="w-6 h-6" />
          <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Spiritual / Religion</h2>
        </div>
        <div className="space-y-4">
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
      </div>

      {/* Panel 4: Relational & Network */}
      <div className="bg-surface-lowest border border-blue-900/30 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-3 mb-6 text-blue-500">
          <Users className="w-6 h-6" />
          <h2 className="text-lg font-headline font-bold uppercase tracking-widest">Relational & Network</h2>
        </div>
        <div className="space-y-4">
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
      </div>
    </div>
  );
};

export default ConstraintsView;
