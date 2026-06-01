import React from 'react';

export default function PageHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
      {action}
    </div>
  );
}