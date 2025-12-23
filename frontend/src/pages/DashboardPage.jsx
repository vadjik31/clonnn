import { useState, useEffect } from "react";
import { api } from "../App";
import { toast } from "sonner";
import { 
  Package, 
  Archive, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Users,
  Bell,
  Activity,
  ShieldAlert
} from "lucide-react";
import { Button } from "../components/ui/button";

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get("/dashboard");
      setData(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки дашборда");
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/resolve`);
      toast.success("Алерт закрыт");
      fetchDashboard();
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  const statusLabels = {
    IN_POOL: "В пуле",
    ASSIGNED: "Назначен",
    IN_WORK: "В работе",
    WAITING: "Ожидание",
    ON_HOLD: "Приостановлен",
    NO_RESPONSE: "Нет ответа",
    OUTCOME_APPROVED: "Одобрен",
    OUTCOME_DECLINED: "Отклонён",
    OUTCOME_REPLIED: "Ответил",
    PROBLEMATIC: "Проблемный",
    ARCHIVED: "В архиве",
    BLACKLISTED: "В ЧС"
  };

  const stageLabels = {
    REVIEW: "Рассмотрение",
    EMAIL_1_DONE: "Письмо 1",
    EMAIL_2_DONE: "Письмо 2",
    MULTI_CHANNEL_DONE: "Мультиканал",
    CALL_OR_PUSH_RECOMMENDED: "Звонок/Пуш",
    CLOSED: "Закрыт"
  };

  // Group alerts by type
  const groupedAlerts = (data?.alerts || []).reduce((acc, alert) => {
    const type = alert.alert_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(alert);
    return acc;
  }, {});

  const alertTypeLabels = {
    review_timeout: { label: "Вечный REVIEW", icon: Clock, color: "text-yellow-400" },
    inactivity: { label: "Без активности", icon: Activity, color: "text-orange-400" },
    quality_warning: { label: "Низкое качество", icon: AlertTriangle, color: "text-red-400" },
    abuse_detected: { label: "Злоупотребление", icon: ShieldAlert, color: "text-red-500" },
    other: { label: "Другое", icon: Bell, color: "text-[#94A3B8]" }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider">
          Дашборд
        </h1>
        <p className="text-[#94A3B8] mt-1">Обзор системы и активность сёрчеров</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Package}
          label="Всего брендов"
          value={data?.total_brands || 0}
          color="text-[#FF9900]"
          testId="total-brands"
        />
        <KPICard
          icon={Archive}
          label="В пуле"
          value={data?.brands_in_pool || 0}
          color="text-blue-400"
          testId="brands-in-pool"
        />
        <KPICard
          icon={TrendingUp}
          label="В работе"
          value={data?.brands_assigned || 0}
          color="text-green-400"
          testId="brands-assigned"
        />
        <KPICard
          icon={AlertTriangle}
          label="Просрочено"
          value={data?.brands_overdue || 0}
          color="text-red-400"
          testId="brands-overdue"
        />
      </div>

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6" data-testid="status-distribution">
          <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 uppercase tracking-wider font-mono flex items-center gap-2">
            <Package size={18} className="text-[#FF9900]" />
            По статусам
          </h2>
          <div className="space-y-3">
            {Object.entries(data?.brands_by_status || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-[#94A3B8]">{statusLabels[status] || status}</span>
                <span className="font-mono text-[#E6E6E6]">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stage Distribution */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6" data-testid="stage-distribution">
          <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 uppercase tracking-wider font-mono flex items-center gap-2">
            <Clock size={18} className="text-[#FF9900]" />
            По этапам воронки
          </h2>
          <div className="space-y-3">
            {Object.entries(data?.brands_by_stage || {}).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="text-[#94A3B8]">{stageLabels[stage] || stage}</span>
                <span className="font-mono text-[#E6E6E6]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Searchers Activity */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6" data-testid="searchers-activity">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 uppercase tracking-wider font-mono flex items-center gap-2">
          <Users size={18} className="text-[#FF9900]" />
          Активность сёрчеров
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="py-3 px-4 text-left">Сёрчер</th>
                <th className="py-3 px-4 text-left">Статус</th>
                <th className="py-3 px-4 text-center">Брендов</th>
                <th className="py-3 px-4 text-center">Просрочено</th>
                <th className="py-3 px-4 text-center">Очищено</th>
                <th className="py-3 px-4 text-center">Быстрые возвраты</th>
                <th className="py-3 px-4 text-center">Низкое качество</th>
                <th className="py-3 px-4 text-left">Рабочие часы</th>
              </tr>
            </thead>
            <tbody>
              {data?.searchers_activity?.map((searcher) => (
                <tr key={searcher.id} className="table-row" data-testid={`searcher-row-${searcher.id}`}>
                  <td className="table-cell font-medium">{searcher.nickname}</td>
                  <td className="table-cell">
                    <ActivityIndicator status={searcher.activity_status} inWorkHours={searcher.in_work_hours} />
                  </td>
                  <td className="table-cell text-center font-mono">{searcher.assigned_count}</td>
                  <td className="table-cell text-center font-mono">
                    <span className={searcher.overdue_count > 0 ? "text-red-400 font-bold" : ""}>
                      {searcher.overdue_count}
                    </span>
                  </td>
                  <td className="table-cell text-center font-mono">
                    <span className={searcher.cleared_count > 10 ? "text-yellow-400" : ""}>
                      {searcher.cleared_count}
                    </span>
                  </td>
                  <td className="table-cell text-center font-mono">
                    <span className={searcher.quick_returns_count > 5 ? "text-red-400 font-bold" : ""}>
                      {searcher.quick_returns_count || 0}
                    </span>
                  </td>
                  <td className="table-cell text-center font-mono">
                    <span className={searcher.low_quality_count > 5 ? "text-yellow-400" : ""}>
                      {searcher.low_quality_count || 0}
                    </span>
                  </td>
                  <td className="table-cell text-[#94A3B8] font-mono text-sm">{searcher.work_hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ icon: Icon, label, value, color, testId }) => (
  <div 
    className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6 card-hover"
    data-testid={testId}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[#94A3B8] text-sm uppercase tracking-wider">{label}</p>
        <p className={`text-3xl font-mono font-bold mt-2 ${color}`}>{value.toLocaleString()}</p>
      </div>
      <Icon size={32} className={color} />
    </div>
  </div>
);

const ActivityIndicator = ({ status, inWorkHours }) => {
  const statusConfig = {
    online: { color: "bg-green-500", label: "Онлайн" },
    idle: { color: "bg-yellow-500", label: "Неактивен" },
    offline: { color: "bg-red-500", label: "Офлайн" },
    off_hours: { color: "bg-gray-500", label: "Не рабочее время" }
  };

  const config = statusConfig[status] || statusConfig.offline;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-sm">{config.label}</span>
    </div>
  );
};

export default DashboardPage;
