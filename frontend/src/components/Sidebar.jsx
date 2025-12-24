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
  Building2
} from "lucide-react";

const Sidebar = ({ user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (user?.role === "searcher") {
      checkCheckInStatus();
    }
  }, [user]);

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
    { to: "/users", icon: Users, label: "Пользователи" },
    { to: "/staff", icon: UserCheck, label: "Сотрудники" },
    { to: "/import", icon: Upload, label: "Импорт" },
    { to: "/brands", icon: Package, label: "Все бренды" },
    { to: "/bash", icon: Boxes, label: "BASH" },
    { to: "/suppliers", icon: Building2, label: "Поставщики" },
    { to: "/settings", icon: Settings, label: "Настройки" },
  ];

  const superAdminLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
    { to: "/analytics", icon: BarChart3, label: "Аналитика" },
    { to: "/users", icon: Users, label: "Пользователи" },
    { to: "/staff", icon: UserCheck, label: "Сотрудники" },
    { to: "/import", icon: Upload, label: "Импорт" },
    { to: "/brands", icon: Package, label: "Все бренды" },
    { to: "/bash", icon: Boxes, label: "BASH" },
    { to: "/suppliers", icon: Building2, label: "Поставщики" },
    { to: "/super-admin", icon: Shield, label: "Супер-админ" },
    { to: "/settings", icon: Settings, label: "Настройки" },
  ];

  const searcherLinks = [
    { to: "/my-brands", icon: Briefcase, label: "Мои бренды" },
    { to: "/problematic", icon: AlertTriangle, label: "Проблемные" },
    { to: "/suppliers", icon: Building2, label: "Поставщики" },
  ];

  const links = user?.role === "super_admin" ? superAdminLinks : 
                user?.role === "admin" ? adminLinks : searcherLinks;

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-64 bg-[#13161B] border-r border-[#2A2F3A] flex flex-col"
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="p-6 border-b border-[#2A2F3A]">
        <h1 
          className="font-mono font-bold text-2xl tracking-tighter text-[#FF9900]"
          data-testid="logo"
        >
          PROCTO_13
        </h1>
        <p className="text-xs text-[#94A3B8] mt-1 uppercase tracking-wider">
          Brand Management
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" data-testid="nav-menu">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            data-testid={`nav-${link.to.slice(1)}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-[2px] transition-all duration-200 ${
                isActive
                  ? "bg-[#FF9900]/10 text-[#FF9900] border-l-2 border-[#FF9900]"
                  : "text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24]"
              }`
            }
          >
            <link.icon size={20} />
            <span className="font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-[#2A2F3A]">
        {/* Check-In Button for Searchers */}
        {user?.role === "searcher" && (
          <div className="mb-4">
            {checkInStatus?.checked_in ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 text-green-400 rounded-[2px]">
                <UserCheck size={18} />
                <span className="text-sm">Отмечен</span>
              </div>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold rounded-[2px] transition-all"
              >
                <UserCheck size={18} />
                <span>{checkingIn ? "..." : "Зашёл!"}</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-[2px] bg-[#FF9900]/20 flex items-center justify-center">
            <span className="text-[#FF9900] font-mono font-bold">
              {user?.nickname?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#E6E6E6] truncate" data-testid="user-nickname">
              {user?.nickname}
            </p>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider">
              {user?.role === "super_admin" ? "Супер-админ" : user?.role === "admin" ? "Админ" : "Сёрчер"}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[#94A3B8] hover:text-[#E6E6E6] hover:bg-[#1A1D24] rounded-[2px] transition-all duration-200"
        >
          <LogOut size={18} />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
