import { useState, useEffect, useRef } from "react";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { 
  Shield, 
  Users, 
  Settings, 
  Archive, 
  Ban, 
  Clock,
  FileText,
  Trash2,
  RotateCcw,
  Calendar,
  Activity,
  CheckCircle,
  XCircle,
  UserCheck,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const SuperAdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("check-ins");
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef(null);
  
  // Data states
  const [checkIns, setCheckIns] = useState(null);
  const [imports, setImports] = useState([]);
  const [settings, setSettings] = useState(null);
  const [archivedBrands, setArchivedBrands] = useState([]);
  const [archivedSubSuppliers, setArchivedSubSuppliers] = useState([]);
  const [blacklistedBrands, setBlacklistedBrands] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [searchers, setSearchers] = useState([]);
  const [selectedArchived, setSelectedArchived] = useState(new Set());
  const [selectedArchivedSS, setSelectedArchivedSS] = useState(new Set());
  const [selectedBlacklisted, setSelectedBlacklisted] = useState(new Set());
  const [selectingAllArchived, setSelectingAllArchived] = useState(false);
  
  // Pagination states
  const [archivePage, setArchivePage] = useState(1);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archivePages, setArchivePages] = useState(0);
  const [blacklistPage, setBlacklistPage] = useState(1);
  const [blacklistTotal, setBlacklistTotal] = useState(0);
  const [blacklistPages, setBlacklistPages] = useState(0);
  
  // Modal states
  const [settingsModal, setSettingsModal] = useState(false);
  const [deleteImportModal, setDeleteImportModal] = useState(null);

  useEffect(() => {
    if (user?.role === "super_admin" || user?.role === "admin") {
      fetchData();
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [activeTab, user]);

  const fetchData = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    try {
      const signal = abortControllerRef.current.signal;
      switch (activeTab) {
        case "check-ins":
          const checkInsRes = await api.get("/super-admin/check-ins", { signal });
          setCheckIns(checkInsRes.data);
          break;
        case "imports":
          const importsRes = await api.get("/super-admin/imports", { signal });
          setImports(importsRes.data.imports || []);
          break;
        case "settings":
          const settingsRes = await api.get("/super-admin/settings", { signal });
          setSettings(settingsRes.data);
          break;
        case "archived":
          await fetchArchivedBrands(1);
          break;
        case "blacklist":
          await fetchBlacklistedBrands(1);
          break;
        case "activity":
          const usersRes = await api.get("/users", { signal });
          setSearchers(usersRes.data.filter(u => u.role === "searcher"));
          break;
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') return;
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedBrands = async (page) => {
    try {
      const res = await api.get(`/super-admin/archived-brands?page=${page}&limit=50`);
      setArchivedBrands(res.data.brands || []);
      setArchivePage(res.data.page || 1);
      setArchiveTotal(res.data.total || 0);
      setArchivePages(res.data.pages || 0);
      setSelectedArchived(new Set());
      
      // Также загружаем архивных под-сапплаеров
      const ssRes = await api.get("/sub-suppliers?status=ARCHIVED&include_archived=true&limit=100");
      setArchivedSubSuppliers(ssRes.data.sub_suppliers || []);
      setSelectedArchivedSS(new Set());
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        toast.error("Ошибка загрузки архива");
      }
    }
  };

  const fetchBlacklistedBrands = async (page) => {
    try {
      const res = await api.get(`/super-admin/blacklisted-brands?page=${page}&limit=50`);
      setBlacklistedBrands(res.data.brands || []);
      setBlacklistPage(res.data.page || 1);
      setBlacklistTotal(res.data.total || 0);
      setBlacklistPages(res.data.pages || 0);
      setSelectedBlacklisted(new Set());
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        toast.error("Ошибка загрузки ЧС");
      }
    }
  };

  const fetchUserActivity = async (userId) => {
    try {
      const res = await api.get(`/super-admin/user/${userId}/activity?days=7`);
      setUserActivity(res.data);
      setSelectedUser(userId);
    } catch (error) {
      toast.error("Ошибка загрузки активности");
    }
  };

  const handleDeleteImport = async (importId, archive = true) => {
    try {
      await api.delete(`/super-admin/imports/${importId}?archive=${archive}`);
      toast.success(archive ? "Импорт удалён, бренды в архиве" : "Импорт полностью удалён");
      setDeleteImportModal(null);
      fetchData();
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleRestoreBrand = async (brandId) => {
    try {
      await api.post(`/super-admin/brands/${brandId}/restore`);
      toast.success("Бренд восстановлен");
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleDeleteBrand = async (brandId, brandName) => {
    if (!window.confirm(`Удалить бренд "${brandName}" навсегда? Это действие нельзя отменить!`)) return;
    try {
      await api.delete(`/super-admin/brands/${brandId}`);
      toast.success("Бренд удалён");
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleBulkDeleteArchived = async () => {
    if (selectedArchived.size === 0) return;
    if (!window.confirm(`Удалить ${selectedArchived.size} брендов навсегда? Это действие нельзя отменить!`)) return;
    try {
      const brandIds = Array.from(selectedArchived);
      await api.delete("/super-admin/brands/bulk-delete", { data: brandIds });
      toast.success(`Удалено ${selectedArchived.size} брендов`);
      setSelectedArchived(new Set());
      fetchArchivedBrands(archivePage);
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error.response?.data?.detail || "Ошибка удаления");
    }
  };

  const handleBulkRestoreArchived = async () => {
    if (selectedArchived.size === 0) return;
    try {
      await api.post("/super-admin/brands/bulk-restore", Array.from(selectedArchived));
      toast.success(`Восстановлено ${selectedArchived.size} брендов`);
      setSelectedArchived(new Set());
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleSelectAllArchived = async () => {
    setSelectingAllArchived(true);
    try {
      // Загружаем только ID всех архивных брендов
      const res = await api.get("/super-admin/archived-brands/all-ids");
      const allIds = res.data.ids || [];
      setSelectedArchived(new Set(allIds));
      toast.success(`Выбрано ${allIds.length} брендов`);
    } catch (error) {
      toast.error("Ошибка загрузки");
    } finally {
      setSelectingAllArchived(false);
    }
  };

  // Sub-supplier archive handlers
  const handleRestoreSubSupplier = async (ssId) => {
    try {
      await api.post("/sub-suppliers/bulk-release", { sub_supplier_ids: [ssId], reason: "Восстановлен из архива" });
      toast.success("Под-сапплаер восстановлен");
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleDeleteSubSupplier = async (ssId, name) => {
    if (!window.confirm(`Удалить под-сапплаера "${name}" навсегда?`)) return;
    try {
      await api.delete("/sub-suppliers/bulk-delete", { data: { sub_supplier_ids: [ssId], reason: "Удалён из архива" } });
      toast.success("Под-сапплаер удалён");
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка удаления");
    }
  };

  const handleBulkDeleteArchivedSS = async () => {
    if (selectedArchivedSS.size === 0) return;
    if (!window.confirm(`Удалить ${selectedArchivedSS.size} под-сапплаеров навсегда?`)) return;
    try {
      await api.delete("/sub-suppliers/bulk-delete", { data: { sub_supplier_ids: Array.from(selectedArchivedSS), reason: "Массовое удаление из архива" } });
      toast.success(`Удалено ${selectedArchivedSS.size} под-сапплаеров`);
      setSelectedArchivedSS(new Set());
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка удаления");
    }
  };

  const handleBulkRestoreArchivedSS = async () => {
    if (selectedArchivedSS.size === 0) return;
    try {
      await api.post("/sub-suppliers/bulk-release", { sub_supplier_ids: Array.from(selectedArchivedSS), reason: "Массовое восстановление" });
      toast.success(`Восстановлено ${selectedArchivedSS.size} под-сапплаеров`);
      setSelectedArchivedSS(new Set());
      fetchArchivedBrands(archivePage);
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleUnblacklistBrand = async (brandId) => {
    try {
      await api.post(`/super-admin/brands/${brandId}/unblacklist`);
      toast.success("Бренд убран из ЧС");
      fetchBlacklistedBrands(blacklistPage);
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      await api.put("/super-admin/settings", newSettings);
      toast.success("Настройки сохранены");
      setSettingsModal(false);
      fetchData();
    } catch (error) {
      toast.error("Ошибка сохранения");
    }
  };

  if (user?.role !== "super_admin" && user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 font-mono">⛔ Доступ запрещён. Требуется роль супер-админа.</div>
      </div>
    );
  }

  const tabs = [
    { id: "check-ins", label: "Отметки", icon: UserCheck },
    { id: "activity", label: "Активность", icon: Activity },
    { id: "imports", label: "Импорты", icon: FileText },
    { id: "archived", label: "Архив", icon: Archive },
    { id: "blacklist", label: "Чёрный список", icon: Ban },
    { id: "settings", label: "Настройки", icon: Settings },
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="super-admin-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
            <Shield className="text-[#FF9900]" />
            Управление
          </h1>
          <p className="text-[#94A3B8] mt-1">Управление системой</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2A2F3A] pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${
              activeTab === tab.id
                ? "bg-[#FF9900]/20 text-[#FF9900] border-b-2 border-[#FF9900]"
                : "text-[#94A3B8] hover:text-[#E6E6E6]"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[#FF9900] font-mono">Загрузка...</div>
        </div>
      ) : (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          {activeTab === "check-ins" && <CheckInsTab data={checkIns} />}
          {activeTab === "activity" && (
            <ActivityTab 
              searchers={searchers} 
              selectedUser={selectedUser}
              userActivity={userActivity}
              onSelectUser={fetchUserActivity}
            />
          )}
          {activeTab === "imports" && (
            <ImportsTab 
              imports={imports} 
              onDelete={(imp) => setDeleteImportModal(imp)}
            />
          )}
          {activeTab === "archived" && (
            <ArchivedTab 
              brands={archivedBrands} 
              subSuppliers={archivedSubSuppliers}
              onRestore={handleRestoreBrand}
              onDelete={handleDeleteBrand}
              onRestoreSS={handleRestoreSubSupplier}
              onDeleteSS={handleDeleteSubSupplier}
              selected={selectedArchived}
              selectedSS={selectedArchivedSS}
              onSelectChange={setSelectedArchived}
              onSelectChangeSS={setSelectedArchivedSS}
              onBulkDelete={handleBulkDeleteArchived}
              onBulkRestore={handleBulkRestoreArchived}
              onBulkDeleteSS={handleBulkDeleteArchivedSS}
              onBulkRestoreSS={handleBulkRestoreArchivedSS}
              page={archivePage}
              total={archiveTotal}
              pages={archivePages}
              onPageChange={(p) => fetchArchivedBrands(p)}
              onSelectAll={handleSelectAllArchived}
              selectingAll={selectingAllArchived}
            />
          )}
          {activeTab === "blacklist" && (
            <BlacklistTab 
              brands={blacklistedBrands} 
              onRemove={handleUnblacklistBrand}
              page={blacklistPage}
              total={blacklistTotal}
              pages={blacklistPages}
              onPageChange={(p) => fetchBlacklistedBrands(p)}
            />
          )}
          {activeTab === "settings" && (
            <SettingsTab 
              settings={settings}
              onEdit={() => setSettingsModal(true)}
            />
          )}
        </div>
      )}

      {/* Delete Import Modal */}
      {deleteImportModal && (
        <Dialog open={true} onOpenChange={() => setDeleteImportModal(null)}>
          <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
            <DialogHeader>
              <DialogTitle className="font-mono uppercase tracking-wider text-red-400">
                Удалить импорт
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-[#94A3B8]">
                Удалить файл <span className="text-[#FF9900]">{deleteImportModal.file_name}</span>?
              </p>
              <p className="text-sm text-[#94A3B8]">
                Активных брендов: <span className="text-[#E6E6E6]">{deleteImportModal.active_brands_count}</span>
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDeleteImport(deleteImportModal.id, true)}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                >
                  <Archive size={16} className="mr-2" />
                  В архив
                </Button>
                <Button
                  onClick={() => handleDeleteImport(deleteImportModal.id, false)}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 size={16} className="mr-2" />
                  Удалить навсегда
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setDeleteImportModal(null)}
                className="w-full border-[#2A2F3A] text-[#94A3B8]"
              >
                Отмена
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsModal(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};

// Pagination Component
const Pagination = ({ page, pages, total, onPageChange }) => {
  if (pages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2A2F3A]">
      <span className="text-sm text-[#94A3B8]">
        Всего: {total} • Страница {page} из {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="border-[#2A2F3A] text-[#94A3B8]"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="border-[#2A2F3A] text-[#94A3B8]"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};

// Tab Components
const CheckInsTab = ({ data }) => {
  if (!data) return <p className="text-[#94A3B8]">Нет данных</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
          <UserCheck size={18} className="text-[#FF9900]" />
          Отметки за {data.date}
        </h3>
        <div className="text-sm text-[#94A3B8]">
          {data.total_checked_in} из {data.total_searchers} сёрчеров
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Checked In */}
        <div>
          <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
            <CheckCircle size={14} />
            Отметились ({data.checked_in?.length || 0})
          </h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.checked_in?.map(c => (
              <div key={c.id} className="p-3 bg-[#0F1115] rounded-[2px] flex justify-between">
                <span className="text-[#E6E6E6]">{c.user_nickname}</span>
                <span className="text-xs text-[#94A3B8]">
                  {new Date(c.created_at).toLocaleTimeString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Not Checked In */}
        <div>
          <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <XCircle size={14} />
            Не отметились ({data.not_checked_in?.length || 0})
          </h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.not_checked_in?.map(u => (
              <div key={u.id} className="p-3 bg-[#0F1115] rounded-[2px]">
                <span className="text-[#E6E6E6]">{u.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityTab = ({ searchers, selectedUser, userActivity, onSelectUser }) => {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="w-64">
          <Label className="text-[#94A3B8] mb-2 block">Выберите сёрчера</Label>
          <Select value={selectedUser || ""} onValueChange={onSelectUser}>
            <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
              <SelectValue placeholder="Сёрчер..." />
            </SelectTrigger>
            <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
              {searchers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nickname}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {userActivity && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#E6E6E6]">
            Активность: {userActivity.user?.nickname}
          </h3>
          
          {/* Check-ins */}
          <div className="bg-[#0F1115] p-4 rounded-[2px]">
            <h4 className="text-sm font-medium text-[#FF9900] mb-2">Отметки за 7 дней</h4>
            <div className="flex gap-2 flex-wrap">
              {userActivity.check_ins?.map(c => (
                <span key={c.id} className="px-2 py-1 bg-green-900/20 text-green-400 rounded text-xs">
                  {c.date}
                </span>
              ))}
              {userActivity.check_ins?.length === 0 && (
                <span className="text-[#94A3B8] text-sm">Нет отметок</span>
              )}
            </div>
          </div>

          {/* Daily Stats */}
          <div className="bg-[#0F1115] p-4 rounded-[2px]">
            <h4 className="text-sm font-medium text-[#FF9900] mb-2">Статистика по дням</h4>
            <div className="space-y-3">
              {Object.entries(userActivity.daily_stats || {}).slice(0, 7).map(([date, stats]) => (
                <div key={date} className="border-b border-[#2A2F3A] pb-2 last:border-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#E6E6E6] font-medium">{date}</span>
                    <span className="text-[#FF9900]">{stats.events} действий</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(stats.types || {}).map(([type, count]) => (
                      <span key={type} className="px-2 py-0.5 bg-[#1A1D24] text-[#94A3B8] rounded text-xs">
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div className="bg-[#0F1115] p-4 rounded-[2px]">
            <h4 className="text-sm font-medium text-[#FF9900] mb-2">Последние действия</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {userActivity.events?.slice(0, 30).map(e => (
                <div key={e.id} className="flex items-center justify-between p-2 bg-[#13161B] rounded text-sm">
                  <div className="flex-1">
                    <span className="text-[#E6E6E6]">{e.label_ru || e.event_type}</span>
                    {e.brand_name && (
                      <span className="text-[#FF9900] ml-2">• {e.brand_name}</span>
                    )}
                  </div>
                  <span className="text-[#94A3B8] text-xs whitespace-nowrap ml-2">
                    {new Date(e.created_at).toLocaleString('ru-RU', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ImportsTab = ({ imports, onDelete }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
        <FileText size={18} className="text-[#FF9900]" />
        Файлы импорта
      </h3>

      {imports.length === 0 ? (
        <p className="text-[#94A3B8]">Нет импортов</p>
      ) : (
        <div className="space-y-3">
          {imports.map(imp => (
            <div key={imp.id} className="p-4 bg-[#0F1115] rounded-[2px] flex justify-between items-center">
              <div>
                <p className="text-[#E6E6E6] font-medium">{imp.file_name}</p>
                <p className="text-xs text-[#94A3B8]">
                  {new Date(imp.created_at).toLocaleString('ru-RU')} • 
                  Активных: {imp.active_brands_count} • 
                  В архиве: {imp.archived_brands_count || 0}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(imp)}
              >
                <Trash2 size={14} className="mr-1" />
                Удалить
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ArchivedTab = ({ 
  brands, 
  subSuppliers = [], 
  onRestore, 
  onDelete, 
  onRestoreSS, 
  onDeleteSS, 
  selected, 
  selectedSS = new Set(), 
  onSelectChange, 
  onSelectChangeSS, 
  onBulkDelete, 
  onBulkRestore, 
  onBulkDeleteSS, 
  onBulkRestoreSS, 
  page, 
  total, 
  pages, 
  onPageChange, 
  onSelectAll, 
  selectingAll 
}) => {
  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectChange(newSelected);
  };

  const toggleSelectSS = (id) => {
    const newSelected = new Set(selectedSS);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectChangeSS(newSelected);
  };

  const toggleSelectAllOnPage = () => {
    if (selected.size === brands.length) {
      onSelectChange(new Set());
    } else {
      onSelectChange(new Set(brands.map(b => b.id)));
    }
  };

  const toggleSelectAllSS = () => {
    if (selectedSS.size === subSuppliers.length) {
      onSelectChangeSS(new Set());
    } else {
      onSelectChangeSS(new Set(subSuppliers.map(s => s.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Brands Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <Archive size={18} className="text-yellow-400" />
            Бренды в архиве ({total})
          </h3>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" className="btn-secondary" onClick={onBulkRestore}>
                <RotateCcw size={14} className="mr-1" />
                Восстановить ({selected.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={onBulkDelete}>
                <Trash2 size={14} className="mr-1" />
                Удалить ({selected.size})
              </Button>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === brands.length && brands.length > 0}
                onChange={toggleSelectAllOnPage}
                className="rounded border-[#2A2F3A]"
              />
              <span>Выбрать на странице</span>
            </label>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onSelectAll}
              disabled={selectingAll}
              className="text-xs border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900]"
            >
              {selectingAll ? "Загрузка..." : `Выбрать все ${total}`}
            </Button>
            {selected.size > 0 && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onSelectChange(new Set())}
                className="text-xs text-[#94A3B8]"
              >
                Сбросить
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {brands.length === 0 ? (
            <p className="text-[#94A3B8] text-sm py-4 text-center">Нет брендов в архиве</p>
          ) : (
            brands.map(b => (
              <div key={b.id} className="p-3 bg-[#0F1115] rounded-[2px] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => toggleSelect(b.id)}
                    className="rounded border-[#2A2F3A]"
                  />
                  <div>
                    <p className="text-[#E6E6E6]">{b.name_original}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {b.archive_reason || "Нет причины"} • {b.archived_at ? new Date(b.archived_at).toLocaleDateString('ru-RU') : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="btn-secondary" onClick={() => onRestore(b.id)}>
                    <RotateCcw size={14} className="mr-1" />
                    В пул
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => onDelete(b.id, b.name_original)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        
        <Pagination page={page} pages={pages} total={total} onPageChange={onPageChange} />
      </div>

      {/* Sub-Suppliers Section */}
      <div className="space-y-4 pt-4 border-t border-[#2A2F3A]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <Archive size={18} className="text-orange-400" />
            Под-сапплаеры в архиве ({subSuppliers.length})
          </h3>
          {selectedSS.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" className="btn-secondary" onClick={onBulkRestoreSS}>
                <RotateCcw size={14} className="mr-1" />
                Восстановить ({selectedSS.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={onBulkDeleteSS}>
                <Trash2 size={14} className="mr-1" />
                Удалить ({selectedSS.size})
              </Button>
            </div>
          )}
        </div>

        {subSuppliers.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSS.size === subSuppliers.length && subSuppliers.length > 0}
                onChange={toggleSelectAllSS}
                className="rounded border-[#2A2F3A]"
              />
              <span>Выбрать все</span>
            </label>
            {selectedSS.size > 0 && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => onSelectChangeSS(new Set())}
                className="text-xs text-[#94A3B8]"
              >
                Сбросить
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {subSuppliers.length === 0 ? (
            <p className="text-[#94A3B8] text-sm py-4 text-center">Нет под-сапплаеров в архиве</p>
          ) : (
            subSuppliers.map(ss => (
              <div key={ss.id} className="p-3 bg-[#0F1115] rounded-[2px] flex justify-between items-center border-l-2 border-orange-500/50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSS.has(ss.id)}
                    onChange={() => toggleSelectSS(ss.id)}
                    className="rounded border-[#2A2F3A]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF9900] text-xs">↳</span>
                      <p className="text-[#E6E6E6]">{ss.name}</p>
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      Родитель: {ss.parent_brand_name} • {ss.archived_at ? new Date(ss.archived_at).toLocaleDateString('ru-RU') : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="btn-secondary" onClick={() => onRestoreSS(ss.id)}>
                    <RotateCcw size={14} className="mr-1" />
                    В пул
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => onDeleteSS(ss.id, ss.name)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const BlacklistTab = ({ brands, onRemove, page, total, pages, onPageChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
        <Ban size={18} className="text-red-400" />
        Чёрный список ({total})
      </h3>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {brands.map(b => (
          <div key={b.id} className="p-3 bg-[#0F1115] rounded-[2px] flex justify-between items-center">
            <div>
              <p className="text-[#E6E6E6]">{b.name_original}</p>
              <p className="text-xs text-[#94A3B8]">
                {b.blacklist_reason} • {new Date(b.blacklisted_at).toLocaleDateString('ru-RU')}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[#2A2F3A] text-[#94A3B8]"
              onClick={() => onRemove(b.id)}
            >
              Убрать из ЧС
            </Button>
          </div>
        ))}
      </div>
      
      <Pagination page={page} pages={pages} total={total} onPageChange={onPageChange} />
    </div>
  );
};

const SettingsTab = ({ settings, onEdit }) => {
  if (!settings) return <p className="text-[#94A3B8]">Загрузка...</p>;

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
          <Settings size={18} className="text-[#FF9900]" />
          Глобальные настройки
        </h3>
        <Button onClick={onEdit} className="btn-primary">
          Изменить
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#0F1115] p-4 rounded-[2px]">
          <h4 className="text-sm font-medium text-[#94A3B8] mb-2">Рабочее время</h4>
          <p className="text-[#E6E6E6] font-mono">
            {settings.work_hours_start} - {settings.work_hours_end}
          </p>
        </div>

        <div className="bg-[#0F1115] p-4 rounded-[2px]">
          <h4 className="text-sm font-medium text-[#94A3B8] mb-2">Выходные</h4>
          <div className="flex gap-2">
            {weekDays.map((day, i) => (
              <span
                key={i}
                className={`px-2 py-1 rounded text-xs ${
                  settings.weekends?.includes(i)
                    ? "bg-red-900/20 text-red-400"
                    : "bg-[#1A1D24] text-[#94A3B8]"
                }`}
              >
                {day}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[#0F1115] p-4 rounded-[2px] col-span-2">
          <h4 className="text-sm font-medium text-[#94A3B8] mb-2">Праздники</h4>
          <div className="flex gap-2 flex-wrap">
            {settings.holidays?.length > 0 ? (
              settings.holidays.map((h, i) => (
                <span key={i} className="px-2 py-1 bg-purple-900/20 text-purple-400 rounded text-xs">
                  {h}
                </span>
              ))
            ) : (
              <span className="text-[#94A3B8] text-sm">Не заданы</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ settings, onClose, onSave }) => {
  const [workStart, setWorkStart] = useState(settings?.work_hours_start || "09:00");
  const [workEnd, setWorkEnd] = useState(settings?.work_hours_end || "18:00");
  const [weekends, setWeekends] = useState(settings?.weekends || [5, 6]);
  const [holidays, setHolidays] = useState((settings?.holidays || []).join(", "));

  const toggleWeekend = (day) => {
    if (weekends.includes(day)) {
      setWeekends(weekends.filter(d => d !== day));
    } else {
      setWeekends([...weekends, day]);
    }
  };

  const handleSave = () => {
    onSave({
      work_hours_start: workStart,
      work_hours_end: workEnd,
      weekends: weekends,
      holidays: holidays.split(",").map(h => h.trim()).filter(Boolean)
    });
  };

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">
            Настройки системы
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#94A3B8]">Начало рабочего дня</Label>
              <Input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
            <div>
              <Label className="text-[#94A3B8]">Конец рабочего дня</Label>
              <Input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
          </div>

          <div>
            <Label className="text-[#94A3B8] mb-2 block">Выходные дни</Label>
            <div className="flex gap-2">
              {weekDays.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekend(i)}
                  className={`px-3 py-2 rounded text-sm transition-all ${
                    weekends.includes(i)
                      ? "bg-red-600 text-white"
                      : "bg-[#0F1115] text-[#94A3B8] hover:bg-[#1A1D24]"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[#94A3B8]">Праздники (через запятую, YYYY-MM-DD)</Label>
            <Input
              value={holidays}
              onChange={(e) => setHolidays(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="2025-01-01, 2025-05-01"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button onClick={handleSave} className="btn-primary">
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuperAdminPage;
