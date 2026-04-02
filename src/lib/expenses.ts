export interface Balance {
  from: string;
  to: string;
  amount: number;
}

export function simplifyDebts(
  balances: Record<string, number>
): Balance[] {
  // balances: userId -> net amount (positive = gets back, negative = owes)
  // This produces a Splitwise-style simplified settlement graph:
  // minimum practical payer -> receiver transfers after netting everyone out.
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, amount] of Object.entries(balances)) {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded < 0) debtors.push({ id, amount: -rounded });
    else if (rounded > 0) creditors.push({ id, amount: rounded });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const result: Balance[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    if (payment > 0.01) {
      result.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: Math.round(payment * 100) / 100,
      });
    }
    debtors[i].amount -= payment;
    creditors[j].amount -= payment;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return result;
}
