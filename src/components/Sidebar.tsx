import React, { useState } from 'react';
import {
  Dices,
  FlaskConical,
  LayoutDashboard,
  Lock,
  Network,
  PlayCircle,
  Settings,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';

export type TabId =
  | 'dashboard'
  | 'canvas'
  | 'lab'
  | 'risk'
  | 'constraints'
  | 'execution'
  | 'settings';

export const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode; blurb: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} />, blurb: 'Where the plan takes you' },
  { id: 'canvas', label: 'Canvas', icon: <Network size={17} />, blurb: 'Tasks and dependencies' },
  { id: 'lab', label: 'Scenario Lab', icon: <FlaskConical size={17} />, blurb: 'Compare every ordering' },
  { id: 'risk', label: 'Risk', icon: <Dices size={17} />, blurb: 'Thousands of futures' },
  { id: 'constraints', label: 'Constraints', icon: <Lock size={17} />, blurb: 'Lines you will not cross' },
  { id: 'execution', label: 'Execution', icon: <PlayCircle size={17} />, blurb: 'This month, and reality' },
];

interface Props {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  planName: string;
  /** Mobile drawer state. Ignored at md and above, where the rail is always present. */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ activeTab, onSelect, planName, mobileOpen, onMobileClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Selecting a destination on a phone should also dismiss the drawer, otherwise
  // the user lands on a view they cannot see.
  const select = (tab: TabId) => {
    onSelect(tab);
    onMobileClose();
  };

  const content = (isDrawer: boolean) => {
    // The drawer is always full-width; only the desktop rail can collapse.
    const narrow = collapsed && !isDrawer;

    return (
      <>
        <div className={cn('flex items-center justify-between mb-6 md:mb-8', narrow ? 'px-3' : 'px-5 md:px-6')}>
          {!narrow && (
            <div className="min-w-0">
              <h1 className="text-primary font-headline font-bold tracking-tighter text-xl leading-none">
                SOVEREIGN
              </h1>
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-on-surface-variant mt-1.5 truncate">
                {planName}
              </p>
            </div>
          )}

          {isDrawer ? (
            <button
              onClick={onMobileClose}
              aria-label="Close menu"
              className="p-2 -mr-2 text-on-surface-variant hover:text-primary transition-colors"
            >
              <X size={20} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="p-1 text-[9px] font-mono font-bold border border-outline-variant/25 text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors shrink-0"
              title={narrow ? 'Expand' : 'Collapse'}
            >
              {narrow ? '»' : '«'}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto terminal-scroll">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => select(tab.id)}
              title={narrow ? tab.label : tab.blurb}
              className={cn(
                'relative flex items-center w-full transition-colors',
                // Roomier rows on touch so each is a comfortable target.
                narrow ? 'justify-center py-3.5' : 'px-5 md:px-6 py-3.5 md:py-3',
                activeTab === tab.id
                  ? 'text-primary bg-surface-container'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50',
              )}
            >
              {activeTab === tab.id && <span className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary" />}
              <span className={cn(!narrow && 'mr-3.5')}>{tab.icon}</span>
              {!narrow && (
                <span className="min-w-0 text-left">
                  <span className="block font-headline text-[14px] md:text-[13px] tracking-tight leading-tight">
                    {tab.label}
                  </span>
                  <span className="block text-[9px] text-on-surface-variant/50 truncate leading-tight mt-0.5">
                    {tab.blurb}
                  </span>
                </span>
              )}
            </button>
          ))}
        </nav>

        <button
          onClick={() => select('settings')}
          title={narrow ? 'Settings' : undefined}
          className={cn(
            'flex items-center w-full py-3.5 md:py-3 transition-colors border-t border-outline-variant/10 mt-4 shrink-0',
            narrow ? 'justify-center' : 'px-5 md:px-6',
            activeTab === 'settings' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <Settings size={16} className={cn(!narrow && 'mr-3.5')} />
          {!narrow && <span className="font-headline text-[14px] md:text-[13px]">Settings</span>}
        </button>
      </>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden md:flex border-r border-outline-variant/20 bg-surface flex-col py-6 transition-[width] duration-200 shrink-0',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {content(false)}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="md:hidden fixed inset-0 bg-black/70 z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="md:hidden fixed inset-y-0 left-0 w-[17rem] max-w-[85vw] bg-surface border-r border-outline-variant/20 flex flex-col py-5 z-50 shadow-2xl"
            >
              {content(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
