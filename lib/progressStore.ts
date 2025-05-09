const progressByRange: Record<string, number> = {};

export function setProgress(fromDate: string, toDate: string, progress: number) {
  const key = `${fromDate}_${toDate}`;
  progressByRange[key] = progress;
}

export function getProgress(fromDate: string, toDate: string): number {
  const key = `${fromDate}_${toDate}`;
  return progressByRange[key] ?? 0;
}