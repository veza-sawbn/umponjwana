interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: number;
    label: string;
    positive: boolean;
  };
}

export default function StatsCard({ title, value, icon, trend }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {trend && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
          <span>{trend.positive ? '↑' : '↓'}</span>
          <span>{trend.value}% {trend.label}</span>
        </p>
      )}
    </div>
  );
}
