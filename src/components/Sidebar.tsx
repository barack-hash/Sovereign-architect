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
  exportPath: () => void;
  importPath: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  exportPath, 
  importPath 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { label: 'Goals', icon: <Target size={18} /> },
    { label: 'Constraints', icon: <Lock size={18} /> },
    { label: 'Path Simulations', icon: <TrendingUp size={18} /> },
    { label: 'Daily Log', icon: <FileText size={18} /> },
  ];

  return (
    <aside 
      className={cn(
        "absolute top-4 left-4 bottom-4 bg-neutral-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col py-8 transition-all duration-300 ease-in-out z-40 overflow-hidden",
        isCollapsed ? "w-20 items-center" : "w-64"
      )}
    >
      <div className={cn(
        "px-8 mb-12 flex items-center justify-between w-full",
        isCollapsed && "px-0 justify-center"
      )}>
        {!isCollapsed && (
          <div>
            <h1 className="text-primary font-bold tracking-tighter text-2xl font-headline">SOVEREIGN</h1>
            <p className="font-headline uppercase tracking-[0.2em] text-[10px] text-on-surface-variant mt-1">Deterministic Life Strategy</p>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1 text-[10px] font-mono font-bold border border-outline-variant/20 rounded-sm hover:bg-surface-container transition-colors text-on-surface-variant hover:text-primary",
            isCollapsed ? "" : "ml-2"
          )}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? "[ > ]" : "[ < ]"}
        </button>
      </div>

      <nav className="flex-1 space-y-1 w-full">
        {navItems.map((item) => (
          <button 
            key={item.label}
            onClick={() => setActiveTab(item.label)}
            className={cn(
              "flex items-center transition-all duration-200 group relative mx-2 rounded-xl",
              isCollapsed ? "justify-center px-0 py-4 w-[calc(100%-16px)]" : "px-6 py-4 w-[calc(100%-16px)]",
              activeTab === item.label 
                ? "text-primary bg-white/10" 
                : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
            )}
            title={isCollapsed ? item.label : undefined}
          >
            {activeTab === item.label && (
              <div className={cn(
                "absolute top-0 bottom-0 w-0.5 bg-primary",
                isCollapsed ? "right-0" : "right-0"
              )} />
            )}
            <span className={cn(!isCollapsed && "mr-4")}>{item.icon}</span>
            {!isCollapsed && <span className="font-headline tracking-tight text-sm">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className={cn(
        "pt-8 mt-auto border-t border-outline-variant/10 space-y-2 w-full",
        isCollapsed ? "px-2" : "px-8"
      )}>
        <div className="flex flex-col gap-2 mb-4 mx-2">
          <button 
            onClick={exportPath}
            className={cn(
              "flex items-center text-[10px] font-headline uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant hover:text-on-surface rounded-xl",
              isCollapsed ? "justify-center p-3" : "px-4 py-3 w-full"
            )}
            title={isCollapsed ? "Export Path" : undefined}
          >
            <ArrowUpRight size={14} className={cn(!isCollapsed && "mr-3")} /> 
            {!isCollapsed && "Export Path (.JSON)"}
          </button>
          <label 
            className={cn(
              "flex items-center text-[10px] font-headline uppercase tracking-widest hover:bg-white/5 transition-all text-on-surface-variant hover:text-on-surface cursor-pointer rounded-xl",
              isCollapsed ? "justify-center p-3" : "px-4 py-3 w-full"
            )}
            title={isCollapsed ? "Import Path" : undefined}
          >
            <TrendingUp size={14} className={cn(!isCollapsed && "mr-3")} /> 
            {!isCollapsed && "Import Path"}
            <input type="file" accept=".json" onChange={importPath} className="hidden" />
          </label>
        </div>
        
        <button 
          onClick={() => setActiveTab('Settings')}
          className={cn(
            "flex items-center w-[calc(100%-16px)] mx-2 py-3 transition-colors text-sm font-headline rounded-xl",
            isCollapsed ? "justify-center" : "px-4",
            activeTab === 'Settings' ? "text-primary bg-white/10" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          )}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings size={16} className={cn(!isCollapsed && "mr-3")} /> 
          {!isCollapsed && "Settings"}
        </button>
        <button 
          onClick={() => setActiveTab('Support')}
          className={cn(
            "flex items-center w-[calc(100%-16px)] mx-2 py-3 transition-colors text-sm font-headline rounded-xl",
            isCollapsed ? "justify-center" : "px-4",
            activeTab === 'Support' ? "text-primary bg-white/10" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          )}
          title={isCollapsed ? "Support" : undefined}
        >
          <HelpCircle size={16} className={cn(!isCollapsed && "mr-3")} /> 
          {!isCollapsed && "Support"}
        </button>
        
        <div className={cn(
          "mt-8 p-3 bg-surface-container rounded-sm flex items-center gap-3",
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
