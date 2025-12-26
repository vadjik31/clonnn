import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight, RotateCcw, UserPlus, Archive, Ban, CheckSquare, Square, CheckCircle, MessageSquare, Phone, Info, Users } from "lucide-react";
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

// Компонент тултипа с роадмапом для суб-поставщика
const SubSupplierTooltip = ({ subSupplierId, children }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const fetchData = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/sub-suppliers/${subSupplierId}`);
      setData(res.data);
    } catch (e) {
      console.error("SubSupplier tooltip error", e);
    } finally {
      setLoading(false);
    }
  }, [subSupplierId, data, loading]);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => { setShow(true); fetchData(); }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 left-full top-0 ml-2 w-64 bg-[#1A1D23] border border-[#FF9900]/30 rounded p-3 shadow-xl pointer-events-none">
          <div className="text-xs font-medium text-[#FF9900] mb-2">Под-сапплаер</div>
          {loading ? (
            <div className="text-[#94A3B8] text-xs">Загрузка...</div>
          ) : data ? (
            <div className="space-y-2">
              <div className="text-xs text-[#E6E6E6]">
                <span className="text-[#94A3B8]">Родитель:</span> {data.parent_brand_name}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#E6E6E6]">
                <MessageSquare size={12} className="text-blue-400" />
                <span>Заметок: {data.notes?.length || 0}</span>
                <Phone size={12} className="text-green-400 ml-2" />
                <span>Контактов: {data.contacts?.length || 0}</span>
              </div>
              {data.website_url && (
                <div className="text-xs text-[#94A3B8] truncate">
                  {data.website_url}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const SubSuppliersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subSuppliers, setSubSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const abortControllerRef = useRef(null);
  
  // Selection for bulk actions (admin only)
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [allItemIds, setAllItemIds] = useState([]);
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
  const [releaseModal, setReleaseModal] = useState({ open: false, itemId: null });
  const [reassignModal, setReassignModal] = useState({ open: false, itemId: null });

  useEffect(() => {
    fetchSubSuppliers();
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

  const fetchSubSuppliers = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const params = new URLSearchParams();
      if (filters.status) {
        params.append("status", filters.status);
        // Если запрашиваем архивные, добавляем флаг
        if (filters.status === "ARCHIVED") {
          params.append("include_archived", "true");
        }
      }
      if (filters.pipeline_stage) params.append("pipeline_stage", filters.pipeline_stage);
      if (filters.assigned_to) params.append("assigned_to", filters.assigned_to);
      if (filters.search) params.append("search", filters.search);
      if (filters.overdue) params.append("overdue", "true");
      params.append("page", filters.page.toString());
      params.append("limit", "50");

      const response = await api.get(`/sub-suppliers?${params}`, {
        signal: abortControllerRef.current.signal
      });
      setSubSuppliers(response.data.sub_suppliers);
      setTotal(response.data.total);
      setPages(response.data.pages);
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') return;
      toast.error("Ошибка загрузки под-сапплаеров");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      // Включаем сёрчеров и админов для назначения
      setUsers(response.data.filter(u => u.role === "searcher" || u.role === "admin"));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleRelease = async (reason) => {
    try {
      await api.post(`/sub-suppliers/${releaseModal.itemId}/return-to-searcher`, { reason });
      toast.success("Под-сапплаер освобождён");
      setReleaseModal({ open: false, itemId: null });
      fetchSubSuppliers();
    } catch (error) {
      toast.error("Ошибка освобождения");
    }
  };

  const handleReassign = async (newUserId, reason) => {
    // TODO: Implement reassign endpoint for sub-suppliers if needed
    toast.info("Функция переназначения в разработке");
    setReassignModal({ open: false, itemId: null });
  };

  // Selection handlers
  const toggleSelectItem = (itemId) => {
    setSelectAllPages(false);
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    setSelectAllPages(false);
    if (selectedItems.size === subSuppliers.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(subSuppliers.map(s => s.id)));
    }
  };

  const handleSelectAllPages = async () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedItems(new Set());
      setAllItemIds([]);
    } else {
      try {
        const params = new URLSearchParams();
        if (filters.status) params.append("status", filters.status);
        if (filters.pipeline_stage) params.append("pipeline_stage", filters.pipeline_stage);
        if (filters.assigned_to) params.append("assigned_to", filters.assigned_to);
        if (filters.search) params.append("search", filters.search);
        
        const res = await api.get(`/sub-suppliers/ids?${params}`);
        setAllItemIds(res.data.ids);
        setSelectedItems(new Set(res.data.ids));
        setSelectAllPages(true);
        toast.success(`Выбрано ${res.data.total} под-сапплаеров на всех страницах`);
      } catch (error) {
        toast.error("Ошибка получения списка");
      }
    }
  };

  const handleBulkAction = async (action, params) => {
    const itemIds = selectAllPages ? allItemIds : Array.from(selectedItems);
    if (itemIds.length === 0) {
      toast.error("Выберите под-сапплаеров");
      return;
    }

    try {
      switch (action) {
        case "release":
          await api.post("/sub-suppliers/bulk-release", {
            sub_supplier_ids: itemIds,
            reason: params.reason || "Массовый сброс в пул"
          });
          toast.success(`${itemIds.length} под-сапплаеров освобождено`);
          break;
        case "archive":
          await api.post("/sub-suppliers/bulk-archive", {
            sub_supplier_ids: itemIds,
            reason: params.reason
          });
          toast.success(`${itemIds.length} под-сапплаеров в архив`);
          break;
        case "assign":
          await api.post(`/sub-suppliers/bulk-assign?user_id=${params.userId}`, {
            sub_supplier_ids: itemIds,
            reason: params.reason
          });
          toast.success(`${itemIds.length} под-сапплаеров назначено`);
          break;
        case "blacklist":
          // Для под-сапплаеров blacklist = удаление (они не основные сущности)
          if (!window.confirm(`Удалить ${itemIds.length} под-сапплаеров? Это действие нельзя отменить!`)) {
            return;
          }
          await api.delete("/sub-suppliers/bulk-delete", {
            data: { sub_supplier_ids: itemIds, reason: params.reason }
          });
          toast.success(`${itemIds.length} под-сапплаеров удалено`);
          break;
      }
      setBulkModal({ open: false, action: null });
      setSelectedItems(new Set());
      setSelectAllPages(false);
      setAllItemIds([]);
      fetchSubSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка массовой операции");
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
    { value: "ARCHIVED", label: "📦 В архиве" },
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
    <div className="space-y-6 animate-fade-in" data-testid="sub-suppliers-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
            <Users className="text-[#FF9900]" size={28} />
            Под-сапплаеры
          </h1>
          <p className="text-[#94A3B8] mt-1">Всего: {total.toLocaleString()} под-сапплаеров</p>
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

          {isAdmin && (
            <Select 
              value={filters.assigned_to} 
              onValueChange={(v) => setFilters({ ...filters, assigned_to: v === "all" ? "" : v, page: 1 })}
            >
              <SelectTrigger className="w-[180px] bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="user-filter">
                <SelectValue placeholder="Сёрчер" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                <SelectItem value="all">Все сёрчеры</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nickname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

      {/* Bulk Actions Bar (admin only) */}
      {isAdmin && selectedItems.size > 0 && (
        <div className="bg-[#FF9900]/10 border border-[#FF9900]/30 rounded-[2px] p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[#FF9900] font-medium">
              Выбрано: {selectedItems.size} под-сапплаеров
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
                Выбрать все {total}
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
              onClick={() => { setSelectedItems(new Set()); setSelectAllPages(false); }}
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
          <table className="w-full" data-testid="sub-suppliers-table">
            <thead>
              <tr className="table-header">
                {isAdmin && (
                  <th className="py-3 px-2 text-center w-10">
                    <button onClick={toggleSelectAll} className="text-[#94A3B8] hover:text-[#FF9900]">
                      {selectedItems.size === subSuppliers.length && subSuppliers.length > 0 ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3 px-4 text-left">Под-сапплаер</th>
                <th className="py-3 px-4 text-left">Родитель</th>
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
                  <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-[#94A3B8]">
                    Загрузка...
                  </td>
                </tr>
              ) : subSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-[#94A3B8]">
                    Нет под-сапплаеров
                  </td>
                </tr>
              ) : (
                subSuppliers.map((ss) => {
                  const isOverdue = ss.next_action_at && new Date(ss.next_action_at) < new Date();
                  const isSelected = selectedItems.has(ss.id);
                  return (
                    <tr 
                      key={ss.id} 
                      className={`table-row cursor-pointer ${isOverdue ? "bg-red-900/10" : ""} ${isSelected ? "bg-[#FF9900]/10" : ""}`}
                      onClick={() => navigate(`/sub-suppliers/${ss.id}`)}
                      data-testid={`sub-supplier-row-${ss.id}`}
                    >
                      {isAdmin && (
                        <td className="table-cell text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectItem(ss.id)}
                            className="border-[#2A2F3A] data-[state=checked]:bg-[#FF9900]"
                          />
                        </td>
                      )}
                      <td className="table-cell font-medium">
                        <SubSupplierTooltip subSupplierId={ss.id}>
                          <div className="flex items-center gap-2">
                            <span className="text-[#FF9900] text-xs">↳</span>
                            <span>{ss.name}</span>
                            <Info size={12} className="text-[#94A3B8] opacity-50" />
                          </div>
                        </SubSupplierTooltip>
                      </td>
                      <td className="table-cell text-[#94A3B8]">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/brands/${ss.parent_brand_id}`);
                          }}
                          className="hover:text-[#FF9900] transition-colors"
                        >
                          {ss.parent_brand_name}
                        </button>
                      </td>
                      <td className="table-cell text-center font-mono text-[#FF9900]">{ss.priority_score}</td>
                      <td className="table-cell text-center font-mono">{ss.items_count}</td>
                      <td className="table-cell">
                        <StatusBadge status={ss.status} />
                      </td>
                      <td className="table-cell">
                        <StageBadge stage={ss.pipeline_stage} />
                      </td>
                      <td className="table-cell text-[#94A3B8]">
                        {ss.assigned_to_nickname || "—"}
                      </td>
                      <td className="table-cell">
                        {ss.next_action_at ? (
                          <span className={isOverdue ? "text-red-400" : "text-[#94A3B8]"}>
                            {new Date(ss.next_action_at).toLocaleDateString('ru-RU')}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {ss.assigned_to_user_id && isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReleaseModal({ open: true, itemId: ss.id })}
                                className="text-[#94A3B8] hover:text-[#E6E6E6] p-1"
                                title="Освободить"
                              >
                                <RotateCcw size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReassignModal({ open: true, itemId: ss.id })}
                                className="text-[#94A3B8] hover:text-[#FF9900] p-1"
                                title="Переназначить"
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
        onClose={() => setReleaseModal({ open: false, itemId: null })}
        onSubmit={handleRelease}
      />

      {/* Reassign Modal */}
      <ReassignModal
        open={reassignModal.open}
        onClose={() => setReassignModal({ open: false, itemId: null })}
        onSubmit={handleReassign}
        users={users}
      />

      {/* Bulk Action Modal */}
      {bulkModal.open && (
        <BulkActionModal
          action={bulkModal.action}
          count={selectedItems.size}
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
            Освободить под-сапплаера
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
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary">
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
            Переназначить под-сапплаера
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Новый сёрчер</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]">
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
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary">
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
    archive: "Архивировать под-сапплаеров",
    blacklist: "В чёрный список",
    assign: "Назначить под-сапплаеров",
    release: "Сбросить в пул"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
            Выбрано под-сапплаеров: <span className="text-[#FF9900] font-bold">{count}</span>
          </p>
          
          {action === "release" && (
            <p className="text-sm text-blue-400 bg-blue-900/20 p-3 rounded">
              Все выбранные под-сапплаеры будут освобождены от текущих сёрчеров.
            </p>
          )}
          
          {action === "assign" && (
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Пользователь</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nickname} {u.role === 'admin' ? '(Админ)' : u.role === 'super_admin' ? '(Супер-админ)' : ''}
                    </SelectItem>
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

export default SubSuppliersPage;
