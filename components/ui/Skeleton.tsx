
import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className={`bg-gray-200 rounded-md ${className}`}
        >
          &nbsp;
        </div>
      ))}
    </div>
  );
};
