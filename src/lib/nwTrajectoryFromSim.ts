/** 121 points (months 0–120): sim months from rows, then compound + savings tail (Terminal-consistent). */
export function buildTenYearNwFromSim(
  rows: Array<{ month: number; Financial?: number }>,
  targetTimeline: number,
  monthlyYield: number,
  liveMonthlySavings: number
): number[] {
  const map = new Map<number, number>();
  for (const r of rows) {
    if (typeof r.month === 'number' && typeof r.Financial === 'number') {
      map.set(r.month, r.Financial);
    }
  }
  const pts: number[] = [];
  let nw = map.get(0) ?? 0;
  pts.push(nw);
  for (let m = 1; m <= 120; m++) {
    if (m <= targetTimeline && map.has(m)) {
      nw = map.get(m)!;
    } else {
      nw = nw * (1 + monthlyYield) + liveMonthlySavings;
    }
    pts.push(nw);
  }
  return pts;
}
