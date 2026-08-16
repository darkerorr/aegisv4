export type DiffLineType = "add" | "del" | "equal";

export interface DiffLine {
  type: DiffLineType;
  oldLine?: number;
  newLine?: number;
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

/** Maximum combined input lines for the exact DP diff; beyond that we fall back
 * to a coarse prefix/suffix diff so memory stays bounded on pathological files. */
const COARSE_LIMIT = 4_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  const n = a.length;
  const m = b.length;
  if (n + m === 0) return [];
  if (n + m > COARSE_LIMIT) return coarseDiff(a, b);

  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  for (let i = 1; i <= n; i += 1) {
    const row = i * width;
    const prevRow = row - width;
    for (let j = 1; j <= m; j += 1) {
      dp[row + j] = a[i - 1] === b[j - 1]
        ? dp[prevRow + j - 1] + 1
        : Math.max(dp[prevRow + j], dp[row + j - 1]);
    }
  }

  const edits: DiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      edits.push({ type: "equal", oldLine: i, newLine: j, text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (dp[(i - 1) * width + j] >= dp[i * width + j - 1]) {
      edits.push({ type: "del", oldLine: i, text: a[i - 1] });
      i -= 1;
    } else {
      edits.push({ type: "add", newLine: j, text: b[j - 1] });
      j -= 1;
    }
  }
  while (i > 0) {
    edits.push({ type: "del", oldLine: i, text: a[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    edits.push({ type: "add", newLine: j, text: b[j - 1] });
    j -= 1;
  }
  edits.reverse();
  return edits;
}

function coarseDiff(a: string[], b: string[]): DiffLine[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  const edits: DiffLine[] = [];
  for (let i = 0; i < head; i += 1) edits.push({ type: "equal", oldLine: i + 1, newLine: i + 1, text: a[i] });
  for (let i = head; i < a.length - tail; i += 1) edits.push({ type: "del", oldLine: i + 1, text: a[i] });
  for (let i = head; i < b.length - tail; i += 1) edits.push({ type: "add", newLine: i + 1, text: b[i] });
  for (let i = 0; i < tail; i += 1) {
    const oldLine = a.length - tail + i + 1;
    const newLine = b.length - tail + i + 1;
    edits.push({ type: "equal", oldLine, newLine, text: a[a.length - tail + i] });
  }
  return edits;
}

export function diffHunks(before: string, after: string, context = 2): DiffHunk[] {
  const lines = diffLines(before, after);
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let idx = 0; idx <= lines.length; idx += 1) {
    const changed = idx < lines.length && lines[idx].type !== "equal";
    if (changed && start === -1) start = idx;
    if (!changed && start !== -1) {
      runs.push([start, idx]);
      start = -1;
    }
  }
  const spans: Array<[number, number]> = [];
  for (const [runStart, runEnd] of runs) {
    const spanStart = Math.max(0, runStart - context);
    const spanEnd = Math.min(lines.length, runEnd + context);
    const last = spans[spans.length - 1];
    if (last && spanStart <= last[1]) last[1] = Math.max(last[1], spanEnd);
    else spans.push([spanStart, spanEnd]);
  }

  const hunks: DiffHunk[] = [];
  for (const [spanStart, spanEnd] of spans) {
    let oldStart = 0;
    let newStart = 0;
    for (const line of lines.slice(0, spanStart)) {
      if (line.type !== "add") oldStart += 1;
      if (line.type !== "del") newStart += 1;
    }
    oldStart += 1;
    newStart += 1;
    let oldCount = 0;
    let newCount = 0;
    const hunkLines = lines.slice(spanStart, spanEnd);
    for (const line of hunkLines) {
      if (line.type !== "add") oldCount += 1;
      if (line.type !== "del") newCount += 1;
    }
    hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines });
  }
  return hunks;
}

export function diffStats(before: string, after: string): { adds: number; dels: number } {
  let adds = 0;
  let dels = 0;
  for (const line of diffLines(before, after)) {
    if (line.type === "add") adds += 1;
    else if (line.type === "del") dels += 1;
  }
  return { adds, dels };
}