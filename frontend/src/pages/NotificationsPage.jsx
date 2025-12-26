import { useState, useEffect, useCallback } from "react";
import { api } from "../App";
import { useAuth } from "../App";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Bell, Check, CheckCheck, Trash2, ExternalLink, Filter, Search, X,
  RefreshCw
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../components/ui/select";

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, unread, read
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications?limit=100");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки уведомлений");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll for updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("Все уведомления отмечены как прочитанные");
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast.success("Удалено");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "только что";
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString("ru-RU", { 
      day: "numeric", 
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getTypeInfo = (type) => {
    switch (type) {
      case "note_added":
        return { icon: "📝", label: "Заметка", color: "bg-blue-500/20 text-blue-400" };
      case "task_assigned":
        return { icon: "📋", label: "Задача", color: "bg-purple-500/20 text-purple-400" };
      case "status_changed":
        return { icon: "🔄", label: "Статус", color: "bg-yellow-500/20 text-yellow-400" };
      case "brand_assigned":
        return { icon: "🏷️", label: "Назначение", color: "bg-green-500/20 text-green-400" };
      default:
        return { icon: "🔔", label: "Уведомление", color: "bg-gray-500/20 text-gray-400" };
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    // Read/unread filter
    if (filter === "unread" && n.is_read) return false;
    if (filter === "read" && !n.is_read) return false;
    
    // Type filter
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      return (
        n.title?.toLowerCase().includes(q) ||
        n.message?.toLowerCase().includes(q)
      );
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase flex items-center gap-3">
            <Bell className="text-[#FF9900]" /> Уведомления
            {unreadCount > 0 && (
              <span className="text-sm bg-[#FF9900] text-black px-2 py-0.5 rounded-full">
                {unreadCount} новых
              </span>
            )}
          </h1>
          <p className="text-[#94A3B8] mt-1">Все ваши уведомления</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchNotifications}
            className="border-[#2A2F3A] text-[#94A3B8]"
          >
            <RefreshCw size={14} className="mr-2" /> Обновить
          </Button>
          {unreadCount > 0 && (
            <Button 
              onClick={markAllAsRead}
              className="bg-[#FF9900] hover:bg-[#E68A00] text-black"
            >
              <CheckCheck size={14} className="mr-2" /> Прочитать все
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по уведомлениям..."
            className="pl-10 bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
          />
          {search && (
            <button 
              onClick={() => setSearch("")} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E6E6E6]"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 bg-[#0F1115] border-[#2A2F3A]">
            <Filter size={14} className="mr-2 text-[#94A3B8]" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="unread">Непрочитанные</SelectItem>
            <SelectItem value="read">Прочитанные</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-[#0F1115] border-[#2A2F3A]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="note_added">📝 Заметки</SelectItem>
            <SelectItem value="task_assigned">📋 Задачи</SelectItem>
            <SelectItem value="status_changed">🔄 Статусы</SelectItem>
            <SelectItem value="brand_assigned">🏷️ Назначения</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-12 text-center">
          <Bell size={48} className="mx-auto text-[#FF9900] mb-4 opacity-50" />
          <h3 className="text-lg text-[#E6E6E6] mb-2">
            {notifications.length === 0 ? "Нет уведомлений" : "Ничего не найдено"}
          </h3>
          <p className="text-[#94A3B8] text-sm">
            {notifications.length === 0 
              ? "Здесь будут появляться ваши уведомления" 
              : "Попробуйте изменить фильтры"}
          </p>
        </div>
      ) : (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded overflow-hidden divide-y divide-[#2A2F3A]">
          {filteredNotifications.map(notification => {
            const typeInfo = getTypeInfo(notification.type);
            return (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 cursor-pointer transition-colors ${
                  notification.is_read 
                    ? "bg-transparent hover:bg-[#1A1D24]/50" 
                    : "bg-[#FF9900]/5 hover:bg-[#FF9900]/10"
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                {/* Type Icon */}
                <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                  <span className="text-lg">{typeInfo.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-medium ${notification.is_read ? "text-[#94A3B8]" : "text-[#E6E6E6]"}`}>
                      {notification.title}
                    </span>
                    {!notification.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#FF9900]" />
                    )}
                  </div>
                  <p className="text-sm text-[#94A3B8] mb-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-[#64748B]">
                    <span>{formatTime(notification.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {notification.link && (
                      <span className="flex items-center gap-1">
                        <ExternalLink size={10} /> Перейти
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                      className="text-[#94A3B8] hover:text-[#FF9900] h-8 w-8 p-0"
                      title="Отметить как прочитанное"
                    >
                      <Check size={16} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                    className="text-[#94A3B8] hover:text-red-400 h-8 w-8 p-0"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
