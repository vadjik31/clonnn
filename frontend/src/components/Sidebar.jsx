import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, api } from "../App";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Users, 
  Upload, 
  Package, 
  Settings, 
  LogOut,
  AlertTriangle,
  Briefcase,
  BarChart3,
  Shield,
  UserCheck,
  Boxes,
  Building2,
  ListTodo,
  UsersRound,
  Bell,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";
import NotificationsDropdown from "./NotificationsDropdown";

const Sidebar = ({ user, collapsed, setCollapsed }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (user?.role === "searcher") {
      checkCheckInStatus();
    }
  }, [user]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get("/notifications?limit=1");
        setUnreadCount(res.data.unread_count || 0);
      } catch (error) {
        console.log("Failed to fetch unread count");
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch unread chat messages count
  useEffect(() => {
    const fetchUnreadChatCount = async () => {
      try {
        const res = await api.get("/chats/unread-count");
        setUnreadChatCount(res.data.unread_count || 0);
      } catch (error) {
        console.log("Failed to fetch unread chat count");
      }
    };

    fetchUnreadChatCount();
    const interval = setInterval(fetchUnreadChatCount, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const checkCheckInStatus = async () => {
    try {
      const res = await api.get("/auth/check-in/status");
      setCheckInStatus(res.data);
    } catch (error) {
      console.error("Check-in status error:", error);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await api.post("/auth/check-in", { message: "На месте!" });
      toast.success("Отметка поставлена!");
      checkCheckInStatus();
    } catch (error) {
      toast.error("Ошибка отметки");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const adminLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
    { to: "/analytics", icon: BarChart3, label: "Аналитика" },
    { to: "/chat", icon: MessageSquare, label: "Чат" },
    { to: "/tasks", icon: ListTodo, label: "Задачи" },
    { to: "/notifications", icon: Bell, label: "Уведомления" },
    { to: "/users", icon: Users, label: "Пользователи" },
    { to: "/staff", icon: UserCheck, label: "Сотрудники" },
    { to: "/import", icon: Upload, label: "Импорт" },
    { to: "/brands", icon: Package, label: "Все бренды" },
    { to: "/sub-suppliers", icon: UsersRound, label: "Под-сапплаеры" },
    { to: "/super-admin", icon: Shield, label: "Управление" },
    { to: "/bash", icon: Boxes, label: "BASH" },
    { to: "/suppliers", icon: Building2, label: "Поставщики" },
    { to: "/settings", icon: Settings, label: "Настройки" },
  ];

  const superAdminLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
    { to: "/analytics", icon: BarChart3, label: "Аналитика" },
    { to: "/chat", icon: MessageSquare, label: "Чат" },
    { to: "/tasks", icon: ListTodo, label: "Задачи" },
    { to: "/users", icon: Users, label: "Пользователи" },
    { to: "/staff", icon: UserCheck, label: "Сотрудники" },
    { to: "/import", icon: Upload, label: "Импорт" },
    { to: "/brands", icon: Package, label: "Все бренды" },
    { to: "/sub-suppliers", icon: UsersRound, label: "Под-сапплаеры" },
    { to: "/super-admin", icon: Shield, label: "Управление" },
    { to: "/bash", icon: Boxes, label: "BASH" },
    { to: "/suppliers", icon: Building2, label: "Поставщики" },
    { to: "/settings", icon: Settings, label: "Настройки" },
  ];

  const searcherLinks = [
    { to: "/my-brands", icon: Briefcase, label: "Мои бренды" },
    { to: "/chat", icon: MessageSquare, label: "Чат" },
    { to: "/sub-suppliers", icon: UsersRound, label: "Под-сапплаеры" },
    { to: "/problematic", icon: AlertTriangle, label: "Проблемные" },
    { to: "/suppliers", icon: Building2, label: "Поставщики" },
    { to: "/notifications", icon: Bell, label: "Уведомления" },
  ];

  const links = user?.role === "super_admin" ? superAdminLinks : 
                user?.role === "admin" ? adminLinks : searcherLinks;

  return (
    <>
      {/* Toggle button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed left-4 top-4 z-50 p-2 bg-[#13161B] border border-[#2A2F3A] rounded-lg text-[#FF9900] hover:bg-[#1A1D24] transition-all"
        >
          <Menu size={24} />
        </button>
      )}
      
      <aside 
        className={`fixed left-0 top-0 h-screen bg-[#13161B] border-r border-[#2A2F3A] flex flex-col z-40 transition-all duration-300 ${
          collapsed ? "-translate-x-full" : "translate-x-0 w-64"
        }`}
        data-testid="sidebar"
      >
        {/* Logo & Collapse Button */}
        <div className="p-4 border-b border-[#2A2F3A] flex items-center justify-between">
          <div>
            <h1 
              className="font-mono font-bold text-xl tracking-tighter text-[#FF9900]"
              data-testid="logo"
            >
              PROCTO_13
            </h1>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider">
              Brand Management
            </p>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 text-[#94A3B8] hover:text-[#FF9900] hover:bg-[#1A1D24] rounded transition-all"
            title="Скрыть меню"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navigation with scroll */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2A2F3A] scrollbar-track-transparent" data-testid="nav-menu">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              data-testid={`nav-${link.to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-[#FF9900]/10 text-[#FF9900] border-l-2 border-[#FF9900]"
                    : "text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24]"
                }`
              }
            >
              <link.icon size={18} />
              <span className="font-medium text-sm">{link.label}</span>
              {/* Red badge for notifications */}
              {link.to === "/notifications" && unreadCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {/* Red dot for chat */}
              {link.to === "/chat" && unreadChatCount > 0 && (
                <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Info - compact */}
        <div className="p-3 border-t border-[#2A2F3A]">
          {/* Notifications for Admin/Searcher */}
          {user?.role && (
            <div className="mb-3 flex justify-center">
              <NotificationsDropdown />
            </div>
          )}

          {/* Check-In Button for Searchers */}
          {user?.role === "searcher" && (
            <div className="mb-3">
              {checkInStatus?.checked_in ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 text-green-400 rounded-lg text-sm">
                  <UserCheck size={16} />
                  <span>Отмечен</span>
                </div>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold rounded-lg transition-all text-sm"
                >
                  <UserCheck size={16} />
                  <span>{checkingIn ? "..." : "Зашёл!"}</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF9900]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#FF9900] font-mono font-bold text-sm">
                {user?.nickname?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#E6E6E6] truncate" data-testid="user-nickname">
                {user?.nickname}
              </p>
              <p className="text-xs text-[#94A3B8]">
                {user?.role === "super_admin" ? "СА" : user?.role === "admin" ? "Админ" : "Сёрчер"}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24] rounded-lg transition-all duration-200 text-sm"
          >
            <LogOut size={16} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
