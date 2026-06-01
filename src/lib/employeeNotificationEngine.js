import { base44 } from '@/api/base44Client';

/**
 * Employee Notification Engine
 * Handles all employee-related real-time notifications
 */

class EmployeeNotificationEngine {
  async notifyCheckIn(employee, branch, checkInTime) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'login_alert',
      title: `کارمند ${employee.full_name} وارد شد`,
      message: `${employee.full_name} وارد فرع ${branch} شد — ${checkInTime}`,
      severity: 'info',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        check_in_time: checkInTime,
      }),
    });
  }

  async notifyCheckOut(employee, branch, checkOutTime) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'login_alert',
      title: `کارمند ${employee.full_name} خارج شد`,
      message: `${employee.full_name} از فرع ${branch} خارج شد — ${checkOutTime}`,
      severity: 'info',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        check_out_time: checkOutTime,
      }),
    });
  }

  async notifyAbsence(employee, branch, date) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'suspicious_activity',
      title: `کارمند ${employee.full_name} غير حاضر`,
      message: `${employee.full_name} امروز به فرع ${branch} نيامد`,
      severity: 'warning',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        date,
      }),
    });
  }

  async notifyLateArrival(employee, branch, checkInTime, minutesLate) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'expense_spike',
      title: `کارمند ${employee.full_name} دير آمد`,
      message: `${employee.full_name} ${minutesLate} دقيقه دير به فرع ${branch} آمد`,
      severity: 'warning',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        check_in_time: checkInTime,
        minutes_late: minutesLate,
      }),
    });
  }

  async notifyEarlyCheckOut(employee, branch, checkOutTime, hoursWorked) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'suspicious_activity',
      title: `کارمند ${employee.full_name} زود رفت`,
      message: `${employee.full_name} پس از ${hoursWorked} ساعت از فرع ${branch} خارج شد`,
      severity: 'warning',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        check_out_time: checkOutTime,
        hours_worked: hoursWorked,
      }),
    });
  }

  async notifySalaryAdvance(employee, branch, amount) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'salary_advance',
      title: `پيش‌پرداخت به ${employee.full_name}`,
      message: `${employee.full_name} SAR ${amount} پيش‌پرداخت دريافت کرد`,
      amount,
      severity: 'warning',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        amount,
      }),
    });
  }

  async notifySalaryPayment(employee, branch, amount, month) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'salary_payment',
      title: `معاش ${employee.full_name} پرداخت شد`,
      message: `${employee.full_name} برای ماه ${month} SAR ${amount} دريافت کرد`,
      amount,
      severity: 'info',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        amount,
        month,
      }),
    });
  }

  async notifyBonusApplied(employee, branch, amount) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'salary_payment',
      title: `بونس برای ${employee.full_name}`,
      message: `${employee.full_name} بونس SAR ${amount} دريافت کرد`,
      amount,
      severity: 'info',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        amount,
      }),
    });
  }

  async notifyDeductionApplied(employee, branch, amount, reason) {
    await base44.entities.Notification.create({
      org_id: employee.created_by,
      type: 'expense_spike',
      title: `کسر معاش ${employee.full_name}`,
      message: `${employee.full_name} SAR ${amount} کسر شد: ${reason}`,
      amount,
      severity: 'warning',
      target_role: 'owner',
      actor_email: employee.email,
      actor_name: employee.full_name,
      metadata: JSON.stringify({
        employee_id: employee.id,
        branch,
        amount,
        reason,
      }),
    });
  }

  async notifyAttendanceViolation(employees, branch, violationType) {
    // Smart alert: Multiple absences or latenesses
    const message =
      violationType === 'frequent_absence'
        ? `${employees[0].full_name} و ${employees.length - 1} کارمند ديگر اين هفته مکرر غير حاضر بودند`
        : `${employees[0].full_name} و ${employees.length - 1} کارمند ديگر اين هفته مکرر دير آمدند`;

    await base44.entities.Notification.create({
      org_id: employees[0].created_by,
      type: 'suspicious_activity',
      title: `تنبيهات حضور و غياب - ${branch}`,
      message,
      severity: 'critical',
      target_role: 'owner',
      metadata: JSON.stringify({
        employee_ids: employees.map(e => e.id),
        branch,
        violation_type: violationType,
      }),
    });
  }

  async notifyBranchStaffShortage(branch, shortage) {
    await base44.entities.Notification.create({
      org_id: branch,
      type: 'suspicious_activity',
      title: `كمبود كارمند - ${branch}`,
      message: `فرع ${branch} ${shortage} کارمند کم است`,
      severity: 'critical',
      target_role: 'owner',
      metadata: JSON.stringify({
        branch,
        shortage_count: shortage,
      }),
    });
  }

  async notifyUnusualPayroll(branch, message, severity = 'warning') {
    await base44.entities.Notification.create({
      org_id: branch,
      type: 'expense_spike',
      title: `فعاليت غيرعادی - معاش`,
      message,
      severity,
      target_role: 'owner',
      metadata: JSON.stringify({
        branch,
      }),
    });
  }
}

export const employeeNotifications = new EmployeeNotificationEngine();