import { useState, useEffect } from "react";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Eye, EyeOff } from "lucide-react";
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

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Удалить пользователя?")) return;
    
    try {
      await api.delete(`/users/${userId}`);
      toast.success("Пользователь удалён");
      fetchUsers();
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider">
            Пользователи
          </h1>
          <p className="text-[#94A3B8] mt-1">Управление аккаунтами сёрчеров</p>
        </div>
        <Button
          onClick={() => { setEditingUser(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
          data-testid="add-user-btn"
        >
          <Plus size={18} />
          Добавить
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
        <table className="w-full" data-testid="users-table">
          <thead>
            <tr className="table-header">
              <th className="py-3 px-4 text-left">Никнейм</th>
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left">Пароль</th>
              <th className="py-3 px-4 text-left">Секретный код</th>
              <th className="py-3 px-4 text-left">Роль</th>
              <th className="py-3 px-4 text-left">Статус</th>
              <th className="py-3 px-4 text-left">Рабочие часы</th>
              <th className="py-3 px-4 text-center">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="table-row" data-testid={`user-row-${user.id}`}>
                <td className="table-cell font-medium">{user.nickname}</td>
                <td className="table-cell font-mono text-sm">{user.email}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {showPasswords[user.id] ? user.password : "••••••••"}
                    </span>
                    <button
                      onClick={() => togglePasswordVisibility(user.id)}
                      className="text-[#94A3B8] hover:text-[#E6E6E6]"
                      data-testid={`toggle-password-${user.id}`}
                    >
                      {showPasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </td>
                <td className="table-cell font-mono text-sm tracking-wider">{user.secret_code}</td>
                <td className="table-cell">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    user.role === "admin" 
                      ? "bg-purple-900/20 text-purple-400 border-purple-800" 
                      : "bg-blue-900/20 text-blue-400 border-blue-800"
                  }`}>
                    {user.role === "admin" ? "Админ" : "Сёрчер"}
                  </span>
                </td>
                <td className="table-cell">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    user.status === "active" 
                      ? "bg-green-900/20 text-green-400 border-green-800" 
                      : "bg-red-900/20 text-red-400 border-red-800"
                  }`}>
                    {user.status === "active" ? "Активен" : "Отключён"}
                  </span>
                </td>
                <td className="table-cell text-[#94A3B8] font-mono text-sm">
                  {user.work_hours_start} - {user.work_hours_end}
                </td>
                <td className="table-cell">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => { setEditingUser(user); setShowModal(true); }}
                      className="p-2 text-[#94A3B8] hover:text-[#FF9900] transition-colors"
                      data-testid={`edit-user-${user.id}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-[#94A3B8] hover:text-red-400 transition-colors"
                      data-testid={`delete-user-${user.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <UserModal
        open={showModal}
        onClose={() => setShowModal(false)}
        user={editingUser}
        onSuccess={() => { setShowModal(false); fetchUsers(); }}
      />
    </div>
  );
};

const UserModal = ({ open, onClose, user, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    secret_code: "",
    nickname: "",
    role: "searcher",
    status: "active",
    work_hours_start: "09:00",
    work_hours_end: "18:00"
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        password: user.password,
        secret_code: user.secret_code,
        nickname: user.nickname,
        role: user.role,
        status: user.status,
        work_hours_start: user.work_hours_start,
        work_hours_end: user.work_hours_end
      });
    } else {
      setFormData({
        email: "",
        password: "",
        secret_code: "",
        nickname: "",
        role: "searcher",
        status: "active",
        work_hours_start: "09:00",
        work_hours_end: "18:00"
      });
    }
  }, [user, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user) {
        await api.put(`/users/${user.id}`, formData);
        toast.success("Пользователь обновлён");
      } else {
        await api.post("/users", formData);
        toast.success("Пользователь создан");
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#E6E6E6] font-mono uppercase tracking-wider">
            {user ? "Редактировать пользователя" : "Новый пользователь"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="user-form">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Никнейм</Label>
            <Input
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
              required
              data-testid="nickname-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
              required
              data-testid="email-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Пароль</Label>
            <Input
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] font-mono"
              required={!user}
              data-testid="password-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Секретный код</Label>
            <Input
              value={formData.secret_code}
              onChange={(e) => setFormData({ ...formData, secret_code: e.target.value.toUpperCase() })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] font-mono tracking-wider"
              required={!user}
              data-testid="secret-code-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Роль</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  <SelectItem value="searcher">Сёрчер</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Статус</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]" data-testid="status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="disabled">Отключён</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Начало работы</Label>
              <Input
                type="time"
                value={formData.work_hours_start}
                onChange={(e) => setFormData({ ...formData, work_hours_start: e.target.value })}
                className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
                data-testid="work-start-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Конец работы</Label>
              <Input
                type="time"
                value={formData.work_hours_end}
                onChange={(e) => setFormData({ ...formData, work_hours_end: e.target.value })}
                className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
                data-testid="work-end-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#2A2F3A] text-[#94A3B8] hover:bg-[#1A1D24]"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="btn-primary"
              data-testid="save-user-btn"
            >
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UsersPage;
