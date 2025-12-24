interface ProgressBarProps {
  current: number;
  target: number;
  showPercentage?: boolean;
  showRemaining?: boolean;
  className?: string;
}

export default function ProgressBar({
  current,
  target,
  showPercentage = true,
  showRemaining = false,
  className = "",
}: ProgressBarProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const remaining = Math.max(target - current, 0);

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-semibold text-gray-900">
          {current.toFixed(2)} ETH
        </span>
        <div className="flex items-center gap-2 text-gray-600">
          {showRemaining && (
            <span className="text-xs">Còn thiếu {remaining.toFixed(2)} ETH</span>
          )}
          <span className="text-xs">/ {target.toFixed(2)} ETH</span>
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <p className="text-xs text-gray-500 mt-1.5 text-right">
          {percentage.toFixed(1)}% hoàn thành
        </p>
      )}
    </div>
  );
}

