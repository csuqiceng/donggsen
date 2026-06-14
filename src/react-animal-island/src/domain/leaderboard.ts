export function isOnline(lastActive: number, now: number): boolean {
  if (!lastActive) return false;
  return now - lastActive < 120000;
}
