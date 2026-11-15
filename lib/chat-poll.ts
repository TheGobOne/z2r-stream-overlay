/**
 * The player the vote picks: most votes wins. A tie goes to whoever already has the sound when they are
 * among the tied, otherwise to the lowest player number. No votes means no change (null).
 */
export function pickWinner(counts: number[], current: number | null): number | null {
  const max = Math.max(0, ...counts)
  if (max === 0) return null
  const tied = counts.flatMap((c, i) => (c === max ? [i] : []))
  return current !== null && tied.includes(current) ? current : tied[0]
}
