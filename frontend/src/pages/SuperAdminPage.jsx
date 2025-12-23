import { useState, useEffect } from "react";
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
  UserCheck
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
  
  // Data states
  const [checkIns, setCheckIns] = useState(null);
  const [imports, setImports] = useState([]);
  const [settings, setSettings] = useState(null);
  const [archivedBrands, setArchivedBrands] = useState([]);
  const [blacklistedBrands, setBlacklistedBrands] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [searchers, setSearchers] = useState([]);
  
  // Modal states
  const [settingsModal, setSettingsModal] = useState(false);
  const [deleteImportModal, setDeleteImportModal] = useState(null);

  useEffect(() => {
    if (user?.role === "super_admin") {
      fetchData();
    }
  }, [activeTab, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case "check-ins":
          const checkInsRes = await api.get("/super-admin/check-ins");
          setCheckIns(checkInsRes.data);
          break;
        case "imports":
          const importsRes = await api.get("/super-admin/imports");
          setImports(importsRes.data.imports || []);
          break;
        case "settings":
          const settingsRes = await api.get("/super-admin/settings");
          setSettings(settingsRes.data);
          break;
        case "archived":
          const archivedRes = await api.get("/super-admin/archived-brands");
          setArchivedBrands(archivedRes.data.brands || []);
          break;
        case "blacklist":
          const blacklistRes = await api.get("/super-admin/blacklisted-brands");
          setBlacklistedBrands(blacklistRes.data.brands || []);
          break;
        case "activity":
          const usersRes = await api.get("/users");
          setSearchers(usersRes.data.filter(u => u.role === "searcher"));
          break;
      }
    } catch (error) {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
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
      fetchData();
    } catch (error) {
      toast.error("Ошибка восстановления");
    }
  };

  const handleUnblacklistBrand = async (brandId) => {
    try {
      await api.post(`/super-admin/brands/${brandId}/unblacklist`);
      toast.success("Бренд убран из ЧС");
      fetchData();
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

  if (user?.role !== "super_admin") {
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
            Супер-админ панель
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
              onRestore={handleRestoreBrand}
            />
          )}
          {activeTab === "blacklist" && (
            <BlacklistTab 
              brands={blacklistedBrands} 
              onRemove={handleUnblacklistBrand}
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
            <div className="space-y-2">
              {Object.entries(userActivity.daily_stats || {}).slice(0, 7).map(([date, stats]) => (
                <div key={date} className="flex justify-between text-sm">
                  <span className="text-[#E6E6E6]">{date}</span>
                  <span className="text-[#94A3B8]">{stats.events} событий</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div className="bg-[#0F1115] p-4 rounded-[2px]">
            <h4 className="text-sm font-medium text-[#FF9900] mb-2">Последние события</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {userActivity.events?.slice(0, 20).map(e => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="text-[#E6E6E6]">{e.event_type}</span>
                  <span className="text-[#94A3B8]">
                    {new Date(e.created_at).toLocaleString('ru-RU')}
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

const ArchivedTab = ({ brands, onRestore }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
        <Archive size={18} className="text-yellow-400" />
        Архив ({brands.length})
      </h3>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {brands.map(b => (
          <div key={b.id} className="p-3 bg-[#0F1115] rounded-[2px] flex justify-between items-center">
            <div>
              <p className="text-[#E6E6E6]">{b.name_original}</p>
              <p className="text-xs text-[#94A3B8]">
                {b.archive_reason} • {new Date(b.archived_at).toLocaleDateString('ru-RU')}
              </p>
            </div>
            <Button
              size="sm"
              className="btn-secondary"
              onClick={() => onRestore(b.id)}
            >
              <RotateCcw size={14} className="mr-1" />
              Восстановить
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const BlacklistTab = ({ brands, onRemove }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
        <Ban size={18} className="text-red-400" />
        Чёрный список ({brands.length})
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
