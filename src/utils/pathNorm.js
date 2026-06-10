/** Normalize path for cross-platform comparison (Windows vs POSIX). */
export function normPathKey(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase().replace(/\/$/, '')
}
