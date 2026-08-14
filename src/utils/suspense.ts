export function applySuspenseRotation<T>(teams: T[], isSuspenseMode: boolean | undefined, step: number): T[] {
  if (!isSuspenseMode || !teams || teams.length < 2) return teams;

  const result = [...teams];
  if (result.length === 2) {
    if (step % 2 === 1) {
      const temp = result[0];
      result[0] = result[1];
      result[1] = temp;
    }
  } else if (result.length >= 3) {
    const rot = step % 3;
    if (rot === 1) {
      // 2nd -> 1st, 3rd -> 2nd, 1st -> 3rd
      const [t1, t2, t3] = [result[0], result[1], result[2]];
      result[0] = t2;
      result[1] = t3;
      result[2] = t1;
    } else if (rot === 2) {
      // 3rd -> 1st, 1st -> 2nd, 2nd -> 3rd
      const [t1, t2, t3] = [result[0], result[1], result[2]];
      result[0] = t3;
      result[1] = t1;
      result[2] = t2;
    }
  }
  return result;
}
