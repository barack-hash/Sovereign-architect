import { useState, useCallback } from 'react';

export interface CanvasState {
  timelineEvents: any[];
  objectiveDependencies: string[];
  currentCash: number;
  currentDebt: number;
  baseMonthlyIncome: number;
  goalName: string;
  targetCapital: number;
  targetTimeline: number;
  burnRateLedger: any[];
}

export function useCanvasHistory() {
  const [past, setPast] = useState<CanvasState[]>([]);
  const [future, setFuture] = useState<CanvasState[]>([]);

  const recordHistory = useCallback((currentState: CanvasState) => {
    setPast(prev => {
      // Limit history size to 50 steps
      const newPast = [...prev, JSON.parse(JSON.stringify(currentState))];
      if (newPast.length > 50) return newPast.slice(1);
      return newPast;
    });
    setFuture([]);
  }, []);

  const undo = useCallback((currentState: CanvasState) => {
    if (past.length === 0) return null;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture(prev => [JSON.parse(JSON.stringify(currentState)), ...prev]);
    
    return JSON.parse(JSON.stringify(previous));
  }, [past]);

  const redo = useCallback((currentState: CanvasState) => {
    if (future.length === 0) return null;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    setFuture(newFuture);
    setPast(prev => [...prev, JSON.parse(JSON.stringify(currentState))]);
    
    return JSON.parse(JSON.stringify(next));
  }, [future]);

  return {
    undo,
    redo,
    recordHistory,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  };
}
