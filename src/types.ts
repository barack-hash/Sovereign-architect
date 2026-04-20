export type ConstraintType = 'MIN_CASH' | 'MAX_BURN' | 'MIN_SYSTEM_HEALTH' | 'MAX_TIME_LOAD';

export interface Constraint {
  id: string;
  type: ConstraintType;
  threshold: number;
  severity: 'Warning' | 'Critical';
}

export interface Violation {
  constraintId: string;
  message: string;
  severity: 'Warning' | 'Critical';
}
