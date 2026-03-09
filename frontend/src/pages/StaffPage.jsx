import { useState, useEffect } from "react";
import { api } from "../App";
import { toast } from "sonner";
import { 
  UserCheck, 
  Clock, 
  Activity,
  Calendar,
  TrendingUp
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// Конвертация в киевское время
const toKyivTime = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString('uk-UA', { 
    timeZone: 'Europe/Kiev',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const toKyivDate = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString('uk-UA', { 
    timeZone: 'Europe/Kiev',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const toKyivTimeOnly = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleTimeString('uk-UA', { 
    timeZone: 'Europe/Kiev',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const StaffPage = () => {
  const [searchers, setSearchers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, checkInsRes] = await Promise.all([
        api.get("/users"),
        api.get("/admin/check-ins")
      ]);
      const searchersList = usersRes.data.filter(u => u.role === "searcher");
      setSearchers(searchersList);
      setCheckIns(checkInsRes.data.check_ins || []);
    } catch (error) {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (userId) => {
    setSelectedUser(userId);
    if (!userId) {
      setUserActivity(null);
      return;
    }
    try {
      const res = await api.get(`/admin/user/${userId}/activity?days=14`);
      setUserActivity(res.data);
    } catch (error) {
      toast.error("Ошибка загрузки активности");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  // Группируем check-ins по дате
  const checkInsByDate = checkIns.reduce((acc, ci) => {
    const date = ci.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(ci);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
          <UserCheck className="text-[#FF9900]" />
          Сотрудники
        </h1>
        <p className="text-[#94A3B8] mt-1">Логи активности и отметки сёрчеров (время по Киеву)</p>
      </div>

      {/* Today's Check-ins */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
          <Calendar size={18} className="text-[#FF9900]" />
          Отметки за последние дни
        </h2>
        
        <div className="space-y-4">
          {Object.entries(checkInsByDate).slice(0, 7).map(([date, dayCheckIns]) => (
            <div key={date} className="border-b border-[#2A2F3A] pb-3 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#FF9900] font-mono">{toKyivDate(date + "T00:00:00Z")}</span>
                <span className="text-[#94A3B8] text-sm">{dayCheckIns.length} отметок</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dayCheckIns.map((ci, idx) => {
                  const user = searchers.find(s => s.id === ci.user_id);
                  return (
                    <div key={idx} className="px-3 py-1 bg-green-900/20 text-green-400 rounded text-sm flex items-center gap-2">
                      <span>{user?.nickname || "?"}</span>
                      <span className="text-green-300/60">{toKyivTimeOnly(ci.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(checkInsByDate).length === 0 && (
            <p className="text-[#94A3B8] text-center py-4">Нет отметок</p>
          )}
        </div>
      </div>

      {/* User Activity Section */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
          <Activity size={18} className="text-[#FF9900]" />
          Активность сёрчера
        </h2>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-64">
              <Select value={selectedUser || ""} onValueChange={handleSelectUser}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                  <SelectValue placeholder="Выберите сёрчера..." />
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
              
              {/* User Check-ins */}
              <div className="bg-[#0F1115] p-4 rounded-[2px]">
                <h4 className="text-sm font-medium text-[#FF9900] mb-2">Отметки за 7 дней</h4>
                <div className="flex gap-2 flex-wrap">
                  {userActivity.check_ins?.map((c, idx) => (
                    <span key={idx} className="px-2 py-1 bg-green-900/20 text-green-400 rounded text-xs">
                      {toKyivDate(c.date + "T00:00:00Z")} в {toKyivTimeOnly(c.created_at)}
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
                        <span className="text-[#E6E6E6] font-medium">{toKyivDate(date + "T00:00:00Z")}</span>
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
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {userActivity.events?.slice(0, 50).map((e, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-[#13161B] rounded text-sm">
                      <div className="flex-1">
                        <span className="text-[#E6E6E6]">{e.label_ru || e.event_type}</span>
                        {e.brand_name && (
                          <span className="text-[#FF9900] ml-2">• {e.brand_name}</span>
                        )}
                      </div>
                      <span className="text-[#94A3B8] text-xs whitespace-nowrap ml-2">
                        {toKyivTime(e.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Searchers List */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
          <TrendingUp size={18} className="text-[#FF9900]" />
          Список сёрчеров
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="py-3 px-4 text-left">Никнейм</th>
                <th className="py-3 px-4 text-left">Email</th>
                <th className="py-3 px-4 text-center">Последний вход</th>
                <th className="py-3 px-4 text-center">Последняя отметка</th>
              </tr>
            </thead>
            <tbody>
              {searchers.map(s => {
                const lastCheckIn = checkIns.find(ci => ci.user_id === s.id);
                return (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell font-medium">{s.nickname}</td>
                    <td className="table-cell text-[#94A3B8]">{s.email}</td>
                    <td className="table-cell text-center text-[#94A3B8]">
                      {toKyivTime(s.last_login_at)}
                    </td>
                    <td className="table-cell text-center">
                      {lastCheckIn ? (
                        <span className="text-green-400">{toKyivTime(lastCheckIn.created_at)}</span>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffPage;
