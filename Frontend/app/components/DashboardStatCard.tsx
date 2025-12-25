interface DashboardStatCardProps {
  icon: string;
  label: string;
  value: string | number;
  color?: "blue" | "green" | "purple" | "orange";
}

export default function DashboardStatCard({
  icon,
  label,
  value,
  color = "blue",
}: DashboardStatCardProps) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    purple: "from-purple-500 to-purple-600",
    orange: "from-orange-500 to-orange-600",
  };

  const textColorClasses = {
    blue: "text-blue-400",
    green: "text-emerald-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
  };

  return (
    <div className="bg-white/10 rounded-xl border border-white/20 shadow-lg p-6 hover:bg-white/20 hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white text-xl shadow-lg`}
        >
          {icon}
        </div>
      </div>
      <p className="text-sm text-gray-300 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${textColorClasses[color]}`}>{value}</p>
    </div>
  );
}

