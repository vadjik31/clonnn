import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Search, Filter, ChevronLeft, ChevronRight, RotateCcw, UserPlus, Archive, Ban, CheckSquare, Square, CheckCircle, MessageSquare, Phone, Clock, Info } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import StatusBadge from "../components/StatusBadge";

// Компонент тултипа с роадмапом
const BrandTooltip = ({ brandId, children }) => {
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const fetchTimeline = useCallback(async () => {
    if (timeline || loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/brands/${brandId}/timeline`);
      setTimeline(res.data);
    } catch (e) {
      console.error("Timeline error", e);
    } finally {
      setLoading(false);
    }
  }, [brandId, timeline, loading]);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => { setShow(true); fetchTimeline(); }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 left-full top-0 ml-2 w-64 bg-[#1A1D23] border border-[#FF9900]/30 rounded p-3 shadow-xl pointer-events-none">
          <div className="text-xs font-medium text-[#FF9900] mb-2">Роадмап бренда</div>
          {loading ? (
            <div className="text-[#94A3B8] text-xs">Загрузка...</div>
          ) : timeline ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#E6E6E6]">
                <MessageSquare size={12} className="text-blue-400" />
                <span>Заметок: {timeline.notes_count}</span>
                <Phone size={12} className="text-green-400 ml-2" />
                <span>Контактов: {timeline.contacts_count}</span>
              </div>
              {timeline.timeline?.length > 0 ? (
                <div className="space-y-1 mt-2 border-l-2 border-[#2A2F3A] pl-2">
                  {timeline.timeline.slice(0, 5).map((item, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-[#94A3B8]">{item.date}</span>
                      <span className="text-[#E6E6E6] ml-1">{item.action}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#94A3B8] text-xs">Нет истории</div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const BrandsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const abortControllerRef = useRef(null);
  
  // Selection for bulk actions (super_admin only)
  const [selectedBrands, setSelectedBrands] = useState(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [allBrandIds, setAllBrandIds] = useState([]);
  const [bulkModal, setBulkModal] = useState({ open: false, action: null });
  
  // Filters
  const [filters, setFilters] = useState({
    status: "",
    pipeline_stage: "",
    assigned_to: "",
    search: "",
    overdue: false,
    page: 1
  });

  // Modals
  const [releaseModal, setReleaseModal] = useState({ open: false, brandId: null });
  const [reassignModal, setReassignModal] = useState({ open: false, brandId: null });

  useEffect(() => {
    fetchBrands();
    setSelectAllPages(false);
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchBrands = async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.pipeline_stage) params.append("pipeline_stage", filters.pipeline_stage);
      if (filters.assigned_to) params.append("assigned_to", filters.assigned_to);
      if (filters.search) params.append("search", filters.search);
      if (filters.overdue) params.append("overdue", "true");
      params.append("page", filters.page.toString());
      params.append("limit", "50");

      const response = await api.get(`/brands?${params}`, {
        signal: abortControllerRef.current.signal
      });
      setBrands(response.data.brands);
      setTotal(response.data.total);
      setPages(response.data.pages);
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') return;
      toast.error("Ошибка загрузки брендов");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      setUsers(response.data.filter(u => u.role === "searcher"));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleRelease = async (reason) => {
    try {
      await api.post(`/admin/brands/${releaseModal.brandId}/release`, { reason });
      toast.success("Бренд освобождён");
      setReleaseModal({ open: false, brandId: null });
      fetchBrands();
    } catch (error) {
      toast.error("Ошибка освобождения");
    }
  };

  const handleReassign = async (newUserId, reason) => {
    try {
      await api.post(`/admin/brands/${reassignModal.brandId}/reassign`, {
        new_user_id: newUserId,
        reason
      });
      toast.success("Бренд переназначен");
      setReassignModal({ open: false, brandId: null });
      fetchBrands();
    } catch (error) {
      toast.error("Ошибка переназначения");
    }
  };

  // Bulk actions (super_admin only)
  const toggleSelectBrand = (brandId) => {
    setSelectAllPages(false);
    const newSelected = new Set(selectedBrands);
    if (newSelected.has(brandId)) {
      newSelected.delete(brandId);
    } else {
      newSelected.add(brandId);
    }
    setSelectedBrands(newSelected);
  };

  const toggleSelectAll = () => {
    setSelectAllPages(false);
    if (selectedBrands.size === brands.length) {
      setSelectedBrands(new Set());
    } else {
      setSelectedBrands(new Set(brands.map(b => b.id)));
    }
  };

  const handleSelectAllPages = async () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedBrands(new Set());
      setAllBrandIds([]);
    } else {
      try {
        const params = new URLSearchParams();
        if (filters.status) params.append("status", filters.status);
        if (filters.pipeline_stage) params.append("pipeline_stage", filters.pipeline_stage);
        if (filters.assigned_to) params.append("assigned_to", filters.assigned_to);
        if (filters.search) params.append("search", filters.search);
        
        const res = await api.get(`/brands/ids?${params}`);
        setAllBrandIds(res.data.ids);
        setSelectedBrands(new Set(res.data.ids));
        setSelectAllPages(true);
        toast.success(`Выбрано ${res.data.total} брендов на всех страницах`);
      } catch (error) {
        toast.error("Ошибка получения списка");
      }
    }
  };

  const handleBulkAction = async (action, params) => {
    const brandIds = selectAllPages ? allBrandIds : Array.from(selectedBrands);
    if (brandIds.length === 0) {
      toast.error("Выберите бренды");
      return;
    }

    try {
      switch (action) {
        case "release":
          await api.post("/admin/brands/bulk-release", {
            brand_ids: brandIds,
            reason: params.reason || "Массовый сброс в пул"
          });
          toast.success(`${brandIds.length} брендов возвращено в пул`);
          break;
        case "archive":
          await api.post("/super-admin/brands/bulk-archive", {
            brand_ids: brandIds,
            reason: params.reason
          });
          toast.success(`${brandIds.length} брендов в архив`);
          break;
        case "blacklist":
          await api.post("/super-admin/brands/bulk-blacklist", {
            brand_ids: brandIds,
            reason: params.reason
          });
          toast.success(`${brandIds.length} брендов в ЧС`);
          break;
        case "assign":
          await api.post("/super-admin/brands/bulk-assign", {
            brand_ids: brandIds,
            user_id: params.userId,
            reason: params.reason
          });
          toast.success(`${brandIds.length} брендов назначено`);
          break;
      }
      setBulkModal({ open: false, action: null });
      setSelectedBrands(new Set());
      setSelectAllPages(false);
      setAllBrandIds([]);
      fetchBrands();
    } catch (error) {
      toast.error("Ошибка массовой операции");
    }
  };

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const statusOptions = [
    { value: "IN_POOL", label: "В пуле" },
    { value: "ASSIGNED", label: "Назначен" },
    { value: "IN_WORK", label: "В работе" },
    { value: "WAITING", label: "Ожидание" },
    { value: "ON_HOLD", label: "Приостановлен" },
    { value: "OUTCOME_APPROVED", label: "Одобрен" },
    { value: "OUTCOME_DECLINED", label: "Отклонён" },
    { value: "OUTCOME_REPLIED", label: "Ответил" },
    { value: "REPLIED_NEED_ACTION", label: "Нужно действие" },
    { value: "REPLIED_NEED_SEARCHER", label: "Внимание сёрчера!" },
    { value: "REPLIED_WAITING", label: "Ожидаем от них" },
    { value: "REPLIED_APPROVED", label: "Одобрили" },
    { value: "REPLIED_DECLINED", label: "Отказали" },
    { value: "PROBLEMATIC", label: "Проблемный" },
  ];

  const stageOptions = [
    { value: "REVIEW", label: "🔍 Изучение" },
    { value: "EMAIL_1_DONE", label: "1️⃣ Письмо 1" },
    { value: "EMAIL_2_DONE", label: "2️⃣ Письмо 2" },
    { value: "MULTI_CHANNEL_DONE", label: "📱 Соцсети" },
    { value: "CALL_OR_PUSH_RECOMMENDED", label: "📞 Звонок" },
    { value: "CLOSED", label: "✅ Закрыт" },
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="brands-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider">
            Все бренды
          </h1>
          <p className="text-[#94A3B8] mt-1">Всего: {total.toLocaleString()} брендов</p>
        </div>
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

          <Select 
            value={filters.assigned_to} 
            onValueChange={(v) => setFilters({ ...filters, assigned_to: v === "all" ? "" : v, page: 1 })}
          >
            <SelectTrigger className="w-[180px] bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="user-filter">
              <SelectValue placeholder="Сёрчер" />
            </SelectTrigger>
            <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
              <SelectItem value="all">Все сёрчеры</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>{user.nickname}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={filters.overdue ? "default" : "outline"}
            onClick={() => setFilters({ ...filters, overdue: !filters.overdue, page: 1 })}
            className={filters.overdue ? "btn-primary" : "border-[#2A2F3A] text-[#94A3B8]"}
            data-testid="overdue-filter"
          >
            Просрочено
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar (super_admin only) */}
      {isAdmin && selectedBrands.size > 0 && (
        <div className="bg-[#FF9900]/10 border border-[#FF9900]/30 rounded-[2px] p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[#FF9900] font-medium">
              Выбрано: {selectedBrands.size} брендов
              {selectAllPages && <span className="text-xs ml-1">(все страницы)</span>}
            </span>
            {!selectAllPages && pages > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAllPages}
                className="border-[#FF9900]/50 text-[#FF9900] hover:bg-[#FF9900]/10"
              >
                <CheckCircle size={14} className="mr-1" />
                Выбрать все {total} брендов
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setBulkModal({ open: true, action: "archive" })}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Archive size={14} className="mr-1" />
              В архив
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkModal({ open: true, action: "blacklist" })}
              variant="destructive"
            >
              <Ban size={14} className="mr-1" />
              В ЧС
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkModal({ open: true, action: "assign" })}
              className="btn-primary"
            >
              <UserPlus size={14} className="mr-1" />
              Назначить
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkModal({ open: true, action: "release" })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RotateCcw size={14} className="mr-1" />
              В пул
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSelectedBrands(new Set()); setSelectAllPages(false); }}
              className="border-[#2A2F3A] text-[#94A3B8]"
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="brands-table">
            <thead>
              <tr className="table-header">
                {isAdmin && (
                  <th className="py-3 px-2 text-center w-10">
                    <button onClick={toggleSelectAll} className="text-[#94A3B8] hover:text-[#FF9900]">
                      {selectedBrands.size === brands.length && brands.length > 0 ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3 px-4 text-left">Бренд</th>
                <th className="py-3 px-4 text-center">Приоритет</th>
                <th className="py-3 px-4 text-center">Товаров</th>
                <th className="py-3 px-4 text-left">Статус</th>
                <th className="py-3 px-4 text-left">Этап</th>
                <th className="py-3 px-4 text-left">Сёрчер</th>
                <th className="py-3 px-4 text-left">След. действие</th>
                <th className="py-3 px-4 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-[#94A3B8]">
                    Загрузка...
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-[#94A3B8]">
                    Нет брендов
                  </td>
                </tr>
              ) : (
                brands.map((brand) => {
                  const isOverdue = brand.next_action_at && new Date(brand.next_action_at) < new Date();
                  const isSelected = selectedBrands.has(brand.id);
                  return (
                    <tr 
                      key={brand.id} 
                      className={`table-row cursor-pointer ${isOverdue ? "bg-red-900/10" : ""} ${isSelected ? "bg-[#FF9900]/10" : ""}`}
                      onClick={() => navigate(brand.is_sub_supplier ? `/sub-suppliers/${brand.id}` : `/brands/${brand.id}`)}
                      data-testid={`brand-row-${brand.id}`}
                    >
                      {isAdmin && (
                        <td className="table-cell text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectBrand(brand.id)}
                            className="border-[#2A2F3A] data-[state=checked]:bg-[#FF9900]"
                          />
                        </td>
                      )}
                      <td className="table-cell font-medium">
                        <BrandTooltip brandId={brand.id}>
                          <div className="flex items-center gap-2">
                            {brand.is_sub_supplier && <span className="text-[#FF9900] text-xs">↳</span>}
                            <span>{brand.is_sub_supplier ? brand.name : brand.name_original}</span>
                            <Info size={12} className="text-[#94A3B8] opacity-50" />
                          </div>
                        </BrandTooltip>
                      </td>
                      <td className="table-cell text-center font-mono text-[#FF9900]">{brand.priority_score}</td>
                      <td className="table-cell text-center font-mono">{brand.items_count}</td>
                      <td className="table-cell">
                        <StatusBadge status={brand.status} />
                      </td>
                      <td className="table-cell">
                        <StageBadge stage={brand.pipeline_stage} />
                      </td>
                      <td className="table-cell text-[#94A3B8]">
                        {brand.assigned_to_nickname || "—"}
                      </td>
                      <td className="table-cell">
                        {brand.next_action_at ? (
                          <span className={isOverdue ? "text-red-400" : "text-[#94A3B8]"}>
                            {new Date(brand.next_action_at).toLocaleDateString('ru-RU')}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {brand.assigned_to_user_id && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReleaseModal({ open: true, brandId: brand.id })}
                                className="text-[#94A3B8] hover:text-[#E6E6E6] p-1"
                                title="Освободить"
                                data-testid={`release-btn-${brand.id}`}
                              >
                                <RotateCcw size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReassignModal({ open: true, brandId: brand.id })}
                                className="text-[#94A3B8] hover:text-[#FF9900] p-1"
                                title="Переназначить"
                                data-testid={`reassign-btn-${brand.id}`}
                              >
                                <UserPlus size={16} />
                              </Button>
                            </>
                          )}
                        </div>
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

      {/* Release Modal */}
      <ReleaseModal
        open={releaseModal.open}
        onClose={() => setReleaseModal({ open: false, brandId: null })}
        onSubmit={handleRelease}
      />

      {/* Reassign Modal */}
      <ReassignModal
        open={reassignModal.open}
        onClose={() => setReassignModal({ open: false, brandId: null })}
        onSubmit={handleReassign}
        users={users}
      />

      {/* Bulk Action Modal (super_admin) */}
      {bulkModal.open && (
        <BulkActionModal
          action={bulkModal.action}
          count={selectedBrands.size}
          users={users}
          onClose={() => setBulkModal({ open: false, action: null })}
          onSubmit={(params) => handleBulkAction(bulkModal.action, params)}
        />
      )}
    </div>
  );
};

const StageBadge = ({ stage }) => {
  const stageConfig = {
    REVIEW: { label: "🔍 Изучение", color: "bg-gray-800 text-gray-400 border-gray-700" },
    EMAIL_1_DONE: { label: "1️⃣ Письмо 1", color: "bg-blue-900/20 text-blue-400 border-blue-800" },
    EMAIL_2_DONE: { label: "2️⃣ Письмо 2", color: "bg-indigo-900/20 text-indigo-400 border-indigo-800" },
    MULTI_CHANNEL_DONE: { label: "📱 Соцсети", color: "bg-purple-900/20 text-purple-400 border-purple-800" },
    CALL_OR_PUSH_RECOMMENDED: { label: "📞 Звонок", color: "bg-orange-900/20 text-orange-400 border-orange-800" },
    CLOSED: { label: "✅ Закрыт", color: "bg-green-900/20 text-green-400 border-green-800" },
  };

  const config = stageConfig[stage] || { label: stage || "—", color: "bg-gray-800 text-gray-400 border-gray-700" };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
};

const ReleaseModal = ({ open, onClose, onSubmit }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Укажите причину");
      return;
    }
    setLoading(true);
    await onSubmit(reason);
    setLoading(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="text-[#E6E6E6] font-mono uppercase tracking-wider">
            Освободить бренд
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина освобождения</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] min-h-[100px]"
              placeholder="Укажите причину..."
              required
              data-testid="release-reason"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="confirm-release">
              {loading ? "Освобождение..." : "Освободить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ReassignModal = ({ open, onClose, onSubmit, users }) => {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Выберите сёрчера");
      return;
    }
    if (!reason.trim()) {
      toast.error("Укажите причину");
      return;
    }
    setLoading(true);
    await onSubmit(userId, reason);
    setLoading(false);
    setUserId("");
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="text-[#E6E6E6] font-mono uppercase tracking-wider">
            Переназначить бренд
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Новый сёрчер</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="reassign-user">
                <SelectValue placeholder="Выберите сёрчера" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина переназначения</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] min-h-[100px]"
              placeholder="Укажите причину..."
              required
              data-testid="reassign-reason"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="confirm-reassign">
              {loading ? "Переназначение..." : "Переназначить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const BulkActionModal = ({ action, count, users, onClose, onSubmit }) => {
  const [reason, setReason] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  const titles = {
    archive: "Архивировать бренды",
    blacklist: "В чёрный список",
    assign: "Назначить бренды",
    release: "Сбросить в пул"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Для release причина необязательна
    if (action !== "release" && !reason.trim()) {
      toast.error("Укажите причину");
      return;
    }
    if (action === "assign" && !userId) {
      toast.error("Выберите сёрчера");
      return;
    }
    setLoading(true);
    await onSubmit({ reason: reason || "Массовый сброс", userId });
    setLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className={`font-mono uppercase tracking-wider ${
            action === "blacklist" ? "text-red-400" : 
            action === "archive" ? "text-yellow-400" : 
            action === "release" ? "text-blue-400" : "text-[#FF9900]"
          }`}>
            {titles[action]}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-[#94A3B8]">
            Выбрано брендов: <span className="text-[#FF9900] font-bold">{count}</span>
          </p>
          
          {action === "release" && (
            <p className="text-sm text-blue-400 bg-blue-900/20 p-3 rounded">
              Все выбранные бренды будут освобождены от текущих сёрчеров и возвращены в пул.
            </p>
          )}
          
          {action === "assign" && (
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Сёрчер</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                  <SelectValue placeholder="Выберите сёрчера" />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nickname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {action !== "release" && (
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Причина</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
                placeholder="Укажите причину..."
                required
              />
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className={
                action === "blacklist" ? "bg-red-600 hover:bg-red-700" :
                action === "archive" ? "bg-yellow-600 hover:bg-yellow-700" :
                action === "release" ? "bg-blue-600 hover:bg-blue-700" :
                "btn-primary"
              }
            >
              {loading ? "Обработка..." : "Подтвердить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BrandsPage;
