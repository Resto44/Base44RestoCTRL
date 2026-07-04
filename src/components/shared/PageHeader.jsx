import React, { memo } from 'react';

const PageHeader = memo(function PageHeader({ title, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
      <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
      <div className="w-full sm:w-auto overflow-x-hidden">
        {action}
      </div>
    </div>
  );
});

export default PageHeader;
