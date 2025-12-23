import { useState, useEffect } from "react";
import { api } from "../App";
import { toast } from "sonner";
import { 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Users,
  Trophy,
  Activity,
  RefreshCw
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const AnalyticsPage = () => {
  const [kpiData, setKpiData] = useState(null);
  const [reviewTimeout, setReviewTimeout] = useState(null);
  const [inactiveBrands, setInactiveBrands] = useState(null);
  const [sharedContacts, setSharedContacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [kpi, review, inactive, shared] = await Promise.all([
        api.get(`/analytics/kpi?period_days=${period}`),
        api.get("/analytics/review-timeout"),
        api.get("/analytics/inactive-brands"),
        api.get("/analytics/shared-contacts")
      ]);
      setKpiData(kpi.data);
      setReviewTimeout(review.data);
      setInactiveBrands(inactive.data);
      setSharedContacts(shared.data);
    } catch (error) {
      toast.error("Ошибка загрузки аналитики");
    } finally {
      setLoading(false);
    }
  };

  const checkTimeouts = async () => {
    setChecking(true);
    try {
      const response = await api.post("/system/check-timeouts");
      toast.success(`Проверка завершена. Создано алертов: ${response.data.alerts_created}`);
      fetchAllData();
    } catch (error) {
      toast.error("Ошибка проверки");
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="analytics-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
            <BarChart3 className="text-[#FF9900]" />
            Аналитика
          </h1>
          <p className="text-[#94A3B8] mt-1">KPI, таймауты и контроль качества</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px] bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
              <SelectItem value="7">7 дней</SelectItem>
              <SelectItem value="14">14 дней</SelectItem>
              <SelectItem value="30">30 дней</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={checkTimeouts}
            disabled={checking}
            className="btn-secondary flex items-center gap-2"
            data-testid="check-timeouts-btn"
          >
            {checking ? <RefreshCw size={16} className="animate-spin" /> : <Clock size={16} />}
            Проверить таймауты
          </Button>
        </div>
      </div>

      {/* KPI Leaderboard */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
          <Trophy size={18} className="text-[#FF9900]" />
          KPI Рейтинг ({period} дней)
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="kpi-table">
            <thead>
              <tr className="table-header">
                <th className="py-3 px-4 text-left">#</th>
                <th className="py-3 px-4 text-left">Сёрчер</th>
                <th className="py-3 px-4 text-center">Этапов</th>
                <th className="py-3 px-4 text-center">Исходов</th>
                <th className="py-3 px-4 text-center">Обновлений</th>
                <th className="py-3 px-4 text-center">Возвратов</th>
                <th className="py-3 px-4 text-center">Быстрых</th>
                <th className="py-3 px-4 text-center">Качество</th>
                <th className="py-3 px-4 text-center">Балл</th>
              </tr>
            </thead>
            <tbody>
              {kpiData?.kpi?.map((item, index) => (
                <tr key={item.user_id} className="table-row" data-testid={`kpi-row-${item.user_id}`}>
                  <td className="table-cell">
                    <span className={`font-mono font-bold ${
                      index === 0 ? "text-[#FFD700]" : 
                      index === 1 ? "text-[#C0C0C0]" : 
                      index === 2 ? "text-[#CD7F32]" : "text-[#94A3B8]"
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="table-cell font-medium">{item.nickname}</td>
                  <td className="table-cell text-center font-mono text-green-400">{item.metrics.stages_completed}</td>
                  <td className="table-cell text-center font-mono text-blue-400">{item.metrics.outcomes_set}</td>
                  <td className="table-cell text-center font-mono">{item.metrics.info_updates}</td>
                  <td className="table-cell text-center font-mono text-yellow-400">{item.metrics.returns}</td>
                  <td className="table-cell text-center font-mono">
                    <span className={item.metrics.quick_returns > 5 ? "text-red-400 font-bold" : ""}>
                      {item.metrics.quick_returns}
                    </span>
                  </td>
                  <td className="table-cell text-center font-mono">
                    <span className={item.quality_ratio >= 50 ? "text-green-400" : "text-yellow-400"}>
                      {item.quality_ratio}%
                    </span>
                  </td>
                  <td className="table-cell text-center">
                    <span className="px-3 py-1 bg-[#FF9900]/20 text-[#FF9900] rounded-full font-mono font-bold">
                      {item.weighted_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Timeout */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 flex items-center gap-2">
            <Clock size={18} className="text-yellow-400" />
            Вечный REVIEW ({reviewTimeout?.count || 0})
          </h3>
          <p className="text-sm text-[#94A3B8] mb-4">
            Бренды в статусе REVIEW более {reviewTimeout?.threshold_days} дней
          </p>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {reviewTimeout?.brands?.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет проблемных брендов</p>
            ) : (
              reviewTimeout?.brands?.slice(0, 10).map((brand) => (
                <div key={brand.id} className="flex items-center justify-between p-3 bg-[#0F1115] rounded-[2px]">
                  <div>
                    <p className="text-sm text-[#E6E6E6]">{brand.name_original}</p>
                    <p className="text-xs text-[#94A3B8]">{brand.assigned_to_nickname}</p>
                  </div>
                  <span className="px-2 py-1 bg-yellow-900/20 text-yellow-400 rounded text-xs font-mono">
                    {brand.days_in_review} дней
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inactive Brands */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            Без активности ({inactiveBrands?.count || 0})
          </h3>
          <p className="text-sm text-[#94A3B8] mb-4">
            Бренды без действий более {inactiveBrands?.threshold_days} дней
          </p>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {inactiveBrands?.brands?.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет неактивных брендов</p>
            ) : (
              inactiveBrands?.brands?.slice(0, 10).map((brand) => (
                <div key={brand.id} className="flex items-center justify-between p-3 bg-[#0F1115] rounded-[2px]">
                  <div>
                    <p className="text-sm text-[#E6E6E6]">{brand.name_original}</p>
                    <p className="text-xs text-[#94A3B8]">{brand.assigned_to_nickname}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-900/20 text-red-400 rounded text-xs font-mono">
                    {brand.days_inactive} дней
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Shared Contacts */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 flex items-center gap-2">
          <Users size={18} className="text-purple-400" />
          Общие контакты ({sharedContacts?.total_found || 0})
        </h3>
        <p className="text-sm text-[#94A3B8] mb-4">
          Бренды с одинаковыми доменами сайтов (возможные дубликаты)
        </p>
        
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {sharedContacts?.shared_contacts?.length === 0 ? (
            <p className="text-[#94A3B8] text-center py-4">Дубликаты не найдены</p>
          ) : (
            sharedContacts?.shared_contacts?.slice(0, 20).map((item, idx) => (
              <div key={idx} className="p-4 bg-[#0F1115] rounded-[2px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[#FF9900]">{item.domain}</span>
                  <span className="text-xs text-[#94A3B8]">{item.brands_count} брендов</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.brands.map((b, i) => (
                    <span key={i} className="px-2 py-1 bg-[#1A1D24] text-[#E6E6E6] rounded text-xs">
                      {b.brand_name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
