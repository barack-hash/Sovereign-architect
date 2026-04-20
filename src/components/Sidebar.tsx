import React, { useState } from 'react';
import { 
  Target, 
  Lock, 
  TrendingUp, 
  FileText, 
  ArrowUpRight, 
  Settings, 
  HelpCircle, 
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onExport, 
  onImport
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navItems = [
    { label: 'Goals', icon: <Target size={18} /> },
    { label: 'Constraints', icon: <Lock size={18} /> },
    { label: 'Path Simulations', icon: <TrendingUp size={18} /> },
    { label: 'Daily Log', icon: <FileText size={18} /> },
  ];
  const getHoverLabel = (label: string) => {
    if (label === 'Path Simulations') return 'Path Simulations (Terminal/Canvas)';
    return label;
  };

  return (
    <aside 
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
      className={cn(
        "h-full shrink-0 backdrop-blur-xl border-[0.5px] rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.08)] flex flex-col py-4 transition-all duration-300 ease-in-out z-40 overflow-hidden",
        "bg-neutral-900/35 border-white/5 border-r-[0.5px] border-r-white/5",
        isCollapsed ? "w-16 items-center" : "w-48"
      )}
    >
      <div className={cn(
        "px-3 mb-6 flex items-center justify-between w-full",
        isCollapsed && "px-0 justify-center mb-4"
      )}>
        {!isCollapsed && (
          <div>
            <h1 className="text-primary font-bold tracking-tighter text-lg font-headline">SOVEREIGN</h1>
            <p className="font-headline uppercase tracking-[0.22em] text-[9px] text-on-surface-variant mt-0.5">Life Strategy</p>
          </div>
        )}
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-mono font-bold border border-primary/20">
          S
        </div>
      </div>

      <nav className="flex-1 space-y-1 w-full">
        {navItems.map((item) => (
          <div key={item.label} className="relative group/nav">
            <button 
              onClick={() => setActiveTab(item.label)}
              className={cn(
                "flex items-center transition-all duration-200 group relative mx-2 rounded-xl border border-transparent",
                isCollapsed ? "justify-center px-0 py-3 w-[calc(100%-16px)]" : "px-4 py-3 w-[calc(100%-16px)]",
                activeTab === item.label 
                  ? "text-emerald-500 bg-white/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 hover:border-white/10"
              )}
              title={isCollapsed ? getHoverLabel(item.label) : undefined}
            >
              {activeTab === item.label && (
                <div className={cn(
                  "absolute top-0 bottom-0 w-0.5 bg-emerald-500",
                  isCollapsed ? "right-0" : "right-0"
                )} />
              )}
              <span className={cn(!isCollapsed && "mr-4")}>{item.icon}</span>
              {!isCollapsed && <span className="font-headline tracking-wide text-xs uppercase">{item.label}</span>}
            </button>
            {isCollapsed && (
              <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity text-[9px] tracking-[0.16em] uppercase bg-neutral-900/95 border border-white/10 rounded-lg px-2 py-1 text-stone-200 z-50">
                {getHoverLabel(item.label)}
              </span>
            )}
          </div>
        ))}
      </nav>

      <div className={cn(
        "pt-4 mt-auto border-t border-outline-variant/10 space-y-1 w-full",
        isCollapsed ? "px-2" : "px-8"
      )}>
        <div className="flex flex-col gap-2 mb-4 mx-2">
          <button 
            onClick={onExport}
            className={cn(
              "flex items-center text-[9px] font-headline uppercase tracking-[0.2em] hover:bg-white/5 transition-all text-on-surface-variant hover:text-on-surface rounded-xl border border-transparent hover:border-white/10",
              isCollapsed ? "justify-center p-3" : "px-4 py-3 w-full"
            )}
            title={isCollapsed ? "Export Path" : undefined}
          >
            <ArrowUpRight size={14} className={cn(!isCollapsed && "mr-3")} /> 
            {!isCollapsed && "Export Json"}
          </button>
          <label 
            className={cn(
              "flex items-center text-[9px] font-headline uppercase tracking-[0.2em] hover:bg-white/5 transition-all text-on-surface-variant hover:text-on-surface cursor-pointer rounded-xl border border-transparent hover:border-white/10",
              isCollapsed ? "justify-center p-3" : "px-4 py-3 w-full"
            )}
            title={isCollapsed ? "Import Path" : undefined}
          >
            <TrendingUp size={14} className={cn(!isCollapsed && "mr-3")} /> 
            {!isCollapsed && "Import Json"}
            <input type="file" accept=".json" className="hidden" onChange={onImport} />
          </label>
        </div>
        
        <button 
          onClick={() => setActiveTab('Settings')}
          className={cn(
            "flex items-center w-[calc(100%-16px)] mx-2 py-2.5 transition-colors text-sm font-headline rounded-xl",
            isCollapsed ? "justify-center" : "px-4",
            activeTab === 'Settings' ? "text-emerald-500 bg-white/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          )}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings size={16} className={cn(!isCollapsed && "mr-3")} /> 
          {!isCollapsed && "Settings"}
        </button>
        <button 
          onClick={() => setActiveTab('Support')}
          className={cn(
            "flex items-center w-[calc(100%-16px)] mx-2 py-2.5 transition-colors text-sm font-headline rounded-xl",
            isCollapsed ? "justify-center" : "px-4",
            activeTab === 'Support' ? "text-emerald-500 bg-white/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          )}
          title={isCollapsed ? "Support" : undefined}
        >
          <HelpCircle size={16} className={cn(!isCollapsed && "mr-3")} /> 
          {!isCollapsed && "Support"}
        </button>
        
        <div className={cn(
          "mt-5 p-2.5 bg-surface-container rounded-lg flex items-center gap-3 border border-white/5",
          isCollapsed && "p-1 justify-center"
        )}>
          <div className="w-10 h-10 bg-surface-highest rounded-sm flex items-center justify-center text-on-surface-variant shrink-0">
            <User size={20} />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">ANALYST_01</p>
              <p className="text-[10px] text-primary truncate">Active Session</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
