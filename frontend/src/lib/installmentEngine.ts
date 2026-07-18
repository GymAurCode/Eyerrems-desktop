export function generateInstallmentSchedule(
  totalAmount: number,
  downPayment: number,
  numInstallments: number,
  startDate: string
): Array<{ installmentNo: number; dueDate: string; amount: number }> {
  const schedule = [];
  const remaining = totalAmount - downPayment;
  const perInstallment = remaining / numInstallments;
  const start = new Date(startDate);

  for (let i = 1; i <= numInstallments; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    schedule.push({
      installmentNo: i,
      dueDate: due.toISOString().split("T")[0],
      amount: Math.round(perInstallment * 100) / 100,
    });
  }
  return schedule;
}
