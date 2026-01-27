import { CheckCircle } from 'lucide-react';

export default function ConfidenceBadge({ confidence, size = 'default' }) {
  const getColor = (conf) => {
    if (conf >= 90) return 'text-green-500';
    if (conf >= 75) return 'text-yellow-500';
    return 'text-red-500';
  };

  const sizeClasses = {
    small: 'text-xs',
    default: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex items-center gap-1 ${getColor(confidence)} ${sizeClasses[size]}`}>
      <CheckCircle size={size === 'small' ? 12 : 14} />
      <span className="font-medium">{confidence}%</span>
    </div>
  );
}
