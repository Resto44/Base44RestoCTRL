/**
 * Payroll calculation engine
 * Computes attendance summary, deductions, bonuses, advances → final salary
 */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function employeeKey(employee = {}) {
  return employee.employee_id ?? employee.id ?? '';
}

export function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut || typeof checkIn !== 'string' || typeof checkOut !== 'string') return 0;

  const [ih, im = 0] = checkIn.split(':').map(Number);
  const [oh, om = 0] = checkOut.split(':').map(Number);

  if (![ih, im, oh, om].every(Number.isFinite)) return 0;

  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? mins / 60 : 0;
}

/** Summarise attendance records for one employee in a month */
export function summariseAttendance(records = []) {
  let present = 0;
  let absent = 0;
  let late = 0;
  let halfDay = 0;
  let vacation = 0;
  let totalHours = 0;
  let accountableDays = 0;

  safeArray(records).forEach(r => {
    if (!r) return;

    totalHours += toNumber(r.hours_worked) || calcHours(r.check_in, r.check_out);

    if (r.status === 'present') {
      present++;
      accountableDays++;
    } else if (r.status === 'late') {
      late++;
      present++;
      accountableDays++;
    } else if (r.status === 'absent') {
      absent++;
      accountableDays++;
    } else if (r.status === 'half_day') {
      halfDay++;
      present += 0.5;
      accountableDays++;
    } else if (r.status === 'vacation') {
      vacation++;
    }
  });

  return { present, absent, late, halfDay, vacation, totalHours, accountableDays };
}

/**
 * Calculate deductions for an employee based on attendance + rules
 * @param {object} summary - from summariseAttendance
 * @param {number} baseSalary
 * @param {number} workingDaysInMonth - typically 26 or 30
 * @param {Array} rules - DeductionRule records
 * @returns {number} total deduction amount
 */
export function calcDeductions(summary = {}, baseSalary = 0, workingDaysInMonth = 26, rules = []) {
  const safeBaseSalary = toNumber(baseSalary);
  const safeWorkingDays = toNumber(workingDaysInMonth);
  const dailySalary = safeWorkingDays > 0 ? safeBaseSalary / safeWorkingDays : 0;
  let total = 0;

  // DB columns: applies_to (not type), rule_name (not name), late_threshold (not late_threshold_minutes)
  // There is no is_active column in deduction_rules — all stored rules are active.
  safeArray(rules).forEach(rule => {
    // Support both legacy field name (type) and DB field name (applies_to) for safety
    const ruleType = rule.applies_to || rule.type;
    if (ruleType === 'absent') {
      const amount = rule.deduction_type === 'fixed'
        ? toNumber(rule.amount) * toNumber(summary.absent)
        : dailySalary * toNumber(rule.fraction ?? 1) * toNumber(summary.absent);
      total += amount;
    }
    if (ruleType === 'late') {
      const amount = rule.deduction_type === 'fixed'
        ? toNumber(rule.amount) * toNumber(summary.late)
        : dailySalary * toNumber(rule.fraction ?? 0.5) * toNumber(summary.late);
      total += amount;
    }
    if (ruleType === 'half_day') {
      const amount = rule.deduction_type === 'fixed'
        ? toNumber(rule.amount) * toNumber(summary.halfDay)
        : dailySalary * toNumber(rule.fraction ?? 0.5) * toNumber(summary.halfDay);
      total += amount;
    }
  });

  return Math.max(0, total);
}

/**
 * Build full payroll row for a single employee in a given month
 */
export function buildPayrollRow(employee = {}, attendanceRecords = [], bonuses = [], advances = [], rules = [], workingDaysInMonth = 26) {
  const safeAttendanceRecords = safeArray(attendanceRecords);
  const safeBonuses = safeArray(bonuses);
  const safeAdvances = safeArray(advances);
  const baseSalary = toNumber(employee.base_salary);
  const summary = summariseAttendance(safeAttendanceRecords);
  const deductions = calcDeductions(summary, baseSalary, workingDaysInMonth, rules);
  const totalBonuses = safeBonuses.reduce((s, b) => s + toNumber(b?.amount), 0);
  const totalAdvances = safeAdvances.reduce((s, a) => s + toNumber(a?.amount), 0);
  const finalSalary = Math.max(0, baseSalary + totalBonuses - deductions - totalAdvances);
  const attendanceRate = summary.accountableDays > 0
    ? clamp(Math.round((summary.present / summary.accountableDays) * 100))
    : 0;

  return {
    employee_id: employeeKey(employee),
    employee_name: employee.full_name || employee.employee_name || '',
    branch: employee.branch || 'unassigned',
    base_salary: baseSalary,
    bonuses: totalBonuses,
    deductions,
    advances: totalAdvances,
    final_salary: finalSalary,
    present_days: summary.present,
    absent_days: summary.absent,
    late_days: summary.late,
    total_hours: summary.totalHours,
    attendance_rate: attendanceRate,
  };
}

/** Month string helpers */
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month) {
  const safeMonth = typeof month === 'string' && /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
  const [y, m] = safeMonth.split('-').map(Number);
  const from = `${safeMonth}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${safeMonth}-${String(last).padStart(2, '0')}`;
  return { from, to };
}
