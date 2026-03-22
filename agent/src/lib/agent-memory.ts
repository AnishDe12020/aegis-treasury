import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface DecisionOutcome {
  executed?: boolean;
  success?: boolean;
  returnPct?: number;
  pnl?: number;
  confidence?: number;
  notes?: string;
}

export interface DecisionRecord {
  timestamp: string;
  action: string;
  reasoning: string;
  outcome: DecisionOutcome;
}

interface PerformanceRecord {
  timestamp: string;
  action: string;
  success: boolean;
  returnPct: number;
  pnl: number;
}

interface AgentMemoryData {
  decisions: DecisionRecord[];
  performanceHistory: PerformanceRecord[];
  learnedPatterns: string[];
}

export interface PerformanceStats {
  winRate: number;
  averageReturn: number;
  totalPnL: number;
  totalDecisions: number;
  evaluatedDecisions: number;
}

const DEFAULT_MEMORY_PATH = path.resolve(process.cwd(), 'data', 'agent-memory.json');

function buildDefaultMemory(): AgentMemoryData {
  return {
    decisions: [],
    performanceHistory: [],
    learnedPatterns: [],
  };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export class AgentMemory {
  private cache: AgentMemoryData | null = null;

  constructor(private readonly filePath = DEFAULT_MEMORY_PATH) {}

  private async ensureStorage(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(
        this.filePath,
        `${JSON.stringify(buildDefaultMemory(), null, 2)}\n`,
        'utf8',
      );
    }
  }

  private normalize(data: unknown): AgentMemoryData {
    if (!data || typeof data !== 'object') {
      return buildDefaultMemory();
    }

    const raw = data as Partial<AgentMemoryData>;
    const decisions = Array.isArray(raw.decisions) ? raw.decisions : [];
    const performanceHistory = Array.isArray(raw.performanceHistory) ? raw.performanceHistory : [];
    const learnedPatterns = Array.isArray(raw.learnedPatterns)
      ? raw.learnedPatterns.filter((pattern): pattern is string => typeof pattern === 'string')
      : [];

    return {
      decisions: decisions
        .filter(
          (entry): entry is DecisionRecord =>
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as DecisionRecord).timestamp === 'string' &&
            typeof (entry as DecisionRecord).action === 'string' &&
            typeof (entry as DecisionRecord).reasoning === 'string',
        )
        .map((entry) => ({
          ...entry,
          outcome: entry.outcome && typeof entry.outcome === 'object' ? entry.outcome : {},
        })),
      performanceHistory: performanceHistory.filter(
        (entry): entry is PerformanceRecord =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as PerformanceRecord).timestamp === 'string' &&
          typeof (entry as PerformanceRecord).action === 'string' &&
          typeof (entry as PerformanceRecord).success === 'boolean' &&
          typeof (entry as PerformanceRecord).returnPct === 'number' &&
          Number.isFinite((entry as PerformanceRecord).returnPct) &&
          typeof (entry as PerformanceRecord).pnl === 'number' &&
          Number.isFinite((entry as PerformanceRecord).pnl),
      ),
      learnedPatterns,
    };
  }

  private deriveLearnedPatterns(data: AgentMemoryData): string[] {
    const byAction = new Map<string, { wins: number; total: number; returnSum: number }>();

    for (const record of data.performanceHistory) {
      const current = byAction.get(record.action) ?? { wins: 0, total: 0, returnSum: 0 };
      current.total += 1;
      current.returnSum += record.returnPct;
      if (record.success) {
        current.wins += 1;
      }
      byAction.set(record.action, current);
    }

    const patterns: string[] = [];
    for (const [action, summary] of byAction.entries()) {
      if (summary.total < 3) {
        continue;
      }

      const winRate = summary.wins / summary.total;
      const avgReturn = summary.returnSum / summary.total;

      if (winRate >= 0.65) {
        patterns.push(
          `Action "${action}" has a ${(winRate * 100).toFixed(1)}% win rate over ${summary.total} evaluated decisions.`,
        );
      }

      if (avgReturn >= 1) {
        patterns.push(
          `Action "${action}" averages ${avgReturn.toFixed(2)}% return across ${summary.total} evaluated decisions.`,
        );
      }

      if (winRate <= 0.35) {
        patterns.push(
          `Action "${action}" underperforms with a ${(winRate * 100).toFixed(1)}% win rate over ${summary.total} evaluated decisions.`,
        );
      }
    }

    if (patterns.length === 0 && data.performanceHistory.length > 0) {
      patterns.push('Insufficient signal to identify strong patterns yet.');
    }

    return patterns;
  }

  private async load(): Promise<AgentMemoryData> {
    if (this.cache) {
      return this.cache;
    }

    await this.ensureStorage();
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      this.cache = this.normalize(JSON.parse(content));
    } catch {
      this.cache = buildDefaultMemory();
      await this.save(this.cache);
    }

    return this.cache;
  }

  private async save(data: AgentMemoryData): Promise<void> {
    await this.ensureStorage();
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    this.cache = data;
  }

  async recordDecision(action: string, reasoning: string, outcome: DecisionOutcome): Promise<void> {
    const data = await this.load();

    const decision: DecisionRecord = {
      timestamp: new Date().toISOString(),
      action,
      reasoning,
      outcome,
    };

    data.decisions.push(decision);

    const numericReturn = toFiniteNumber(outcome.returnPct);
    const numericPnl = toFiniteNumber(outcome.pnl);
    const success = typeof outcome.success === 'boolean' ? outcome.success : null;

    if (numericReturn !== null || numericPnl !== null || success !== null) {
      const derivedSuccess =
        success ?? (numericReturn !== null ? numericReturn > 0 : (numericPnl ?? 0) > 0);

      data.performanceHistory.push({
        timestamp: decision.timestamp,
        action,
        success: derivedSuccess,
        returnPct: numericReturn ?? 0,
        pnl: numericPnl ?? 0,
      });
    }

    data.learnedPatterns = this.deriveLearnedPatterns(data);
    await this.save(data);
  }

  async getDecisionHistory(limit = 20): Promise<DecisionRecord[]> {
    const data = await this.load();
    if (limit <= 0) {
      return [];
    }

    return data.decisions.slice(-limit).reverse();
  }

  async getPerformanceStats(): Promise<PerformanceStats> {
    const data = await this.load();
    const evaluated = data.performanceHistory;

    if (evaluated.length === 0) {
      return {
        winRate: 0,
        averageReturn: 0,
        totalPnL: 0,
        totalDecisions: data.decisions.length,
        evaluatedDecisions: 0,
      };
    }

    const wins = evaluated.filter((record) => record.success).length;
    const totalReturn = evaluated.reduce((sum, record) => sum + record.returnPct, 0);
    const totalPnL = evaluated.reduce((sum, record) => sum + record.pnl, 0);

    return {
      winRate: wins / evaluated.length,
      averageReturn: totalReturn / evaluated.length,
      totalPnL,
      totalDecisions: data.decisions.length,
      evaluatedDecisions: evaluated.length,
    };
  }

  async getLearnedPatterns(): Promise<string[]> {
    const data = await this.load();
    return [...data.learnedPatterns];
  }
}
