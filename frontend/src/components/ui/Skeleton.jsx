import React from 'react';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div 
      className={`animate-pulse rounded-custom bg-border/60 ${className}`} 
      {...props} 
    />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="w-full border border-border bg-card rounded-custom overflow-hidden">
      <div className="h-10 bg-elevated/50 border-b border-border flex items-center px-4 space-x-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-12 flex items-center px-4 space-x-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
