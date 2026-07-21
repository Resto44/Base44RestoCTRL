import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import OwnerStaffProvisioning from '@/components/owner/OwnerStaffProvisioning';

export default function StaffInvitations() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Invitations"
        subtitle="Create and manage secure invitations for organization staff."
      />
      <OwnerStaffProvisioning />
    </div>
  );
}
