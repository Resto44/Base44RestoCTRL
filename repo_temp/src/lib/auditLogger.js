/**
 * Audit Logger — call these helpers whenever a critical action occurs.
 * All writes are fire-and-forget (no await needed in callers).
 */
import { base44 } from '@/api/base44Client';

let _user = null;
let _orgId = '';

/** Call once from AuthContext or AppLayout to seed the logger with current user. */
export function initAuditLogger(user) {
  _user = user;
  _orgId = user?.email || '';
}

export async function auditLog({ action, entity, entityId, description, before, after, branch }) {
  if (!_orgId) return; // not initialized yet
  try {
    await base44.entities.AuditLog.create({
      org_id: _orgId,
      user_email: _user?.email || 'unknown',
      user_name: _user?.full_name || _user?.email || 'unknown',
      action,
      entity,
      entity_id: entityId || '',
      description,
      before: before ? JSON.stringify(before) : undefined,
      after: after ? JSON.stringify(after) : undefined,
      branch: branch || '',
    });
  } catch (e) {
    // Never block UI — silently fail
    console.warn('AuditLog write failed:', e);
  }
}

// Security-specific logger
export async function logSecurityViolation(user, detail) {
  await auditLog({
    action: 'security_violation',
    entity: 'Security',
    description: detail,
  });
}

// Convenience wrappers
export const audit = {
  delete: (entity, record, branch) => auditLog({ action: 'delete', entity, entityId: record?.id, description: `Deleted ${entity} record: ${record?.date || record?.name || record?.id}`, before: record, branch }),
  update: (entity, id, before, after, branch) => auditLog({ action: 'update', entity, entityId: id, description: `Updated ${entity} #${id?.slice(-6)?.toUpperCase()}`, before, after, branch }),
  create: (entity, record, branch) => auditLog({ action: 'create', entity, entityId: record?.id, description: `Created ${entity}: ${record?.date || record?.name || record?.id}`, after: record, branch }),
  priceChange: (productName, oldPrice, newPrice) => auditLog({ action: 'price_change', entity: 'Product', description: `Price changed for "${productName}": ${oldPrice} → ${newPrice}`, before: { price: oldPrice }, after: { price: newPrice } }),
  branchChange: (description) => auditLog({ action: 'branch_change', entity: 'Restaurant', description }),
  settingsChange: (description) => auditLog({ action: 'settings_change', entity: 'AppSettings', description }),
  exportPDF: (rangeType) => auditLog({ action: 'export', entity: 'Report', description: `PDF report exported for range: ${rangeType}` }),
  securityViolation: (path, role) => auditLog({ action: 'security_violation', entity: 'Security', description: `Unauthorized access attempt by [${role}] to: ${path}` }),
  loginEvent: (email) => auditLog({ action: 'login', entity: 'Auth', description: `User logged in: ${email}` }),
};