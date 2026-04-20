import React, { useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  NodeProps,
  Edge,
  MarkerType,
  Node,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Connection,
  EdgeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Shield, Zap, Target, AlertTriangle, Plus, X, Info, Network, Trash2, TrendingUp, CheckCircle2, Activity, XCircle, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, findCriticalPath } from '../lib/utils';
import { NODE_COLORS } from '../constants';

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

// --- Custom Edge Component ---

const SlackEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const slack = data?.slack as number || 0;
  const isCritical = slack === 0;
  const isLiquidityCrisis = data?.isLiquidityCrisis as boolean || false;
  const onDeleteEdge = data?.onDeleteEdge as (id: string) => void;

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          stroke: style.stroke || (isLiquidityCrisis ? '#ff4444' : (isCritical ? '#f27d26' : '#4be277')),
          strokeWidth: style.strokeWidth || (isLiquidityCrisis || isCritical ? 3 : 2),
          opacity: style.opacity || 0.8
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
          }}
          className="nodrag nopan group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center gap-1 pointer-events-auto">
            <div className={cn(
              "px-2 py-0.5 rounded-sm border text-[8px] font-mono font-bold uppercase tracking-tighter shadow-xl transition-all",
              isLiquidityCrisis ? "bg-secondary text-surface-lowest border-secondary animate-pulse" : (isCritical ? "bg-secondary text-surface-lowest border-secondary" : "bg-surface-container text-primary border-primary/30")
            )}>
              {isLiquidityCrisis ? "DENIED" : `[ SLACK: ${slack} MO ]`}
            </div>
            <AnimatePresence>
              {isHovered && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEdge(id);
                  }}
                  className="p-1 bg-secondary text-surface-lowest rounded-full shadow-lg hover:bg-secondary/80 transition-colors"
                >
                  <Trash2 size={10} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// --- Custom Node Components ---

type GenesisNodeData = { 
  name: string;
  cash: number; 
  health: number; 
  relational: number; 
  spiritual: number;
  isActive: boolean;
  scenario?: 'primary' | 'ghost';
};
type GenesisNode = Node<GenesisNodeData, 'genesis'>;

const OmniHandles = ({ color = '#4be277' }: { color?: string }) => (
  <>
    <Handle 
      type="target" 
      position={Position.Left} 
      id="left" 
      className="w-2 h-2 border-none transition-colors !left-[-4px]" 
      style={{ backgroundColor: color }}
    />
    <Handle 
      type="target" 
      position={Position.Top} 
      id="top" 
      className="w-2 h-2 border-none transition-colors !top-[-4px]" 
      style={{ backgroundColor: color }}
    />
    <Handle 
      type="source" 
      position={Position.Right} 
      id="right" 
      className="w-2 h-2 border-none hover:scale-125 transition-transform !right-[-4px]" 
      style={{ backgroundColor: color }}
    />
    <Handle 
      type="source" 
      position={Position.Bottom} 
      id="bottom" 
      className="w-2 h-2 border-none hover:scale-125 transition-transform !bottom-[-4px]" 
      style={{ backgroundColor: color }}
    />
  </>
);

const GenesisNode = ({ data, selected }: NodeProps<GenesisNode>) => (
  <div className={cn(
    "min-w-[280px] backdrop-blur-xl border rounded-2xl p-4 shadow-2xl relative transition-all",
    "bg-neutral-950/70 border-white/10",
    data?.scenario === 'ghost' && "opacity-50 border-dashed border-purple-500/50"
  )}
  style={{
    borderColor: data?.scenario === 'ghost' ? undefined : NODE_COLORS.genesis.border,
    boxShadow: selected ? NODE_COLORS.genesis.glowSelected : NODE_COLORS.genesis.glow,
    borderWidth: selected ? '4px' : '2px',
  }}
  >
    <div className="absolute -top-3 left-4 bg-primary text-on-primary px-2 py-0.5 text-[8px] font-headline font-black uppercase tracking-widest">
      {NODE_COLORS.genesis.header}
    </div>
    <div className="flex items-center gap-3 mb-4 border-b border-outline-variant/10 pb-2">
      <div className="p-2 bg-primary/10 rounded-sm">
        <Zap size={18} className="text-primary" />
      </div>
      <div>
        <h3 className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface">{data?.name || "Genesis"}</h3>
        <span className="text-[8px] font-headline text-on-surface-variant uppercase tracking-widest">Temporal Origin</span>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <span className="text-[8px] text-on-surface-variant uppercase tracking-widest">Liquid Capital</span>
        <p className="text-xs font-mono font-bold text-primary">${(data?.cash || 0).toLocaleString()}</p>
      </div>
      <div className="space-y-1">
        <span className="text-[8px] text-on-surface-variant uppercase tracking-widest">System Health</span>
        <p className="text-xs font-mono font-bold text-secondary">{data?.health}%</p>
      </div>
    </div>
    <OmniHandles color={NODE_COLORS.genesis.border} />
  </div>
);

type EventNodeData = { 
  name: string; 
  immediateCost: number; 
  immediateIncome: number;
  ongoingCost: number; 
  monthlyIncome: number;
  time: number; 
  month: number; 
  relationalImpact?: number;
  spiritualImpact?: number;
  status: 'nominal' | 'critical'; 
  nodeStatus?: 'LOCKED' | 'IN-PROGRESS' | 'COMPLETED';
  isBottleneck?: boolean;
  errorType?: string;
  scenario?: 'primary' | 'ghost';
  onDelete: () => void 
};
type EventNode = Node<EventNodeData, 'event'>;

const EventNode = ({ data, selected }: NodeProps<EventNode>) => (
  <div className={cn(
    "min-w-[280px] backdrop-blur-xl border rounded-2xl p-4 shadow-2xl relative transition-all group",
    "bg-neutral-950/70 border-white/10",
    data?.isBottleneck && data?.errorType === 'UNLINKED' && "ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse",
    data?.isBottleneck && data?.errorType === 'BLOCKED_BY_PARENT' && "ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse",
    data?.scenario === 'ghost' && "opacity-50 border-dashed border-purple-500/50"
  )}
  style={{
    borderColor: data?.scenario === 'ghost' ? undefined : NODE_COLORS.event.border,
    boxShadow: data?.isBottleneck ? undefined : (selected ? NODE_COLORS.event.glowSelected : NODE_COLORS.event.glow),
    borderWidth: selected ? '4px' : '2px',
  }}
  >
    {data?.isBottleneck && (
      <div className={cn(
        "absolute -top-3 -right-3 text-black text-xs font-bold px-2 py-1 rounded-sm z-10",
        data?.errorType === 'UNLINKED' ? "bg-red-500" : "bg-orange-500"
      )}>
        {data?.errorType === 'UNLINKED' ? "[ UNLINKED: NO ORIGIN ]" : "[ BLOCKED: PREREQ FAILED ]"}
      </div>
    )}
    <div className={cn(
      "absolute -top-3 left-4 px-2 py-0.5 text-[8px] font-headline font-black uppercase tracking-widest",
      data?.nodeStatus === 'COMPLETED' ? "bg-primary text-on-primary" : 
      data?.nodeStatus === 'IN-PROGRESS' ? "bg-cyan-400 text-black" :
      "bg-outline-variant text-on-surface-variant"
    )}>
      {NODE_COLORS.event.header}
    </div>
    <div className="flex items-center justify-between mb-4 border-b border-outline-variant/10 pb-2">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-sm transition-colors",
          data?.nodeStatus === 'COMPLETED' ? "bg-primary/10" : 
          data?.nodeStatus === 'IN-PROGRESS' ? "bg-cyan-400/10" :
          "bg-surface-container"
        )}>
          {data?.nodeStatus === 'COMPLETED' ? <CheckCircle2 size={18} className="text-primary" /> : <Target size={18} className="text-on-surface-variant" />}
        </div>
        <div>
          <h3 className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface">{data?.name || "Event"}</h3>
          <span className="text-[8px] font-headline text-on-surface-variant uppercase tracking-widest">Month {data?.month}</span>
        </div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); data?.onDelete?.(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-secondary/80"
      >
        <X size={14} />
      </button>
    </div>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[9px] text-secondary uppercase font-bold">Cost</span>
        <span className="text-xs font-mono font-bold text-secondary">-${((data?.immediateCost || 0) / 1000).toFixed(1)}k</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[9px] text-primary uppercase font-bold">Income</span>
        <span className="text-xs font-mono font-bold text-primary">+${((data?.immediateIncome || 0) / 1000).toFixed(1)}k</span>
      </div>
      {((data?.monthlyIncome || 0) - (data?.ongoingCost || 0)) !== 0 && (
        <div className="flex justify-between text-[10px] font-mono uppercase mt-1">
          <span className="text-white/50">YIELD:</span>
          <span className={((data?.monthlyIncome || 0) - (data?.ongoingCost || 0)) > 0 ? "text-green-400" : "text-red-400"}>
            {((data?.monthlyIncome || 0) - (data?.ongoingCost || 0)) > 0 ? '+' : ''}${((data?.monthlyIncome || 0) - (data?.ongoingCost || 0))}/MO
          </span>
        </div>
      )}
      <div className="flex justify-between border-t border-outline-variant/10 pt-1">
        <span className="text-[9px] text-on-surface-variant uppercase">Time Rec</span>
        <span className="text-xs font-mono font-bold text-primary">+{(data?.time || 0)}h</span>
      </div>
      {(data?.relationalImpact !== 0) && (
        <div className="flex justify-between">
          <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">Harmony</span>
          <span className={cn("text-xs font-mono font-bold", (data?.relationalImpact || 0) > 0 ? "text-primary" : "text-secondary")}>
            {(data?.relationalImpact || 0) > 0 ? '+' : ''}{data?.relationalImpact}%
          </span>
        </div>
      )}
      {(data?.spiritualImpact !== 0) && (
        <div className="flex justify-between">
          <span className="text-[9px] text-on-surface-variant uppercase tracking-tighter">Alignment</span>
          <span className={cn("text-xs font-mono font-bold", (data?.spiritualImpact || 0) > 0 ? "text-primary" : "text-secondary")}>
            {(data?.spiritualImpact || 0) > 0 ? '+' : ''}{data?.spiritualImpact}%
          </span>
        </div>
      )}
    </div>
    {data?.status === 'critical' && data?.nodeStatus !== 'COMPLETED' && (
      <div className="absolute -top-2 -right-2 bg-secondary text-surface-lowest p-1 rounded-full animate-pulse">
        <AlertTriangle size={12} />
      </div>
    )}
    {data?.nodeStatus === 'COMPLETED' && (
      <div className="absolute -top-2 -right-2 bg-primary text-on-primary px-2 py-0.5 rounded-sm text-[8px] font-headline font-bold uppercase tracking-widest">
        [ DONE ]
      </div>
    )}
    <OmniHandles color={NODE_COLORS.event.border} />
  </div>
);

type ObjectiveNodeData = { 
  name: string; 
  target: number; 
  status: 'nominal' | 'critical'; 
  isSuccess: boolean;
  nodeStatus?: 'LOCKED' | 'IN-PROGRESS' | 'COMPLETED';
  progress?: number;
  satisfactionMonth?: number;
  targetTimeline?: number;
  isBottleneck?: boolean;
  errorType?: string;
  deficit?: number;
  scenario?: 'primary' | 'ghost';
};
type ObjectiveNode = Node<ObjectiveNodeData, 'objective'>;

const ObjectiveNode = ({ data, selected }: NodeProps<ObjectiveNode>) => (
  <div className={cn(
    "min-w-[280px] backdrop-blur-xl border rounded-2xl p-4 shadow-2xl relative transition-all",
    "bg-neutral-950/70 border-white/10",
    data?.isBottleneck && data?.errorType === 'UNLINKED' && "ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse",
    data?.isBottleneck && data?.errorType === 'BLOCKED_BY_PARENT' && "ring-2 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse",
    data?.isBottleneck && data?.errorType === 'DEFICIT' && "ring-2 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse",
    data?.scenario === 'ghost' && "opacity-50 border-dashed border-purple-500/50"
  )}
  style={{
    borderColor: data?.scenario === 'ghost' ? undefined : NODE_COLORS.objective.border,
    boxShadow: data?.isBottleneck ? undefined : (selected ? NODE_COLORS.objective.glowSelected : NODE_COLORS.objective.glow),
    borderWidth: selected ? '4px' : '2px',
  }}
  >
    {data?.isBottleneck && (
      <div className={cn(
        "absolute -top-3 -right-3 text-black text-xs font-bold px-2 py-1 rounded-sm z-10",
        data?.errorType === 'UNLINKED' ? "bg-red-500" :
        data?.errorType === 'BLOCKED_BY_PARENT' ? "bg-orange-500" :
        "bg-yellow-500"
      )}>
        {data?.errorType === 'UNLINKED' ? "[ UNLINKED: NO ORIGIN ]" :
         data?.errorType === 'BLOCKED_BY_PARENT' ? "[ BLOCKED: PREREQ FAILED ]" :
         `DEFICIT: $${data.deficit?.toLocaleString()}`}
      </div>
    )}
    <div className={cn(
      "absolute -top-3 left-4 px-2 py-0.5 text-[8px] font-headline font-black uppercase tracking-widest",
      data?.nodeStatus === 'COMPLETED' ? "bg-primary text-on-primary" : 
      data?.nodeStatus === 'IN-PROGRESS' ? "bg-cyan-400 text-black" :
      "bg-[#FFD700] text-black"
    )}>
      {NODE_COLORS.objective.header}
    </div>
    <div className="flex items-center gap-3 mb-4 border-b border-outline-variant/10 pb-2">
      <div className={cn(
        "p-2 rounded-sm",
        data?.nodeStatus === 'COMPLETED' ? "bg-primary/10" : "bg-[#FFD700]/10"
      )}>
        <Flag size={18} className={cn(data?.nodeStatus === 'COMPLETED' ? "text-primary" : "text-[#FFD700]")} />
      </div>
      <div>
        <h3 className="text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-on-surface">{data?.name || "Objective"}</h3>
        <span className="text-[8px] font-headline text-on-surface-variant uppercase tracking-widest">End State</span>
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[9px] text-on-surface-variant uppercase">Target Capital</span>
        <span className="text-xs font-mono font-bold text-on-surface">${((data?.target || 0) / 1000).toFixed(1)}k</span>
      </div>
      
      {/* Timeline Variance Display */}
      <div className="space-y-1 mt-2 mb-2 border-t border-white/10 pt-2">
        <div className="flex justify-between text-[10px] font-mono uppercase">
          <span className="text-white/50">Target:</span>
          <span className="text-white">Month {data.targetTimeline || 1}</span>
        </div>
        <div className="flex justify-between text-[10px] font-mono uppercase">
          <span className="text-white/50">Projected:</span>
          <span className={data.isBottleneck ? "text-yellow-500 font-bold" : "text-green-500 font-bold"}>
            {data.errorType === 'UNLINKED' || data.errorType === 'BLOCKED_BY_PARENT' 
              ? "BLOCKED" 
              : `Month ${data.satisfactionMonth || 'N/A'}`}
          </span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="space-y-1 pt-2">
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-on-surface-variant uppercase tracking-widest">Progress</span>
          <span className="text-[8px] font-mono font-bold text-on-surface">{Math.round(data?.progress || 0)}%</span>
        </div>
        <div className="w-full bg-surface-lowest h-1.5 rounded-full overflow-hidden border border-outline-variant/10">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${data?.progress || 0}%` }}
            className={cn(
              "h-full transition-all duration-1000",
              data?.nodeStatus === 'COMPLETED' ? "bg-primary" : "bg-cyan-400"
            )}
          />
        </div>
      </div>
    </div>
    <OmniHandles color={NODE_COLORS.objective.border} />
  </div>
);

type NoteNodeData = { content: string; scenario?: 'primary' | 'ghost' };
type NoteNode = Node<NoteNodeData, 'note'>;

const NoteNode = ({ data }: NodeProps<NoteNode>) => (
  <div className={cn(
    "backdrop-blur-xl border rounded-2xl p-3 min-w-[150px] max-w-[250px] shadow-2xl",
    "bg-neutral-950/70 border-white/10",
    data?.scenario === 'ghost' && "opacity-50 border-dashed border-purple-500/50"
  )}>
    <div className="flex items-center gap-2 mb-2 border-b border-outline-variant/10 pb-1">
      <Info size={12} className="text-on-surface-variant" />
      <span className="text-[8px] font-headline font-bold uppercase tracking-widest text-on-surface-variant">Annotation</span>
    </div>
    <p className="text-[10px] font-headline text-on-surface leading-relaxed italic">
      {data?.content || "No content."}
    </p>
    <OmniHandles />
  </div>
);

const nodeTypes = {
  genesis: GenesisNode,
  event: EventNode,
  objective: ObjectiveNode,
  note: NoteNode,
};

const edgeTypes = {
  slack: SlackEdge,
};

interface CanvasViewProps {
  initialCash: number;
  initialDebt: number;
  baseMonthlyIncome: number;
  setInitialCash: (val: number) => void;
  setInitialDebt: (val: number) => void;
  setBaseMonthlyIncome: (val: number) => void;
  initialHealth: number;
  timelineEvents: any[];
  targetCapital: number;
  setTargetCapital: (val: number) => void;
  goalName: string;
  setGoalName: (val: string) => void;
  targetTimeline: number;
  setTargetTimeline: (val: number) => void;
  simulationData: any[];
  ghostSimulationData?: any[];
  onUpdateEvent: (id: string, updates: any) => void;
  onDeleteEvent: (id: string) => void;
  onConnectEvents: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void;
  onDeleteEdge: (id: string) => void;
  onAddEvent: (type: 'expense' | 'income' | 'genesis' | 'objective' | 'note' | 'event', pos?: { x: number, y: number }) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  criticalEventIds: string[];
  isTemporalOverdraft: boolean;
  objectiveDependencies: string[];
  onUpdateObjectiveDependencies: (deps: string[]) => void;
  burnRateLedger: any[];
  onAddExpense: () => void;
  onUpdateExpense: (id: string, updates: any) => void;
  onDeleteExpense: (id: string) => void;
  totalMonthlyBurnRate: number;
  netMonthlyYield: number;
  appState: 'PLANNING' | 'ACTIVE_PROTOCOL';
  onNodeDragStop: () => void;
  onTidyGrid: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onLogCompleted: (id: string) => void;
  onTraceCriticalPath: () => void;
}

export default function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasInternal {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInternal({
  initialCash,
  initialDebt,
  baseMonthlyIncome,
  setInitialCash,
  setInitialDebt,
  setBaseMonthlyIncome,
  initialHealth,
  timelineEvents,
  targetCapital,
  setTargetCapital,
  goalName,
  setGoalName,
  targetTimeline,
  setTargetTimeline,
  simulationData,
  ghostSimulationData,
  onUpdateEvent,
  onDeleteEvent,
  onConnectEvents,
  onDeleteEdge,
  onAddEvent,
  selectedNodeId,
  onSelectNode,
  criticalEventIds,
  isTemporalOverdraft,
  objectiveDependencies,
  onUpdateObjectiveDependencies,
  burnRateLedger,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  totalMonthlyBurnRate,
  netMonthlyYield,
  appState,
  onNodeDragStop,
  onTidyGrid,
  undo,
  redo,
  canUndo,
  canRedo,
  onLogCompleted,
  onTraceCriticalPath,
}: CanvasViewProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false);
  
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState([]);
  const [showCriticalPath, setShowCriticalPath] = React.useState(false);

  // Sync nodes/edges when timelineEvents or other deps change
  const onConnect = (params: Connection) => {
    if (appState !== 'PLANNING') return;
    if (params.source && params.target) {
      const sourceId = params.source.replace('node-', '');
      const targetId = params.target.replace('node-', '');
      onConnectEvents(sourceId, targetId, params.sourceHandle || undefined, params.targetHandle || undefined);
    }
  };

  const onNodesDelete = (deletedNodes: Node[]) => {
    if (appState !== 'PLANNING') return;
    deletedNodes.forEach(node => {
      if (node.id.startsWith('node-')) {
        onDeleteEvent(node.id.replace('node-', ''));
      }
    });
  };

  const onEdgesDelete = (deletedEdges: Edge[]) => {
    if (appState !== 'PLANNING') return;
    deletedEdges.forEach(edge => onDeleteEdge(edge.id));
  };

  const isValidConnection = (connection: Connection) => {
    if (connection.source === connection.target) return false;
    
    // Prevent backward connections in time (month-based)
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (sourceNode && targetNode) {
      const sourceMonth = (sourceNode.data as any).month || 0;
      const targetMonth = (targetNode.data as any).month || targetTimeline;
      
      if (targetMonth < sourceMonth) return false;
    }

    // Simple loop detection: check if target is already an ancestor of source
    const checkAncestry = (currentId: string, targetId: string): boolean => {
      const directEdges = edges.filter(e => e.target === currentId);
      for (const edge of directEdges) {
        if (edge.source === targetId) return true;
        if (checkAncestry(edge.source, targetId)) return true;
      }
      return false;
    };

    if (checkAncestry(connection.source, connection.target)) return false;

    return true;
  };

  const onNodeClick = (_: any, node: Node) => {
    if (node.id.startsWith('node-')) {
      onSelectNode(node.id.replace('node-', ''));
    } else {
      onSelectNode(null);
    }
  };

  const handleAddNode = () => {
    setIsAddMenuOpen(prev => !prev);
  };

  const handleAddSpecificNode = (type: 'expense' | 'income' | 'genesis' | 'objective' | 'note' | 'event') => {
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    onAddEvent(type, pos);
    setIsAddMenuOpen(false);
  };

  const onNodeDragStart = (_: any, node: Node) => {
    setDraggingNodeId(node.id);
  };

  const onNodeDragStopInternal = (_: any, node: Node) => {
    setDraggingNodeId(null);
    
    // Update global state on drag stop
    const flowNode = nodes.find(n => n.id === node.id);
    if (flowNode && flowNode.id.startsWith('node-')) {
      const eventId = flowNode.id.replace('node-', '');
      const event = timelineEvents.find(e => e.id === eventId);
      if (event) {
        const newMonth = event.type === 'genesis' ? 0 : Math.max(1, Math.min(targetTimeline, Math.round((flowNode.position.x - 50) / 300)));
        handleUpdateEventInternal(eventId, { 
          month: newMonth,
          visualY: flowNode.position.y
        });
      }
    }
    
    onNodeDragStop();
  };

  const handleUpdateEventInternal = (id: string, updates: any) => {
    // 1. Update global state (timelineEvents)
    onUpdateEvent(id, updates);

    // 2. Update local nodes state for immediate feedback
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === `node-${id}`) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updates,
            },
          };
        }
        return node;
      })
    );
  };

  const { derivedNodes, derivedEdges } = useMemo(() => {
    // 0. Calculate Critical Path first to avoid dependency on React Flow state
    const logicalNodes = timelineEvents.map(e => ({ id: `node-${e.id}` }));
    const logicalEdges: any[] = [];
    
    timelineEvents.forEach(event => {
      const targetId = `node-${event.id}`;
      event.dependencies.forEach((dep: any) => {
        const depId = typeof dep === 'string' ? dep : dep.id;
        const sourceId = `node-${depId}`;
        logicalEdges.push({ id: `edge-manual-${sourceId}-${targetId}`, source: sourceId, target: targetId });
      });
    });
    
    // Find active genesis for critical path calculation
    const activeGenesis = timelineEvents.find(e => e.type === 'genesis' && e.isActiveGenesis) || timelineEvents.find(e => e.type === 'genesis');
    const firstObjective = timelineEvents.find(e => e.type === 'objective');

    const criticalPath = (showCriticalPath && activeGenesis && firstObjective)
      ? findCriticalPath(logicalNodes, logicalEdges, `node-${activeGenesis.id}`, `node-${firstObjective.id}`)
      : { nodeIds: [], edgeIds: [] };

    const sortedEvents = [...timelineEvents].sort((a, b) => a.month - b.month);
    
    const flowNodes: any[] = [];
    const monthCounts: Record<number, number> = {};
    const bottleneckStatus: Record<string, { isBottleneck: boolean, errorType?: string, deficit?: number }> = {};

    sortedEvents.forEach((event) => {
      const activeSimData = (event.scenario === 'ghost' && ghostSimulationData && ghostSimulationData.length > 0) ? ghostSimulationData : simulationData;
      const finalMonthData = activeSimData[activeSimData.length - 1] || {};
      const nodeStatuses = finalMonthData.nodeStatuses || {};
      const objectiveProgress = finalMonthData.objectiveProgress || {};
      const satisfiedObjectives = finalMonthData.satisfiedObjectives || {};

      const nodeId = `node-${event.id}`;
      const isCritical = criticalEventIds.includes(event.id);
      const nodeStatus = nodeStatuses[event.id] || 'LOCKED';

      const m = event.month;
      const count = monthCounts[m] || 0;
      monthCounts[m] = count + 1;
      
      // Default Y if not manually set (Vertical Stacking)
      const defaultY = 100 + (count * 160); 
      const position = { 
        x: event.month * 300 + 50, 
        y: event.visualY !== undefined ? event.visualY : defaultY 
      };

      let isBottleneck = false;
      let errorType: string | undefined = undefined;
      let deficit: number | undefined = undefined;

      if (event.type === 'event' || event.type === 'objective') {
        if (!event.dependencies || event.dependencies.length === 0) {
          isBottleneck = true;
          errorType = 'UNLINKED';
        } else {
          const hasBlockedParent = event.dependencies.some(dep => {
            const depId = typeof dep === 'string' ? dep : dep.id;
            return bottleneckStatus[depId]?.isBottleneck;
          });
          if (hasBlockedParent) {
            isBottleneck = true;
            errorType = 'BLOCKED_BY_PARENT';
          } else if (event.type === 'objective') {
            const targetCapital = event.targetCapital || 0;
            const targetMonth = event.targetTimeline || 1;
            const simMonthData = activeSimData[targetMonth - 1] || activeSimData[activeSimData.length - 1] || { Financial: 0 };
            const projectedCapital = simMonthData.Financial || 0;
            if (projectedCapital < targetCapital) {
              isBottleneck = true;
              errorType = 'DEFICIT';
              deficit = targetCapital - projectedCapital;
            }
          }
        }
      }

      bottleneckStatus[event.id] = { isBottleneck, errorType, deficit };

      let nodeData: any = { 
        name: event.name,
        month: event.month,
        nodeStatus,
        scenario: event.scenario,
        onDelete: () => onDeleteEvent(event.id)
      };

      if (event.type === 'genesis') {
        nodeData = {
          ...nodeData,
          cash: event.initialCash,
          health: event.initialSystemHealth ?? 100,
          relational: event.initialRelationalHarmony ?? 100,
          spiritual: event.initialSpiritualAlignment ?? 100,
          isActive: event.isActiveGenesis,
          nodeStatus: 'COMPLETED'
        };
      } else if (event.type === 'event') {
        nodeData = {
          ...nodeData,
          immediateCost: event.immediateCost, 
          immediateIncome: event.immediateIncome,
          ongoingCost: event.ongoingCost,
          monthlyIncome: event.monthlyIncome,
          time: event.timeReclaimed, 
          relationalImpact: event.relationalImpact,
          spiritualImpact: event.spiritualImpact,
          status: isCritical ? 'critical' : 'nominal',
          isBottleneck,
          errorType
        };
      } else if (event.type === 'objective') {
        nodeData = {
          ...nodeData,
          target: event.targetCapital,
          status: nodeStatus === 'LOCKED' ? 'critical' : 'nominal',
          progress: objectiveProgress[event.id] || 0,
          satisfactionMonth: satisfiedObjectives[event.id],
          targetTimeline: event.targetTimeline,
          isBottleneck,
          errorType,
          deficit
        };
      } else if (event.type === 'note') {
        nodeData = {
          ...nodeData,
          content: event.content
        };
      }

      flowNodes.push({
        id: nodeId,
        type: event.type,
        position,
        style: {
          transition: draggingNodeId === nodeId ? 'none' : 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: draggingNodeId === nodeId ? 1000 : 1,
          opacity: showCriticalPath && !criticalPath.nodeIds.includes(nodeId) ? 0.3 : 1,
          border: showCriticalPath && criticalPath.nodeIds.includes(nodeId) ? '2px solid #FF4500' : undefined,
          boxShadow: showCriticalPath && criticalPath.nodeIds.includes(nodeId) ? '0 0 15px #FF4500' : undefined,
        },
        data: nodeData,
      });
    });

    const flowEdges: Edge[] = [];
    const SAFETY_BUFFER = 500;
    
    timelineEvents.forEach(event => {
      const targetId = `node-${event.id}`;
      event.dependencies.forEach((dep: any) => {
        const depId = typeof dep === 'string' ? dep : dep.id;
        const sourceHandle = typeof dep === 'string' ? undefined : dep.sourceHandle;
        const targetHandle = typeof dep === 'string' ? undefined : dep.targetHandle;
        
        const sourceId = `node-${depId}`;
        const sourceEvent = timelineEvents.find(e => e.id === depId);
        const sourceMonth = sourceEvent?.month || 0;
        const slack = event.month - sourceMonth;
        
        const isLiquidityCrisis = criticalEventIds.includes(event.id);
        const activeSimData = (event.scenario === 'ghost' && ghostSimulationData && ghostSimulationData.length > 0) ? ghostSimulationData : simulationData;
        const finalMonthData = activeSimData[activeSimData.length - 1] || {};
        const activeEdges = new Set(finalMonthData.activeEdges || []);
        const isActive = activeEdges.has(`${depId}-${event.id}`);

        const isCriticalEdge = criticalPath.edgeIds.includes(`edge-manual-${sourceId}-${targetId}`);

        const targetNodeStatus = bottleneckStatus[event.id];
        const targetMonth = event.type === 'objective' ? (event.targetTimeline || 1) : event.month;
        const simMonthData = activeSimData[targetMonth - 1] || activeSimData[activeSimData.length - 1] || { Financial: 0 };
        const projectedCapital = simMonthData.Financial || 0;
        
        let edgeColor = '#4be277'; // default green
        let edgeStrokeWidth = 2;
        let edgeOpacity = 0.5;
        let edgeAnimated = false;
        let edgeDasharray = undefined;

        if (event.scenario === 'ghost' || sourceEvent?.scenario === 'ghost') {
          edgeColor = '#a855f7';
          edgeDasharray = '5, 5';
        } else if (targetNodeStatus?.isBottleneck || projectedCapital < 0) {
          edgeColor = '#ef4444';
          edgeStrokeWidth = 3;
          edgeOpacity = 0.9;
          edgeAnimated = true;
        } else if (projectedCapital < SAFETY_BUFFER) {
          edgeColor = '#eab308';
          edgeStrokeWidth = 3;
          edgeOpacity = 0.9;
          edgeAnimated = true;
        } else {
          edgeColor = '#22c55e';
          edgeStrokeWidth = 2;
          edgeOpacity = 0.5;
          edgeAnimated = false;
        }

        flowEdges.push({
          id: `edge-manual-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          sourceHandle,
          targetHandle,
          type: 'slack',
          animated: isCriticalEdge || edgeAnimated,
          data: { 
            slack,
            isLiquidityCrisis,
            onDeleteEdge
          },
          style: isCriticalEdge 
            ? { stroke: '#FF4500', strokeWidth: 4, filter: 'drop-shadow(0 0 5px #FF4500)' }
            : { stroke: edgeColor, strokeWidth: edgeStrokeWidth, opacity: showCriticalPath ? 0.1 : edgeOpacity, strokeDasharray: edgeDasharray, filter: edgeAnimated ? `drop-shadow(0 0 5px ${edgeColor})` : undefined },
          markerEnd: { 
            type: MarkerType.ArrowClosed, 
            color: isCriticalEdge ? '#FF4500' : edgeColor 
          },
        });
      });
    });

    return { derivedNodes: flowNodes, derivedEdges: flowEdges };
  }, [initialHealth, timelineEvents, simulationData, ghostSimulationData, onDeleteEvent, criticalEventIds, targetTimeline, draggingNodeId, onDeleteEdge, showCriticalPath]);

  React.useEffect(() => {
    setNodes(derivedNodes);
    setEdges(derivedEdges);
  }, [derivedNodes, derivedEdges, setNodes, setEdges]);

  // Fit view on mount
  React.useEffect(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  const selectedEvent = timelineEvents.find(e => e.id === selectedNodeId);

  return (
    <div className="absolute inset-0 z-0 bg-neutral-950">
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="backdrop-blur-md border-[0.5px] border-white/5 rounded-3xl p-8 flex flex-col items-center max-w-md text-center shadow-[0_20px_80px_rgba(0,0,0,0.08)] pointer-events-auto bg-neutral-900/40">
            <h2 className="text-xl font-semibold mb-2">Welcome to your Life Architecture</h2>
            <p className="text-white/60 text-sm mb-6">Your canvas is completely blank. Click the <span className="text-primary font-mono bg-primary/10 px-1 py-0.5 rounded">[ + NEW STRATEGY ]</span> button at the top to map your first timeline.</p>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStopInternal}
        isValidConnection={isValidConnection}
        colorMode="dark"
        nodesDraggable={appState === 'PLANNING'}
        nodesConnectable={appState === 'PLANNING'}
        elementsSelectable={true}
      >
        <Background variant="dots" color="#353437" gap={20} />
        <Controls className="bg-surface border border-outline-variant/20 fill-on-surface" />
        <MiniMap 
          className="bg-surface border border-outline-variant/20" 
          nodeColor={(n) => {
            if (n.type === 'genesis') return '#00ff00';
            if (n.data.status === 'critical') return '#f27d26';
            return '#353437';
          }}
          maskColor="rgba(14, 14, 16, 0.7)"
        />

        {/* Undo/Redo Controls */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={cn(
              "px-3 py-1.5 rounded-xl backdrop-blur-md border-[0.5px] border-white/5 text-[9px] font-headline font-bold uppercase tracking-[0.2em] transition-all active:scale-95 bg-neutral-900/40",
              canUndo ? "text-primary hover:bg-white/10" : "text-on-surface-variant opacity-30 cursor-not-allowed"
            )}
          >
            [ &lt; UNDO ]
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={cn(
              "px-3 py-1.5 rounded-xl backdrop-blur-md border-[0.5px] border-white/5 text-[9px] font-headline font-bold uppercase tracking-[0.2em] transition-all active:scale-95 bg-neutral-900/40",
              canRedo ? "text-primary hover:bg-white/10" : "text-on-surface-variant opacity-30 cursor-not-allowed"
            )}
          >
            [ REDO &gt; ]
          </button>
          <button
            onClick={() => {
              setShowCriticalPath(!showCriticalPath);
              onTraceCriticalPath();
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl backdrop-blur-md border-[0.5px] border-white/5 text-[9px] font-headline font-bold uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2",
              showCriticalPath 
                ? "bg-secondary text-surface-lowest border-secondary animate-pulse shadow-[0_0_10px_#FF4500]" 
                : "bg-neutral-900/40 text-on-surface-variant hover:bg-white/10"
            )}
          >
            <Activity size={12} />
            [ {showCriticalPath ? 'TRACING CRITICAL PATH' : 'TRACE CRITICAL PATH'} ]
          </button>
          <button
            onClick={onTidyGrid}
            className={cn(
              "px-3 py-1.5 rounded-xl backdrop-blur-md border-[0.5px] border-white/5 text-[9px] font-headline font-bold uppercase tracking-[0.2em] transition-all active:scale-95 text-primary hover:bg-white/10 bg-neutral-900/40"
            )}
          >
            [ TIDY GRID ]
          </button>
        </div>
      </ReactFlow>

      {/* FAB: Add Event */}
      {appState === 'PLANNING' && (
        <div className="absolute bottom-20 right-8 z-40 flex flex-col items-end gap-4">
          <AnimatePresence>
            {isAddMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="flex flex-col gap-2 backdrop-blur-md border-[0.5px] border-white/5 rounded-2xl p-2 shadow-[0_20px_80px_rgba(0,0,0,0.08)] bg-neutral-900/40"
              >
                <button
                  onClick={() => handleAddSpecificNode('genesis')}
                  className="px-4 py-2 text-left text-[10px] font-headline font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/30"
                >
                  [ + GENESIS ]
                </button>
                <button
                  onClick={() => handleAddSpecificNode('event')}
                  className="px-4 py-2 text-left text-[10px] font-headline font-bold uppercase tracking-widest text-[#4be277] hover:bg-[#4be277]/10 transition-colors border border-transparent hover:border-[#4be277]/30"
                >
                  [ + EVENT ]
                </button>
                <button
                  onClick={() => handleAddSpecificNode('objective')}
                  className="px-4 py-2 text-left text-[10px] font-headline font-bold uppercase tracking-widest text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors border border-transparent hover:border-[#FFD700]/30"
                >
                  [ + OBJECTIVE ]
                </button>
                <button
                  onClick={() => handleAddSpecificNode('note')}
                  className="px-4 py-2 text-left text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant hover:bg-on-surface-variant/10 transition-colors border border-transparent hover:border-on-surface-variant/30"
                >
                  [ + NOTE ]
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={handleAddNode}
            className={cn(
              "w-12 h-12 bg-primary text-black rounded-xl shadow-[0_20px_80px_rgba(0,0,0,0.08)] flex items-center justify-center hover:scale-105 transition-transform group",
              isAddMenuOpen && "rotate-45 bg-neutral-900/40 backdrop-blur-md border-[0.5px] border-white/5 text-primary"
            )}
          >
            <Plus size={24} />
            {!isAddMenuOpen && (
              <span className="absolute right-14 backdrop-blur-md border-[0.5px] border-white/5 rounded-xl px-3 py-2 text-[9px] font-headline uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-neutral-900/40">
                Inject Event
              </span>
            )}
          </button>
        </div>
      )}

      {/* Node Inspector Sidebar */}
      <AnimatePresence>
        {selectedNodeId && (
          <motion.div 
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="absolute top-4 right-4 bottom-4 w-80 backdrop-blur-md border-[0.5px] border-white/5 rounded-3xl z-30 shadow-[0_20px_80px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden bg-neutral-900/40"
          >
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-primary" />
                <h3 className="text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface">Node Inspector</h3>
              </div>
              <button 
                onClick={() => onSelectNode(null)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {isTemporalOverdraft && (
                <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-sm flex items-center gap-3 animate-pulse">
                  <AlertTriangle size={16} className="text-secondary" />
                  <span className="text-[10px] font-headline font-bold text-secondary uppercase tracking-widest">Temporal Overdraft Detected</span>
                </div>
              )}

              {selectedEvent?.type === 'genesis' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Genesis Name</label>
                    <input 
                      type="text"
                      value={selectedEvent.name}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { name: e.target.value })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-headline focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      checked={selectedEvent.isActiveGenesis}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { isActiveGenesis: e.target.checked })}
                      disabled={appState !== 'PLANNING'}
                      id="active-genesis"
                      className="w-4 h-4 rounded border-outline-variant/20 bg-surface-lowest text-primary focus:ring-primary"
                    />
                    <label htmlFor="active-genesis" className="text-[9px] font-headline uppercase tracking-widest text-on-surface">Active Starting Point</label>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Liquid Cash ($)</label>
                    <input 
                      type="number"
                      value={selectedEvent.initialCash}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { initialCash: parseFloat(e.target.value) || 0 })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Current Debt ($)</label>
                    <input 
                      type="number"
                      value={selectedEvent.initialDebt}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { initialDebt: parseFloat(e.target.value) || 0 })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="pt-4 border-t border-outline-variant/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary">Baseline Ledger</h4>
                      <button 
                        onClick={() => {
                          const newLedger = [...(selectedEvent.baselineLedger || []), { id: Math.random().toString(36).substr(2, 9), label: 'New Activity', type: 'Expense', value: 0, frequency: 'Monthly', relationalImpact: 0, spiritualImpact: 0 }];
                          handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                        }}
                        className="text-[9px] font-headline font-bold uppercase tracking-widest text-primary hover:underline"
                      >
                        [ + ADD ROW ]
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {(selectedEvent.baselineLedger || []).map((item: any) => (
                        <div key={item.id} className="p-2 bg-surface-lowest border border-outline-variant/10 rounded-sm space-y-2">
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const newLedger = selectedEvent.baselineLedger.map((i: any) => i.id === item.id ? { ...i, label: e.target.value } : i);
                                handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                              }}
                              placeholder="Label"
                              className="flex-1 bg-transparent border-none p-0 text-[10px] font-headline focus:ring-0"
                            />
                            <button 
                              onClick={() => {
                                const newLedger = selectedEvent.baselineLedger.filter((i: any) => i.id !== item.id);
                                handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                              }}
                              className="text-secondary hover:text-secondary/80"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <select 
                              value={item.type}
                              onChange={(e) => {
                                const newLedger = selectedEvent.baselineLedger.map((i: any) => i.id === item.id ? { ...i, type: e.target.value } : i);
                                handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                              }}
                              className="bg-transparent border-none p-0 text-[9px] font-headline uppercase tracking-widest focus:ring-0 w-16"
                            >
                              <option value="Income">Income</option>
                              <option value="Expense">Expense</option>
                              <option value="Time Use">Time Use</option>
                              <option value="Impact">Impact</option>
                            </select>

                            <select 
                              value={item.frequency || 'Monthly'}
                              onChange={(e) => {
                                const newLedger = selectedEvent.baselineLedger.map((i: any) => i.id === item.id ? { ...i, frequency: e.target.value } : i);
                                handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                              }}
                              className="bg-transparent border-none p-0 text-[9px] font-headline uppercase tracking-widest focus:ring-0 w-20"
                            >
                              <option value="Daily">Daily</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Bi-Weekly">Bi-Wkly</option>
                              <option value="Monthly">Monthly</option>
                              <option value="Yearly">Yearly</option>
                            </select>

                            <div className="flex-1 flex flex-col items-end">
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number"
                                  value={item.value}
                                  onChange={(e) => {
                                    const newLedger = selectedEvent.baselineLedger.map((i: any) => i.id === item.id ? { ...i, value: parseFloat(e.target.value) || 0 } : i);
                                    handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                                  }}
                                  className="w-16 bg-transparent border-none p-0 text-[10px] font-mono font-bold text-right focus:ring-0"
                                />
                                <span className="text-[8px] text-on-surface-variant uppercase">{item.type === 'Time Use' ? 'H' : '$'}</span>
                              </div>
                              {item.frequency && item.frequency !== (item.type === 'Time Use' ? 'Daily' : 'Monthly') && (
                                <span className="text-[7px] text-on-surface-variant opacity-60 font-mono">
                                  {item.type === 'Time Use' 
                                    ? `(${normalizeToDaily(item.value, item.frequency).toFixed(2)}h/day)`
                                    : `(${normalizeToMonthly(item.value, item.frequency).toFixed(0)}/mo)`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant/5">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[7px] uppercase tracking-tighter text-on-surface-variant">
                                <span>Relational</span>
                                <span>{item.relationalImpact}%</span>
                              </div>
                              <input 
                                type="range" min="-5" max="5" step="1"
                                value={item.relationalImpact}
                                onChange={(e) => {
                                  const newLedger = selectedEvent.baselineLedger.map((i: any) => i.id === item.id ? { ...i, relationalImpact: parseFloat(e.target.value) || 0 } : i);
                                  handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                                }}
                                className="w-full h-0.5 accent-primary"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[7px] uppercase tracking-tighter text-on-surface-variant">
                                <span>Spiritual</span>
                                <span>{item.spiritualImpact}%</span>
                              </div>
                              <input 
                                type="range" min="-5" max="5" step="1"
                                value={item.spiritualImpact}
                                onChange={(e) => {
                                  const newLedger = selectedEvent.baselineLedger.map((i: any) => i.id === item.id ? { ...i, spiritualImpact: parseFloat(e.target.value) || 0 } : i);
                                  handleUpdateEventInternal(selectedEvent.id, { baselineLedger: newLedger });
                                }}
                                className="w-full h-0.5 accent-primary"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant/10 space-y-4">
                    <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-secondary">Initial Baselines</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">System Health</label>
                          <span className="text-[10px] font-mono font-bold text-secondary">{selectedEvent.initialSystemHealth ?? 80}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" step="1"
                          value={selectedEvent.initialSystemHealth ?? 80}
                          onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { initialSystemHealth: parseFloat(e.target.value) || 0 })}
                          className="w-full h-1 bg-surface-lowest rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Relational Harmony</label>
                          <span className="text-[10px] font-mono font-bold text-blue-400">{selectedEvent.initialRelationalHarmony ?? 100}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" step="1"
                          value={selectedEvent.initialRelationalHarmony ?? 100}
                          onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { initialRelationalHarmony: parseFloat(e.target.value) || 0 })}
                          className="w-full h-1 bg-surface-lowest rounded-lg appearance-none cursor-pointer accent-blue-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Spiritual Alignment</label>
                          <span className="text-[10px] font-mono font-bold text-purple-400">{selectedEvent.initialSpiritualAlignment ?? 100}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" step="1"
                          value={selectedEvent.initialSpiritualAlignment ?? 100}
                          onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { initialSpiritualAlignment: parseFloat(e.target.value) || 0 })}
                          className="w-full h-1 bg-surface-lowest rounded-lg appearance-none cursor-pointer accent-purple-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedEvent?.type === 'objective' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Objective Name</label>
                    <input 
                      type="text"
                      value={selectedEvent.name}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { name: e.target.value })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-headline focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Target Capital ($)</label>
                    <input 
                      type="number"
                      value={selectedEvent.targetCapital}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { targetCapital: Number(e.target.value) || 0 })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Target Timeline (Months)</label>
                    <input 
                      type="number"
                      min="1"
                      max="120"
                      value={selectedEvent.targetTimeline}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { targetTimeline: Number(e.target.value) || 0 })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
              ) : selectedEvent?.type === 'note' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Annotation Content</label>
                    <textarea 
                      value={selectedEvent.content}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { content: e.target.value })}
                      disabled={appState !== 'PLANNING'}
                      rows={6}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-headline focus:border-primary focus:ring-0 transition-all disabled:opacity-50 resize-none"
                    />
                  </div>
                </div>
              ) : selectedEvent ? (
                <>
                  {appState === 'ACTIVE_PROTOCOL' && selectedEvent.status === 'ACTIVE' && (
                    <div className="mb-8">
                      <button 
                        onClick={() => onLogCompleted(selectedEvent.id)}
                        className="w-full py-4 bg-secondary text-on-secondary font-headline font-black uppercase tracking-[0.2em] hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-3"
                      >
                        <CheckCircle2 size={18} />
                        [ LOG AS COMPLETED ]
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Event Name</label>
                    <input 
                      type="text"
                      value={selectedEvent.name || ''}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { name: e.target.value })}
                      disabled={appState !== 'PLANNING'}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-headline focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2 mt-4">
                    <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Event Status</label>
                    <select
                      value={selectedEvent.status || 'PENDING'}
                      onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { status: e.target.value })}
                      className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-headline focus:border-primary focus:ring-0 transition-all"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="FAILED">FAILED</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Execution Month</label>
                      <input 
                        type="number"
                        min="1"
                        max={targetTimeline}
                        value={selectedEvent.month ?? 1}
                        onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { month: Number(e.target.value) || 0 })}
                        disabled={appState !== 'PLANNING'}
                        className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Time Reclaimed (H)</label>
                      <input 
                        type="number"
                        step="0.5"
                        value={selectedEvent.timeReclaimed ?? 0}
                        onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { timeReclaimed: Number(e.target.value) || 0 })}
                        disabled={appState !== 'PLANNING'}
                        className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 px-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-secondary">Capital Outflow (Costs)</h4>
                      <div className="space-y-2">
                        <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Immediate Cost ($)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant">$</span>
                          <input 
                            type="number"
                            value={selectedEvent.immediateCost ?? 0}
                            onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { immediateCost: Number(e.target.value) || 0 })}
                            disabled={appState !== 'PLANNING'}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 pl-7 pr-3 text-xs font-mono focus:border-secondary focus:ring-0 transition-all disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Ongoing Monthly Cost ($)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant">$</span>
                          <input 
                            type="number"
                            value={selectedEvent.ongoingCost ?? 0}
                            onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { ongoingCost: Number(e.target.value) || 0 })}
                            disabled={appState !== 'PLANNING'}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 pl-7 pr-3 text-xs font-mono focus:border-secondary focus:ring-0 transition-all disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-outline-variant/10">
                      <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary">Capital Inflow (Revenue)</h4>
                      <div className="space-y-2">
                        <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Immediate Income ($)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant">$</span>
                          <input 
                            type="number"
                            value={selectedEvent.immediateIncome ?? 0}
                            onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { immediateIncome: Number(e.target.value) || 0 })}
                            disabled={appState !== 'PLANNING'}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 pl-7 pr-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Ongoing Monthly Income ($)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant">$</span>
                          <input 
                            type="number"
                            value={selectedEvent.monthlyIncome ?? 0}
                            onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { monthlyIncome: Number(e.target.value) || 0 })}
                            disabled={appState !== 'PLANNING'}
                            className="w-full bg-surface-lowest border border-outline-variant/20 rounded-sm py-2 pl-7 pr-3 text-xs font-mono focus:border-primary focus:ring-0 transition-all disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Relational Impact</label>
                        <span className={cn("text-[10px] font-mono font-bold", selectedEvent.relationalImpact > 0 ? "text-primary" : selectedEvent.relationalImpact < 0 ? "text-secondary" : "text-on-surface-variant")}>
                          {selectedEvent.relationalImpact > 0 ? '+' : ''}{selectedEvent.relationalImpact}%
                        </span>
                      </div>
                      <input 
                        type="range"
                        min="-10"
                        max="10"
                        step="1"
                        value={selectedEvent.relationalImpact ?? 0}
                        onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { relationalImpact: Number(e.target.value) || 0 })}
                        disabled={appState !== 'PLANNING'}
                        className="w-full h-1 bg-surface-lowest rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Spiritual Impact</label>
                        <span className={cn("text-[10px] font-mono font-bold", selectedEvent.spiritualImpact > 0 ? "text-primary" : selectedEvent.spiritualImpact < 0 ? "text-secondary" : "text-on-surface-variant")}>
                          {selectedEvent.spiritualImpact > 0 ? '+' : ''}{selectedEvent.spiritualImpact}%
                        </span>
                      </div>
                      <input 
                        type="range"
                        min="-10"
                        max="10"
                        step="1"
                        value={selectedEvent.spiritualImpact ?? 0}
                        onChange={(e) => handleUpdateEventInternal(selectedEvent.id, { spiritualImpact: Number(e.target.value) || 0 })}
                        disabled={appState !== 'PLANNING'}
                        className="w-full h-1 bg-surface-lowest rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>

                  {selectedEvent.isOrphaned && (
                    <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-sm flex items-center gap-3">
                      <AlertTriangle size={16} className="text-secondary" />
                      <span className="text-[9px] font-headline font-bold text-secondary uppercase tracking-widest leading-tight">Orphaned Node: No Impact on Critical Path</span>
                    </div>
                  )}

                  <div className="pt-6 border-t border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Network size={14} className="text-on-surface-variant" />
                      <span className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant">Dependencies</span>
                    </div>
                    <div className="space-y-2">
                      {selectedEvent.dependencies.length === 0 ? (
                        <p className="text-[9px] text-on-surface-variant italic">No manual dependencies. Sequential auto-wiring active.</p>
                      ) : (
                        selectedEvent.dependencies.map((dep: any) => {
                          const depId = typeof dep === 'string' ? dep : dep.id;
                          const depNode = depId === 'genesis' ? { name: 'Genesis' } : timelineEvents.find(e => e.id === depId);
                          return (
                            <div key={depId} className="flex items-center justify-between bg-surface-container p-2 border border-outline-variant/10">
                              <span className="text-[10px] uppercase font-bold">{depNode?.name || 'Unknown'}</span>
                              <button 
                                onClick={() => onUpdateEvent(selectedEvent.id, { dependencies: selectedEvent.dependencies.filter((d: any) => (typeof d === 'string' ? d !== depId : d.id !== depId)) })}
                                className="text-secondary hover:text-secondary/80"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {selectedEvent && appState === 'PLANNING' && (
              <div className="p-6 bg-surface-container border-t border-outline-variant/10">
                <button 
                  onClick={() => { onDeleteEvent(selectedEvent.id); onSelectNode(null); }}
                  className="w-full py-2 bg-secondary/10 border border-secondary/30 text-secondary text-[10px] font-headline uppercase tracking-widest font-bold hover:bg-secondary/20 transition-all"
                >
                  Delete Event Node
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
