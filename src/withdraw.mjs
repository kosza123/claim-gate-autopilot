export function withdraw(balance, amount) {
  const next = Number(balance) - Number(amount);
  if (!Number.isFinite(next) || next < 0) throw new Error("insufficient funds");
  return next;
}
