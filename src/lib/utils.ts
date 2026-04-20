import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function findCriticalPath(nodes: any[], edges: any[], genesisId: string, objectiveId: string) {
  // 1. Build adjacency list
  const adj: Record<string, string[]> = {};
  nodes.forEach(node => adj[node.id] = []);
  edges.forEach(edge => {
    if (adj[edge.source]) {
      adj[edge.source].push(edge.target);
    }
  });

  // 2. Find all paths from genesis to objective using DFS
  const allPaths: string[][] = [];
  function findPaths(currentId: string, path: string[]) {
    if (currentId === objectiveId) {
      allPaths.push([...path]);
      return;
    }
    
    const neighbors = adj[currentId] || [];
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        findPaths(neighbor, [...path, neighbor]);
      }
    }
  }

  findPaths(genesisId, [genesisId]);

  if (allPaths.length === 0) return { nodeIds: [], edgeIds: [] };

  // 3. Calculate weight of each path
  // Refinement: The absolute longest/heaviest path based on node count (proxy for execution complexity)
  // This ensures that if Path A and Path B both reach the Objective, only the true bottleneck is highlighted.
  let longestPath: string[] = [];
  let maxWeight = -1;

  allPaths.forEach(path => {
    // Weight is the number of nodes in the path. 
    // In this deterministic model, more nodes = more execution months/steps.
    const weight = path.length;
    
    if (weight > maxWeight) {
      maxWeight = weight;
      longestPath = path;
    } else if (weight === maxWeight) {
      // Tie-breaker: could use alphabetical or other stable criteria to ensure ONLY ONE path is highlighted
      if (path.join('-') < longestPath.join('-')) {
        longestPath = path;
      }
    }
  });

  // 4. Return node and edge IDs
  const nodeIds = longestPath;
  const edgeIds: string[] = [];
  for (let i = 0; i < longestPath.length - 1; i++) {
    const source = longestPath[i];
    const target = longestPath[i + 1];
    const edge = edges.find(e => e.source === source && e.target === target);
    if (edge) edgeIds.push(edge.id);
  }

  return { nodeIds, edgeIds };
}
