import { useState, useEffect, useRef, useCallback } from "react";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { 
  BarChart3, 
  Clock, 
  TrendingUp, 
  Users,
  Trophy,
  Zap,
  MessageSquare,
  Phone,
  Target,
  Skull,
  HelpCircle,
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

// Глоссарий терминов
const glossary = {
  "Обработано": "Количество брендов, с которыми сёрчер взаимодействовал за период",
  "С контактами": "Бренды, для которых найдены и добавлены контакты",
  "С заметками": "Бренды с добавленными заметками о ходе работы",
  "Исходы": "Бренды с финальным результатом (одобрен/отказ/ответил)",
  "Мёртвые": "Назначенные бренды без активности за период",
  "Скорость": "Среднее количество обработанных брендов в час",
  "Эффективность": "% полезных действий от общего числа обработанных"
};

const Tooltip = ({ text, children }) => (
  <div className="relative group inline-flex items-center gap-1">
    {children}
    <HelpCircle size={12} className="text-[#94A3B8] opacity-50 group-hover:opacity-100 cursor-help" />
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-3 py-2 bg-[#1A1D23] border border-[#FF9900]/30 rounded text-xs text-[#E6E6E6] whitespace-normal max-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-[100] shadow-lg">
      {text}
    </div>
  </div>
);

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("7");
  
  // Cache ref to prevent duplicate fetches
  const cacheRef = useRef({ kpi: {}, lastFetch: 0 });
  const abortControllerRef = useRef(null);
  const CACHE_TTL = 60000; // 1 minute cache

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    // Check cache first - instant return if valid
    if (!forceRefresh && cache.kpi[period] && (now - cache.lastFetch) < CACHE_TTL) {
      setKpiData(cache.kpi[period]);
      setLoading(false);
      return;
    }
    
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    if (!loading) setRefreshing(true);
    
    try {
      const kpi = await api.get(`/analytics/kpi?period_days=${period}`, { 
        signal: abortControllerRef.current.signal 
      });
      
      // Update cache
      cache.kpi[period] = kpi.data;
      cache.lastFetch = Date.now();
      
      setKpiData(kpi.data);
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      toast.error("Ошибка загрузки аналитики");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, loading]);

  useEffect(() => {
    fetchAllData();
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [period]);

  const handleRefresh = () => {
    fetchAllData(true);
  };
      const res = await api.get("/analytics/inactive-brands/all-ids");
      const allIds = res.data.ids || [];
      
      if (allIds.length === 0) {
        toast.info("Нет неактивных брендов для удаления");
        return;
      }
      
      if (!window.confirm(`Удалить ВСЕ ${allIds.length} неактивных брендов? Это действие нельзя отменить!`)) return;
      
      setDeletingInactive(true);
      await api.delete("/super-admin/brands/bulk-delete", { data: allIds });
      toast.success(`Удалено ${allIds.length} брендов`);
      // Invalidate cache and refresh
      cacheRef.current.inactive = null;
      fetchAllData(true);
    } catch (error) {
      toast.error("Ошибка удаления");
    } finally {
      setDeletingInactive(false);
    }
  };

  // Skeleton loader
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-[#2A2F3A] rounded w-48"></div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <div className="h-6 bg-[#2A2F3A] rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-[#2A2F3A] rounded"></div>
            ))}
          </div>
        </div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <div className="h-6 bg-[#2A2F3A] rounded w-40 mb-4"></div>
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-10 bg-[#2A2F3A] rounded"></div>
            ))}
          </div>
        </div>
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
          <p className="text-[#94A3B8] mt-1">KPI сёрчеров и контроль качества</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="ghost"
            size="sm"
            className="text-[#94A3B8] hover:text-[#FF9900]"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </Button>
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
        </div>
      </div>

      {/* KPI Leaderboard - New Design */}
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
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["Обработано"]}>
                    <span>Обработано</span>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["С контактами"]}>
                    <span>Контакты</span>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["С заметками"]}>
                    <span>Заметки</span>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["Исходы"]}>
                    <span>Исходы</span>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["Мёртвые"]}>
                    <span>Мёртвые</span>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["Скорость"]}>
                    <span>Скор/час</span>
                  </Tooltip>
                </th>
                <th className="py-3 px-4 text-center">
                  <Tooltip text={glossary["Эффективность"]}>
                    <span>Эфф-ть</span>
                  </Tooltip>
                </th>
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
                  <td className="table-cell text-center font-mono text-[#E6E6E6]">
                    {item.metrics.brands_processed}
                  </td>
                  <td className="table-cell text-center font-mono text-green-400">
                    {item.metrics.with_contacts}
                  </td>
                  <td className="table-cell text-center font-mono text-blue-400">
                    {item.metrics.with_notes}
                  </td>
                  <td className="table-cell text-center font-mono text-purple-400">
                    {item.metrics.outcomes}
                  </td>
                  <td className="table-cell text-center font-mono">
                    <span className={item.metrics.dead_brands > 5 ? "text-red-400 font-bold" : "text-[#94A3B8]"}>
                      {item.metrics.dead_brands}
                    </span>
                  </td>
                  <td className="table-cell text-center font-mono">
                    <span className="flex items-center justify-center gap-1">
                      <Zap size={12} className="text-yellow-400" />
                      {item.metrics.speed_per_hour}
                    </span>
                  </td>
                  <td className="table-cell text-center">
                    <span className={`px-3 py-1 rounded-full font-mono font-bold ${
                      item.efficiency >= 100 ? "bg-green-900/30 text-green-400" :
                      item.efficiency >= 50 ? "bg-yellow-900/30 text-yellow-400" :
                      "bg-red-900/30 text-red-400"
                    }`}>
                      {item.efficiency}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
