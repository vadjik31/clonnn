import { useState, useEffect, useRef, useCallback } from "react";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Users,
  Trophy,
  Zap,
  MessageSquare,
  Phone,
  Target,
  Skull,
  Trash2,
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
  const [inactiveBrands, setInactiveBrands] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("7");
  const [deletingInactive, setDeletingInactive] = useState(false);
  
  // Cache ref to prevent duplicate fetches
  const cacheRef = useRef({ kpi: {}, inactive: null, lastFetch: 0 });
  const abortControllerRef = useRef(null);
  const CACHE_TTL = 60000; // 1 minute cache

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    // Check cache first - instant return if valid
    if (!forceRefresh && cache.kpi[period] && cache.inactive && (now - cache.lastFetch) < CACHE_TTL) {
      setKpiData(cache.kpi[period]);
      setInactiveBrands(cache.inactive);
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
      const [kpi, inactive] = await Promise.all([
        api.get(`/analytics/kpi?period_days=${period}`, { 
          signal: abortControllerRef.current.signal 
        }),
        api.get("/analytics/inactive-brands", { 
          signal: abortControllerRef.current.signal 
        })
      ]);
      
      // Update cache
      cache.kpi[period] = kpi.data;
      cache.inactive = inactive.data;
      cache.lastFetch = Date.now();
      
      setKpiData(kpi.data);
      setInactiveBrands(inactive.data);
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

  const handleDeleteAllInactive = async () => {
    try {
      // Сначала загружаем все ID неактивных брендов
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

      {/* Inactive Brands with Delete Option */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-400" />
            Без активности ({inactiveBrands?.count || 0})
          </h3>
          {user?.role === "super_admin" && inactiveBrands?.count > 0 && (
            <Button
              onClick={handleDeleteAllInactive}
              disabled={deletingInactive}
              variant="outline"
              size="sm"
              className="text-red-400 border-red-400/30 hover:bg-red-900/20"
            >
              <Trash2 size={14} className="mr-1" />
              {deletingInactive ? "Удаление..." : `Удалить все (${inactiveBrands?.count || 0})`}
            </Button>
          )}
        </div>
        <p className="text-sm text-[#94A3B8] mb-4">
          Бренды без действий более {inactiveBrands?.threshold_days} дней (показаны первые 100)
        </p>
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {inactiveBrands?.brands?.length === 0 ? (
            <p className="text-[#94A3B8] text-center py-4">Нет неактивных брендов</p>
          ) : (
            inactiveBrands?.brands?.slice(0, 20).map((brand) => (
              <div key={brand.id} className="flex items-center justify-between p-3 bg-[#0F1115] rounded-[2px] group">
                <div className="flex-1">
                  <p className="text-sm text-[#E6E6E6]">{brand.name_original}</p>
                  <p className="text-xs text-[#94A3B8]">{brand.assigned_to_nickname || "Не назначен"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-orange-900/20 text-orange-400 rounded text-xs font-mono">
                    {brand.days_inactive} дней
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 h-auto"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
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
