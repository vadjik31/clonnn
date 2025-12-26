import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, X, ExternalLink } from "lucide-react";
import { api, API } from "../App";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NotificationsDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const dropdownRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications?limit=20");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  // Connect to WebSocket for real-time notifications
  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Close existing connection if any
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        return; // Already connected or connecting
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    // Build WebSocket URL
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiUrl = new URL(API);
    const wsUrl = `${wsProtocol}//${apiUrl.host}/api/ws/notifications?token=${token}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected for notifications");
        setWsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "init") {
            setUnreadCount(data.unread_count || 0);
          } else if (data.type === "new_notification") {
            // Add new notification to the top of the list
            setNotifications(prev => [data.notification, ...prev.slice(0, 19)]);
            setUnreadCount(prev => prev + 1);
            
            // Show toast notification
            toast.info(data.notification.title, {
              description: data.notification.message,
              duration: 5000,
            });
          }
        } catch (e) {
          // Handle ping/pong - check readyState before sending
          if (event.data === "ping" && wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send("pong");
            } catch (sendError) {
              console.log("WebSocket send error (ignored):", sendError);
            }
          }
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code);
        setWsConnected(false);
        wsRef.current = null;
        
        // Reconnect after 5 seconds (unless intentionally closed)
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.log("WebSocket error (will reconnect)");
        setWsConnected(false);
      };
    } catch (error) {
      console.log("Failed to connect WebSocket:", error);
      setWsConnected(false);
    }
  }, []);

  // Initial setup
  useEffect(() => {
    fetchNotifications();
    connectWebSocket();

    // Fallback polling every 10 seconds if WebSocket fails
    const pollInterval = setInterval(() => {
      if (!wsConnected) {
        fetchNotifications();
      }
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [fetchNotifications, connectWebSocket, wsConnected]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Mark single notification as read
  const markAsRead = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await api.post("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${notificationId}`);
      const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id, { stopPropagation: () => {} });
    }
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  // Format relative time
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
    return date.toLocaleDateString("ru-RU");
  };

  // Get icon color based on notification type
  const getTypeColor = (type) => {
    switch (type) {
      case "note_added":
        return "bg-blue-500/20 text-blue-400";
      case "task_assigned":
        return "bg-purple-500/20 text-purple-400";
      case "status_changed":
        return "bg-yellow-500/20 text-yellow-400";
      case "brand_assigned":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-[2px] text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24] transition-all"
        data-testid="notifications-btn"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold bg-[#FF9900] text-black rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-96 bg-[#13161B] border border-[#2A2F3A] rounded-[4px] shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2F3A]">
            <h3 className="font-semibold text-[#E6E6E6]">Уведомления</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-[#FF9900] hover:text-[#E68A00] transition-colors disabled:opacity-50"
              >
                <CheckCheck size={14} />
                Прочитать все
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[#94A3B8]">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-3 p-4 border-b border-[#2A2F3A] cursor-pointer transition-colors ${
                    notification.is_read 
                      ? "bg-transparent hover:bg-[#1A1D24]/50" 
                      : "bg-[#FF9900]/5 hover:bg-[#FF9900]/10"
                  }`}
                >
                  {/* Type indicator */}
                  <div className={`w-8 h-8 rounded-[2px] flex items-center justify-center flex-shrink-0 ${getTypeColor(notification.type)}`}>
                    {notification.type === "note_added" && <span className="text-sm">📝</span>}
                    {notification.type === "task_assigned" && <span className="text-sm">📋</span>}
                    {notification.type === "status_changed" && <span className="text-sm">🔄</span>}
                    {notification.type === "brand_assigned" && <span className="text-sm">🏷️</span>}
                    {!["note_added", "task_assigned", "status_changed", "brand_assigned"].includes(notification.type) && (
                      <Bell size={14} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${notification.is_read ? "text-[#94A3B8]" : "text-[#E6E6E6]"}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#64748B]">
                        {formatTime(notification.created_at)}
                      </span>
                      {notification.link && (
                        <ExternalLink size={10} className="text-[#64748B]" />
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {!notification.is_read && (
                      <button
                        onClick={(e) => markAsRead(notification.id, e)}
                        className="p-1 text-[#94A3B8] hover:text-[#FF9900] transition-colors"
                        title="Отметить как прочитанное"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteNotification(notification.id, e)}
                      className="p-1 text-[#94A3B8] hover:text-red-400 transition-colors"
                      title="Удалить"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Footer - View All */}
          <div className="border-t border-[#2A2F3A] px-4 py-3">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/notifications");
              }}
              className="w-full text-center text-sm text-[#FF9900] hover:text-[#E68A00] transition-colors font-medium"
            >
              Посмотреть все уведомления →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
