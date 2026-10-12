import React from 'react';

interface StatusBadgeProps {
  status: 'available' | 'occupied' | 'online' | 'offline' | 'warning' | 'simulated';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'md' }) => {
  let text = label;
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status) {
    case 'available':
      text = text || 'Available';
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      break;
    case 'occupied':
      text = text || 'Occupied';
      bgClass = 'bg-rose-50 text-rose-800 border-rose-200/80';
      break;
    case 'online':
      text = text || 'Connected';
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      break;
    case 'offline':
      text = text || 'Disconnected';
      bgClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
      break;
    case 'warning':
      text = text || 'Attention';
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200/80';
      break;
    case 'simulated':
      text = text || 'Simulated';
      bgClass = 'bg-blue-50 text-blue-800 border-blue-200/80';
      break;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 tracking-tight',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${bgClass} ${sizeClasses[size]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'available' || status === 'online'
            ? 'bg-emerald-600'
            : status === 'occupied'
            ? 'bg-rose-600'
            : status === 'warning'
            ? 'bg-amber-600'
            : status === 'simulated'
            ? 'bg-blue-600'
            : 'bg-zinc-400'
        }`}
        aria-hidden="true"
      />
      <span>{text}</span>
    </span>
  );
};
