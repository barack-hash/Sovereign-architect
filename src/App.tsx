import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  Lock, 
  TrendingUp, 
  FileText, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  User,
  Shield,
  Zap,
  Clock,
  Hourglass,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Terminal,
  Network,
  Users,
  Sparkles,
  Heart,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  ReferenceLine,
  TooltipProps,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { cn } from './lib/utils';
import { buildTenYearNwFromSim } from './lib/nwTrajectoryFromSim';
import CanvasView from './components/CanvasView';
import ConstraintsView from './components/ConstraintsView';
import DailyLogView from './components/DailyLogView';
import { GoalsView } from './components/GoalsView';
import { Sidebar } from './components/Sidebar';
import { CommanderDossierModal } from './components/CommanderDossierModal';
import { SettingsView } from './components/SettingsView';
import { SupportView } from './components/SupportView';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useCanvasHistory, CanvasState } from './hooks/useCanvasHistory';

// --- Types ---

type ExpenseFrequency = 'daily' | 'weekly' | 'monthly';

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  frequency: ExpenseFrequency;
}

type TelemetryCategory = 'Expense' | 'Time Investment' | 'Time Wasted';

interface TelemetryEntry {
  id: string;
  timestamp: number;
  category: TelemetryCategory;
  amount: number;
  description: string;
  month: number;
}

interface CapitalWidgetProps {
  label: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color: 'primary' | 'secondary' | 'neutral' | 'relational' | 'spiritual';
}

interface SimulationCardProps {
  title: string;
  onTitleChange: (val: string) => void;
  variance: string;
  description: string;
  emotionalTax: number;
  burnout: 'LOW' | 'MEDIUM' | 'CRITICAL';
  timeFreedom: 'HIGH' | 'MINIMAL' | 'MODERATE';
  wealthCeiling: 'FIXED' | 'UNCAPPED';
  active?: boolean;
  type: 'conservative' | 'aggressive';
  halalAligned: boolean;
  onHalalToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
  targetReadout?: string;
}

// --- Normalization Helpers ---
const normalizeToMonthly = (value: number, freq: string) => {
  switch (freq) {
    case 'Daily': return value * 30.4;
    case 'Weekly': return value * 4.33;
    case 'Bi-Weekly': return value * 2.16;
    case 'Yearly': return value / 12;
    default: return value; // Monthly
  }
};

const normalizeToDaily = (value: number, freq: string) => {
  switch (freq) {
    case 'Weekly': return value / 7;
    case 'Bi-Weekly': return value / 14;
    case 'Monthly': return value / 30.4;
    case 'Yearly': return value / 365;
    default: return value; // Daily
  }
};

// --- Components ---

const CapitalWidget = ({ label, value, subValue, icon, trend, color }: CapitalWidgetProps) => (
  <div className="bg-surface p-5 border-l-2 border-outline-variant hover:border-primary/50 transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant">{label}</span>
      <div className={cn(
        "p-1.5 rounded-sm",
        color === 'primary' ? "bg-primary/10 text-primary" : 
        color === 'secondary' ? "bg-secondary/10 text-secondary" : 
        color === 'relational' ? "bg-blue-500/10 text-blue-400" :
        color === 'spiritual' ? "bg-purple-500/10 text-purple-400" :
        "bg-surface-highest text-on-surface-variant"
      )}>
        {icon}
      </div>
    </div>
    <div className="space-y-1">
      <h3 className="text-2xl font-headline font-bold tracking-tight">{value}</h3>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">{subValue}</span>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold flex items-center",
            trend.positive ? "text-primary" : "text-secondary"
          )}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
    </div>
  </div>
);

const SimulationCard = ({ 
  title, onTitleChange, variance, description, emotionalTax, burnout, 
  timeFreedom, wealthCeiling, active, type, halalAligned, onHalalToggle, onClick, targetReadout 
}: SimulationCardProps) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-surface p-6 border-l-2 transition-all duration-500 relative overflow-hidden group cursor-pointer",
      type === 'conservative' ? "border-primary/40" : "border-secondary/40",
      active ? "bg-surface-container border-l-4" : "opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
    )}
  >
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
      {type === 'conservative' ? <Shield size={80} /> : <Zap size={80} />}
    </div>
    
    <div className="flex justify-between items-start mb-6">
      <div className="flex flex-col gap-1">
        <input 
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "text-[10px] font-headline uppercase tracking-widest py-1 px-2 border bg-transparent focus:ring-0 focus:border-primary/50 transition-all w-fit",
            type === 'conservative' ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/10 text-secondary border-secondary/20"
          )}
        />
        {active && targetReadout && (
          <span className="text-[9px] font-mono text-primary mt-1 animate-pulse">{targetReadout}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-headline text-on-surface-variant">HALAL ALIGNED</span>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onHalalToggle(e);
          }}
          className={cn(
            "w-8 h-4 rounded-full relative cursor-pointer transition-colors",
            halalAligned ? "bg-primary/20" : "bg-surface-highest"
          )}
        >
          <div className={cn(
            "absolute top-0.5 w-3 h-3 rounded-full transition-all",
            halalAligned ? "right-0.5 bg-primary" : "left-0.5 bg-on-surface-variant"
          )} />
        </div>
      </div>
    </div>

    <div className="mb-8">
      <div className="text-4xl font-headline font-bold text-on-surface">
        {variance} <span className="text-sm font-normal text-on-surface-variant">ANNUAL VARIANCE</span>
      </div>
      <p className="text-xs text-on-surface-variant mt-2 leading-relaxed max-w-md">
        {description}
      </p>
    </div>

    <div className="space-y-6">
      <div>
        <div className="flex justify-between text-[10px] font-headline mb-2 uppercase tracking-wider">
          <span>Emotional Tax</span>
          <span className={type === 'conservative' ? "text-primary" : "text-secondary"}>{emotionalTax.toFixed(1)}/10</span>
        </div>
        <div className="h-1 bg-surface-highest rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, emotionalTax * 10)}%` }}
            className={cn("h-full", type === 'conservative' ? "bg-primary" : "bg-secondary")}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-lowest p-3 border border-outline-variant/10">
          <p className="text-[9px] text-on-surface-variant uppercase font-headline mb-1">Burnout Risk</p>
          <p className={cn("text-xs font-bold", burnout === 'CRITICAL' ? "text-secondary" : "text-on-surface")}>{burnout}</p>
        </div>
        <div className="bg-surface-lowest p-3 border border-outline-variant/10">
          <p className="text-[9px] text-on-surface-variant uppercase font-headline mb-1">Time Freedom</p>
          <p className="text-xs font-bold">{timeFreedom}</p>
        </div>
        <div className="bg-surface-lowest p-3 border border-outline-variant/10">
          <p className="text-[9px] text-on-surface-variant uppercase font-headline mb-1">Wealth Ceiling</p>
          <p className="text-xs font-bold">{wealthCeiling}</p>
        </div>
      </div>
    </div>
  </div>
);

const sanitizeNum = (val: any, fallback = 0) => {
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length && payload[0] && !isNaN(sanitizeNum(payload[0].value))) {
    return (
      <div className="bg-surface-lowest border border-outline-variant/30 p-4 shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant mb-3 border-b border-outline-variant/10 pb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((entry, index) => {
            if (!entry || isNaN(sanitizeNum(entry.value))) return null;
            return (
              <div key={index} className="flex items-center justify-between gap-8">
                <span className="text-[10px] font-headline uppercase tracking-wider text-on-surface-variant">{entry.name}</span>
                <span className={cn("text-xs font-mono font-bold", entry.name === 'Financial' ? "text-primary" : entry.name === 'Emotional' ? "text-secondary" : entry.name === 'Relational' ? "text-blue-400" : "text-purple-400")}>
                  {entry.name === 'Financial' ? `$${(sanitizeNum(entry.value) / 1000).toFixed(1)}k` : `${sanitizeNum(entry.value).toFixed(1)}%`}
                </span>
              </div>
            );
          })}
        </div>
        {payload[0]?.payload?.events?.length > 0 && (
          <div className="mt-4 pt-2 border-t border-outline-variant/10 space-y-2">
            <p className="text-[8px] font-headline uppercase tracking-widest text-primary font-bold">Timeline Events</p>
            {payload[0].payload.events.map((e: any, i: number) => (
              <div key={i} className="flex flex-col">
                <span className={cn("text-[10px] font-bold uppercase", e.status === 'FAILED' ? "text-secondary line-through" : "text-on-surface")}>
                  {e.name} {e.status === 'FAILED' && '(FAILED)'}
                </span>
                <span className="text-[8px] text-on-surface-variant uppercase">Cost: ${sanitizeNum(e.immediateCost)} // Rec: {sanitizeNum(e.timeReclaimed)}h</span>
              </div>
            ))}
          </div>
        )}
        {payload[0]?.payload?.isBurnoutActive && (
          <div className="mt-2 p-1 bg-secondary/10 border border-secondary/20 rounded-xs">
            <p className="text-[8px] font-bold text-secondary uppercase animate-pulse">Burnout Tax Active (-20% Income)</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

/** First simulation month that fails path verification (aligned with protocol watch effect). */
function findFirstSimulationIssue(simulationData: any[]) {
  return simulationData.find((d) => {
    if (d.month < 1) return false;
    if (d.isCrisis === true) return true;
    if (typeof d.Financial === 'number' && d.Financial < 0) return true;
    if (Array.isArray(d.violations) && d.violations.length > 0) return true;
    if (Array.isArray(d.events)) {
      return d.events.some(
        (ev: any) =>
          Number(ev.monthlyIncome || 0) - Number(ev.ongoingCost || 0) < 0
      );
    }
    return false;
  });
}

// --- Main App ---

export default function App() {
  // 1. State Initialization
  const [viewMode, setViewMode] = useLocalStorage<'terminal' | 'canvas'>('sovereign-view-mode', 'terminal');
  const [activeTab, setActiveTab] = useState<string>('Path Simulations');
  const [chaosReport, setChaosReport] = useState<string | null>(null);
  const [pathReport, setPathReport] = useState<{ target: string, reason: string } | null>(null);
  const [protocolChaosReport, setProtocolChaosReport] = useState<string | null>(null);
  const [protocolPathReport, setProtocolPathReport] = useState<{ target: string; reason: string } | null>(null);
  const [protocolFinalScore, setProtocolFinalScore] = useState<{
    success: boolean;
    headline: string;
    detail: string;
    failureMonth?: number;
  } | null>(null);
  const [canvasSyncing, setCanvasSyncing] = useState(false);
  const canvasSyncTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Security State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showDedication, setShowDedication] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState('');
  const MASTER_PASSCODE = "ARCHITECT-01";
  const GUEST_PASSCODE = "GUEST-24H";

  useEffect(() => {
    const unlockState = localStorage.getItem('sovereign_unlocked');
    if (unlockState === 'master') {
      setIsUnlocked(true);
    } else if (unlockState === 'guest') {
      const expiry = localStorage.getItem('sovereign_guest_expires');
      if (expiry && Date.now() < parseInt(expiry)) {
        setIsUnlocked(true);
      } else {
        // Time expired, clear the guest session
        localStorage.removeItem('sovereign_unlocked');
        localStorage.removeItem('sovereign_guest_expires');
        setIsUnlocked(false);
      }
    }
  }, []);

  const handleUnlock = () => {
    if (passcodeInput === MASTER_PASSCODE) {
      localStorage.setItem('sovereign_unlocked', 'master');
      setIsUnlocked(true);
    } else if (passcodeInput === GUEST_PASSCODE) {
      localStorage.setItem('sovereign_unlocked', 'guest');
      // Set expiration for 24 hours from now
      localStorage.setItem('sovereign_guest_expires', (Date.now() + 24 * 60 * 60 * 1000).toString());
      setIsUnlocked(true);
    }
    setPasscodeInput('');
  };

  const handleLock = () => {
    localStorage.removeItem('sovereign_unlocked');
    localStorage.removeItem('sovereign_guest_expires');
    setIsUnlocked(false);
    setPasscodeInput('');
    setShowDedication(true); // <-- This resets the gateway for the next login
  };

  const [systemConstraints, setSystemConstraints] = useLocalStorage('sovereign-system-constraints', { 
    minCash: 0, 
    maxBurn: 0, 
    minMonthlyBuffer: 0,
    minSleep: 0, 
    maxLabor: 10,
    prayerStrict: false,
    minStudy: 0,
    minFamily: 0,
    coreContacts: 0
  });
  const [activePath, setActivePath] = useLocalStorage<'conservative' | 'aggressive'>('sovereign-active-path', 'conservative');

  const [isGhostMode, setIsGhostMode] = useState(false);
  const [resetMemoryModalOpen, setResetMemoryModalOpen] = useState(false);
  const [commanderDossierOpen, setCommanderDossierOpen] = useState(false);

  const [conservativePathName, setConservativePathName] = useLocalStorage('sovereign-conservative-name', 'Conservative');
  const [aggressivePathName, setAggressivePathName] = useLocalStorage('sovereign-aggressive-name', 'Aggressive');
  
  // Genesis State
  const [currentCash, setCurrentCash] = useLocalStorage('sovereign-cash', 150000);
  const [currentDebt, setCurrentDebt] = useLocalStorage('sovereign-debt', 7500);
  const [baseMonthlyIncome, setBaseMonthlyIncome] = useLocalStorage('sovereign-income', 8500);

  const [goalName, setGoalName] = useLocalStorage('sovereign-goal-name', 'Move Out');
  const [targetCapital, setTargetCapital] = useLocalStorage('sovereign-target-capital', 250000);
  const [targetTimeline, setTargetTimeline] = useLocalStorage('sovereign-target-timeline', 12);
  const [healthRedline, setHealthRedline] = useLocalStorage('sovereign-health-redline', 20);
  const [relationalTripwire, setRelationalTripwire] = useLocalStorage('sovereign-relational-tripwire', 30);
  const [spiritualTripwire, setSpiritualTripwire] = useLocalStorage('sovereign-spiritual-tripwire', 30);

  const [burnRateLedger, setBurnRateLedger] = useLocalStorage<ExpenseItem[]>('sovereign-burn-ledger', [
    { id: '1', name: 'Rent/Mortgage', amount: 2200, frequency: 'monthly' },
    { id: '2', name: 'Groceries', amount: 150, frequency: 'weekly' },
    { id: '3', name: 'Utilities', amount: 200, frequency: 'monthly' },
    { id: '4', name: 'Transport', amount: 10, frequency: 'daily' },
  ]);

  const [investmentYield, setInvestmentYield] = useLocalStorage('sovereign-yield', 7.2);
  
  // Category 1: Non-Negotiables
  const [salahActive, setSalahActive] = useLocalStorage('sovereign-salah', true);
  const [familyTime, setFamilyTime] = useLocalStorage('sovereign-family-time', 2);
  
  // Category 2: Maintenance Costs
  const [sleepTime, setSleepTime] = useLocalStorage('sovereign-sleep-time', 7);
  const [commutingTime, setCommutingTime] = useLocalStorage('sovereign-commuting-time', 1);
  const [hygieneMealsTime, setHygieneMealsTime] = useLocalStorage('sovereign-hygiene-time', 2);
  
  // Category 3: Investment Variables
  const [skillStudyTime, setSkillStudyTime] = useLocalStorage('sovereign-skill-time', 2);
  const [readingLearningTime, setReadingLearningTime] = useLocalStorage('sovereign-reading-time', 1);
  const [fitnessGymTime, setFitnessGymTime] = useLocalStorage('sovereign-fitness-time', 1);
  
  // Category 4: System Entropy
  const [socialMediaTime, setSocialMediaTime] = useLocalStorage('sovereign-social-time', 1);
  const [entertainmentTime, setEntertainmentTime] = useLocalStorage('sovereign-ent-time', 1);

  const [expandedSections, setExpandedSections] = React.useState<string[]>(['cat1', 'cat2', 'cat3', 'cat4']);
  
  const [stressTests, setStressTests] = useLocalStorage('sovereign-stress-tests', {
    marketVolatility: false,
    incomeDisruption: false,
    inflationSpike: false,
    burnoutEvent: false,
  });

  const [yieldMultiplier, setYieldMultiplier] = useState(1.0);

  // Timeline Events
  const [timelineEvents, setTimelineEvents] = useLocalStorage<{
    id: string;
    type: 'genesis' | 'event' | 'objective' | 'note';
    name: string;
    month: number;
    immediateCost: number;
    immediateIncome: number;
    ongoingCost: number;
    monthlyIncome: number;
    monthlyYieldImpact?: number;
    timeReclaimed: number;
    weeklyHours?: number;
    relationalImpact: number;
    spiritualImpact: number;
    dependencies: (string | { id: string, sourceHandle?: string, targetHandle?: string })[]; // Added for CPM
    visualY?: number; // Added for Smart Grid
    status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
    // Genesis specific
    initialCash?: number;
    initialDebt?: number;
    baseMonthlyIncome?: number;
    isActiveGenesis?: boolean;
    baselineLedger?: { id: string, label: string, type: 'Income' | 'Expense' | 'Time Use' | 'Impact', value: number, frequency?: string, relationalImpact: number, spiritualImpact: number }[];
    initialSystemHealth?: number;
    initialRelationalHarmony?: number;
    initialSpiritualAlignment?: number;
    // Objective specific
    targetCapital?: number;
    targetTimeline?: number;
    // Note specific
    content?: string;
    /** Tactical cartography: life zone for sector overlays on canvas */
    lifeSector?: 'professional' | 'personal' | 'financial';
  }[]>('sovereign-events', [
    {
      id: 'genesis-1',
      type: 'genesis',
      name: 'Genesis Alpha',
      month: 0,
      initialCash: 150000,
      initialDebt: 7500,
      baseMonthlyIncome: 8500,
      isActiveGenesis: true,
      immediateCost: 0,
      immediateIncome: 0,
      ongoingCost: 0,
      monthlyIncome: 0,
      timeReclaimed: 0,
      weeklyHours: 0,
      relationalImpact: 0,
      spiritualImpact: 0,
      dependencies: [],
      status: 'COMPLETED',
      baselineLedger: [
        { id: '1', label: 'Primary Income', type: 'Income', value: 8500, relationalImpact: 0, spiritualImpact: 0 },
        { id: '2', label: 'Base Living Expenses', type: 'Expense', value: 3500, relationalImpact: 0, spiritualImpact: 0 },
        { id: '3', label: 'Sleep', type: 'Time Use', value: 7, relationalImpact: 0, spiritualImpact: 0 },
        { id: '4', label: 'Work Hours', type: 'Time Use', value: 8, relationalImpact: 0, spiritualImpact: 0 },
      ],
      initialSystemHealth: 80,
      initialRelationalHarmony: 70,
      initialSpiritualAlignment: 60
    }
  ]);
  const [dailyTimeBudget, setDailyTimeBudget] = useLocalStorage<number>('sovereign-daily-time-budget', 24);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [isAddingEvent, setIsAddingEvent] = React.useState(false);
  const [newEvent, setNewEvent] = React.useState({
    name: '',
    month: 1,
    immediateCost: 0,
    immediateIncome: 0,
    ongoingCost: 0,
    monthlyIncome: 0,
    timeReclaimed: 0,
    relationalImpact: 0,
    spiritualImpact: 0
  });
  
  const [conservativeHalal, setConservativeHalal] = useLocalStorage('sovereign-cons-halal', true);
  const [aggressiveHalal, setAggressiveHalal] = useLocalStorage('sovereign-agg-halal', false);
  const [objectiveDependencies, setObjectiveDependencies] = useLocalStorage<string[]>('sovereign-obj-deps', []);

  const [dailyTelemetry, setDailyTelemetry] = useLocalStorage<TelemetryEntry[]>('sovereign-daily-telemetry', []);
  const [currentSimulationMonth, setCurrentSimulationMonth] = useLocalStorage('sovereign-current-month', 1);

  // History Engine
  const { undo, redo, recordHistory, canUndo, canRedo } = useCanvasHistory();

  const getCurrentCanvasState = useCallback((): CanvasState => ({
    timelineEvents,
    objectiveDependencies,
    currentCash,
    currentDebt,
    baseMonthlyIncome,
    goalName,
    targetCapital,
    targetTimeline,
    burnRateLedger
  }), [timelineEvents, objectiveDependencies, currentCash, currentDebt, baseMonthlyIncome, goalName, targetCapital, targetTimeline, burnRateLedger]);

  const applyCanvasState = (state: CanvasState) => {
    setTimelineEvents(state.timelineEvents);
    setObjectiveDependencies(state.objectiveDependencies);
    setCurrentCash(state.currentCash);
    setCurrentDebt(state.currentDebt);
    setBaseMonthlyIncome(state.baseMonthlyIncome);
    setGoalName(state.goalName);
    setTargetCapital(state.targetCapital);
    setTargetTimeline(state.targetTimeline);
    setBurnRateLedger(state.burnRateLedger);
  };

  const handleUndo = () => {
    const prevState = undo(getCurrentCanvasState());
    if (prevState) {
      applyCanvasState(prevState);
      addTerminalLog("UNDO: REVERTING TO PREVIOUS STATE.");
    }
  };

  const handleRedo = () => {
    const nextState = redo(getCurrentCanvasState());
    if (nextState) {
      applyCanvasState(nextState);
      addTerminalLog("REDO: RESTORING FUTURE STATE.");
    }
  };

  const bumpCanvasSync = useCallback(() => {
    setCanvasSyncing(true);
    if (canvasSyncTimerRef.current) clearTimeout(canvasSyncTimerRef.current);
    canvasSyncTimerRef.current = setTimeout(() => {
      setCanvasSyncing(false);
      canvasSyncTimerRef.current = undefined;
    }, 650);
  }, []);

  const handleResetStrategy = () => {
    recordHistory(getCurrentCanvasState());
    setTimelineEvents([
      {
        id: 'genesis-1',
        type: 'genesis',
        name: 'Genesis Alpha',
        month: 0,
        initialCash: 150000,
        initialDebt: 7500,
        baseMonthlyIncome: 8500,
        isActiveGenesis: true,
        immediateCost: 0,
        immediateIncome: 0,
        ongoingCost: 0,
        monthlyIncome: 0,
        timeReclaimed: 0,
        relationalImpact: 0,
        spiritualImpact: 0,
        dependencies: [],
        status: 'COMPLETED',
        baselineLedger: [
          { id: '1', label: 'Base Salary', type: 'Income', value: 8500, frequency: 'Monthly', relationalImpact: 0, spiritualImpact: 0 },
          { id: '2', label: 'Living Expenses', type: 'Expense', value: 4500, frequency: 'Monthly', relationalImpact: 0, spiritualImpact: 0 }
        ]
      }
    ]);
    setObjectiveDependencies([]);
    setSelectedNodeId('genesis-1');
    addTerminalLog("STRATEGY RESET: NEW GENESIS INITIALIZED.");
  };

  const handleConfirmWipeSystemMemory = useCallback(() => {
    setResetMemoryModalOpen(false);
    recordHistory(getCurrentCanvasState());
    setTimelineEvents([
      {
        id: 'genesis-1',
        type: 'genesis',
        name: 'Genesis Alpha',
        month: 0,
        initialCash: 150000,
        initialDebt: 7500,
        baseMonthlyIncome: 8500,
        isActiveGenesis: true,
        immediateCost: 0,
        immediateIncome: 0,
        ongoingCost: 0,
        monthlyIncome: 0,
        timeReclaimed: 0,
        weeklyHours: 0,
        relationalImpact: 0,
        spiritualImpact: 0,
        dependencies: [],
        status: 'COMPLETED',
        baselineLedger: [
          { id: '1', label: 'Primary Income', type: 'Income', value: 8500, relationalImpact: 0, spiritualImpact: 0 },
          { id: '2', label: 'Base Living Expenses', type: 'Expense', value: 3500, relationalImpact: 0, spiritualImpact: 0 },
          { id: '3', label: 'Sleep', type: 'Time Use', value: 7, relationalImpact: 0, spiritualImpact: 0 },
          { id: '4', label: 'Work Hours', type: 'Time Use', value: 8, relationalImpact: 0, spiritualImpact: 0 },
        ],
        initialSystemHealth: 80,
        initialRelationalHarmony: 70,
        initialSpiritualAlignment: 60,
      },
    ]);
    setSystemConstraints({
      minCash: 0,
      maxBurn: 0,
      minMonthlyBuffer: 0,
      minSleep: 0,
      maxLabor: 10,
      prayerStrict: false,
      minStudy: 0,
      minFamily: 0,
      coreContacts: 0,
    });
    setObjectiveDependencies([]);
    setSelectedNodeId('genesis-1');
    bumpCanvasSync();
    addTerminalLog('SYSTEM MEMORY WIPED: GENESIS ONLY; CONSTRAINTS RESET.');
  }, [recordHistory, getCurrentCanvasState, bumpCanvasSync]);

  const handleTidyGrid = () => {
    recordHistory(getCurrentCanvasState());
    setTimelineEvents(prev => prev.map(e => {
      const { visualY, ...rest } = e;
      return rest;
    }));
    addTerminalLog("GRID ALIGNED: NODES SNAPPED TO TIMELINE COLUMNS.");
  };

  const [isCalculating, setIsCalculating] = React.useState(false);
  const [calculationKey, setCalculationKey] = React.useState(0);

  const [appState, setAppState] = useLocalStorage<'PLANNING' | 'ACTIVE_PROTOCOL'>('sovereign-app-state', 'PLANNING');
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationResults, setSimulationResults] = React.useState<{ pessimistic: any[], optimistic: any[] } | null>(null);
  const [terminalLogs, setTerminalLogs] = React.useState<string[]>([]);

  const addTerminalLog = (msg: string) => {
    setTerminalLogs(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runSimulation = () => {
    setIsSimulating(true);
    addTerminalLog("INITIALIZING MONTE CARLO STRESS TEST...");
    
    const messages = [
      "ANALYZING VOLATILITY VECTORS...",
      "CALCULATING PROBABILISTIC OVERHEAD...",
      "MAPPING ENTROPY GRADIENTS...",
      "STRESS TESTING LIQUIDITY THRESHOLDS...",
      "SIMULATION COMPLETE: DISPLAYING CONFIDENCE INTERVALS."
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        addTerminalLog(messages[i]);
        i++;
      } else {
        clearInterval(interval);
        
        // Calculate alternate realities
        const pessimistic = calculateSimulationData({
          costMod: 1.2,
          burnMod: 1.2,
          yieldMod: 0.9
        });
        
        const optimistic = calculateSimulationData({
          costMod: 0.9,
          burnMod: 1.0,
          yieldMod: 1.05
        });

        setSimulationResults({ pessimistic, optimistic });
        setIsSimulating(false);
      }
    }, 300);
  };

  const handleLogCompleted = (eventId: string) => {
    const event = timelineEvents.find(e => e.id === eventId);
    if (!event) return;

    recordHistory(getCurrentCanvasState());

    // 1. Deduct Immediate Cost & Add Immediate Income
    setCurrentCash(prev => prev - event.immediateCost + (event.immediateIncome || 0));

    // 2. Add Ongoing Cost to Burn Rate Ledger & Add Monthly Income
    if (event.ongoingCost > 0) {
      const newExpense: ExpenseItem = {
        id: `ongoing-${event.id}`,
        name: `Ongoing: ${event.name}`,
        amount: event.ongoingCost,
        frequency: 'monthly'
      };
      setBurnRateLedger(prev => [...prev, newExpense]);
    }

    if (event.monthlyIncome && event.monthlyIncome > 0) {
      setBaseMonthlyIncome(prev => prev + event.monthlyIncome);
    }

    // 3. Update Status
    setTimelineEvents(prev => {
      const updated = prev.map(e => e.id === eventId ? { ...e, status: 'COMPLETED' as const } : e);
      
      // 4. Find next node on Critical Path
      // For simplicity, find nodes that depended on this one
      const dependents = updated.filter(e => e.dependencies.some(d => (typeof d === 'string' ? d === eventId : d.id === eventId)));
      if (dependents.length > 0) {
        // Sort by month and take the first one
        const nextNode = dependents.sort((a, b) => a.month - b.month)[0];
        return updated.map(e => e.id === nextNode.id ? { ...e, status: 'ACTIVE' as const } : e);
      }
      
      return updated;
    });

    addTerminalLog(`OBJECTIVE COMPLETED: ${event.name.toUpperCase()}. RESOURCES REALLOCATED.`);
  };

  const [showAutoSave, setShowAutoSave] = React.useState(false);
  
  React.useEffect(() => {
    const handleUpdate = () => {
      setShowAutoSave(true);
      const timer = setTimeout(() => setShowAutoSave(false), 2000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('local-storage-update', handleUpdate);
    return () => window.removeEventListener('local-storage-update', handleUpdate);
  }, []);

  const handleExport = () => {
    const payload = {
      nodes: timelineEvents,
      edges: objectiveDependencies,
      systemConstraints,
      timelineEvents,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sovereign-architecture.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);

        if (parsed.nodes || parsed.timelineEvents) {
          setTimelineEvents(parsed.nodes || parsed.timelineEvents || []);
        }
        if (parsed.edges || parsed.objectiveDependencies) {
          setObjectiveDependencies(parsed.edges || parsed.objectiveDependencies || []);
        }
        if (parsed.systemConstraints || parsed.uiConstraints) {
          setSystemConstraints(parsed.systemConstraints || parsed.uiConstraints || systemConstraints);
        }
      } catch (err) {
        console.error("Failed to import path:", err);
      }
    };
    reader.readAsText(file);
  };

  // Snapshots State
  const [snapshots, setSnapshots] = React.useState<{
    id: string;
    name: string;
    timestamp: string;
    data: any;
  }[]>([]);

  const saveSnapshot = (name: string) => {
    const newSnapshot = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || `Scenario ${snapshots.length + 1}`,
      timestamp: new Date().toLocaleTimeString(),
      data: {
        currentCash,
        currentDebt,
        baseMonthlyIncome,
        investmentYield,
        burnRateLedger,
        timelineEvents,
        activePath,
        conservativeHalal,
        aggressiveHalal,
        skillStudyTime,
        readingLearningTime,
        fitnessGymTime,
        socialMediaTime,
        entertainmentTime,
        sleepTime,
        familyTime
      }
    };
    setSnapshots([newSnapshot, ...snapshots]);
  };

  const loadSnapshot = (snapshot: any) => {
    const d = snapshot.data;
    setCurrentCash(d.currentCash);
    setCurrentDebt(d.currentDebt);
    setBaseMonthlyIncome(d.baseMonthlyIncome);
    setInvestmentYield(d.investmentYield);
    if (d.burnRateLedger) setBurnRateLedger(d.burnRateLedger);
    setTimelineEvents(d.timelineEvents);
    if (d.objectiveDependencies) setObjectiveDependencies(d.objectiveDependencies);
    setActivePath(d.activePath);
    setConservativeHalal(d.conservativeHalal);
    setAggressiveHalal(d.aggressiveHalal);
    setSkillStudyTime(d.skillStudyTime);
    setReadingLearningTime(d.readingLearningTime);
    setFitnessGymTime(d.fitnessGymTime);
    setSocialMediaTime(d.socialMediaTime);
    setEntertainmentTime(d.entertainmentTime);
    setSleepTime(d.sleepTime);
    setFamilyTime(d.familyTime);
    handleRecalculate();
  };

  const handleUpdateInitialCash = (val: number) => {
    recordHistory(getCurrentCanvasState());
    setCurrentCash(val);
  };

  const handleUpdateInitialDebt = (val: number) => {
    recordHistory(getCurrentCanvasState());
    setCurrentDebt(val);
  };

  const handleUpdateBaseMonthlyIncome = (val: number) => {
    recordHistory(getCurrentCanvasState());
    setBaseMonthlyIncome(val);
  };

  const handleUpdateTargetCapital = (val: number) => {
    recordHistory(getCurrentCanvasState());
    setTargetCapital(val);
  };

  const handleUpdateTargetTimeline = (val: number) => {
    recordHistory(getCurrentCanvasState());
    setTargetTimeline(val);
  };

  const handleUpdateGoalName = (val: string) => {
    recordHistory(getCurrentCanvasState());
    setGoalName(val);
  };

  const handleUpdateEvent = useCallback((id: string, updates: any) => {
    recordHistory(getCurrentCanvasState());
    setTimelineEvents(prev => {
      let newEvents = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      
      // CPM Logic: If month changed, ensure dependents are pushed forward
      if (updates.month !== undefined) {
        let changed = true;
        while (changed) {
          changed = false;
          // Re-implementing more robustly and immutably:
          for (let i = 0; i < newEvents.length; i++) {
            const e = newEvents[i];
            for (const dep of e.dependencies) {
              const depId = typeof dep === 'string' ? dep : dep.id;
              const depNode = newEvents.find(ev => ev.id === depId);
              if (depNode && e.month < depNode.month) {
                newEvents[i] = { ...e, month: depNode.month };
                changed = true;
              }
            }
          }
        }
      }
      return [...newEvents];
    });
    bumpCanvasSync();
  }, [recordHistory, getCurrentCanvasState, bumpCanvasSync]);

  const handleConnectEvents = useCallback((sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => {
    if (sourceId === targetId) return;

    recordHistory(getCurrentCanvasState());

    setTimelineEvents(prev => {
      const targetEvent = prev.find(e => e.id === targetId);
      if (!targetEvent) return prev;
      
      // Check if already exists
      const alreadyExists = targetEvent.dependencies.some(d => 
        (typeof d === 'string' ? d === sourceId : d.id === sourceId)
      );
      if (alreadyExists) return prev;

      const newDep = { id: sourceId, sourceHandle, targetHandle };

      const newEvents = prev.map(e => 
        e.id === targetId 
          ? { ...e, dependencies: [...e.dependencies, newDep] } 
          : e
      );

      // Ensure target month is >= source month
      const sourceEvent = prev.find(e => e.id === sourceId);
      if (sourceEvent && targetEvent.month < sourceEvent.month) {
        return newEvents.map(e => e.id === targetId ? { ...e, month: sourceEvent.month } : e);
      }

      return newEvents;
    });
  }, [recordHistory, getCurrentCanvasState, objectiveDependencies]);

  const handleAddBlankEvent = useCallback((type: 'expense' | 'income' | 'genesis' | 'objective' | 'note' | 'event', pos?: { x: number, y: number }) => {
    recordHistory(getCurrentCanvasState());
    const id = Math.random().toString(36).substr(2, 9);
    const month = pos ? Math.max(0, Math.min(targetTimeline, Math.round((pos.x - 50) / 300))) : 1;
    
    const newEventObj: any = {
      id,
      type: type === 'expense' || type === 'income' ? 'event' : type,
      name: type === 'genesis' ? 'New Genesis' : type === 'objective' ? 'New Objective' : type === 'note' ? 'New Note' : 'New Event',
      month: type === 'genesis' ? 0 : (Number(month) || 1),
      immediateCost: type === 'expense' ? 5000 : 0,
      immediateIncome: type === 'income' ? 2000 : 0,
      ongoingCost: 0,
      monthlyIncome: 0,
      timeReclaimed: 0,
      weeklyHours: 0,
      relationalImpact: 0,
      spiritualImpact: 0,
      dependencies: [],
      status: type === 'genesis' ? 'COMPLETED' : 'PENDING',
      scenario: isGhostMode ? 'ghost' : 'primary'
    };

    if (type === 'genesis') {
      newEventObj.initialCash = 10000;
      newEventObj.initialDebt = 0;
      newEventObj.baseMonthlyIncome = 3000;
      newEventObj.isActiveGenesis = false;
    } else if (type === 'objective') {
      newEventObj.targetCapital = 100000;
      newEventObj.targetTimeline = 12;
    } else if (type === 'note') {
      newEventObj.content = 'Enter note here...';
    }

    setTimelineEvents(prev => [...prev, newEventObj]);
    addTerminalLog(`NODE INJECTED: ${type.toUpperCase()} INITIALIZED.`);
    setSelectedNodeId(id);
  }, [recordHistory, getCurrentCanvasState, targetTimeline, isGhostMode]);

  const handleDeleteEvent = useCallback((id: string) => {
    recordHistory(getCurrentCanvasState());
    setTimelineEvents(prev => prev
      .filter(e => e.id !== id)
      .map(e => ({
        ...e,
        dependencies: e.dependencies.filter(d => (typeof d === 'string' ? d !== id : d.id !== id))
      }))
    );
    setObjectiveDependencies(prev => prev.filter(d => d !== id));
    addTerminalLog(`NODE DELETED: ${id} REMOVED FROM SYSTEM.`);
  }, [recordHistory, getCurrentCanvasState, addTerminalLog]);

  const applyStarterTemplate = useCallback(
    (templateId: 'aviation' | 'travel') => {
      recordHistory(getCurrentCanvasState());
      const genesisId = timelineEvents.find((e) => e.type === 'genesis')?.id ?? 'genesis-1';
      const scenario = isGhostMode ? ('ghost' as const) : ('primary' as const);
      const mkId = () => Math.random().toString(36).slice(2, 11);
      const base = () => ({
        immediateIncome: 0,
        ongoingCost: 0,
        monthlyIncome: 0,
        timeReclaimed: 0,
        weeklyHours: 0,
        relationalImpact: 0,
        spiritualImpact: 0,
        dependencies: [genesisId] as (string | { id: string; sourceHandle?: string; targetHandle?: string })[],
        status: 'PENDING' as const,
        scenario,
      });

      const aviationNodes = [
        {
          ...base(),
          id: mkId(),
          type: 'event' as const,
          name: 'UDC Tuition (Fall 2026 est.)',
          month: 9,
          immediateCost: 14200,
          ongoingCost: 1750,
          weeklyHours: 18,
        },
        {
          ...base(),
          id: mkId(),
          type: 'event' as const,
          name: 'Study Hours',
          month: 2,
          immediateCost: 450,
          ongoingCost: 90,
          weeklyHours: 15,
        },
        {
          ...base(),
          id: mkId(),
          type: 'event' as const,
          name: 'Junior Tech Salary (VA/DC entry)',
          month: 5,
          immediateCost: 0,
          ongoingCost: 0,
          monthlyIncome: 4750,
          weeklyHours: 40,
        },
      ];

      const travelNodes = [
        {
          ...base(),
          id: mkId(),
          type: 'event' as const,
          name: 'Business Licensing',
          month: 1,
          immediateCost: 3200,
          ongoingCost: 0,
          weeklyHours: 8,
        },
        {
          ...base(),
          id: mkId(),
          type: 'event' as const,
          name: 'Dar Al Safar Branding',
          month: 2,
          immediateCost: 6500,
          ongoingCost: 150,
          weeklyHours: 15,
        },
        {
          ...base(),
          id: mkId(),
          type: 'event' as const,
          name: 'GDS Subscription',
          month: 2,
          immediateCost: 500,
          ongoingCost: 450,
          weeklyHours: 6,
        },
      ];

      const nodes = templateId === 'aviation' ? aviationNodes : travelNodes;
      setTimelineEvents((prev) => [...prev, ...nodes]);
      addTerminalLog(
        templateId === 'aviation'
          ? 'TEMPLATE INJECTED: AVIATION MAINTENANCE PATH'
          : 'TEMPLATE INJECTED: TRAVEL AGENCY LAUNCH'
      );
    },
    [recordHistory, getCurrentCanvasState, timelineEvents, isGhostMode]
  );

  // Keyboard Shortcuts (Canvas view)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'canvas') return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
        handleRedo();
        e.preventDefault();
      } else if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport();
      } else if (e.code === 'Space') {
        e.preventDefault();
        window.dispatchEvent(new Event('sovereign-canvas-fitview'));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          const node = timelineEvents.find((x) => x.id === selectedNodeId);
          if (node && node.type !== 'genesis') {
            e.preventDefault();
            handleDeleteEvent(selectedNodeId);
            setSelectedNodeId(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMode,
    timelineEvents,
    selectedNodeId,
    handleDeleteEvent,
    handleUndo,
    handleRedo,
    handleExport,
  ]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    if (appState !== 'PLANNING') return;
    
    recordHistory(getCurrentCanvasState());

    if (edgeId.startsWith('edge-manual-')) {
      // edge-manual-node-sourceId-node-targetId
      const parts = edgeId.replace('edge-manual-', '').split('-node-');
      if (parts.length === 2) {
        const sourceId = parts[0].replace('node-', '');
        const targetId = parts[1];
        
        setTimelineEvents(prev => prev.map(e => 
          e.id === targetId 
            ? { ...e, dependencies: e.dependencies.filter(d => (typeof d === 'string' ? d !== sourceId : d.id !== sourceId)) } 
            : e
        ));
        addTerminalLog(`CONNECTION SEVERED: ${sourceId} ➔ ${targetId}`);
      }
    } else if (edgeId.startsWith('edge-objective-')) {
      const sourceId = edgeId.replace('edge-objective-event-', '');
      setObjectiveDependencies(prev => prev.filter(d => d !== sourceId));
      addTerminalLog(`OBJECTIVE CONNECTION SEVERED: ${sourceId}`);
    }
  }, [recordHistory, getCurrentCanvasState, appState, addTerminalLog]);

  const handleNodeDragStop = () => {
    recordHistory(getCurrentCanvasState());
    bumpCanvasSync();
  };

  const handleAddExpense = useCallback(() => {
    recordHistory(getCurrentCanvasState());
    const newExpense: ExpenseItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Expense',
      amount: 0,
      frequency: 'monthly'
    };
    setBurnRateLedger([...burnRateLedger, newExpense]);
  }, [recordHistory, getCurrentCanvasState, burnRateLedger]);

  const handleUpdateExpense = useCallback((id: string, updates: Partial<ExpenseItem>) => {
    recordHistory(getCurrentCanvasState());
    setBurnRateLedger(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, [recordHistory, getCurrentCanvasState]);

  const handleDeleteExpense = useCallback((id: string) => {
    recordHistory(getCurrentCanvasState());
    setBurnRateLedger(prev => prev.filter(item => item.id !== id));
  }, [recordHistory, getCurrentCanvasState]);

  // 2. The Sequential Math Engine
  const calculateSimulationData = (
    mods = { costMod: 1, burnMod: 1, yieldMod: 1 },
    scenarioType: 'primary' | 'ghost' = 'primary',
    constraintOverride?: typeof systemConstraints
  ) => {
    const sc = constraintOverride ?? systemConstraints;
    const scenarioEvents = timelineEvents.filter(e => scenarioType === 'ghost' ? true : e.scenario !== 'ghost');
    const activeGenesis = scenarioEvents.find(e => e.type === 'genesis' && e.isActiveGenesis) || scenarioEvents.find(e => e.type === 'genesis');
    
    if (!activeGenesis) return [];

    const data: any[] = [];
    let currentNW = (activeGenesis.initialCash || 0) - (activeGenesis.initialDebt || 0);
    let currentHealth = activeGenesis.initialSystemHealth ?? initialSystemHealth;
    let currentRelational = activeGenesis.initialRelationalHarmony ?? 100;
    let currentSpiritual = activeGenesis.initialSpiritualAlignment ?? 100;
    let burnoutTaxMonths = 0;
    let liquidityCrisisMonth = -1;
    let obligationDebtMonths = 0;

    // Baseline Ledger Calculations
    const ledger = activeGenesis.baselineLedger || [];
    const ledgerIncome = ledger.filter((i: any) => i.type === 'Income').reduce((sum: number, i: any) => sum + normalizeToMonthly(parseFloat(i.value) || 0, i.frequency || 'Monthly'), 0);
    const ledgerExpense = ledger.filter((i: any) => i.type === 'Expense').reduce((sum: number, i: any) => sum + normalizeToMonthly(parseFloat(i.value) || 0, i.frequency || 'Monthly'), 0);
    const ledgerTime = ledger.filter((i: any) => i.type === 'Time Use').reduce((sum: number, i: any) => sum + normalizeToDaily(parseFloat(i.value) || 0, i.frequency || 'Monthly'), 0);
    const ledgerRelational = ledger.reduce((sum: number, i: any) => sum + (parseFloat(i.relationalImpact) || 0), 0);
    const ledgerSpiritual = ledger.reduce((sum: number, i: any) => sum + (parseFloat(i.spiritualImpact) || 0), 0);

    const effectiveBaseIncome = ledger.length > 0 ? ledgerIncome : (activeGenesis.baseMonthlyIncome || 0);
    const effectiveBaseExpense = ledger.length > 0 ? ledgerExpense : totalMonthlyBurnRate;

    // Actual Reality tracking
    let actualNW = (activeGenesis.initialCash || 0) - (activeGenesis.initialDebt || 0);
    let actualHealth = activeGenesis.initialSystemHealth ?? initialSystemHealth;
    let actualRelational = activeGenesis.initialRelationalHarmony ?? 100;
    let actualSpiritual = activeGenesis.initialSpiritualAlignment ?? 100;
    let actualBurnoutTaxMonths = 0;
    let actualObligationDebtMonths = 0;

    // Dependency Gating Tracking
    const satisfiedObjectives: Record<string, number> = {}; // nodeId -> month
    const nodeStatuses: Record<string, 'LOCKED' | 'IN-PROGRESS' | 'COMPLETED'> = {};
    const nodeEffectiveMonths: Record<string, number> = {};
    const objectiveProgress: Record<string, number> = {}; // nodeId -> percentage
    const activeEdges = new Set<string>(); // edgeId (source-target)

    nodeStatuses[activeGenesis.id] = 'COMPLETED';
    nodeEffectiveMonths[activeGenesis.id] = 0;

    // Month 0
    data.push({
      name: 'GEN',
      month: 0,
      Financial: currentNW,
      Emotional: currentHealth,
      Relational: currentRelational,
      Spiritual: currentSpiritual,
      ActualFinancial: actualNW,
      ActualEmotional: actualHealth,
      ActualRelational: actualRelational,
      ActualSpiritual: actualSpiritual,
      events: []
    });

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    let cumulativeMonthlyImpact = 0;
    let actualCumulativeMonthlyImpact = 0;

    // Find all nodes reachable from activeGenesis
    const reachableNodes = new Set<string>([activeGenesis.id]);
    let changed = true;
    while (changed) {
      changed = false;
      scenarioEvents.forEach(e => {
        if (!reachableNodes.has(e.id)) {
          const hasDependencyInSet = e.dependencies.some(d => {
            const depId = typeof d === 'string' ? d : d.id;
            return reachableNodes.has(depId);
          });
          if (hasDependencyInSet) {
            reachableNodes.add(e.id);
            changed = true;
          }
        }
      });
    }

    const filteredEvents = scenarioEvents.filter(e => reachableNodes.has(e.id));

    for (let m = 1; m <= targetTimeline; m++) {
      // --- Simulation Logic ---
      if (liquidityCrisisMonth !== -1) {
        data.push({
          name: `${monthNames[(m-1) % 12]}${m > 12 ? `'${Math.floor((m-1)/12) + 1}` : ''}`,
          month: m,
          Financial: currentNW,
          Emotional: currentHealth,
          Relational: currentRelational,
          Spiritual: currentSpiritual,
          ActualFinancial: m <= currentSimulationMonth ? actualNW : undefined,
          ActualEmotional: m <= currentSimulationMonth ? actualHealth : undefined,
          ActualRelational: m <= currentSimulationMonth ? actualRelational : undefined,
          ActualSpiritual: m <= currentSimulationMonth ? actualSpiritual : undefined,
          events: [],
          isCrisis: true,
          nodeStatuses: { ...nodeStatuses },
          objectiveProgress: { ...objectiveProgress },
          activeEdges: Array.from(activeEdges),
          violations: ["Liquidity crisis"]
        });
        continue;
      }

      // Determine which events fire this month based on dependency gating
      const eventsFiringThisMonth = filteredEvents.filter(e => {
        if (e.type !== 'event') return false;
        
        // Check dependencies
        const allDepsSatisfied = e.dependencies.every(d => {
          const depId = typeof d === 'string' ? d : d.id;
          if (depId === activeGenesis.id) return true;
          const depNode = scenarioEvents.find(ev => ev.id === depId);
          if (!depNode) return true;
          if (depNode.type === 'objective') return satisfiedObjectives[depId] !== undefined && satisfiedObjectives[depId] < m;
          if (depNode.type === 'event') return nodeStatuses[depId] === 'COMPLETED' && nodeEffectiveMonths[depId] < m;
          return true;
        });

        if (!allDepsSatisfied) {
          nodeStatuses[e.id] = 'LOCKED';
          return false;
        }

        // Calculate effective month
        const depSatisfactionMonths = e.dependencies.map(d => {
          const depId = typeof d === 'string' ? d : d.id;
          return satisfiedObjectives[depId] || nodeEffectiveMonths[depId] || 0;
        });
        const maxDepMonth = Math.max(0, ...depSatisfactionMonths);
        const effectiveMonth = Math.max(e.month, maxDepMonth + 1);
        
        nodeEffectiveMonths[e.id] = effectiveMonth;
        
        if (effectiveMonth === m) {
          nodeStatuses[e.id] = 'COMPLETED';
          // Mark edges as active
          e.dependencies.forEach(d => {
            const depId = typeof d === 'string' ? d : d.id;
            activeEdges.add(`${depId}-${e.id}`);
          });
          return true;
        }
        
        if (effectiveMonth > m) {
          nodeStatuses[e.id] = 'IN-PROGRESS'; // Waiting for its time
        }
        
        return false;
      });

      let monthImmediateImpact = 0;
      let monthTimeReclaimed = 0;
      let monthRelationalImpact = 0;
      let monthSpiritualImpact = 0;

      eventsFiringThisMonth.forEach(e => {
        if (e.status !== 'FAILED') {
          monthImmediateImpact += ((e.immediateIncome || 0) - (e.immediateCost || 0)) * mods.costMod;
          const income = e.monthlyIncome || 0;
          const cost = e.ongoingCost || 0;
          const netImpact = income - cost;
          cumulativeMonthlyImpact += netImpact * mods.costMod;
          monthTimeReclaimed += e.timeReclaimed;
          monthRelationalImpact += (e.relationalImpact || 0);
          monthSpiritualImpact += (e.spiritualImpact || 0);
        }
      });

      const isBurnedOut = currentHealth < 30;
      if (isBurnedOut && burnoutTaxMonths === 0) burnoutTaxMonths = 2;

      // Obligation Debt Check
      const isRelationalCrisis = currentRelational < relationalTripwire;
      if (isRelationalCrisis && obligationDebtMonths === 0) obligationDebtMonths = 2;

      const currentIncome = burnoutTaxMonths > 0 
        ? effectiveBaseIncome * 0.8 
        : effectiveBaseIncome;
      
      if (burnoutTaxMonths > 0) burnoutTaxMonths--;

      const growth = currentNW * (monthlyYield * mods.yieldMod);
      const modifiedBurnRate = ((effectiveBaseExpense * mods.burnMod) * inflationImpact) + disruptionImpact;
      const monthNetYield = currentIncome - modifiedBurnRate;
      const adjustedYield = monthNetYield * yieldMultiplier;
      
      const nextNW = currentNW + growth + adjustedYield + cumulativeMonthlyImpact + monthImmediateImpact;
      
      if (nextNW < 0) {
        liquidityCrisisMonth = m;
        currentNW = nextNW;
      } else {
        currentNW = nextNW;
      }

      // Obligation Debt Penalty: Deduct Temporal Capital (simulated as less time reclaimed or more degradation)
      // and System Health
      const obligationPenalty = obligationDebtMonths > 0 ? 15 : 0;
      if (obligationDebtMonths > 0) obligationDebtMonths--;

      const timeReclaimedImpact = Math.max(0, monthTimeReclaimed * 0.5) - (obligationPenalty * 0.2);
      const monthDegradation = Math.max(0, (effectiveMonthlyDegradation * 5) - timeReclaimedImpact + (obligationPenalty * 0.5));
      currentHealth = Math.max(0, currentHealth - monthDegradation);

      // Update Relational and Spiritual
      currentRelational = Math.max(0, Math.min(100, currentRelational + monthRelationalImpact + ledgerRelational - (isBurnedOut ? 2 : 0)));
      currentSpiritual = Math.max(0, Math.min(100, currentSpiritual + monthSpiritualImpact + ledgerSpiritual + (isHalal ? 1 : -2)));

      // Check Objectives
      const objectivesToCheck = filteredEvents.filter(e => e.type === 'objective');
      objectivesToCheck.forEach(obj => {
        if (satisfiedObjectives[obj.id]) return;

        // Check if parents are met
        const allDepsSatisfied = obj.dependencies.every(d => {
          const depId = typeof d === 'string' ? d : d.id;
          if (depId === activeGenesis.id) return true;
          const depNode = scenarioEvents.find(ev => ev.id === depId);
          if (!depNode) return true;
          if (depNode.type === 'objective') return satisfiedObjectives[depId] !== undefined;
          if (depNode.type === 'event') return nodeStatuses[depId] === 'COMPLETED';
          return true;
        });

        if (allDepsSatisfied) {
          nodeStatuses[obj.id] = 'IN-PROGRESS';
          objectiveProgress[obj.id] = Math.max(0, Math.min(100, (currentNW / (obj.targetCapital || 1)) * 100));
          
          // Mark edges as active
          obj.dependencies.forEach(d => {
            const depId = typeof d === 'string' ? d : d.id;
            activeEdges.add(`${depId}-${obj.id}`);
          });

          if (currentNW >= (obj.targetCapital || 0)) {
            satisfiedObjectives[obj.id] = m;
            nodeStatuses[obj.id] = 'COMPLETED';
            nodeEffectiveMonths[obj.id] = m;
          }
        } else {
          nodeStatuses[obj.id] = 'LOCKED';
          objectiveProgress[obj.id] = 0;
        }
      });

      // --- Actual Reality Logic ---
      if (m <= currentSimulationMonth) {
        const telemetryThisMonth = dailyTelemetry.filter(t => t.month === m);
        const actualExpenses = telemetryThisMonth
          .filter(t => t.category === 'Expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const timeInvestment = telemetryThisMonth
          .filter(t => t.category === 'Time Investment')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const timeWasted = telemetryThisMonth
          .filter(t => t.category === 'Time Wasted')
          .reduce((sum, t) => sum + t.amount, 0);

        const isActualBurnedOut = actualHealth < 30;
        if (isActualBurnedOut && actualBurnoutTaxMonths === 0) actualBurnoutTaxMonths = 2;

        const isActualRelationalCrisis = actualRelational < relationalTripwire;
        if (isActualRelationalCrisis && actualObligationDebtMonths === 0) actualObligationDebtMonths = 2;

        const actualIncome = actualBurnoutTaxMonths > 0 
          ? effectiveBaseIncome * 0.8 
          : effectiveBaseIncome;
        
        if (actualBurnoutTaxMonths > 0) actualBurnoutTaxMonths--;

        const actualGrowth = actualNW * (monthlyYield * mods.yieldMod);
        const actualMonthNetYield = actualIncome - actualExpenses;
        const actualAdjustedYield = actualMonthNetYield * yieldMultiplier;
        
        const completedEventsThisMonth = filteredEvents.filter(e => e.month === m && e.status === 'COMPLETED');
        let actualMonthImmediateImpact = 0;
        let actualRelationalImpact = 0;
        let actualSpiritualImpact = 0;

        completedEventsThisMonth.forEach(e => {
          actualMonthImmediateImpact += (e.immediateIncome || 0) - e.immediateCost;
          const income = e.monthlyIncome || 0;
          const cost = e.ongoingCost || 0;
          const netImpact = income - cost;
          actualCumulativeMonthlyImpact += netImpact;
          actualRelationalImpact += (e.relationalImpact || 0);
          actualSpiritualImpact += (e.spiritualImpact || 0);
        });

        actualNW = actualNW + actualGrowth + actualAdjustedYield + actualCumulativeMonthlyImpact + actualMonthImmediateImpact;

        const actualObligationPenalty = actualObligationDebtMonths > 0 ? 15 : 0;
        if (actualObligationDebtMonths > 0) actualObligationDebtMonths--;

        const actualTimeImpact = (timeInvestment * 0.5) - (timeWasted * 0.8) - (actualObligationPenalty * 0.2);
        const actualDegradation = Math.max(0, (effectiveMonthlyDegradation * 5) - actualTimeImpact + (actualObligationPenalty * 0.5));
        actualHealth = Math.max(0, Math.min(100, actualHealth - actualDegradation));

        actualRelational = Math.max(0, Math.min(100, actualRelational + actualRelationalImpact + ledgerRelational - (isActualBurnedOut ? 2 : 0)));
        actualSpiritual = Math.max(0, Math.min(100, actualSpiritual + actualSpiritualImpact + ledgerSpiritual + (isHalal ? 1 : -2)));
      }

      const monthViolations: string[] = [];
      if (sc.minCash > 0 && currentNW < sc.minCash) {
        monthViolations.push("Emergency Fund Breach");
      }
      if (sc.maxBurn > 0 && modifiedBurnRate > sc.maxBurn) {
        monthViolations.push("Burn Rate Exceeded");
      }

      data.push({
        name: `${monthNames[(m-1) % 12]}${m > 12 ? `'${Math.floor((m-1)/12) + 1}` : ''}`,
        month: m,
        Financial: currentNW,
        Emotional: currentHealth,
        Relational: currentRelational,
        Spiritual: currentSpiritual,
        ActualFinancial: m <= currentSimulationMonth ? actualNW : undefined,
        ActualEmotional: m <= currentSimulationMonth ? actualHealth : undefined,
        ActualRelational: m <= currentSimulationMonth ? actualRelational : undefined,
        ActualSpiritual: m <= currentSimulationMonth ? actualSpiritual : undefined,
        events: eventsFiringThisMonth,
        isBurnoutActive: burnoutTaxMonths > 0,
        isObligationDebtActive: obligationDebtMonths > 0,
        isCrisis: nextNW < 0,
        unallocatedTime: dailyTimeBudget - ledgerTime - monthTimeReclaimed,
        nodeStatuses: { ...nodeStatuses },
        objectiveProgress: { ...objectiveProgress },
        satisfiedObjectives: { ...satisfiedObjectives },
        nodeEffectiveMonths: { ...nodeEffectiveMonths },
        activeEdges: Array.from(activeEdges),
        violations: monthViolations
      });
    }
    return data;
  };

  const [isRecalculating, setIsRecalculating] = useState(false);

  const activeGenesis = timelineEvents.find(e => e.type === 'genesis' && e.isActiveGenesis) || timelineEvents.find(e => e.type === 'genesis');
  const initialNetWorth = activeGenesis ? (activeGenesis.initialCash || 0) - (activeGenesis.initialDebt || 0) : 0;
  
  // Burn Rate Normalization from Genesis Ledger
  const { totalMonthlyBurnRate, totalMonthlyIncome } = useMemo(() => {
    if (!activeGenesis?.baselineLedger) return { totalMonthlyBurnRate: 0, totalMonthlyIncome: 0 };
    
    const income = activeGenesis.baselineLedger
      .filter((item: any) => item.type === 'Income')
      .reduce((sum: number, item: any) => sum + normalizeToMonthly(Number(item.value) || 0, item.frequency || 'Monthly'), 0);
      
    const expense = activeGenesis.baselineLedger
      .filter((item: any) => item.type === 'Expense')
      .reduce((sum: number, item: any) => sum + normalizeToMonthly(Number(item.value) || 0, item.frequency || 'Monthly'), 0);
      
    return { totalMonthlyBurnRate: expense, totalMonthlyIncome: income };
  }, [activeGenesis?.baselineLedger]);

  const netMonthlyYield = totalMonthlyIncome - totalMonthlyBurnRate;
  const eventMonthlyCost = useMemo(() => timelineEvents
    .filter(e => e.type === 'event' && e.status !== 'FAILED')
    .reduce((sum, e) => sum + (Number(e.ongoingCost) || 0), 0), [timelineEvents]);
  const eventMonthlyIncome = useMemo(() => timelineEvents
    .filter(e => e.type === 'event' && e.status !== 'FAILED')
    .reduce((sum, e) => sum + (Number(e.monthlyIncome) || 0), 0), [timelineEvents]);
  const liveMonthlyExpenses = totalMonthlyBurnRate + eventMonthlyCost;
  const liveMonthlySavings = (totalMonthlyIncome + eventMonthlyIncome) - liveMonthlyExpenses;

  /** Phase 66: preview monthly savings for a hypothetical timeline (e.g. while dragging a node month). */
  const computeLiveMonthlySavingsForTimeline = useCallback(
    (events: typeof timelineEvents) => {
      const evCost = events
        .filter((e) => e.type === 'event' && e.status !== 'FAILED')
        .reduce((sum, e) => sum + (Number(e.ongoingCost) || 0), 0);
      const evInc = events
        .filter((e) => e.type === 'event' && e.status !== 'FAILED')
        .reduce((sum, e) => sum + (Number(e.monthlyIncome) || 0), 0);
      return totalMonthlyIncome + evInc - (totalMonthlyBurnRate + evCost);
    },
    [totalMonthlyIncome, totalMonthlyBurnRate]
  );

  const [dragSavingsPreview, setDragSavingsPreview] = useState<number | null>(null);

  /** Weekly time from active-by-month nodes → daily average for Daily Log (distinct from systemConstraints.minSleep). */
  const totalDailyHours = useMemo(() => {
    const totalWeekly = timelineEvents
      .filter(
        (n) =>
          (n.type === 'event' || n.type === 'objective') &&
          n.status !== 'FAILED' &&
          (n.month || 0) <= currentSimulationMonth
      )
      .reduce((acc, n) => acc + Number(n.weeklyHours || 0), 0);
    return totalWeekly / 7;
  }, [timelineEvents, currentSimulationMonth]);

  // Stress Test Modifiers
  const volatilityImpact = stressTests.marketVolatility ? -4.5 : 0;
  const inflationImpact = stressTests.inflationSpike ? 1.12 : 1;
  const disruptionImpact = stressTests.incomeDisruption ? 1200 : 0;
  const burnoutImpact = stressTests.burnoutEvent ? 30 : 0;
  
  // Path specific variables
  const pathYieldModifier = activePath === 'aggressive' ? 18.7 : 4.2;
  const baseEffectiveYield = investmentYield + pathYieldModifier + volatilityImpact;
  
  // Category 3 Multipliers
  const investmentMultiplier = 1 + (skillStudyTime * 0.06) + (readingLearningTime * 0.03);
  const effectiveYield = baseEffectiveYield * investmentMultiplier;
  const monthlyYield = (effectiveYield / 100) / 12;

  /** 121 points: month 0..120; compounding + monthly savings (Terminal “visual destiny”). */
  const nwTrajectoryTenYear = useMemo(() => {
    const pts: number[] = [];
    let nw = initialNetWorth;
    pts.push(nw);
    for (let m = 0; m < 120; m++) {
      nw = nw * (1 + monthlyYield) + liveMonthlySavings;
      pts.push(nw);
    }
    return pts;
  }, [initialNetWorth, monthlyYield, liveMonthlySavings]);

  const isHalal = activePath === 'conservative' ? conservativeHalal : aggressiveHalal;
  
  // Base Temporal / Emotional logic
  const totalAllocatedTimeBase = (salahActive ? 1 : 0) + familyTime + sleepTime + commutingTime + hygieneMealsTime + skillStudyTime + readingLearningTime + fitnessGymTime + socialMediaTime + entertainmentTime;
  
  const exhaustionPenalty = sleepTime < 6 ? Math.pow(6 - sleepTime, 2) * 12 : 0;
  const entropyPenalty = (socialMediaTime * 8) + (entertainmentTime * 4);
  const investmentFortification = (skillStudyTime * 3) + (readingLearningTime * 4) + (fitnessGymTime * 6);
  const familyStabilization = familyTime * 5;
  
  const initialSystemHealth = Math.max(0, Math.min(100, 
    100 
    - exhaustionPenalty 
    - entropyPenalty 
    + investmentFortification 
    + familyStabilization 
    - burnoutImpact
  ));

  const baseEmotionalTax = activePath === 'aggressive' ? 8.2 : 2.5;
  const degradationMultiplier = isHalal ? 1 : 2.5;
  const entropyDegradation = (socialMediaTime + entertainmentTime) * 0.6;
  const investmentMitigation = (skillStudyTime + readingLearningTime + fitnessGymTime) * 0.3;
  const effectiveMonthlyDegradation = Math.max(0.05, (baseEmotionalTax * degradationMultiplier) + entropyDegradation - investmentMitigation) / 10;

  const simulationData = useMemo(() => calculateSimulationData({ costMod: 1, burnMod: 1, yieldMod: 1 }, 'primary'), [
    currentCash, currentDebt, initialSystemHealth, targetTimeline, timelineEvents,
    baseMonthlyIncome, monthlyYield, totalMonthlyBurnRate, inflationImpact,
    disruptionImpact, currentSimulationMonth, dailyTelemetry, relationalTripwire,
    effectiveMonthlyDegradation, isHalal, systemConstraints, yieldMultiplier
  ]);

  const ghostSimulationData = useMemo(() => calculateSimulationData({ costMod: 1, burnMod: 1, yieldMod: 1 }, 'ghost'), [
    currentCash, currentDebt, initialSystemHealth, targetTimeline, timelineEvents,
    baseMonthlyIncome, monthlyYield, totalMonthlyBurnRate, inflationImpact,
    disruptionImpact, currentSimulationMonth, dailyTelemetry, relationalTripwire,
    effectiveMonthlyDegradation, isHalal, systemConstraints, yieldMultiplier
  ]);

  const computeTenYearSeriesForConstraints = useCallback(
    (c: typeof systemConstraints) => {
      const rows = calculateSimulationData({ costMod: 1, burnMod: 1, yieldMod: 1 }, 'primary', c);
      return buildTenYearNwFromSim(rows, targetTimeline, monthlyYield, liveMonthlySavings);
    },
    [
      currentCash,
      currentDebt,
      initialSystemHealth,
      targetTimeline,
      timelineEvents,
      baseMonthlyIncome,
      monthlyYield,
      totalMonthlyBurnRate,
      inflationImpact,
      disruptionImpact,
      currentSimulationMonth,
      dailyTelemetry,
      relationalTripwire,
      effectiveMonthlyDegradation,
      isHalal,
      yieldMultiplier,
      liveMonthlySavings,
      systemConstraints,
    ]
  );

  const baselineTenYearSeries = useMemo(
    () => computeTenYearSeriesForConstraints(systemConstraints),
    [computeTenYearSeriesForConstraints, systemConstraints]
  );

  const toggleProtocol = () => {
    if (appState === 'PLANNING') {
      setProtocolFinalScore(null);
      setAppState('ACTIVE_PROTOCOL');
      addTerminalLog("PROTOCOL ACTIVATED: ALL SYSTEMS LOCKED.");
      addTerminalLog("MARCHING ORDERS GENERATED. FOCUS ON IMMEDIATE OBJECTIVE.");

      setTimelineEvents(prev => {
        const hasActiveOrCompleted = prev.some(e => e.status === 'ACTIVE' || e.status === 'COMPLETED');
        if (!hasActiveOrCompleted && prev.length > 0) {
          const genesisDependents = prev.filter(e => e.dependencies.some(d => (typeof d === 'string' ? d === 'genesis' : d.id === 'genesis')));
          if (genesisDependents.length > 0) {
            const firstNode = genesisDependents.sort((a, b) => a.month - b.month)[0];
            return prev.map(e => e.id === firstNode.id ? { ...e, status: 'ACTIVE' } : { ...e, status: e.status || 'PENDING' });
          } else {
            const firstNode = [...prev].sort((a, b) => a.month - b.month)[0];
            return prev.map(e => e.id === firstNode.id ? { ...e, status: 'ACTIVE' } : { ...e, status: e.status || 'PENDING' });
          }
        }
        return prev.map(e => ({ ...e, status: e.status || 'PENDING' }));
      });
    } else {
      const issue = findFirstSimulationIssue(simulationData);
      if (issue) {
        const violText =
          Array.isArray(issue.violations) && issue.violations.length > 0
            ? issue.violations.join('; ')
            : issue.isCrisis === true || (typeof issue.Financial === 'number' && issue.Financial < 0)
              ? 'Negative net position / liquidity stress'
              : 'Negative recurring cashflow on scheduled events';
        setProtocolFinalScore({
          success: false,
          headline: `Path Terminal: [ FAILURE - MONTH ${issue.month} ]`,
          detail: `${violText}. Review the timeline and constraints before the next run.`,
          failureMonth: issue.month,
        });
      } else {
        setProtocolFinalScore({
          success: true,
          headline: 'Path Verified: [ SUCCESS ]',
          detail: 'No liquidity breach, negative net worth month, or negative recurring event cashflow detected across the simulation horizon.',
        });
      }
      setAppState('PLANNING');
      addTerminalLog("PROTOCOL ABORTED: RETURNING TO PLANNING PHASE.");
    }
  };

  useEffect(() => {
    setIsRecalculating(true);
    const timer = setTimeout(() => setIsRecalculating(false), 500);
    return () => clearTimeout(timer);
  }, [simulationData]);
  
  const criticalEventIds = useMemo(() => timelineEvents
    .filter(e => {
      if (e.status === 'FAILED') return false;
      const monthData = simulationData.find(d => d.month === e.month);
      return monthData && monthData.Financial < 0;
    })
    .map(e => e.id), [timelineEvents, simulationData]);

  const objectives = useMemo(
    () => timelineEvents.filter((n) => n.type === 'objective'),
    [timelineEvents]
  );

  const simAtCurrentMonth = useMemo(
    () => simulationData.find((d) => d.month === currentSimulationMonth),
    [simulationData, currentSimulationMonth]
  );

  const canvasCrisisActive =
    Boolean(simAtCurrentMonth?.isCrisis) || (simAtCurrentMonth?.violations?.length ?? 0) > 0;

  const chartData = useMemo(() => {
    return simulationData.map(row => ({
      ...row,
      Financial: sanitizeNum(row.Financial),
      Emotional: sanitizeNum(row.Emotional),
      Relational: sanitizeNum(row.Relational),
      Spiritual: sanitizeNum(row.Spiritual),
      ActualFinancial: (row.ActualFinancial === undefined || row.ActualFinancial === null) ? null : sanitizeNum(row.ActualFinancial),
      ActualEmotional: (row.ActualEmotional === undefined || row.ActualEmotional === null) ? null : sanitizeNum(row.ActualEmotional),
      ActualRelational: (row.ActualRelational === undefined || row.ActualRelational === null) ? null : sanitizeNum(row.ActualRelational),
      ActualSpiritual: (row.ActualSpiritual === undefined || row.ActualSpiritual === null) ? null : sanitizeNum(row.ActualSpiritual),
    }));
  }, [simulationData]);
  const currentData = simulationData[targetTimeline] || {
    Financial: 0,
    Emotional: 0,
    Relational: 0,
    Spiritual: 0,
    month: targetTimeline,
    events: []
  };
  const projectedNetWorth = currentData.Financial;
  const netChange = projectedNetWorth - initialNetWorth;

  const minMonthlyBuffer = Number(systemConstraints.minMonthlyBuffer ?? 0);
  const savingsBelowBuffer =
    minMonthlyBuffer > 0 && liveMonthlySavings < minMonthlyBuffer;

  const criticalAlert = useMemo(() => {
    if (savingsBelowBuffer) return true;
    if (systemConstraints.minCash > 0 && projectedNetWorth < systemConstraints.minCash) return true;
    if (systemConstraints.maxBurn > 0 && liveMonthlyExpenses > systemConstraints.maxBurn) return true;
    const v = simAtCurrentMonth?.violations;
    return Array.isArray(v) && v.length > 0;
  }, [
    savingsBelowBuffer,
    systemConstraints.minCash,
    systemConstraints.maxBurn,
    projectedNetWorth,
    liveMonthlyExpenses,
    simAtCurrentMonth,
  ]);

  const isModalView = activeTab === 'Constraints' || activeTab === 'Goals';
  const glassPanelClass = 'bg-neutral-900/40 border-[0.5px] border-white/5';
  const glassPanelStrongClass = 'bg-neutral-900/60 border-[0.5px] border-white/5';
  const monthlyNetChange = netChange / (targetTimeline || 1);
  const currentSystemHealth = initialSystemHealth; // For display
  const totalReclaimedTime = useMemo(() => timelineEvents
    .filter(e => e.status === 'COMPLETED')
    .reduce((sum, e) => sum + e.timeReclaimed, 0), [timelineEvents]);

  const residualTime = dailyTimeBudget - totalAllocatedTimeBase + totalReclaimedTime;
  const isOverdraft = totalAllocatedTimeBase > dailyTimeBudget;

  // Target Calculation
  const capitalGap = targetCapital - initialNetWorth;
  const monthsToTarget = monthlyNetChange > 0 && capitalGap > 0 
    ? Math.ceil(capitalGap / monthlyNetChange) 
    : (initialNetWorth >= targetCapital ? 0 : -1);

  const yearsUntilObjective = netChange > 0 
    ? (1000000 - initialNetWorth) / netChange 
    : Infinity;

  // Success Probability Logic
  const activeStressTestsCount = Object.values(stressTests).filter(Boolean).length;
  const successProbability = Math.max(0, Math.min(100, 
    (currentData.Emotional * 0.6) + 
    (currentData.Financial >= targetCapital ? 40 : (currentData.Financial / (targetCapital || 1)) * 40) - 
    (activeStressTestsCount * 15)
  ));

  // 3. Tactical Logic
  const isTripwireTriggered = simulationData.some(d => d.Emotional < healthRedline);

  const primaryVulnerability = (() => {
    if (isOverdraft) return { label: "TEMPORAL OVERDRAFT", risk: "CRITICAL", protocol: "REDUCE NON-ESSENTIAL ALLOCATION" };
    if (sleepTime < 6) return { label: "PHYSIOLOGICAL COLLAPSE", risk: "CRITICAL", protocol: "PRIORITIZE SLEEP RECOVERY" };
    if (socialMediaTime > 3) return { label: "ENTROPY SPIKE", risk: "HIGH", protocol: "EXECUTE DIGITAL DETOX" };
    if (monthlyNetChange < 500) return { label: "LIQUIDITY CRISIS", risk: "HIGH", protocol: "REDUCE MONTHLY OVERHEAD" };
    if (isTripwireTriggered) return { label: "SYSTEM COLLAPSE", risk: "CRITICAL", protocol: "ACTIVATE PIVOT PROTOCOL" };
    if (!isHalal) return { label: "SPIRITUAL DEGRADATION", risk: "MODERATE", protocol: "REALIGN HALAL PARAMETERS" };
    return { label: "NOMINAL OPERATIONS", risk: "LOW", protocol: "MAINTAIN CURRENT TRAJECTORY" };
  })();

  // Generate Critical Path Milestones
  const pathMilestones = simulationData.slice(1).map(d => ({
    month: d.month,
    financial: d.Financial,
    emotional: d.Emotional,
  }));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handleRecalculate = () => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setCalculationKey(prev => prev + 1);
    }, 800);
  };

  const runChaosSimulation = () => {
    let testCash = currentCash;
    const minCash = systemConstraints?.minCash || 0;
    
    for (let month = 1; month <= 24; month++) {
      // Apply regular monthly flow
      let monthlyIncome = baseMonthlyIncome;
      
      // Chaos: 10% chance to reduce income by 40%
      if (Math.random() < 0.10) {
        monthlyIncome *= 0.6;
      }
      
      testCash += monthlyIncome;
      testCash -= totalMonthlyBurnRate;
      
      // Chaos: 15% chance for emergency expense between $500 and $1500
      if (Math.random() < 0.15) {
        const emergency = Math.floor(Math.random() * 1001) + 500;
        testCash -= emergency;
      }
      
      // Tripwire Check
      if (testCash < minCash) {
        setChaosReport(`[!] CHAOS SIMULATION FAILED: Redline breached in Month ${month}. System cannot survive this stress test.`);
        return;
      }
    }
    
    setChaosReport(`[ OK ] SYSTEM RESILIENT: Strategy survived the Chaos Simulation.`);
  };

  const traceCriticalPath = () => {
    if (objectives.length === 0) {
      setPathReport({ 
        target: "NO EXTRACTION POINTS", 
        reason: "Zero strategic objectives detected on the canvas. Deploy nodes to establish a critical path." 
      });
      return;
    }
    
    const bottleneckNode = objectives.reduce((prev, current) => (prev.month > current.month) ? prev : current);
    
    setPathReport({ 
      target: bottleneckNode.name, 
      reason: `This objective is positioned at Month ${bottleneckNode.month}. It represents the maximum temporal limit of your current strategy. All preceding operations, resource gathering, and daily tasks must be optimized to clear this specific bottleneck.` 
    });
  };

  React.useEffect(() => {
    if (appState !== 'ACTIVE_PROTOCOL') {
      setProtocolChaosReport(null);
      setProtocolPathReport(null);
      return;
    }

    const issue = findFirstSimulationIssue(simulationData);

    if (issue) {
      const violText =
        Array.isArray(issue.violations) && issue.violations.length > 0
          ? issue.violations.join('; ')
          : issue.isCrisis === true || (typeof issue.Financial === 'number' && issue.Financial < 0)
            ? 'Negative net position / liquidity stress'
            : 'Negative recurring cashflow on scheduled events';
      setProtocolChaosReport(`[!] Protocol watch: ${violText} (Month ${issue.month})`);
      setProtocolPathReport({
        target: `Liquidity gap at Month ${issue.month}`,
        reason: `${violText}. Review events and safety nets while the run is active.`,
      });
    } else {
      setProtocolChaosReport(null);
      setProtocolPathReport(null);
    }
  }, [appState, simulationData, calculationKey]);

  const displayChaos = chaosReport ?? protocolChaosReport;
  const displayPath = pathReport ?? protocolPathReport;

  const reportCardClass =
    'max-w-md rounded-2xl border-[0.5px] border-red-900/50 border-l-2 border-l-red-600/70 bg-stone-100/[0.04] backdrop-blur-2xl p-6 text-stone-100 shadow-2xl ring-1 ring-red-900/20';

  // Helper for formatting currency
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const pathFullyVerified = useMemo(
    () =>
      !simulationData.some(
        (d) =>
          d.isCrisis === true ||
          (Array.isArray(d.violations) && d.violations.length > 0) ||
          (typeof d.Financial === 'number' && d.Financial < 0)
      ),
    [simulationData]
  );

  const dossierStrategicMomentumPct = useMemo(() => {
    const row = simulationData[targetTimeline] as { objectiveProgress?: Record<string, number> } | undefined;
    const prog = row?.objectiveProgress;
    if (prog && Object.keys(prog).length > 0) {
      const vals = Object.values(prog);
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return Math.round(successProbability);
  }, [simulationData, targetTimeline, successProbability]);

  const commanderDossierStateOfUnion = useMemo(() => {
    const liquidityOk =
      !criticalAlert &&
      !canvasCrisisActive &&
      (typeof simAtCurrentMonth?.Financial !== 'number' || (simAtCurrentMonth.Financial as number) >= 0);
    const liquidity = liquidityOk
      ? 'Liquidity Status: NOMINAL'
      : 'Liquidity Status: ELEVATED — REVIEW CONSTRAINTS / SIMULATION';

    const netsActive = activeStressTestsCount === 0 && liquidityOk;
    const risk = netsActive
      ? 'Risk Factor: LOW (Safety Nets Active)'
      : activeStressTestsCount > 0
        ? `Risk Factor: MODERATE (${activeStressTestsCount} stress test(s) armed)`
        : 'Risk Factor: HIGH — MITIGATE BREACHES';

    const momentum = `Strategic Momentum: ${dossierStrategicMomentumPct}% (Objective Aligned)`;

    return { liquidity, risk, momentum };
  }, [
    criticalAlert,
    canvasCrisisActive,
    simAtCurrentMonth,
    activeStressTestsCount,
    dossierStrategicMomentumPct,
  ]);

  const commanderDossierStats = useMemo(() => {
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    const education = `${skillStudyTime}h skill + ${readingLearningTime}h reading / day`;
    const projectedExit =
      monthsToTarget >= 0
        ? `Est. ${monthsToTarget} mo → ${goalName || 'objective'} (horizon ${targetTimeline} mo)`
        : 'Recalibrate trajectory — exit window indeterminate';
    return {
      education,
      netWorth: fmt(projectedNetWorth),
      projectedExit,
    };
  }, [
    skillStudyTime,
    readingLearningTime,
    monthsToTarget,
    goalName,
    targetTimeline,
    projectedNetWorth,
  ]);

  return (
    <>
      {!isUnlocked ? (
        <div className="h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="space-y-2">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 border-2 border-primary flex items-center justify-center text-primary font-black text-3xl tracking-tighter">
                  S
                </div>
              </div>
              <h1 className="text-primary font-headline font-bold text-xl tracking-[0.3em] uppercase">SYSTEM LOCKED</h1>
              <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-widest">Deterministic Life Architect v1.0</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="password" 
                  value={passcodeInput} 
                  onChange={(e) => setPasscodeInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                  placeholder="ENTER MASTER PASSCODE"
                  className="w-full bg-neutral-900 border border-outline-variant/30 px-4 py-3 text-primary font-mono text-sm text-center focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/30"
                />
              </div>
              <button 
                onClick={handleUnlock}
                className="w-full bg-primary text-on-primary py-3 font-headline font-bold text-xs tracking-[0.2em] uppercase hover:bg-white transition-colors"
              >
                [ INITIATE HANDSHAKE ]
              </button>
            </div>

            <div className="pt-8">
              <p className="text-[8px] font-mono text-on-surface-variant/40 uppercase tracking-[0.2em]">
                Unauthorized access is strictly prohibited. All attempts are logged.
              </p>
            </div>
          </div>
        </div>
      ) : showDedication ? (
        <div className="h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center p-6 sm:p-12 z-50 text-center relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
          
          <div className="max-w-4xl space-y-16 relative z-10">
            {/* The Ayah */}
            <div className="space-y-6">
              <p className="text-primary font-bold text-2xl sm:text-3xl lg:text-4xl tracking-wide leading-relaxed font-serif">
                "And when you have decided, then rely upon Allah. Indeed, Allah loves those who rely [upon Him]."
              </p>
              <p className="text-white/50 font-mono text-sm tracking-widest uppercase">
                — Surah Ali 'Imran [3:159]
              </p>
            </div>

            <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mx-auto"></div>

            {/* The Dedication */}
            <div className="space-y-4">
              <p className="text-white font-mono text-xl sm:text-2xl tracking-wide">
                Dedicated to Eman Endris.
              </p>
              <p className="text-white/70 font-mono text-base sm:text-lg leading-relaxed max-w-2xl mx-auto italic">
                My best friend, my anchor, and the only person I can truly depend on.
              </p>
              <p className="text-primary/80 font-mono text-sm tracking-widest pt-6 uppercase">
                — Yitbarek Tegene (Barack Mohammed)
              </p>
            </div>

            {/* The Gateway Button */}
            <div className="pt-12">
              <button 
                onClick={() => setShowDedication(false)} 
                className="border border-primary/50 rounded-full text-primary hover:bg-primary/10 px-10 py-4 font-headline text-sm tracking-widest transition-all hover:scale-105"
              >
                [ ENTER ARCHITECTURE ]
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-screen w-screen overflow-hidden font-sans bg-neutral-950 text-white">
      {protocolFinalScore && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="protocol-final-score-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-900/40 border-stone-200/15 bg-stone-950/92 p-8 shadow-2xl ring-1 ring-stone-100/10 backdrop-blur-2xl">
            <h2
              id="protocol-final-score-title"
              className={cn(
                'mb-3 font-headline text-lg font-black uppercase tracking-widest',
                protocolFinalScore.success ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {protocolFinalScore.headline}
            </h2>
            <p className="mb-8 font-headline text-sm leading-relaxed text-stone-300">{protocolFinalScore.detail}</p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={async () => {
                  const fmt = (v: number) =>
                    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
                  const lastRow = simulationData[simulationData.length - 1];
                  const projectedNW = typeof lastRow?.Financial === 'number' ? lastRow.Financial : 0;
                  const summary = [
                    goalName ? `Goal: ${goalName}` : null,
                    `Target capital: ${fmt(targetCapital)}`,
                    `Projected NW (end sim): ${fmt(projectedNW)}`,
                    `Monthly net (baseline ledger): ${fmt(netMonthlyYield)}`,
                    protocolFinalScore.headline,
                    protocolFinalScore.detail,
                  ]
                    .filter(Boolean)
                    .join('\n');
                  try {
                    await navigator.clipboard.writeText(summary);
                  } catch {
                    console.warn('Clipboard unavailable');
                  }
                }}
                className="rounded-full border border-stone-500/40 px-5 py-2 font-headline text-xs font-bold uppercase tracking-widest text-stone-100 hover:bg-stone-100/10"
              >
                [ Share ]
              </button>
              <button
                type="button"
                onClick={() => setProtocolFinalScore(null)}
                className="rounded-full border border-primary/50 bg-primary/15 px-5 py-2 font-headline text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/25"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      <CommanderDossierModal
        open={commanderDossierOpen}
        onClose={() => setCommanderDossierOpen(false)}
        timelineEvents={timelineEvents}
        stats={commanderDossierStats}
        stateOfUnion={commanderDossierStateOfUnion}
        pathFullyVerified={pathFullyVerified}
      />
      {resetMemoryModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-memory-title"
          onClick={() => setResetMemoryModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border-[0.5px] border-outline-variant/30 bg-neutral-950/88 p-8 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="reset-memory-title"
              className="mb-3 font-headline text-lg font-black uppercase tracking-widest text-red-400"
            >
              WIPE SYSTEM MEMORY?
            </h2>
            <p className="mb-8 font-headline text-sm leading-relaxed text-stone-300">
              This will delete all nodes and reset constraints.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetMemoryModalOpen(false)}
                className="rounded-full border border-stone-500/40 px-5 py-2 font-headline text-xs font-bold uppercase tracking-widest text-stone-200 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWipeSystemMemory}
                className="rounded-full border border-red-600/50 bg-red-950/40 px-5 py-2 font-headline text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-950/70"
              >
                Confirm wipe
              </button>
            </div>
          </div>
        </div>
      )}
      {!isModalView && (displayChaos || displayPath) && (
        <div className="fixed top-24 right-8 z-[60] flex flex-col gap-4 drop-shadow-2xl">
      {displayChaos && (
        <div>
          <div className={cn(reportCardClass, 'text-center')}>
            <h2 className="text-red-500 font-bold font-headline text-xl mb-4 tracking-widest">[ CHAOS REPORT ]</h2>
            <p className="text-stone-100 font-headline mb-8 text-sm leading-relaxed">{displayChaos}</p>
            <button
              onClick={() => (chaosReport ? setChaosReport(null) : setProtocolChaosReport(null))}
              className="border border-red-900/40 hover:border-red-500/60 text-stone-100 hover:text-red-400 rounded-full px-6 py-2 font-headline font-bold tracking-widest hover:bg-red-950/30 transition-colors"
            >
              [ ACKNOWLEDGE ]
            </button>
          </div>
        </div>
      )}
      {displayPath && (
        <div>
          <div className={cn(reportCardClass, 'text-left')}>
            <h2 className="text-red-500 font-bold font-headline text-xl mb-4 tracking-widest">[ CRITICAL PATH ANALYSIS ]</h2>
            <div className="mb-6 border-l border-l-red-600/60 pl-4">
              <p className="text-stone-300 font-headline text-sm uppercase tracking-widest">BOTTLENECK TARGET:</p>
              <p className="text-stone-100 font-bold text-lg font-headline">{displayPath.target}</p>
            </div>
            <p className="text-stone-200 font-headline mb-8 text-sm leading-relaxed">{displayPath.reason}</p>
            <div className="flex justify-center">
              <button
                onClick={() => (pathReport ? setPathReport(null) : setProtocolPathReport(null))}
                className="border border-red-900/40 hover:border-red-500/60 text-stone-100 hover:text-red-400 rounded-full px-6 py-2 font-headline font-bold tracking-widest hover:bg-red-950/30 transition-colors"
              >
                [ CLOSE REPORT ]
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
      {/* Sidebar */}
      <div className="absolute left-4 top-4 bottom-4 z-40">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onExport={handleExport} 
          onImport={handleImport}
          onLoadTemplate={applyStarterTemplate}
          onOpenResetModal={() => setResetMemoryModalOpen(true)}
          onOpenCommanderDossier={() => setCommanderDossierOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <div className="pointer-events-auto absolute inset-0 min-w-0 min-h-0 flex flex-col z-0 overflow-hidden">
        <div className="flex flex-col min-h-0 h-full">
          {/* Header */}
          {!isModalView && (
            <header className={cn(
              "group fixed top-6 left-1/2 -translate-x-1/2 z-40 w-fit max-w-[92vw]",
              "min-h-[48px] overflow-visible rounded-full border-[0.5px] px-4 py-2",
              "backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.12)] transition-all duration-300",
              glassPanelClass
            )}>
              <div className="flex min-h-[44px] items-center gap-4 overflow-visible text-[10px] tracking-[0.2em] uppercase">
                <div className="group/mexp relative flex items-center gap-2">
                  <span className="cursor-help border-b border-dotted border-white/25 text-white/50">Monthly Expenses</span>
                  <span className="font-mono font-bold text-red-600">
                    {formatCurrency(liveMonthlyExpenses)}
                  </span>
                  <div className="pointer-events-none invisible absolute left-0 top-full z-[60] w-max max-w-[240px] pt-1 opacity-0 shadow-lg transition-opacity group-hover/mexp:visible group-hover/mexp:opacity-100">
                    <div className="rounded-md border-[0.5px] border-outline-variant/30 bg-neutral-950/95 px-2.5 py-1.5 text-[8px] font-headline font-normal normal-case leading-snug tracking-normal text-stone-300 backdrop-blur-md">
                      Sum of all active Event and Objective costs.
                    </div>
                  </div>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="group/msav relative flex items-center gap-2">
                  <span className="cursor-help border-b border-dotted border-white/25 text-white/50">Monthly Savings</span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      dragSavingsPreview !== null && 'text-cyan-400 animate-pulse',
                      dragSavingsPreview === null && savingsBelowBuffer && 'text-red-600 animate-pulse',
                      dragSavingsPreview === null &&
                        !savingsBelowBuffer &&
                        liveMonthlySavings < 0 &&
                        'text-red-600',
                      dragSavingsPreview === null &&
                        !savingsBelowBuffer &&
                        liveMonthlySavings >= 0 &&
                        'text-emerald-500'
                    )}
                  >
                    {dragSavingsPreview !== null ? (
                      <>
                        {formatCurrency(dragSavingsPreview)}{' '}
                        <span className="text-[8px] font-headline normal-case tracking-normal opacity-80">
                          (PREVIEW)
                        </span>
                      </>
                    ) : (
                      formatCurrency(liveMonthlySavings)
                    )}
                  </span>
                  <div className="pointer-events-none invisible absolute right-0 top-full z-[60] w-max max-w-[240px] pt-1 opacity-0 shadow-lg transition-opacity group-hover/msav:visible group-hover/msav:opacity-100">
                    <div className="rounded-md border-[0.5px] border-outline-variant/30 bg-neutral-950/95 px-2.5 py-1.5 text-[8px] font-headline font-normal normal-case leading-snug tracking-normal text-stone-300 backdrop-blur-md">
                      Calculated Yield - Total Burn Rate.
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none invisible absolute left-1/2 top-full z-50 w-max max-w-[min(92vw,720px)] -translate-x-1/2 pt-2 opacity-0 shadow-2xl transition-all duration-200 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                <div className="flex min-w-max max-w-[min(92vw,720px)] flex-wrap items-center justify-center gap-2 rounded-2xl border-[0.5px] border-white/5 bg-neutral-900/95 px-3 py-2 backdrop-blur-md">
                <button 
                  onClick={handleResetStrategy}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border-[0.5px] border-white/5 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md transition-all text-emerald-500"
                >
                  [ NEW ]
                </button>
                <button 
                  onClick={runChaosSimulation}
                  disabled={isSimulating}
                  className={cn(
                    "px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border-[0.5px] border-white/5 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md transition-all disabled:opacity-50",
                    isSimulating && "animate-pulse"
                  )}
                >
                  {isSimulating ? "SIM..." : "SIM"}
                </button>
                <button 
                  onClick={toggleProtocol}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border-[0.5px] border-white/5 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md transition-all",
                    appState === 'PLANNING' 
                      ? "bg-emerald-500 text-black hover:bg-emerald-400" 
                      : "bg-red-600 text-white hover:bg-red-500 animate-pulse"
                  )}
                >
                  {appState === 'PLANNING' ? "[ RUN ]" : "[ ABORT ]"}
                </button>
                <button 
                  onClick={() => setIsGhostMode(!isGhostMode)} 
                  className={`px-3 py-1.5 rounded-xl border-[0.5px] border-white/5 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md transition-all ${isGhostMode ? 'text-emerald-500 bg-emerald-500/10' : 'text-white/60 bg-white/5 hover:bg-white/10'}`}
                >
                  {isGhostMode ? '[ SCENARIO PLANNER: ON ]' : '[ SCENARIO PLANNER: OFF ]'}
                </button>
                <button onClick={handleLock} className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border-[0.5px] border-white/5 text-[10px] font-semibold tracking-[0.16em] uppercase backdrop-blur-md transition-all text-red-600">[ LOCK ]</button>
                <div className="flex items-center gap-2 pl-2 border-l border-white/5">
                  <button
                    onClick={() => setViewMode('terminal')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-[0.16em] border-[0.5px] border-white/5",
                      viewMode === 'terminal' ? "text-emerald-500 bg-white/10" : "text-white/60"
                    )}
                  >
                    Terminal
                  </button>
                  <button
                    onClick={() => setViewMode('canvas')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-[0.16em] border-[0.5px] border-white/5",
                      viewMode === 'canvas' ? "text-emerald-500 bg-white/10" : "text-white/60"
                    )}
                  >
                    Canvas
                  </button>
                </div>
                </div>
              </div>
            </header>
          )}

        {/* Dashboard Content */}
        <div
          key={`${activeTab}-${viewMode}`}
          className="absolute inset-0 min-h-0 min-w-0 flex animate-in fade-in overflow-hidden pt-36 pb-16 pl-24 pr-6 duration-300"
        >
          {activeTab === 'Constraints' ? (
            <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
              <div className="relative max-w-4xl w-full max-h-[calc(100vh-2rem)] bg-neutral-900/60 border border-white/5 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('Path Simulations')}
                  className="absolute top-4 right-4 z-[60] text-red-500 font-mono text-sm hover:text-red-400"
                >
                  [ X ]
                </button>
                <div className="h-full max-h-[calc(100vh-2rem)] overflow-y-auto">
                  <ConstraintsView
                    constraintsActive={activeTab === 'Constraints'}
                    systemConstraints={systemConstraints}
                    setSystemConstraints={setSystemConstraints}
                    baselineTenYearSeries={baselineTenYearSeries}
                    computeTenYearSeriesForConstraints={computeTenYearSeriesForConstraints}
                    projectedNetWorth={projectedNetWorth}
                    liveMonthlyExpenses={liveMonthlyExpenses}
                    liveMonthlySavings={liveMonthlySavings}
                    totalDailyHours={totalDailyHours}
                    initialNetWorth={initialNetWorth}
                    onCommitProtocols={() => setCalculationKey((k) => k + 1)}
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'Daily Log' ? (
            <DailyLogView
              currentSimMonth={currentSimulationMonth}
              setCurrentSimulationMonth={setCurrentSimulationMonth}
              targetTimeline={targetTimeline}
              simulationData={simulationData}
              systemConstraints={systemConstraints}
              requiredSleepHours={sleepTime}
              totalDailyHours={totalDailyHours}
              totalFixedCosts={totalMonthlyBurnRate}
              liveMonthlyExpenses={liveMonthlyExpenses}
              variableCosts={eventMonthlyCost}
              projectedYield={totalMonthlyIncome + eventMonthlyIncome}
              savingsBelowBuffer={savingsBelowBuffer}
            />
          ) : activeTab === 'Goals' ? (
            <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
              <div className="relative max-w-2xl w-full max-h-[calc(100vh-2rem)] bg-neutral-900/80 border-[0.5px] border-white/10 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden">
                <button onClick={() => setActiveTab('Path Simulations')} className="absolute top-4 right-4 text-red-600 font-mono text-sm">[ X ]</button>
                <div className="p-8 h-full max-h-[calc(100vh-2rem)] overflow-y-auto">
                  <GoalsView
                    objectives={objectives}
                    simulationData={simulationData}
                    currentSimMonth={currentSimulationMonth}
                    timelineEvents={timelineEvents}
                  />
                </div>
              </div>
            </div>
          ) : activeTab === 'Settings' ? (
            <SettingsView />
          ) : activeTab === 'Support' ? (
            <SupportView />
          ) : viewMode === 'terminal' ? (
            <>
              <div className="flex-1 w-full max-w-6xl mx-auto overflow-y-auto terminal-scroll p-8 pr-[20rem] space-y-10">
            {/* Pentagon of Capital Header */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-headline font-bold uppercase tracking-[0.3em] text-on-surface-variant">The Pentagon of Capital</h2>
                <div className="h-px flex-1 bg-outline-variant/10 mx-6" />
                <span className="text-[10px] font-mono text-primary">SYNC_STATUS: 100%</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={calculationKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-5 gap-4"
                >
                  <CapitalWidget 
                    label="Financial" 
                    value={formatCurrency(projectedNetWorth)} 
                    subValue="12-Mo Projection" 
                    icon={<TrendingUp size={18} />}
                    trend={{ value: `${((netChange / initialNetWorth) * 100).toFixed(1)}%`, positive: netChange > 0 }}
                    color={netChange > 0 ? "primary" : "secondary"}
                  />
                  <CapitalWidget 
                    label="Time Remaining" 
                    value={isOverdraft ? "DEPLETED" : `${currentData.unallocatedTime.toFixed(1)} HRS`} 
                    subValue="Daily Unallocated" 
                    icon={<Hourglass size={18} />}
                    trend={{ 
                      value: isOverdraft ? 'OVERDRAFT' : 'STABLE', 
                      positive: !isOverdraft 
                    }}
                    color={isOverdraft ? "secondary" : "primary"}
                  />
                  <CapitalWidget 
                    label="Temporal" 
                    value={isOverdraft ? "OVERDRAFT" : `${residualTime.toFixed(1)} HRS`} 
                    subValue={isOverdraft ? "DAILY RESIDUAL" : "Daily Residual Time"} 
                    icon={<Clock size={18} />}
                    trend={{ 
                      value: isOverdraft ? 'CRITICAL' : (yearsUntilObjective === Infinity ? 'N/A' : `${yearsUntilObjective.toFixed(1)} YRS`), 
                      positive: !isOverdraft && yearsUntilObjective < 20 
                    }}
                    color={isOverdraft ? "secondary" : "neutral"}
                  />
                  <CapitalWidget 
                    label="Emotional" 
                    value={`${currentData.Emotional.toFixed(1)}%`} 
                    subValue="System Health" 
                    icon={<Activity size={18} />}
                    trend={{ value: currentData.Emotional > 60 ? 'STABLE' : 'CRITICAL', positive: currentData.Emotional > 60 }}
                    color={currentData.Emotional > 60 ? "primary" : "secondary"}
                  />
                  <CapitalWidget 
                    label="Relational" 
                    value={`${currentData.Relational.toFixed(1)}%`} 
                    subValue="Harmony Index" 
                    icon={<Users size={18} />}
                    trend={{ value: currentData.Relational > relationalTripwire ? 'STABLE' : 'DEBT', positive: currentData.Relational > relationalTripwire }}
                    color={currentData.Relational > relationalTripwire ? "relational" : "secondary"}
                  />
                  <CapitalWidget 
                    label="Spiritual" 
                    value={`${currentData.Spiritual.toFixed(1)}%`} 
                    subValue="Alignment" 
                    icon={<Sparkles size={18} />}
                    trend={{ value: currentData.Spiritual > spiritualTripwire ? 'ALIGNED' : 'DRIFT', positive: currentData.Spiritual > spiritualTripwire }}
                    color={currentData.Spiritual > spiritualTripwire ? "spiritual" : "secondary"}
                  />
                </motion.div>
              </AnimatePresence>
            </section>

            <section className="border border-outline-variant/10 bg-surface p-5">
              <h3 className="mb-4 text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">
                10-Yr Net Worth (trajectory)
              </h3>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  {(() => {
                    const pts = nwTrajectoryTenYear;
                    const w = 640;
                    const h = 96;
                    const pad = 8;
                    const minV = Math.min(...pts);
                    const maxV = Math.max(...pts, minV + 1e-6);
                    const rng = maxV - minV;
                    const scaleY = (v: number) => h - pad - ((v - minV) / rng) * (h - 2 * pad);
                    const last = Math.max(0, pts.length - 1);
                    const scaleX = (i: number) =>
                      last <= 0 ? pad : pad + (i / last) * (w - 2 * pad);
                    const lineD = pts
                      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
                      .join(' ');
                    const areaD = `M ${scaleX(0).toFixed(2)} ${(h - pad).toFixed(2)} ${pts
                      .map((v, i) => `L ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
                      .join(' ')} L ${scaleX(last).toFixed(2)} ${(h - pad).toFixed(2)} Z`;
                    return (
                      <svg
                        width="100%"
                        height={h}
                        viewBox={`0 0 ${w} ${h}`}
                        className="text-primary"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <path d={areaD} fill="currentColor" className="opacity-[0.12]" />
                        <path
                          d={lineD}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    );
                  })()}
                </div>
                <div className="shrink-0 border-t border-outline-variant/10 pt-3 text-right sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 sm:text-left">
                  <p className="text-[9px] font-headline uppercase tracking-[0.2em] text-on-surface-variant">
                    Projected 10-Year NW
                  </p>
                  <p className="mt-1 font-headline text-xl font-bold text-emerald-500">
                    {formatCurrency(nwTrajectoryTenYear[nwTrajectoryTenYear.length - 1] ?? 0)}
                  </p>
                </div>
              </div>
            </section>

            {/* Success Probability Gauge */}
            <section className="bg-surface p-6 border border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant">Success Probability</span>
                  <span className={cn(
                    "text-2xl font-bold font-mono tracking-tighter",
                    successProbability > 70 ? "text-primary" : successProbability > 40 ? "text-on-surface" : "text-secondary"
                  )}>
                    {successProbability.toFixed(1)}%
                  </span>
                </div>
                <div className="h-10 w-px bg-outline-variant/20 mx-2" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant">Risk Exposure</span>
                  <span className="text-xs font-bold uppercase">
                    {activeStressTestsCount === 0 ? "Minimal" : activeStressTestsCount < 3 ? "Moderate" : "Critical"}
                  </span>
                </div>
              </div>
              <div className="flex-1 max-w-md ml-8 h-2 bg-surface-highest rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${successProbability}%` }}
                  className={cn(
                    "h-full transition-all duration-1000",
                    successProbability > 70 ? "bg-primary" : successProbability > 40 ? "bg-on-surface" : "bg-secondary"
                  )}
                />
              </div>
            </section>

            {/* ACTIVE MARCHING ORDERS */}
            {appState === 'ACTIVE_PROTOCOL' && (
              <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-secondary/5 border-2 border-secondary p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield size={120} className="text-secondary" />
                </div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-secondary text-on-secondary rounded-sm">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h2 className="text-xs font-headline font-bold uppercase tracking-[0.4em] text-secondary">Active Marching Orders</h2>
                    <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Immediate Objective Lockdown // No Deviations Permitted</p>
                  </div>
                </div>

                {(() => {
                  const activeObjective = timelineEvents.find(e => e.status === 'ACTIVE');
                  if (activeObjective) {
                    return (
                      <motion.div 
                        key={activeObjective.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-surface p-6 border border-secondary/30"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-mono text-secondary font-bold uppercase tracking-tighter">Current Target: {activeObjective.name}</span>
                          <span className="text-[10px] font-mono text-on-surface-variant">MONTH_{activeObjective.month.toString().padStart(2, '0')}</span>
                        </div>
                        <h3 className="text-3xl font-headline font-black text-on-surface mb-6 uppercase tracking-tight">
                          {activeObjective.name}
                        </h3>
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="p-3 bg-surface-container border border-outline-variant/10">
                            <p className="text-[9px] text-on-surface-variant uppercase font-headline mb-1">Immediate Cost</p>
                            <p className="text-sm font-bold font-mono text-secondary">{formatCurrency(activeObjective.immediateCost)}</p>
                          </div>
                          <div className="p-3 bg-surface-container border border-outline-variant/10">
                            <p className="text-[9px] text-on-surface-variant uppercase font-headline mb-1">Ongoing Cost</p>
                            <p className="text-sm font-bold font-mono text-on-surface">{formatCurrency(activeObjective.ongoingCost)}/mo</p>
                          </div>
                          <div className="p-3 bg-surface-container border border-outline-variant/10">
                            <p className="text-[9px] text-on-surface-variant uppercase font-headline mb-1">Time Reclaimed</p>
                            <p className="text-sm font-bold font-mono text-primary">+{activeObjective.timeReclaimed}h/day</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleLogCompleted(activeObjective.id)}
                          className="w-full py-4 bg-secondary text-on-secondary font-headline font-black uppercase tracking-[0.2em] hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
                        >
                          [ LOG AS COMPLETED ]
                        </button>
                      </motion.div>
                    );
                  }
                  return (
                    <div className="text-center py-12 border border-dashed border-outline-variant/30">
                      <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">No immediate objectives identified in Critical Path.</p>
                    </div>
                  );
                })()}
              </motion.section>
            )}

            {/* Active Objective Module */}
            <section className="bg-surface p-6 border border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Target size={64} className="text-primary" />
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xs font-headline font-bold uppercase tracking-[0.3em] text-primary">Active Objective</h2>
                  <button 
                    onClick={() => setIsAddingEvent(!isAddingEvent)}
                    className="text-[10px] font-headline uppercase tracking-widest font-bold text-primary hover:text-primary/80 transition-colors flex items-center bg-primary/5 px-2 py-1 border border-primary/20 rounded-sm"
                  >
                    <Zap size={12} className="mr-1" />
                    Inject Timeline Event
                  </button>
                </div>
                <div className="h-px flex-1 bg-primary/10 mx-6" />
                <span className="text-[10px] font-mono text-on-surface-variant">OBJECTIVE_MAPPING_v4.0</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant">Goal Name</label>
                  <input 
                    type="text" 
                    value={goalName || ''}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant/30 rounded-sm py-2 px-3 text-xs font-headline focus:border-primary focus:ring-0 transition-all"
                    placeholder="e.g. MOVE OUT"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant">Target Capital ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">$</span>
                    <input 
                      type="number" 
                      value={targetCapital ?? 0}
                      onChange={(e) => setTargetCapital(Number(e.target.value) || 0)}
                      className="w-full bg-surface-lowest border border-outline-variant/30 rounded-sm py-2 pl-7 pr-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-headline uppercase tracking-widest text-on-surface-variant">Target Timeline (Months)</label>
                  <input 
                    type="number" 
                    value={targetTimeline ?? 12}
                    onChange={(e) => setTargetTimeline(Number(e.target.value) || 0)}
                    className="w-full bg-surface-lowest border border-outline-variant/30 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all"
                  />
                </div>
              </div>

              <AnimatePresence>
                {isAddingEvent && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-surface-container border border-primary/20 rounded-sm space-y-4 mt-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-headline uppercase text-primary tracking-widest font-bold">New Timeline Event</h4>
                        <button onClick={() => setIsAddingEvent(false)} className="text-on-surface-variant hover:text-on-surface">
                          <Settings size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="space-y-1 col-span-2 sm:col-span-1">
                          <label className="text-[9px] uppercase text-on-surface-variant">Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Buy Car"
                            value={newEvent.name || ''}
                            onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-1.5 px-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase text-on-surface-variant">Month</label>
                          <input 
                            type="number" min="1" max="12"
                            value={newEvent.month ?? 1}
                            onChange={(e) => setNewEvent({...newEvent, month: Number(e.target.value) || 0})}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-1.5 px-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase text-on-surface-variant">Immediate $</label>
                          <input 
                            type="number"
                            value={newEvent.immediateCost ?? 0}
                            onChange={(e) => setNewEvent({...newEvent, immediateCost: Number(e.target.value) || 0})}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-1.5 px-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase text-on-surface-variant">Monthly $</label>
                          <input 
                            type="number"
                            value={newEvent.ongoingCost ?? 0}
                            onChange={(e) => setNewEvent({...newEvent, ongoingCost: Number(e.target.value) || 0})}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-1.5 px-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase text-on-surface-variant">Time Rec (H)</label>
                          <input 
                            type="number" step="0.5"
                            value={newEvent.timeReclaimed ?? 0}
                            onChange={(e) => setNewEvent({...newEvent, timeReclaimed: Number(e.target.value) || 0})}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-1.5 px-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (!newEvent.name) return;
                          setTimelineEvents([...timelineEvents, { ...newEvent, id: Math.random().toString(36).substr(2, 9) }]);
                          setNewEvent({ name: '', month: 1, immediateCost: 0, ongoingCost: 0, timeReclaimed: 0, relationalImpact: 0, spiritualImpact: 0 });
                          setIsAddingEvent(false);
                        }}
                        className="w-full py-2 bg-primary text-surface-lowest text-[10px] font-headline uppercase tracking-widest font-bold hover:bg-primary/90 transition-colors"
                      >
                        Inject Event into Timeline
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {timelineEvents.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-outline-variant/10">
                  {timelineEvents.map(event => (
                    <div key={event.id} className={cn("flex items-center border px-2 py-1 rounded-sm group", event.status === 'FAILED' ? "bg-secondary/10 border-secondary/30" : event.status === 'COMPLETED' ? "bg-primary/10 border-primary/30" : "bg-surface-lowest border-outline-variant/20")}>
                      <span className={cn("text-[9px] font-mono mr-2", event.status === 'FAILED' ? "text-secondary" : "text-primary")}>M{event.month}</span>
                      <span className={cn("text-[9px] font-bold uppercase mr-2", event.status === 'FAILED' ? "text-secondary line-through" : event.status === 'COMPLETED' ? "text-primary" : "text-on-surface")}>{event.name}</span>
                      {event.status !== 'FAILED' && event.status !== 'COMPLETED' && (
                        <button 
                          onClick={() => setTimelineEvents(timelineEvents.filter(e => e.id !== event.id))}
                          className="text-on-surface-variant hover:text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Settings size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active Simulation View */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-headline font-bold text-on-surface tracking-tight">Path Simulations</h2>
                  <span className="text-[10px] font-headline uppercase tracking-widest py-1 px-2 bg-surface-container border border-outline-variant/20 text-on-surface-variant">Active Comparison</span>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 bg-surface-container border border-outline-variant/30 hover:border-primary/50 transition-colors">
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <SimulationCard 
                  title={conservativePathName}
                  onTitleChange={setConservativePathName}
                  variance="4.2%"
                  description="Focus on capital preservation and deterministic wealth accumulation with low volatility overhead. Prioritizes long-term stability over rapid scaling."
                  emotionalTax={2.5 * (conservativeHalal ? 1 : 2.5)}
                  burnout={2.5 * (conservativeHalal ? 1 : 2.5) > 7 ? "CRITICAL" : "LOW"}
                  timeFreedom="HIGH"
                  wealthCeiling="FIXED"
                  type="conservative"
                  active={activePath === 'conservative'}
                  onClick={() => setActivePath('conservative')}
                  halalAligned={conservativeHalal}
                  onHalalToggle={() => setConservativeHalal(!conservativeHalal)}
                  targetReadout={activePath === 'conservative' ? (monthsToTarget === -1 ? "Target Unreachable on Current Path" : `Estimated time to reach target: ${monthsToTarget} Months`) : undefined}
                />
                <SimulationCard 
                  title={aggressivePathName}
                  onTitleChange={setAggressivePathName}
                  variance="18.7%"
                  description="High-leverage resource allocation focusing on exponential scale and rapid equity accumulation. High risk of burnout and temporal depletion."
                  emotionalTax={Math.min(10, 8.2 * (aggressiveHalal ? 1 : 2.5))}
                  burnout={8.2 * (aggressiveHalal ? 1 : 2.5) > 7 ? "CRITICAL" : "MEDIUM"}
                  timeFreedom="MINIMAL"
                  wealthCeiling="UNCAPPED"
                  type="aggressive"
                  active={activePath === 'aggressive'}
                  onClick={() => setActivePath('aggressive')}
                  halalAligned={aggressiveHalal}
                  onHalalToggle={() => setAggressiveHalal(!aggressiveHalal)}
                  targetReadout={activePath === 'aggressive' ? (monthsToTarget === -1 ? "Target Unreachable on Current Path" : `Estimated time to reach target: ${monthsToTarget} Months`) : undefined}
                />
              </div>
            </section>

            {/* Secondary Analytics Row */}
            {/* Equilibrium Radar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-surface p-6 border border-outline-variant/10 flex flex-col items-center">
                <h3 className="text-xs font-headline uppercase tracking-widest font-bold mb-6 self-start">Equilibrium Matrix</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                      { subject: 'Wealth', A: sanitizeNum((currentData.Financial / (sanitizeNum(targetCapital, 1))) * 100), fullMark: 100 },
                      { subject: 'Health', A: sanitizeNum(currentData.Emotional), fullMark: 100 },
                      { subject: 'Time', A: sanitizeNum(Math.min(100, (residualTime / 8) * 100)), fullMark: 100 },
                      { subject: 'Relations', A: sanitizeNum(currentData.Relational), fullMark: 100 },
                      { subject: 'Spirit', A: sanitizeNum(currentData.Spiritual), fullMark: 100 },
                    ]}>
                      <PolarGrid stroke="#2a2a2a" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Capital Balance"
                        dataKey="A"
                        stroke={(() => {
                          const data = [
                            sanitizeNum((currentData.Financial / (sanitizeNum(targetCapital, 1))) * 100),
                            sanitizeNum(currentData.Emotional),
                            sanitizeNum((residualTime / 8) * 100),
                            sanitizeNum(currentData.Relational),
                            sanitizeNum(currentData.Spiritual)
                          ];
                          const isSkewed = data.some(v => v < 30);
                          return isSkewed ? "#f27d26" : "#4be277";
                        })()}
                        fill={(() => {
                          const data = [
                            sanitizeNum((currentData.Financial / (sanitizeNum(targetCapital, 1))) * 100),
                            sanitizeNum(currentData.Emotional),
                            sanitizeNum((residualTime / 8) * 100),
                            sanitizeNum(currentData.Relational),
                            sanitizeNum(currentData.Spiritual)
                          ];
                          const isSkewed = data.some(v => v < 30);
                          return isSkewed ? "#f27d26" : "#4be277";
                        })()}
                        fillOpacity={0.4}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 w-full">
                  <div className="p-2 bg-surface-lowest border border-outline-variant/10">
                    <p className="text-[8px] text-on-surface-variant uppercase font-headline">Relational Decay</p>
                    <p className={cn("text-[10px] font-mono font-bold", currentData.Relational < relationalTripwire ? "text-secondary" : "text-primary")}>
                      {currentData.Relational < 100 ? `-${(100 - currentData.Relational).toFixed(1)}%` : 'STABLE'}
                    </p>
                  </div>
                  <div className="p-2 bg-surface-lowest border border-outline-variant/10">
                    <p className="text-[8px] text-on-surface-variant uppercase font-headline">Spiritual Alignment</p>
                    <p className={cn("text-[10px] font-mono font-bold", currentData.Spiritual < spiritualTripwire ? "text-secondary" : "text-primary")}>
                      {currentData.Spiritual < 100 ? `${currentData.Spiritual.toFixed(1)}%` : 'OPTIMAL'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-surface p-6 border border-outline-variant/10">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex flex-col">
                    <h3 className="text-xs font-headline uppercase tracking-widest font-bold">Capital Growth vs Energy Depletion</h3>
                    <p className="text-[9px] font-mono text-on-surface-variant/50 uppercase mt-1">Simulation Matrix // Reality Overlay</p>
                  </div>
                  <div className="flex items-center gap-6">
                    {appState === 'ACTIVE_PROTOCOL' && (
                      <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-lowest border border-outline-variant/10">
                        <span className="text-[9px] font-mono text-on-surface-variant uppercase">System Drift:</span>
                        {(() => {
                          const currentData = chartData[currentSimulationMonth];
                          if (!currentData || currentData.ActualFinancial === undefined) return <span className="text-[10px] font-mono text-on-surface-variant">N/A</span>;
                          
                          const variance = ((currentData.ActualFinancial - currentData.Financial) / currentData.Financial) * 100;
                          const isCritical = Math.abs(variance) > 5;
                          
                          return (
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-mono font-bold",
                                isCritical ? "text-secondary animate-pulse" : "text-primary"
                              )}>
                                {variance > 0 ? '+' : ''}{variance.toFixed(2)}%
                              </span>
                              {isCritical && (
                                <div className="flex items-center gap-1 bg-secondary/20 px-1.5 py-0.5 rounded-xs">
                                  <AlertTriangle size={8} className="text-secondary" />
                                  <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">Drift Critical</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary" />
                        <span className="text-[9px] font-headline text-on-surface-variant uppercase">Financial</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-secondary" />
                        <span className="text-[9px] font-headline text-on-surface-variant uppercase">Emotional</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#00ffff]" />
                        <span className="text-[9px] font-headline text-on-surface-variant uppercase">Actual</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2a" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#888', fontSize: 10, fontFamily: 'Inter' }} 
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="financial"
                        axisLine={false} 
                        tickLine={false} 
                        tick={false} 
                        domain={[0, Math.max(1, sanitizeNum(targetCapital) * 1.2, sanitizeNum(initialNetWorth) * 1.5)]}
                      />
                      <YAxis 
                        yAxisId="emotional"
                        orientation="right"
                        axisLine={false} 
                        tickLine={false} 
                        tick={false} 
                        domain={[0, 100]}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine 
                        yAxisId="financial"
                        y={sanitizeNum(targetCapital)} 
                        stroke="#4be277" 
                        strokeDasharray="3 3" 
                        strokeOpacity={0.5}
                        label={{ value: 'TARGET', position: 'right', fill: '#4be277', fontSize: 8, fontFamily: 'Inter', fontWeight: 'bold' }} 
                      />
                      <ReferenceLine 
                        yAxisId="emotional"
                        y={sanitizeNum(healthRedline)} 
                        stroke="#ff4444" 
                        strokeWidth={2} 
                        strokeOpacity={0.8}
                        label={{ value: 'REDLINE', position: 'left', fill: '#ff4444', fontSize: 8, fontFamily: 'Inter', fontWeight: 'bold' }} 
                      />
                      {chartData[Math.min(sanitizeNum(targetTimeline), 12)]?.name && (
                        <ReferenceLine 
                          x={chartData[Math.min(sanitizeNum(targetTimeline), 12)].name} 
                          stroke="#ffb690" 
                          strokeDasharray="3 3" 
                          strokeOpacity={0.5}
                          label={{ value: 'TIMELINE', position: 'top', fill: '#ffb690', fontSize: 8, fontFamily: 'Inter', fontWeight: 'bold' }} 
                        />
                      )}
                      {timelineEvents.map(event => {
                        const xName = chartData[sanitizeNum(event.month)]?.name;
                        if (!xName) return null;
                        const statusColor = event.status === 'FAILED' ? '#ff4444' : event.status === 'COMPLETED' ? '#4be277' : event.status === 'ACTIVE' ? '#f27d26' : '#a1a1aa';
                        return (
                          <ReferenceLine 
                            key={event.id}
                            x={xName}
                            stroke={statusColor}
                            strokeOpacity={0.3}
                            label={{ value: event.name, position: 'insideTopLeft', fill: statusColor, fontSize: 7, fontFamily: 'Inter', fontWeight: 'bold' }}
                          />
                        );
                      })}
                      <Line 
                        yAxisId="financial"
                        type="monotone" 
                        dataKey="Financial" 
                        stroke="#4be277" 
                        strokeWidth={2} 
                        dot={false} 
                        activeDot={{ r: 4, strokeWidth: 0 }} 
                        name="Financial"
                      />
                      <Line 
                        yAxisId="financial"
                        type="monotone" 
                        dataKey="ActualFinancial" 
                        stroke="#00ffff" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: '#00ffff', strokeWidth: 0 }} 
                        activeDot={{ r: 5, strokeWidth: 0 }} 
                        name="Actual Reality (Wealth)"
                        connectNulls
                      />
                      {simulationResults && (
                        <>
                          <Line 
                            yAxisId="financial"
                            type="monotone" 
                            data={simulationResults.pessimistic.map(row => ({ ...row, Financial: sanitizeNum(row.Financial) }))}
                            dataKey="Financial" 
                            stroke="#ff4444" 
                            strokeWidth={1} 
                            strokeDasharray="5 5"
                            dot={false} 
                            name="Pessimistic"
                            opacity={0.4}
                          />
                          <Line 
                            yAxisId="financial"
                            type="monotone" 
                            data={simulationResults.optimistic.map(row => ({ ...row, Financial: sanitizeNum(row.Financial) }))}
                            dataKey="Financial" 
                            stroke="#4be277" 
                            strokeWidth={1} 
                            strokeDasharray="5 5"
                            dot={false} 
                            name="Optimistic"
                            opacity={0.4}
                          />
                        </>
                      )}
                      <Line 
                        yAxisId="emotional"
                        type="monotone" 
                        dataKey="Emotional" 
                        stroke="#ffb690" 
                        strokeWidth={2} 
                        dot={false} 
                        activeDot={{ r: 4, strokeWidth: 0 }} 
                        name="Emotional"
                      />
                      <Line 
                        yAxisId="emotional"
                        type="monotone" 
                        dataKey="ActualEmotional" 
                        stroke="#ffffff" 
                        strokeWidth={2} 
                        strokeDasharray="3 3"
                        dot={false} 
                        activeDot={{ r: 4, strokeWidth: 0 }} 
                        name="Actual Reality (Health)"
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Telemetry Input Module */}
                {appState === 'ACTIVE_PROTOCOL' && (
                  <div className="mt-8 pt-6 border-t border-outline-variant/10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Terminal size={14} className="text-primary" />
                        <h3 className="text-[10px] font-headline uppercase tracking-widest font-bold">Telemetry Input</h3>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-on-surface-variant uppercase">Current Month:</span>
                          <select 
                            value={currentSimulationMonth ?? 1}
                            onChange={(e) => setCurrentSimulationMonth(Number(e.target.value) || 0)}
                            className="bg-surface-lowest border border-outline-variant/20 text-[10px] font-mono text-primary px-2 py-0.5 focus:outline-none"
                          >
                            {Array.from({ length: targetTimeline }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>M{m.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] uppercase text-on-surface-variant font-bold">Category</label>
                        <select 
                          id="telemetry-category"
                          className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-[10px] font-mono focus:border-primary focus:ring-0"
                        >
                          <option value="Expense">Expense ($)</option>
                          <option value="Time Investment">Time Investment (H)</option>
                          <option value="Time Wasted">Time Wasted (H)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] uppercase text-on-surface-variant font-bold">Amount</label>
                        <input 
                          id="telemetry-amount"
                          type="number" 
                          placeholder="0.00"
                          className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-[10px] font-mono focus:border-primary focus:ring-0" 
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[8px] uppercase text-on-surface-variant font-bold">Description</label>
                        <div className="flex gap-2">
                          <input 
                            id="telemetry-desc"
                            type="text" 
                            placeholder="e.g. Uber Eats, Studied Python"
                            className="flex-1 bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-[10px] font-mono focus:border-primary focus:ring-0" 
                          />
                          <button 
                            onClick={() => {
                              const cat = (document.getElementById('telemetry-category') as HTMLSelectElement).value as TelemetryCategory;
                              const amt = Number((document.getElementById('telemetry-amount') as HTMLInputElement).value);
                              const desc = (document.getElementById('telemetry-desc') as HTMLInputElement).value;
                              
                              if (!amt || !desc) return;

                              const entry: TelemetryEntry = {
                                id: Math.random().toString(36).substr(2, 9),
                                timestamp: Date.now(),
                                category: cat,
                                amount: amt,
                                description: desc,
                                month: currentSimulationMonth
                              };

                              setDailyTelemetry([...dailyTelemetry, entry]);
                              addTerminalLog(`TELEMETRY LOGGED: ${cat.toUpperCase()} - ${amt}${cat === 'Expense' ? '$' : 'H'} [${desc}]`);
                              
                              // Reset inputs
                              (document.getElementById('telemetry-amount') as HTMLInputElement).value = '';
                              (document.getElementById('telemetry-desc') as HTMLInputElement).value = '';
                            }}
                            className="px-4 bg-primary text-surface-lowest text-[10px] font-headline uppercase tracking-widest font-bold hover:bg-primary/90 transition-colors"
                          >
                            Log Entry
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Ledger */}
                    <div className="mt-6 space-y-2 max-h-40 overflow-y-auto terminal-scroll pr-2">
                      {dailyTelemetry.filter(t => t.month === currentSimulationMonth).sort((a, b) => b.timestamp - a.timestamp).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-outline-variant/5 group">
                          <div className="flex items-center gap-4">
                            <span className="text-[8px] font-mono text-on-surface-variant">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-xs",
                              entry.category === 'Expense' ? "bg-secondary/10 text-secondary" : 
                              entry.category === 'Time Investment' ? "bg-primary/10 text-primary" : "bg-surface-highest text-on-surface-variant"
                            )}>
                              {entry.category}
                            </span>
                            <span className="text-[10px] font-mono text-on-surface">{entry.description}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-mono font-bold">
                              {entry.category === 'Expense' ? '-' : ''}{entry.amount}{entry.category === 'Expense' ? '$' : 'H'}
                            </span>
                            <button 
                              onClick={() => setDailyTelemetry(dailyTelemetry.filter(t => t.id !== entry.id))}
                              className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Settings size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-surface p-6 border border-outline-variant/10 space-y-6">
                <h3 className="text-xs font-headline uppercase tracking-widest font-bold flex items-center">
                  <CheckCircle2 size={14} className="mr-2 text-primary" />
                  Growth Multipliers
                </h3>
                <div className="space-y-4">
                  {[
                    { label: `Reading (${readingLearningTime}hr/day)`, impact: `+${readingLearningTime * 4}% Health`, progress: (readingLearningTime / 3) * 100 },
                    { label: `Skill Study (${skillStudyTime}hr blocks)`, impact: `+${(skillStudyTime * 6).toFixed(0)}% Yield`, progress: (skillStudyTime / 4) * 100 },
                    { label: 'Halal Alignment', impact: isHalal ? '+20% Peace' : '-250% Stability', progress: isHalal ? 100 : 10 },
                  ].map((item) => (
                    <div key={item.label} className="p-3 bg-surface-lowest border border-outline-variant/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase">{item.label}</span>
                        <span className={cn("text-[10px]", item.impact.includes('-') ? "text-secondary" : "text-primary")}>{item.impact}</span>
                      </div>
                      <div className="w-full bg-surface-highest h-1">
                        <div className={cn("h-full transition-all duration-500", item.impact.includes('-') ? "bg-secondary" : "bg-primary")} style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tactical Critical Path */}
            <section className={cn(
              "bg-surface p-6 border transition-all duration-500 relative",
              isTripwireTriggered ? "border-secondary shadow-[0_0_20px_rgba(255,68,68,0.1)]" : "border-outline-variant/10"
            )}>
              {isTripwireTriggered && (
                <div className="absolute top-0 left-0 w-full h-1 bg-secondary animate-pulse" />
              )}
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xs font-headline font-bold uppercase tracking-[0.3em] text-on-surface-variant">Tactical Critical Path</h2>
                  <p className="text-[9px] font-mono text-on-surface-variant/50 uppercase tracking-widest">Milestone Projection Matrix // Active Path: {activePath === 'conservative' ? conservativePathName : aggressivePathName}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "px-3 py-2 text-[10px] font-mono border flex flex-col gap-1",
                    primaryVulnerability.risk === 'CRITICAL' ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-primary/10 text-primary border-primary/20"
                  )}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="opacity-50">VULNERABILITY:</span>
                      <span className="font-bold">{primaryVulnerability.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="opacity-50">PROTOCOL:</span>
                      <span className="font-bold">{primaryVulnerability.protocol}</span>
                    </div>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-[9px] font-mono text-on-surface-variant">LOG_STREAM_v5.2</p>
                    <p className="text-[9px] font-mono text-primary">{new Date().toISOString().split('T')[0]} // {new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto terminal-scroll pb-4">
                <div className="flex gap-4 min-w-max">
                  {pathMilestones.map((milestone) => (
                    <div key={milestone.month} className={cn(
                      "w-56 bg-surface-lowest border p-4 font-mono text-[10px] transition-colors",
                      milestone.emotional < healthRedline ? "border-secondary/30 bg-secondary/5" : "border-outline-variant/10"
                    )}>
                      <div className="flex justify-between items-center mb-3 border-b border-outline-variant/10 pb-2">
                        <span className={milestone.emotional < healthRedline ? "text-secondary" : "text-primary"}>
                          M_{milestone.month.toString().padStart(2, '0')}
                        </span>
                        {milestone.emotional < healthRedline && (
                          <span className="text-[8px] text-secondary animate-pulse font-bold">BREACH</span>
                        )}
                        <span className="text-[8px] text-on-surface-variant">CHECKPOINT</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[8px] text-on-surface-variant uppercase mb-1">Financial Target</p>
                            <p className="text-on-surface font-bold text-xs">{formatCurrency(milestone.financial)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-on-surface-variant uppercase mb-1">Velocity</p>
                            <p className="text-primary font-bold">+{((monthlyNetChange / initialNetWorth) * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[8px] text-on-surface-variant uppercase">System Health</p>
                            <p className={cn(
                              "font-bold",
                              milestone.emotional < healthRedline ? "text-secondary" : "text-primary"
                            )}>
                              {milestone.emotional.toFixed(1)}%
                            </p>
                          </div>
                          <div className={cn(
                            "h-1 w-full bg-surface-highest",
                            milestone.emotional < healthRedline ? "bg-secondary/20" : "bg-primary/20"
                          )}>
                            <div 
                              className={cn("h-full transition-all duration-1000", milestone.emotional < healthRedline ? "bg-secondary" : "bg-primary")} 
                              style={{ width: `${milestone.emotional}%` }} 
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-outline-variant/5 flex justify-between items-center">
                          <span className="text-[8px] text-on-surface-variant uppercase">Status</span>
                          <span className={cn(
                            "text-[8px] font-bold uppercase",
                            milestone.emotional < healthRedline ? "text-secondary" : "text-primary"
                          )}>
                            {milestone.emotional < healthRedline ? "Degraded" : "Optimal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {monthsToTarget === -1 && (
                    <div className="flex-1 flex items-center justify-center p-8 border border-dashed border-secondary/30 text-secondary font-mono text-xs uppercase tracking-widest">
                      <AlertTriangle size={16} className="mr-3" />
                      Critical Path Blocked: Insufficient Growth Velocity
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Terminal Logs Feed */}
            <section className="bg-surface-highest/50 border border-outline-variant/10 p-4 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <Terminal size={12} className="text-primary" />
                  <span className="text-primary font-bold uppercase tracking-widest">System Terminal Output</span>
                </div>
                <span className="text-on-surface-variant/50 uppercase">Active Feed // {terminalLogs.length} Entries</span>
              </div>
              <div className="max-h-40 overflow-y-auto terminal-scroll space-y-1">
                {terminalLogs.length === 0 ? (
                  <p className="text-on-surface-variant/30 italic">No active logs in buffer.</p>
                ) : (
                  terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-4">
                      <span className="text-primary opacity-50 whitespace-nowrap">{log.split(']')[0]}]</span>
                      <span className="text-on-surface-variant break-all">{log.split(']')[1]}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Variable Input Sidebar */}
          <div className="group absolute right-4 top-24 bottom-24 w-12 hover:w-80 transition-all duration-500 ease-in-out overflow-hidden border-[0.5px] border-white/5 bg-neutral-900/60 backdrop-blur-md flex flex-col h-auto z-40 rounded-2xl">
            <div className="p-6 border-b border-outline-variant/10">
              <h3 className="text-xs font-headline uppercase tracking-widest font-bold flex items-center">
                <Terminal size={14} className="mr-2 text-primary" />
                Variable Input
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto terminal-scroll p-6 space-y-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {/* Genesis State */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-headline uppercase text-primary tracking-widest font-bold">Genesis State</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase text-on-surface-variant">Liquid Cash</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant">$</span>
                      <input 
                        type="number" 
                        value={currentCash ?? 0} 
                        onChange={(e) => setCurrentCash(Number(e.target.value) || 0)}
                        className="w-full bg-surface-container border border-outline-variant/20 rounded-sm py-1.5 pl-5 pr-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase text-on-surface-variant">Current Debt</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant">$</span>
                      <input 
                        type="number" 
                        value={currentDebt ?? 0} 
                        onChange={(e) => setCurrentDebt(Number(e.target.value) || 0)}
                        className="w-full bg-surface-container border border-outline-variant/20 rounded-sm py-1.5 pl-5 pr-2 text-[10px] font-mono focus:border-primary focus:ring-0" 
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-on-surface-variant">Base Monthly Income</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">$</span>
                    <input 
                      type="number" 
                      value={baseMonthlyIncome ?? 0} 
                      onChange={(e) => setBaseMonthlyIncome(Number(e.target.value) || 0)}
                      className="w-full bg-surface-container border border-outline-variant/20 rounded-sm py-2 pl-7 pr-3 text-xs font-mono focus:border-primary focus:ring-0" 
                    />
                  </div>
                </div>
              </section>

              {/* Temporal Capital Monitor */}
              <div className={cn(
                "p-4 rounded-sm border transition-all duration-500",
                isOverdraft ? "bg-secondary/10 border-secondary/30" : "bg-surface-container border-outline-variant/10"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center text-on-surface-variant">
                    <Clock size={14} className="mr-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Temporal Capital</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs",
                    isOverdraft ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
                  )}>
                    {isOverdraft ? "OVERDRAFT" : "STABLE"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className={cn(
                    "text-2xl font-bold font-mono tracking-tighter",
                    isOverdraft ? "text-secondary" : "text-on-surface"
                  )}>
                    {isOverdraft ? "CRITICAL" : `${residualTime.toFixed(1)}h`}
                  </span>
                  <span className="text-[10px] text-on-surface-variant uppercase">Residual / Day</span>
                </div>
                <div className="mt-3 h-1 w-full bg-surface-highest overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      isOverdraft ? "bg-secondary" : "bg-primary"
                    )} 
                    style={{ width: `${Math.max(0, Math.min(100, (residualTime / 24) * 100))}%` }} 
                  />
                </div>
                {isOverdraft && (
                  <p className="mt-2 text-[8px] text-secondary font-bold uppercase animate-pulse">
                    Warning: Allocation exceeds 24h limit. System flatlined.
                  </p>
                )}
              </div>

              {/* Financial Inputs */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-headline uppercase text-on-surface-variant tracking-widest">Financial Parameters</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-surface-container border border-outline-variant/10 rounded-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-headline uppercase text-on-surface-variant">Total Monthly Expenses</span>
                      <span className="text-[10px] font-mono font-bold text-secondary">{formatCurrency(totalMonthlyBurnRate)}/MO</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-headline uppercase text-on-surface-variant">Net Monthly Yield</span>
                      <span className={cn(
                        "text-[10px] font-mono font-bold",
                        netMonthlyYield < 0 ? "text-secondary animate-pulse" : "text-primary"
                      )}>
                        {formatCurrency(netMonthlyYield)}/MO
                      </span>
                    </div>
                    <p className="text-[8px] text-on-surface-variant italic leading-tight pt-1 border-t border-outline-variant/5">
                      Adjust granular expenses in the Genesis Node Inspector.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-on-surface-variant">Investment Yield (%)</label>
                    <input 
                      type="number" 
                      value={investmentYield} 
                      onChange={(e) => setInvestmentYield(Number(e.target.value) || 0)}
                      className="w-full bg-surface-container border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0" 
                    />
                  </div>
                </div>
              </section>

              {/* Category 1: Non-Negotiables */}
              <section className="border border-outline-variant/10 rounded-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('cat1')}
                  className="w-full flex items-center justify-between p-3 bg-surface-container hover:bg-surface-highest transition-colors"
                >
                  <h4 className="text-[10px] font-headline uppercase text-on-surface tracking-widest font-bold">1. Non-Negotiables</h4>
                  <ChevronRight size={14} className={cn("transition-transform", expandedSections.includes('cat1') && "rotate-90")} />
                </button>
                {expandedSections.includes('cat1') && (
                  <div className="p-4 space-y-4 bg-surface/50">
                    <div className="flex items-center justify-between p-2 bg-surface-container border border-outline-variant/10 rounded-sm">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">5x Daily Salah</span>
                        <span className="text-[8px] text-on-surface-variant uppercase">Fixed: 1.0 Hr</span>
                      </div>
                      <div 
                        onClick={() => setSalahActive(!salahActive)}
                        className={cn(
                          "w-8 h-4 rounded-full relative cursor-pointer transition-colors",
                          salahActive ? "bg-primary/20" : "bg-surface-highest"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full transition-all",
                          salahActive ? "right-0.5 bg-primary" : "left-0.5 bg-on-surface-variant"
                        )} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Family Obligations</label>
                        <span className="text-[10px] font-mono text-primary">{familyTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="4" step="0.5" value={familyTime ?? 0} 
                        onChange={(e) => setFamilyTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Category 2: Maintenance Costs */}
              <section className="border border-outline-variant/10 rounded-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('cat2')}
                  className="w-full flex items-center justify-between p-3 bg-surface-container hover:bg-surface-highest transition-colors"
                >
                  <h4 className="text-[10px] font-headline uppercase text-on-surface tracking-widest font-bold">2. Maintenance Costs</h4>
                  <ChevronRight size={14} className={cn("transition-transform", expandedSections.includes('cat2') && "rotate-90")} />
                </button>
                {expandedSections.includes('cat2') && (
                  <div className="p-4 space-y-4 bg-surface/50">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Sleep Duration</label>
                        <span className={cn("text-[10px] font-mono", sleepTime < 6 ? "text-secondary" : "text-primary")}>{sleepTime}H</span>
                      </div>
                      <input 
                        type="range" min="4" max="10" step="0.5" value={sleepTime ?? 8} 
                        onChange={(e) => setSleepTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Commuting</label>
                        <span className="text-[10px] font-mono text-primary">{commutingTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="3" step="0.5" value={commutingTime ?? 0} 
                        onChange={(e) => setCommutingTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Hygiene & Meals</label>
                        <span className="text-[10px] font-mono text-primary">{hygieneMealsTime}H</span>
                      </div>
                      <input 
                        type="range" min="1" max="3" step="0.5" value={hygieneMealsTime ?? 2} 
                        onChange={(e) => setHygieneMealsTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Category 3: Investment Variables */}
              <section className="border border-outline-variant/10 rounded-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('cat3')}
                  className="w-full flex items-center justify-between p-3 bg-surface-container hover:bg-surface-highest transition-colors"
                >
                  <h4 className="text-[10px] font-headline uppercase text-on-surface tracking-widest font-bold">3. Investment Variables</h4>
                  <ChevronRight size={14} className={cn("transition-transform", expandedSections.includes('cat3') && "rotate-90")} />
                </button>
                {expandedSections.includes('cat3') && (
                  <div className="p-4 space-y-4 bg-surface/50">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">High-Income Skill Study</label>
                        <span className="text-[10px] font-mono text-primary">{skillStudyTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="4" step="0.5" value={skillStudyTime ?? 0} 
                        onChange={(e) => setSkillStudyTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Reading / Learning</label>
                        <span className="text-[10px] font-mono text-primary">{readingLearningTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="3" step="0.5" value={readingLearningTime ?? 0} 
                        onChange={(e) => setReadingLearningTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Fitness / Gym</label>
                        <span className="text-[10px] font-mono text-primary">{fitnessGymTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="2" step="0.5" value={fitnessGymTime ?? 0} 
                        onChange={(e) => setFitnessGymTime(Number(e.target.value) || 0)}
                        className="w-full accent-primary" 
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Category 4: System Entropy */}
              <section className="border border-outline-variant/10 rounded-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('cat4')}
                  className="w-full flex items-center justify-between p-3 bg-surface-container hover:bg-surface-highest transition-colors"
                >
                  <h4 className="text-[10px] font-headline uppercase text-on-surface tracking-widest font-bold">4. System Entropy</h4>
                  <ChevronRight size={14} className={cn("transition-transform", expandedSections.includes('cat4') && "rotate-90")} />
                </button>
                {expandedSections.includes('cat4') && (
                  <div className="p-4 space-y-4 bg-surface/50">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Social Media / Doomscrolling</label>
                        <span className={cn("text-[10px] font-mono", socialMediaTime > 2 ? "text-secondary" : "text-primary")}>{socialMediaTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="5" step="0.5" value={socialMediaTime ?? 0} 
                        onChange={(e) => setSocialMediaTime(Number(e.target.value) || 0)}
                        className="w-full accent-secondary" 
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-[10px] uppercase text-on-surface-variant">Mindless Entertainment</label>
                        <span className={cn("text-[10px] font-mono", entertainmentTime > 2 ? "text-secondary" : "text-primary")}>{entertainmentTime}H</span>
                      </div>
                      <input 
                        type="range" min="0" max="4" step="0.5" value={entertainmentTime ?? 0} 
                        onChange={(e) => setEntertainmentTime(Number(e.target.value) || 0)}
                        className="w-full accent-secondary" 
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* System Redlines */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-headline uppercase text-on-surface-variant tracking-widest">System Redlines</h4>
                <div className="p-3 bg-surface-container border border-secondary/20 rounded-sm space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] uppercase text-secondary font-bold">
                      <span>Health Tripwire</span>
                      <span>{healthRedline ?? 20}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={healthRedline ?? 20} 
                      onChange={(e) => setHealthRedline(Number(e.target.value) || 0)}
                      className="w-full accent-secondary" 
                    />
                    <p className="text-[8px] text-on-surface-variant leading-tight">
                      System health threshold for PIVOT PROTOCOL activation.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] uppercase text-secondary font-bold">
                      <span>Relational Tripwire</span>
                      <span>{relationalTripwire ?? 30}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={relationalTripwire ?? 30} 
                      onChange={(e) => setRelationalTripwire(Number(e.target.value) || 0)}
                      className="w-full accent-secondary" 
                    />
                    <p className="text-[8px] text-on-surface-variant leading-tight">
                      Threshold for Relational Capital crisis.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] uppercase text-secondary font-bold">
                      <span>Spiritual Tripwire</span>
                      <span>{spiritualTripwire ?? 30}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={spiritualTripwire ?? 30} 
                      onChange={(e) => setSpiritualTripwire(Number(e.target.value) || 0)}
                      className="w-full accent-secondary" 
                    />
                    <p className="text-[8px] text-on-surface-variant leading-tight">
                      Threshold for Spiritual Alignment drift.
                    </p>
                  </div>
                </div>
              </section>

              {/* Stress Test */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-headline uppercase text-on-surface-variant tracking-widest">Scenario Stress Test</h4>
                <div className="space-y-2">
                  {[
                    { id: 'marketVolatility', label: 'Market Volatility' },
                    { id: 'incomeDisruption', label: 'Income Disruption' },
                    { id: 'inflationSpike', label: 'Inflation Spike' },
                    { id: 'burnoutEvent', label: 'Burnout Event' }
                  ].map((item) => (
                    <label key={item.id} className="flex items-center justify-between group cursor-pointer p-1 hover:bg-surface-container transition-colors">
                      <span className="text-xs text-on-surface-variant group-hover:text-on-surface">{item.label}</span>
                      <input 
                        type="checkbox" 
                        checked={stressTests[item.id as keyof typeof stressTests]}
                        onChange={(e) => setStressTests(prev => ({ ...prev, [item.id]: e.target.checked }))}
                        className="rounded-sm bg-surface-highest border-outline-variant text-primary focus:ring-0" 
                      />
                    </label>
                  ))}
                </div>
              </section>

              {/* Snapshots */}
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-headline uppercase text-primary tracking-widest font-bold">Snapshots</h4>
                  <button 
                    onClick={() => saveSnapshot('')}
                    className="text-[9px] font-bold uppercase text-primary hover:text-primary/80"
                  >
                    Save Current
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto terminal-scroll pr-2">
                  {snapshots.length === 0 && (
                    <p className="text-[9px] text-on-surface-variant italic">No snapshots saved.</p>
                  )}
                  {snapshots.map(s => (
                    <div key={s.id} className="p-2 bg-surface-container border border-outline-variant/10 flex justify-between items-center group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase">{s.name}</span>
                        <span className="text-[8px] text-on-surface-variant">{s.timestamp}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => loadSnapshot(s)} className="text-[9px] text-primary font-bold uppercase">Load</button>
                        <button onClick={() => setSnapshots(snapshots.filter(x => x.id !== s.id))} className="text-[9px] text-secondary font-bold uppercase">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-outline-variant/10">
              <button 
                onClick={handleRecalculate}
                disabled={isCalculating}
                className={cn(
                  "w-full py-3 bg-primary text-on-primary font-headline font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98]",
                  isCalculating && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCalculating ? "Processing..." : "Recalculate Path"}
              </button>
            </div>
          </div>
        </>
        ) : (
        <CanvasView 
          initialCash={currentCash}
          initialDebt={currentDebt}
          baseMonthlyIncome={baseMonthlyIncome}
          setInitialCash={handleUpdateInitialCash}
          setInitialDebt={handleUpdateInitialDebt}
          setBaseMonthlyIncome={handleUpdateBaseMonthlyIncome}
          initialHealth={initialSystemHealth}
          timelineEvents={timelineEvents}
          targetCapital={targetCapital}
          setTargetCapital={handleUpdateTargetCapital}
          goalName={goalName}
          setGoalName={handleUpdateGoalName}
          targetTimeline={targetTimeline}
          setTargetTimeline={handleUpdateTargetTimeline}
          simulationData={simulationData}
          ghostSimulationData={ghostSimulationData}
          protocolReplayMonth={currentSimulationMonth}
          canvasCrisisActive={canvasCrisisActive}
          computeLiveMonthlySavingsForTimeline={computeLiveMonthlySavingsForTimeline}
          onDragSavingsPreview={setDragSavingsPreview}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
          onConnectEvents={handleConnectEvents}
          onDeleteEdge={handleDeleteEdge}
          onAddEvent={handleAddBlankEvent}
          onNodeDragStop={handleNodeDragStop}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          criticalEventIds={criticalEventIds}
          isTemporalOverdraft={isOverdraft}
          objectiveDependencies={objectiveDependencies}
          onUpdateObjectiveDependencies={setObjectiveDependencies}
          burnRateLedger={burnRateLedger}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
          totalMonthlyBurnRate={totalMonthlyBurnRate}
          netMonthlyYield={netMonthlyYield}
          appState={appState}
          undo={handleUndo}
          redo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onTidyGrid={handleTidyGrid}
          onLogCompleted={handleLogCompleted}
          onTraceCriticalPath={traceCriticalPath}
          ghostMode={isGhostMode}
          onGraphSync={bumpCanvasSync}
        />
        )}
      </div>

      {/* Bottom Ticker */}
        {!isModalView && (
        <footer className={cn("absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(94vw,1100px)] h-9 backdrop-blur-md border-[0.5px] rounded-2xl flex items-center overflow-hidden z-[100] shadow-[0_20px_80px_rgba(0,0,0,0.08)]", glassPanelClass)}>
            {(() => {
              const breachCount = simAtCurrentMonth?.violations?.length ?? 0;
              const systemStatusValue = criticalAlert
                ? 'CRITICAL_ALERT'
                : breachCount > 0
                  ? 'BREACH DETECTED'
                  : 'OPTIMAL';
              const systemStatusColor =
                criticalAlert || breachCount > 0 ? 'text-[#ef4444]' : 'text-primary';
              const savingsTickerColor =
                dragSavingsPreview !== null
                  ? 'text-cyan-400 animate-pulse'
                  : savingsBelowBuffer
                    ? 'text-[#ef4444] animate-pulse'
                    : liveMonthlySavings < 0
                      ? 'text-secondary'
                      : 'text-primary';
              const objectiveList = timelineEvents.filter((e) => e.type === 'objective');
              const pathAlignmentPct =
                objectiveList.length === 0
                  ? 100
                  : (objectiveList.filter((e) => e.status === 'COMPLETED').length /
                      objectiveList.length) *
                    100;
              const rows: { label: string; value: string; color: string }[] = [
                ...(canvasSyncing
                  ? [
                      {
                        label: 'CANVAS',
                        value: 'SYNCHRONIZING...',
                        color: 'text-amber-400 animate-pulse',
                      },
                    ]
                  : []),
                { label: 'NET WORTH', value: formatCurrency(projectedNetWorth), color: 'text-primary' },
                {
                  label: 'VARIANCE',
                  value: `${((netChange / (initialNetWorth || 1)) * 100).toFixed(2)}%`,
                  color: netChange > 0 ? 'text-primary' : 'text-secondary',
                },
                { label: 'SYSTEM_STATUS', value: systemStatusValue, color: systemStatusColor },
                {
                  label: 'PATH_ALIGNMENT',
                  value: `${pathAlignmentPct.toFixed(1)}%`,
                  color: 'text-primary',
                },
                {
                  label: 'MONTHLY_EXPENSES',
                  value: `${formatCurrency(liveMonthlyExpenses)}/MO`,
                  color: 'text-secondary',
                },
                {
                  label: 'MONTHLY_SAVINGS',
                  value:
                    dragSavingsPreview !== null
                      ? `${formatCurrency(dragSavingsPreview)}/MO (PREVIEW)`
                      : `${formatCurrency(liveMonthlySavings)}/MO`,
                  color: savingsTickerColor,
                },
              ];
              const Track = ({ dup }: { dup?: boolean }) => (
                <div
                  className="flex shrink-0 items-center gap-12 px-6 whitespace-nowrap"
                  aria-hidden={dup ? true : undefined}
                >
                  {rows.map((item) => (
                    <div key={`${dup ? 'd' : 'a'}-${item.label}`} className="flex items-center gap-3">
                      <span className="text-[8px] font-headline uppercase text-on-surface-variant tracking-widest">
                        {item.label}:
                      </span>
                      <span className={cn('text-[9px] font-headline font-bold', item.color)}>{item.value}</span>
                    </div>
                  ))}
                </div>
              );
              return (
                <div className="flex w-max animate-marquee">
                  <Track />
                  <Track dup />
                </div>
              );
            })()}
        </footer>
        )}
        <div className="fixed bottom-20 right-28 z-50 group">
          <button
            type="button"
            aria-label="Open visual legend"
            className="w-8 h-8 rounded-full bg-neutral-900/70 backdrop-blur-md border border-white/10 text-stone-200 text-xs font-mono font-bold flex items-center justify-center"
          >
            ?
          </button>
          <div className="pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 absolute bottom-10 right-0 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-[0.5px] border-outline-variant/30 bg-neutral-950/90 p-4 text-stone-100 shadow-2xl backdrop-blur-xl">
            <h4 className="text-[10px] tracking-[0.18em] uppercase text-stone-200 mb-3">Legend</h4>
            <div className="space-y-3 text-[11px] leading-snug">
              <div>
                <p className="text-stone-400 uppercase text-[9px] tracking-[0.16em] mb-1">Nodes</p>
                <div className="flex flex-col gap-1 text-stone-100">
                  <span><span className="text-emerald-500 font-bold">[GREEN]</span> Event</span>
                  <span><span className="text-blue-400 font-bold">[BLUE]</span> Objective</span>
                  <span><span className="text-yellow-400 font-bold">[YELLOW]</span> Note</span>
                </div>
              </div>
              <div>
                <p className="text-stone-400 uppercase text-[9px] tracking-[0.16em] mb-1">Colors</p>
                <div className="flex flex-col gap-1 text-stone-100">
                  <span><span className="text-emerald-500 font-bold">Emerald</span> = Healthy / Verified</span>
                  <span><span className="text-red-600 font-bold">Red</span> = Deficit / Critical</span>
                </div>
              </div>
              <div>
                <p className="text-stone-400 uppercase text-[9px] tracking-[0.16em] mb-1">Logic</p>
                <span className="text-stone-100">Monthly Savings = Total Yield - Total Expenses</span>
              </div>
              <div>
                <p className="text-stone-400 uppercase text-[9px] tracking-[0.16em] mb-1">Shortcuts</p>
                <p className="text-[9px] text-stone-400 mb-1.5">Canvas view only (focus canvas, not a text field).</p>
                <div className="flex flex-col gap-1 font-mono text-[10px] text-stone-100">
                  <span><span className="text-emerald-500/90">[Del]</span> Delete node</span>
                  <span><span className="text-emerald-500/90">[⌘/Ctrl+S]</span> Save / export JSON</span>
                  <span><span className="text-emerald-500/90">[Space]</span> Center view</span>
                  <span><span className="text-emerald-500/90">[T]</span> Load templates (sidebar)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
