import { useState, useEffect, useRef, useCallback } from "react";
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
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Download
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

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
  const [blacklistedBrands, setBlacklistedBrands] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [searchers, setSearchers] = useState([]);
  const [selectedArchived, setSelectedArchived] = useState(new Set());
  const [selectedBlacklisted, setSelectedBlacklisted] = useState(new Set());
  
  // Pagination states
  const [archivePagination, setArchivePagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [blacklistPagination, setBlacklistPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [archiveSearch, setArchiveSearch] = useState("");
  const [blacklistSearch, setBlacklistSearch] = useState("");
  
  // Modal states
  const [settingsModal, setSettingsModal] = useState(false);
  const [deleteImportModal, setDeleteImportModal] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user?.role === "super_admin" || user?.role === "admin") {
      fetchData();
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [activeTab, user]);

  const fetchData = async (page = 1) => {
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
          await fetchArchivedBrands(page, archiveSearch);
          break;
        case "blacklist":
          await fetchBlacklistedBrands(page, blacklistSearch);
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

  const fetchArchivedBrands = async (page = 1, search = "") => {
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.append("search", search);
      
      const res = await api.get(`/super-admin/archived-brands?${params}`);
      setArchivedBrands(res.data.brands || []);
      setArchivePagination({
        page: res.data.page || 1,
        limit: res.data.limit || 50,
        total: res.data.total || 0,
        pages: res.data.pages || 0
      });
      setSelectedArchived(new Set());
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        toast.error("Ошибка загрузки архива");
      }
    }
  };

  const fetchBlacklistedBrands = async (page = 1, search = "") => {
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.append("search", search);
      
      const res = await api.get(`/super-admin/blacklisted-brands?${params}`);
      setBlacklistedBrands(res.data.brands || []);
      setBlacklistPagination({
        page: res.data.page || 1,
        limit: res.data.limit || 50,
        total: res.data.total || 0,
        pages: res.data.pages || 0
      });
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
      fetchArchivedBrands(archivePagination.page, archiveSearch);
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleDeleteBrand = async (brandId, brandName) => {
    if (!window.confirm(`Удалить бренд "${brandName}" навсегда? Это действие нельзя отменить!`)) return;
    try {
      await api.delete(`/super-admin/brands/${brandId}`);
      toast.success("Бренд удалён");
      fetchArchivedBrands(archivePagination.page, archiveSearch);
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleBulkDeleteArchived = async () => {
    if (selectedArchived.size === 0) return;
    setBulkDeleteConfirm(false);
    
    try {
      const brandIds = Array.from(selectedArchived);
      await api.delete("/super-admin/brands/bulk-delete", { data: brandIds });
      toast.success(`Удалено ${selectedArchived.size} брендов`);
      setSelectedArchived(new Set());
      fetchArchivedBrands(archivePagination.page, archiveSearch);
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
      fetchArchivedBrands(archivePagination.page, archiveSearch);
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleUnblacklistBrand = async (brandId) => {
    try {
      await api.post(`/super-admin/brands/${brandId}/unblacklist`);
      toast.success("Бренд убран из ЧС");
      fetchBlacklistedBrands(blacklistPagination.page, blacklistSearch);
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

  // Debounced search
  const handleArchiveSearch = useCallback((value) => {
    setArchiveSearch(value);
    const timer = setTimeout(() => {
      fetchArchivedBrands(1, value);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleBlacklistSearch = useCallback((value) => {
    setBlacklistSearch(value);
    const timer = setTimeout(() => {
      fetchBlacklistedBrands(1, value);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (user?.role !== "super_admin" && user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="bg-gradient-to-br from-red-950/50 to-red-900/30 border-red-800/50">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
            <p className="text-red-400 font-mono text-lg">⛔ Доступ запрещён</p>
            <p className="text-red-400/70 text-sm mt-2">Требуется роль админа или супер-админа</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: "check-ins", label: "Отметки", icon: UserCheck, color: "text-green-400" },
    { id: "activity", label: "Активность", icon: Activity, color: "text-blue-400" },
    { id: "imports", label: "Импорты", icon: FileText, color: "text-purple-400" },
    { id: "archived", label: "Архив", icon: Archive, color: "text-yellow-400" },
    { id: "blacklist", label: "Чёрный список", icon: Ban, color: "text-red-400" },
    { id: "settings", label: "Настройки", icon: Settings, color: "text-[#FF9900]" },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in" data-testid="super-admin-page">
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#1a1d24] via-[#1f2937] to-[#1a1d24] border border-[#2A2F3A] p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-[#FF9900]/5 via-transparent to-[#FF9900]/5" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FF9900]/5 rounded-full blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF9900]/20 to-[#FF9900]/5 border border-[#FF9900]/30">
                <Shield className="w-8 h-8 text-[#FF9900]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
                  Управление
                  <Sparkles className="w-5 h-5 text-[#FF9900] animate-pulse" />
                </h1>
                <p className="text-[#94A3B8] mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="border-[#FF9900]/50 text-[#FF9900]">
                    {user?.role === "super_admin" ? "Супер-админ" : "Админ"}
                  </Badge>
                  <span className="text-xs">Панель управления системой</span>
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchData()}
              className="border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900] hover:border-[#FF9900]/50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Обновить
            </Button>
          </div>
        </div>

        {/* Premium Tabs */}
        <div className="flex gap-1 p-1 bg-[#0F1115] rounded-xl border border-[#2A2F3A]">
          {tabs.map(tab => (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 flex-1 justify-center ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-[#FF9900]/20 to-[#FF9900]/10 text-[#FF9900] shadow-lg shadow-[#FF9900]/10 border border-[#FF9900]/30"
                      : "text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24]"
                  }`}
                >
                  <tab.icon size={18} className={activeTab === tab.id ? "text-[#FF9900]" : tab.color} />
                  <span className="font-medium hidden md:inline">{tab.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tab.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <Card className="bg-[#13161B] border-[#2A2F3A]">
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-12 w-full bg-[#1A1D24]" />
                <Skeleton className="h-32 w-full bg-[#1A1D24]" />
                <Skeleton className="h-32 w-full bg-[#1A1D24]" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-[#13161B] to-[#0F1115] border-[#2A2F3A] shadow-2xl">
            <CardContent className="p-6">
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
                  onRestore={handleRestoreBrand}
                  onDelete={handleDeleteBrand}
                  selected={selectedArchived}
                  onSelectChange={setSelectedArchived}
                  onBulkDelete={() => setBulkDeleteConfirm(true)}
                  onBulkRestore={handleBulkRestoreArchived}
                  pagination={archivePagination}
                  onPageChange={(page) => fetchArchivedBrands(page, archiveSearch)}
                  search={archiveSearch}
                  onSearchChange={handleArchiveSearch}
                />
              )}
              {activeTab === "blacklist" && (
                <BlacklistTab 
                  brands={blacklistedBrands} 
                  onRemove={handleUnblacklistBrand}
                  pagination={blacklistPagination}
                  onPageChange={(page) => fetchBlacklistedBrands(page, blacklistSearch)}
                  search={blacklistSearch}
                  onSearchChange={handleBlacklistSearch}
                />
              )}
              {activeTab === "settings" && (
                <SettingsTab 
                  settings={settings}
                  onEdit={() => setSettingsModal(true)}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Delete Import Modal */}
        {deleteImportModal && (
          <Dialog open={true} onOpenChange={() => setDeleteImportModal(null)}>
            <DialogContent className="bg-gradient-to-br from-[#13161B] to-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]">
              <DialogHeader>
                <DialogTitle className="font-mono uppercase tracking-wider text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Удалить импорт
                </DialogTitle>
                <DialogDescription className="text-[#94A3B8]">
                  Выберите действие для файла импорта
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-[#0F1115] rounded-lg border border-[#2A2F3A]">
                  <p className="text-[#E6E6E6] font-medium">{deleteImportModal.file_name}</p>
                  <p className="text-sm text-[#94A3B8] mt-1">
                    Активных брендов: <span className="text-[#FF9900] font-mono">{deleteImportModal.active_brands_count}</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleDeleteImport(deleteImportModal.id, true)}
                    className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-black font-semibold"
                  >
                    <Archive size={16} className="mr-2" />
                    В архив
                  </Button>
                  <Button
                    onClick={() => handleDeleteImport(deleteImportModal.id, false)}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Удалить навсегда
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDeleteImportModal(null)}
                  className="w-full border-[#2A2F3A] text-[#94A3B8] hover:bg-[#1A1D24]"
                >
                  Отмена
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Bulk Delete Confirmation */}
        {bulkDeleteConfirm && (
          <Dialog open={true} onOpenChange={() => setBulkDeleteConfirm(false)}>
            <DialogContent className="bg-gradient-to-br from-[#13161B] to-[#0F1115] border-red-800/50 text-[#E6E6E6]">
              <DialogHeader>
                <DialogTitle className="font-mono uppercase tracking-wider text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                  Подтверждение удаления
                </DialogTitle>
                <DialogDescription className="text-[#94A3B8]">
                  Это действие нельзя отменить!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-red-950/30 rounded-lg border border-red-800/50">
                  <p className="text-red-400 text-center text-lg font-mono">
                    Удалить {selectedArchived.size} брендов навсегда?
                  </p>
                  <p className="text-red-400/70 text-center text-sm mt-2">
                    Все данные будут безвозвратно удалены
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setBulkDeleteConfirm(false)}
                    className="border-[#2A2F3A] text-[#94A3B8]"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleBulkDeleteArchived}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Удалить
                  </Button>
                </div>
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
    </TooltipProvider>
  );
};

// Pagination Component
const PaginationControls = ({ pagination, onPageChange }) => {
  const { page, pages, total } = pagination;
  
  if (pages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#2A2F3A]">
      <p className="text-sm text-[#94A3B8]">
        Всего: <span className="text-[#FF9900] font-mono">{total}</span> • 
        Страница <span className="text-[#E6E6E6]">{page}</span> из <span className="text-[#E6E6E6]">{pages}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900] disabled:opacity-30"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900] disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            let pageNum;
            if (pages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= pages - 2) {
              pageNum = pages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={pageNum === page 
                  ? "bg-[#FF9900] text-black hover:bg-[#E68A00]" 
                  : "border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900]"
                }
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900] disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pages)}
          disabled={page === pages}
          className="border-[#2A2F3A] text-[#94A3B8] hover:text-[#FF9900] disabled:opacity-30"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// Tab Components
const CheckInsTab = ({ data }) => {
  if (!data) return <p className="text-[#94A3B8]">Нет данных</p>;

  const checkInRate = data.total_searchers > 0 
    ? Math.round((data.total_checked_in / data.total_searchers) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <UserCheck size={20} className="text-green-400" />
            Отметки за {data.date}
          </h3>
          <p className="text-sm text-[#94A3B8] mt-1">
            Ежедневная проверка присутствия сотрудников
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold font-mono text-[#FF9900]">
            {data.total_checked_in}/{data.total_searchers}
          </div>
          <Progress value={checkInRate} className="w-32 h-2 mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checked In */}
        <Card className="bg-gradient-to-br from-green-950/30 to-green-900/10 border-green-800/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 flex items-center gap-2 text-base">
              <CheckCircle size={18} />
              Отметились ({data.checked_in?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {data.checked_in?.map(c => (
                  <div key={c.id} className="p-3 bg-[#0F1115]/50 rounded-lg flex justify-between items-center hover:bg-[#0F1115] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-900/30 flex items-center justify-center">
                        <span className="text-green-400 font-mono text-sm">
                          {c.user_nickname?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[#E6E6E6] font-medium">{c.user_nickname}</span>
                    </div>
                    <Badge variant="outline" className="border-green-800/50 text-green-400 font-mono">
                      {new Date(c.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  </div>
                ))}
                {data.checked_in?.length === 0 && (
                  <p className="text-[#94A3B8] text-center py-4">Пока никто не отметился</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Not Checked In */}
        <Card className="bg-gradient-to-br from-red-950/30 to-red-900/10 border-red-800/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-400 flex items-center gap-2 text-base">
              <XCircle size={18} />
              Не отметились ({data.not_checked_in?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {data.not_checked_in?.map(u => (
                  <div key={u.id} className="p-3 bg-[#0F1115]/50 rounded-lg flex items-center gap-3 hover:bg-[#0F1115] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-red-900/30 flex items-center justify-center">
                      <span className="text-red-400 font-mono text-sm">
                        {u.nickname?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[#E6E6E6]">{u.nickname}</span>
                  </div>
                ))}
                {data.not_checked_in?.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                    <p className="text-green-400">Все на месте!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ActivityTab = ({ searchers, selectedUser, userActivity, onSelectUser }) => {
  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-end">
        <div className="flex-1 max-w-xs">
          <Label className="text-[#94A3B8] mb-2 block">Выберите сёрчера</Label>
          <Select value={selectedUser || ""} onValueChange={onSelectUser}>
            <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A] hover:border-[#FF9900]/50 transition-colors">
              <SelectValue placeholder="Выберите сёрчера..." />
            </SelectTrigger>
            <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
              {searchers.map(s => (
                <SelectItem key={s.id} value={s.id} className="hover:bg-[#1A1D24]">
                  {s.nickname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {userActivity && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[#FF9900]/10 to-transparent rounded-xl border border-[#FF9900]/20">
            <div className="w-12 h-12 rounded-xl bg-[#FF9900]/20 flex items-center justify-center">
              <span className="text-[#FF9900] font-mono font-bold text-lg">
                {userActivity.user?.nickname?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#E6E6E6]">
                {userActivity.user?.nickname}
              </h3>
              <p className="text-sm text-[#94A3B8]">Активность за последние 7 дней</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Check-ins */}
            <Card className="bg-[#0F1115] border-[#2A2F3A]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#FF9900] text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Отметки за 7 дней
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {userActivity.check_ins?.map(c => (
                    <Badge key={c.id} className="bg-green-900/30 text-green-400 border-green-800/50">
                      {c.date}
                    </Badge>
                  ))}
                  {userActivity.check_ins?.length === 0 && (
                    <span className="text-[#94A3B8] text-sm">Нет отметок</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Daily Stats */}
            <Card className="bg-[#0F1115] border-[#2A2F3A]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#FF9900] text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Статистика по дням
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {Object.entries(userActivity.daily_stats || {}).slice(0, 7).map(([date, stats]) => (
                      <div key={date} className="border-b border-[#2A2F3A] pb-2 last:border-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#E6E6E6] font-medium">{date}</span>
                          <Badge variant="outline" className="border-[#FF9900]/50 text-[#FF9900]">
                            {stats.events} действий
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(stats.types || {}).map(([type, count]) => (
                            <Badge key={type} variant="secondary" className="bg-[#1A1D24] text-[#94A3B8] text-xs">
                              {type}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Recent Events */}
          <Card className="bg-[#0F1115] border-[#2A2F3A]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#FF9900] text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Последние действия
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {userActivity.events?.slice(0, 30).map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-[#13161B] rounded-lg hover:bg-[#1A1D24] transition-colors">
                      <div className="flex-1">
                        <span className="text-[#E6E6E6]">{e.label_ru || e.event_type}</span>
                        {e.brand_name && (
                          <Badge variant="outline" className="ml-2 border-[#FF9900]/30 text-[#FF9900]">
                            {e.brand_name}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[#94A3B8] text-xs font-mono">
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
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
      
      {!userActivity && (
        <Card className="bg-[#0F1115] border-[#2A2F3A]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-[#2A2F3A] mb-4" />
            <p className="text-[#94A3B8]">Выберите сёрчера для просмотра активности</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ImportsTab = ({ imports, onDelete }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
          <FileText size={20} className="text-purple-400" />
          Файлы импорта
        </h3>
        <Badge variant="outline" className="border-purple-800/50 text-purple-400">
          {imports.length} файлов
        </Badge>
      </div>

      {imports.length === 0 ? (
        <Card className="bg-[#0F1115] border-[#2A2F3A]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Download className="w-16 h-16 text-[#2A2F3A] mb-4" />
            <p className="text-[#94A3B8]">Нет импортированных файлов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map(imp => (
            <Card key={imp.id} className="bg-[#0F1115] border-[#2A2F3A] hover:border-[#FF9900]/30 transition-colors">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-900/20">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[#E6E6E6] font-medium">{imp.file_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#94A3B8]">
                      <span>{new Date(imp.created_at).toLocaleString('ru-RU')}</span>
                      <Badge variant="secondary" className="bg-[#1A1D24]">
                        Активных: {imp.active_brands_count}
                      </Badge>
                      {imp.archived_brands_count > 0 && (
                        <Badge variant="secondary" className="bg-yellow-900/20 text-yellow-400">
                          В архиве: {imp.archived_brands_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(imp)}
                  className="bg-red-900/30 hover:bg-red-900/50 text-red-400"
                >
                  <Trash2 size={14} className="mr-1" />
                  Удалить
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const ArchivedTab = ({ brands, onRestore, onDelete, selected, onSelectChange, onBulkDelete, onBulkRestore, pagination, onPageChange, search, onSearchChange }) => {
  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectChange(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === brands.length && brands.length > 0) {
      onSelectChange(new Set());
    } else {
      onSelectChange(new Set(brands.map(b => b.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <Archive size={20} className="text-yellow-400" />
            Архив брендов
          </h3>
          <p className="text-sm text-[#94A3B8] mt-1">
            Всего в архиве: <span className="text-[#FF9900] font-mono">{pagination.total}</span> брендов
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-[#0F1115] border-[#2A2F3A] w-48"
            />
          </div>
          
          {/* Bulk Actions */}
          {selected.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" onClick={onBulkRestore} className="bg-green-600 hover:bg-green-700">
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
      </div>

      {/* Select All */}
      {brands.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#0F1115] rounded-lg border border-[#2A2F3A]">
          <input
            type="checkbox"
            checked={selected.size === brands.length && brands.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-[#2A2F3A] bg-[#1A1D24] text-[#FF9900] focus:ring-[#FF9900]"
          />
          <span className="text-sm text-[#94A3B8]">
            {selected.size > 0 
              ? `Выбрано ${selected.size} из ${brands.length}` 
              : "Выбрать все на странице"
            }
          </span>
        </div>
      )}

      {/* Brands List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {brands.map(b => (
            <Card key={b.id} className={`bg-[#0F1115] border-[#2A2F3A] hover:border-yellow-800/50 transition-all ${selected.has(b.id) ? 'border-[#FF9900]/50 bg-[#FF9900]/5' : ''}`}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => toggleSelect(b.id)}
                    className="w-4 h-4 rounded border-[#2A2F3A] bg-[#1A1D24] text-[#FF9900] focus:ring-[#FF9900]"
                  />
                  <div className="p-2 rounded-lg bg-yellow-900/20">
                    <Archive className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-[#E6E6E6] font-medium">{b.name_original}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {b.archive_reason || "Нет причины"} • {b.archived_at ? new Date(b.archived_at).toLocaleDateString('ru-RU') : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => onRestore(b.id)} className="border-green-800/50 text-green-400 hover:bg-green-900/20">
                        <RotateCcw size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Восстановить в пул</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(b.id, b.name_original)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                        <Trash2 size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Удалить навсегда</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {brands.length === 0 && (
            <Card className="bg-[#0F1115] border-[#2A2F3A]">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Archive className="w-16 h-16 text-[#2A2F3A] mb-4" />
                <p className="text-[#94A3B8]">
                  {search ? "Ничего не найдено" : "Архив пуст"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Pagination */}
      <PaginationControls pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};

const BlacklistTab = ({ brands, onRemove, pagination, onPageChange, search, onSearchChange }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <Ban size={20} className="text-red-400" />
            Чёрный список
          </h3>
          <p className="text-sm text-[#94A3B8] mt-1">
            Всего в ЧС: <span className="text-red-400 font-mono">{pagination.total}</span> брендов
          </p>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-[#0F1115] border-[#2A2F3A] w-48"
          />
        </div>
      </div>

      {/* Brands List */}
      <ScrollArea className="h-[450px]">
        <div className="space-y-2">
          {brands.map(b => (
            <Card key={b.id} className="bg-[#0F1115] border-[#2A2F3A] hover:border-red-800/50 transition-colors">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-red-900/20">
                    <Ban className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[#E6E6E6] font-medium">{b.name_original}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {b.blacklist_reason || "Нет причины"} • {b.blacklisted_at ? new Date(b.blacklisted_at).toLocaleDateString('ru-RU') : "—"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#2A2F3A] text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24]"
                  onClick={() => onRemove(b.id)}
                >
                  Убрать из ЧС
                </Button>
              </CardContent>
            </Card>
          ))}
          
          {brands.length === 0 && (
            <Card className="bg-[#0F1115] border-[#2A2F3A]">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Ban className="w-16 h-16 text-[#2A2F3A] mb-4" />
                <p className="text-[#94A3B8]">
                  {search ? "Ничего не найдено" : "Чёрный список пуст"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Pagination */}
      <PaginationControls pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};

const SettingsTab = ({ settings, onEdit }) => {
  if (!settings) return <p className="text-[#94A3B8]">Загрузка...</p>;

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <Settings size={20} className="text-[#FF9900]" />
            Глобальные настройки
          </h3>
          <p className="text-sm text-[#94A3B8] mt-1">Настройки рабочего времени и расписания</p>
        </div>
        <Button onClick={onEdit} className="bg-gradient-to-r from-[#FF9900] to-[#E68A00] text-black font-semibold hover:from-[#E68A00] hover:to-[#CC7A00]">
          <Settings className="w-4 h-4 mr-2" />
          Изменить
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0F1115] border-[#2A2F3A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#94A3B8] text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Рабочее время
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[#E6E6E6] font-mono text-2xl">
              {settings.work_hours_start} — {settings.work_hours_end}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0F1115] border-[#2A2F3A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#94A3B8] text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Выходные
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {weekDays.map((day, i) => (
                <Badge
                  key={i}
                  variant={settings.weekends?.includes(i) ? "destructive" : "secondary"}
                  className={settings.weekends?.includes(i) 
                    ? "bg-red-900/30 text-red-400 border-red-800/50" 
                    : "bg-[#1A1D24] text-[#94A3B8]"
                  }
                >
                  {day}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0F1115] border-[#2A2F3A] md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#94A3B8] text-sm font-medium">Праздники</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {settings.holidays?.length > 0 ? (
                settings.holidays.map((h, i) => (
                  <Badge key={i} className="bg-purple-900/30 text-purple-400 border-purple-800/50">
                    {h}
                  </Badge>
                ))
              ) : (
                <span className="text-[#94A3B8] text-sm">Не заданы</span>
              )}
            </div>
          </CardContent>
        </Card>
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
      <DialogContent className="bg-gradient-to-br from-[#13161B] to-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#FF9900]" />
            Настройки системы
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#94A3B8]">Начало рабочего дня</Label>
              <Input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="mt-2 bg-[#0F1115] border-[#2A2F3A] focus:border-[#FF9900]"
              />
            </div>
            <div>
              <Label className="text-[#94A3B8]">Конец рабочего дня</Label>
              <Input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="mt-2 bg-[#0F1115] border-[#2A2F3A] focus:border-[#FF9900]"
              />
            </div>
          </div>

          <div>
            <Label className="text-[#94A3B8] mb-3 block">Выходные дни</Label>
            <div className="flex gap-2">
              {weekDays.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekend(i)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    weekends.includes(i)
                      ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-900/30"
                      : "bg-[#0F1115] text-[#94A3B8] hover:bg-[#1A1D24] border border-[#2A2F3A]"
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
              className="mt-2 bg-[#0F1115] border-[#2A2F3A] focus:border-[#FF9900]"
              placeholder="2025-01-01, 2025-05-01"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2F3A]">
            <Button variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-[#FF9900] to-[#E68A00] text-black font-semibold">
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuperAdminPage;
