const StatusBadge = ({ status }) => {
  const statusConfig = {
    IN_POOL: { label: "В пуле", color: "bg-blue-900/20 text-blue-400 border-blue-800" },
    ASSIGNED: { label: "Назначен", color: "bg-purple-900/20 text-purple-400 border-purple-800" },
    IN_WORK: { label: "В работе", color: "bg-yellow-900/20 text-yellow-400 border-yellow-800" },
    WAITING: { label: "Ожидание", color: "bg-cyan-900/20 text-cyan-400 border-cyan-800" },
    ON_HOLD: { label: "Приостановлен", color: "bg-gray-800 text-gray-400 border-gray-700" },
    NO_RESPONSE: { label: "Нет ответа", color: "bg-orange-900/20 text-orange-400 border-orange-800" },
    OUTCOME_APPROVED: { label: "Одобрен", color: "bg-green-900/20 text-green-400 border-green-800" },
    OUTCOME_DECLINED: { label: "Отклонён", color: "bg-red-900/20 text-red-400 border-red-800" },
    OUTCOME_REPLIED: { label: "Ответил", color: "bg-emerald-900/20 text-emerald-400 border-emerald-800" },
    PROBLEMATIC: { label: "Проблемный", color: "bg-red-900/20 text-red-400 border-red-800" },
  };

  const config = statusConfig[status] || { label: status, color: "bg-gray-800 text-gray-400 border-gray-700" };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}
      data-testid={`status-badge-${status}`}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
