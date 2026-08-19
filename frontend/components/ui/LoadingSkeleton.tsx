interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({ rows = 5, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {/* Table header skeleton */}
      <div className="flex gap-4 px-4 py-3 border-b border-gray-100">
        {[40, 30, 15, 15].map((w, i) => (
          <div key={i} className={`h-3 bg-gray-200 rounded w-${w > 20 ? '[' + w + '%]' : w + '%'}`} style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-50">
          <div className="h-4 bg-gray-100 rounded" style={{ width: '40%' }} />
          <div className="h-4 bg-gray-100 rounded" style={{ width: '30%' }} />
          <div className="h-4 bg-gray-100 rounded" style={{ width: '15%' }} />
          <div className="h-5 bg-gray-100 rounded-full" style={{ width: '10%' }} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse p-4 rounded-xl border border-gray-100 bg-white ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  );
}
