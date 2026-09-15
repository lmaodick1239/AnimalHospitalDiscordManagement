export function assertShiftNumber(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > 99999) {
    throw new Error("shift number must be an integer from 1 to 99999");
  }
}

export function nextCounter(current: number, adminOverride?: number): { shiftNumber: number; counter: number } {
  if (adminOverride === undefined) {
    const shiftNumber = current + 1;
    assertShiftNumber(shiftNumber);
    return { shiftNumber, counter: shiftNumber };
  }
  assertShiftNumber(adminOverride);
  return {
    shiftNumber: adminOverride,
    counter: Math.max(current, adminOverride),
  };
}
