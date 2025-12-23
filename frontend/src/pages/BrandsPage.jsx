import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../App";
import { toast } from "sonner";
import { Search, Filter, ChevronLeft, ChevronRight, RotateCcw, UserPlus } from "lucide-react";
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
import StatusBadge from "../components/StatusBadge";

const BrandsPage = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  
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
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchBrands = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.pipeline_stage) params.append("pipeline_stage", filters.pipeline_stage);
      if (filters.assigned_to) params.append("assigned_to", filters.assigned_to);
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

  const statusOptions = [
    { value: "IN_POOL", label: "В пуле" },
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
                <th className="py-3 px-4 text-left">Сёрчер</th>
                <th className="py-3 px-4 text-left">След. действие</th>
                <th className="py-3 px-4 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#94A3B8]">
                    Загрузка...
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#94A3B8]">
                    Нет брендов
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

  const config = stageConfig[stage] || { label: stage, color: "bg-gray-800 text-gray-400 border-gray-700" };

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

export default BrandsPage;
