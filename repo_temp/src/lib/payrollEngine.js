/**
 * Payroll calculation engine
 * Computes attendance summary, deductions, bonuses, advances → final salary
 */

export function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? mins / 60 : 0;
}

/** Summarise attendance records for one employee in a month */
export function summariseAttendance(records) {
  let present = 0, absent = 0, late = 0, halfDay = 0, vacation = 0, totalHours = 0;
  records.forEach(r => {
    totalHours += r.hours_worked || calcHours(r.check_in, r.check_out);
    if (r.status === 'present') present++;
    else if (r.status === 'late') { late++; present++; } // late counts as present
    else if (r.status === 'absent') absent++;
    else if (r.status === 'half_day') { halfDay++; present += 0.5; }
    else if (r.status === 'vacation') vacation++;
  });
  return { present, absent, late, halfDay, vacation, totalHours };
}

/**
 * Calculate deductions for an employee based on attendance + rules
 * @param {object} summary - from summariseAttendance
 * @param {number} baseSalary
 * @param {number} workingDaysInMonth - typically 26 or 30
 * @param {Array} rules - DeductionRule records
 * @returns {number} total deduction amount
 */
export function calcDeductions(summary, baseSalary, workingDaysInMonth, rules) {
  const dailySalary = workingDaysInMonth > 0 ? baseSalary / workingDaysInMonth : 0;
  let total = 0;

  rules.filter(r => r.is_active !== false).forEach(rule => {
    if (rule.type === 'absent') {
      const amount = rule.deduction_type === 'fixed'
        ? (rule.amount || 0) * summary.absent
        : dailySalary * (rule.fraction ?? 1) * summary.absent;
      total += amount;
    }
    if (rule.type === 'late') {
      const amount = rule.deduction_type === 'fixed'
        ? (rule.amount || 0) * summary.late
        : dailySalary * (rule.fraction ?? 0.5) * summary.late;
      total += amount;
    }
    if (rule.type === 'half_day') {
      const amount = rule.deduction_type === 'fixed'
        ? (rule.amount || 0) * summary.halfDay
        : dailySalary * (rule.fraction ?? 0.5) * summary.halfDay;
      total += amount;
    }
  });
  return Math.max(0, total);
}

/**
 * Build full payroll row for a single employee in a given month
 */
export function buildPayrollRow(employee, attendanceRecords, bonuses, advances, rules, workingDaysInMonth = 26) {
  const summary = summariseAttendance(attendanceRecords);
  const deductions = calcDeductions(summary, employee.base_salary || 0, workingDaysInMonth, rules);
  const totalBonuses = bonuses.reduce((s, b) => s + (b.amount || 0), 0);
  const totalAdvances = advances.reduce((s, a) => s + (a.amount || 0), 0);
  const finalSalary = Math.max(0, (employee.base_salary || 0) + totalBonuses - deductions - totalAdvances);

  return {
    employee_id: employee.id,
    employee_name: employee.name,
    branch: employee.branch,
    base_salary: employee.base_salary || 0,
    bonuses: totalBonuses,
    deductions,
    advances: totalAdvances,
    final_salary: finalSalary,
    present_days: summary.present,
    absent_days: summary.absent,
    late_days: summary.late,
    total_hours: summary.totalHours,
    attendance_rate: attendanceRecords.length > 0
      ? Math.round((summary.present / attendanceRecords.length) * 100)
      : 100,
  };
}

/** Month string helpers */
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${month}-${String(last).padStart(2, '0')}`;
  return { from, to };
}