import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Search, Download, Filter, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import StatusBadge from "../components/StatusBadge";

const MyBrandsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  
  const [filters, setFilters] = useState({
    status: "",
    pipeline_stage: "",
    search: "",
    overdue: false,
    page: 1
  });

  useEffect(() => {
    fetchBrands();
  }, [filters]);

  const fetchBrands = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.pipeline_stage) params.append("pipeline_stage", filters.pipeline_stage);
      if (filters.search) params.append("search", filters.search);
      if (filters.overdue) params.append("overdue", "true");
      params.append("page", filters.page.toString());
      params.append("limit", "50");

      const response = await api.get(`/brands?${params}`);
      setBrands(response.data.brands);
      setTotal(response.data.total);
      setPages(response.data.pages);
    } catch (error) {
      toast.error("Ошибка загрузки брендов");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBrands = async () => {
    setClaiming(true);
    try {
      const response = await api.post("/brands/claim");
      if (response.data.count > 0) {
        toast.success(`Получено ${response.data.count} брендов!`);
        fetchBrands();
      } else {
        toast.info("Нет доступных брендов в пуле");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка получения брендов");
    } finally {
      setClaiming(false);
    }
  };

  const statusOptions = [
    { value: "ASSIGNED", label: "Назначен" },
    { value: "IN_WORK", label: "В работе" },
    { value: "WAITING", label: "Ожидание" },
    { value: "ON_HOLD", label: "Приостановлен" },
    { value: "OUTCOME_APPROVED", label: "Одобрен" },
    { value: "OUTCOME_DECLINED", label: "Отклонён" },
    { value: "OUTCOME_REPLIED", label: "Ответил" },
    { value: "PROBLEMATIC", label: "Проблемный" },
  ];

  const stageOptions = [
    { value: "REVIEW", label: "Рассмотрение" },
    { value: "EMAIL_1_DONE", label: "Письмо 1" },
    { value: "EMAIL_2_DONE", label: "Письмо 2" },
    { value: "MULTI_CHANNEL_DONE", label: "Мультиканал" },
    { value: "CALL_OR_PUSH_RECOMMENDED", label: "Звонок/Пуш" },
    { value: "CLOSED", label: "Закрыт" },
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="my-brands-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider">
            Мои бренды
          </h1>
          <p className="text-[#94A3B8] mt-1">Всего: {total} брендов</p>
        </div>
        <Button
          onClick={handleClaimBrands}
          disabled={claiming}
          className="btn-primary flex items-center gap-2 animate-pulse-glow"
          data-testid="claim-brands-btn"
        >
          {claiming ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Получение...
            </>
          ) : (
            <>
              <Download size={18} />
              Получить бренды
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" size={18} />
              <Input
                placeholder="Поиск по названию..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="pl-10 bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
                data-testid="search-input"
              />
            </div>
          </div>

          <Select 
            value={filters.status} 
            onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v, page: 1 })}
          >
            <SelectTrigger className="w-[180px] bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="status-filter">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
              <SelectItem value="all">Все статусы</SelectItem>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={filters.pipeline_stage} 
            onValueChange={(v) => setFilters({ ...filters, pipeline_stage: v === "all" ? "" : v, page: 1 })}
          >
            <SelectTrigger className="w-[180px] bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="stage-filter">
              <SelectValue placeholder="Этап" />
            </SelectTrigger>
            <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
              <SelectItem value="all">Все этапы</SelectItem>
              {stageOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={filters.overdue ? "default" : "outline"}
            onClick={() => setFilters({ ...filters, overdue: !filters.overdue, page: 1 })}
            className={filters.overdue ? "btn-primary" : "border-[#2A2F3A] text-[#94A3B8]"}
            data-testid="overdue-filter"
          >
            🔥 Горит
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="brands-table">
            <thead>
              <tr className="table-header">
                <th className="py-3 px-4 text-left">Бренд</th>
                <th className="py-3 px-4 text-center">Приоритет</th>
                <th className="py-3 px-4 text-center">Товаров</th>
                <th className="py-3 px-4 text-left">Статус</th>
                <th className="py-3 px-4 text-left">Этап</th>
                <th className="py-3 px-4 text-left">След. действие</th>
                <th className="py-3 px-4 text-left">Последняя активность</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                    Загрузка...
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                    <div className="space-y-2">
                      <p>У вас пока нет брендов</p>
                      <p className="text-sm">Нажмите "Получить бренды" чтобы начать работу</p>
                    </div>
                  </td>
                </tr>
              ) : (
                brands.map((brand) => {
                  const isOverdue = brand.next_action_at && new Date(brand.next_action_at) < new Date();
                  return (
                    <tr 
                      key={brand.id} 
                      className={`table-row cursor-pointer ${isOverdue ? "bg-red-900/10" : ""}`}
                      onClick={() => navigate(`/brands/${brand.id}`)}
                      data-testid={`brand-row-${brand.id}`}
                    >
                      <td className="table-cell font-medium">{brand.name_original}</td>
                      <td className="table-cell text-center font-mono text-[#FF9900]">{brand.priority_score}</td>
                      <td className="table-cell text-center font-mono">{brand.items_count}</td>
                      <td className="table-cell">
                        <StatusBadge status={brand.status} />
                      </td>
                      <td className="table-cell">
                        <StageBadge stage={brand.pipeline_stage} />
                      </td>
                      <td className="table-cell">
                        {brand.next_action_at ? (
                          <span className={`font-mono text-sm ${isOverdue ? "text-red-400 font-bold" : "text-[#94A3B8]"}`}>
                            {isOverdue && "🔥 "}
                            {new Date(brand.next_action_at).toLocaleDateString('ru-RU')}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="table-cell text-[#94A3B8] text-sm">
                        {brand.last_action_at 
                          ? new Date(brand.last_action_at).toLocaleString('ru-RU')
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2A2F3A]">
            <p className="text-sm text-[#94A3B8]">
              Страница {filters.page} из {pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                className="border-[#2A2F3A] text-[#94A3B8]"
                data-testid="prev-page"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= pages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                className="border-[#2A2F3A] text-[#94A3B8]"
                data-testid="next-page"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StageBadge = ({ stage }) => {
  const stageConfig = {
    REVIEW: { label: "Рассмотрение", color: "bg-gray-800 text-gray-400 border-gray-700" },
    EMAIL_1_DONE: { label: "Письмо 1", color: "bg-blue-900/20 text-blue-400 border-blue-800" },
    EMAIL_2_DONE: { label: "Письмо 2", color: "bg-indigo-900/20 text-indigo-400 border-indigo-800" },
    MULTI_CHANNEL_DONE: { label: "Мультиканал", color: "bg-purple-900/20 text-purple-400 border-purple-800" },
    CALL_OR_PUSH_RECOMMENDED: { label: "Звонок/Пуш", color: "bg-orange-900/20 text-orange-400 border-orange-800" },
    CLOSED: { label: "Закрыт", color: "bg-green-900/20 text-green-400 border-green-800" },
  };
  const config = stageConfig[stage] || { label: stage, color: "bg-gray-800 text-gray-400" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
};

export default MyBrandsPage;
