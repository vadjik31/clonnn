import { useState, useEffect } from "react";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { 
  ListTodo, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  MessageSquare,
  CheckCircle,
  Circle,
  AlertTriangle,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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

const TasksPage = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [status, setStatus] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    fetchTasks();
    if (isSuperAdmin) fetchAdmins();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks");
      setTasks(res.data.tasks || []);
    } catch (error) {
      toast.error("Ошибка загрузки задач");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await api.get("/users");
      setAdmins(res.data.filter(u => u.role === "admin" || u.role === "super_admin"));
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !assignedTo) {
      toast.error("Заполните обязательные поля");
      return;
    }
    try {
      await api.post("/tasks", {
        title,
        description,
        assigned_to_id: assignedTo,
        priority,
        deadline: deadline || null
      });
      toast.success("Задача создана");
      setCreateModal(false);
      resetForm();
      fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка создания");
    }
  };

  const handleUpdate = async (taskId) => {
    try {
      const updateData = {};
      if (isSuperAdmin) {
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority) updateData.priority = priority;
        updateData.deadline = deadline || null;
      }
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.admin_notes = adminNotes;

      await api.put(`/tasks/${taskId}`, updateData);
      toast.success("Задача обновлена");
      setEditModal(null);
      resetForm();
      fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка обновления");
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("Удалить задачу?")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success("Задача удалена");
      fetchTasks();
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setPriority("medium");
    setDeadline("");
    setAdminNotes("");
    setStatus("");
  };

  const openEditModal = (task) => {
    setTitle(task.title || "");
    setDescription(task.description || "");
    setPriority(task.priority || "medium");
    setDeadline(task.deadline || "");
    setAdminNotes(task.admin_notes || "");
    setStatus(task.status || "pending");
    setEditModal(task);
  };

  const priorityConfig = {
    low: { label: "Низкий", color: "text-gray-400 bg-gray-800/50" },
    medium: { label: "Средний", color: "text-blue-400 bg-blue-900/30" },
    high: { label: "Высокий", color: "text-orange-400 bg-orange-900/30" },
    urgent: { label: "Срочно", color: "text-red-400 bg-red-900/30" }
  };

  const statusConfig = {
    pending: { label: "Ожидает", color: "text-gray-400", icon: Circle },
    in_progress: { label: "В работе", color: "text-blue-400", icon: Clock },
    completed: { label: "Выполнено", color: "text-green-400", icon: CheckCircle },
    cancelled: { label: "Отменено", color: "text-red-400", icon: AlertTriangle }
  };

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
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
            <ListTodo className="text-[#FF9900]" />
            Задачи
          </h1>
          <p className="text-[#94A3B8] mt-1">
            {isSuperAdmin ? "Управление задачами для админов" : "Ваши назначенные задачи"}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateModal(true)} className="btn-primary">
            <Plus size={16} className="mr-2" />
            Новая задача
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {["pending", "in_progress", "completed", "cancelled"].map(st => {
          const config = statusConfig[st];
          const count = tasks.filter(t => t.status === st).length;
          return (
            <div key={st} className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-1">
                <config.icon size={16} className={config.color} />
                <span className="text-[#94A3B8] text-sm">{config.label}</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${config.color}`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Tasks List */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ListTodo className="w-16 h-16 text-[#2A2F3A] mb-4" />
            <p className="text-[#94A3B8]">Нет задач</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2F3A]">
            {tasks.map(task => {
              const prioConfig = priorityConfig[task.priority] || priorityConfig.medium;
              const statConfig = statusConfig[task.status] || statusConfig.pending;
              const isExpanded = expandedTask === task.id;
              const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "completed";
              
              return (
                <div key={task.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                          {isExpanded ? <ChevronUp size={16} className="text-[#94A3B8]" /> : <ChevronDown size={16} className="text-[#94A3B8]" />}
                        </button>
                        <statConfig.icon size={18} className={statConfig.color} />
                        <h3 className={`font-medium ${task.status === "completed" ? "line-through text-[#94A3B8]" : "text-[#E6E6E6]"}`}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${prioConfig.color}`}>
                          {prioConfig.label}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-400">
                            Просрочено
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-[#94A3B8] ml-9">
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {task.assigned_to_name || "—"}
                        </span>
                        {task.deadline && (
                          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : ""}`}>
                            <Calendar size={12} />
                            {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(task.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(task)} className="text-[#94A3B8] hover:text-[#FF9900]">
                        <Edit size={14} />
                      </Button>
                      {isSuperAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)} className="text-[#94A3B8] hover:text-red-400">
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 ml-9 space-y-3">
                      {task.description && (
                        <div className="bg-[#0F1115] p-3 rounded-[2px]">
                          <p className="text-xs text-[#94A3B8] mb-1">Описание</p>
                          <p className="text-[#E6E6E6] text-sm whitespace-pre-wrap">{task.description}</p>
                        </div>
                      )}
                      {task.admin_notes && (
                        <div className="bg-[#0F1115] p-3 rounded-[2px] border-l-2 border-[#FF9900]">
                          <p className="text-xs text-[#94A3B8] mb-1 flex items-center gap-1">
                            <MessageSquare size={10} /> Заметка исполнителя
                          </p>
                          <p className="text-[#E6E6E6] text-sm whitespace-pre-wrap">{task.admin_notes}</p>
                        </div>
                      )}
                      <div className="text-xs text-[#94A3B8]">
                        Создал: {task.created_by_name} • Обновлено: {new Date(task.updated_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader>
            <DialogTitle className="text-[#FF9900] font-mono uppercase">Новая задача</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#94A3B8]">Название *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название задачи" className="bg-[#0F1115] border-[#2A2F3A]" />
            </div>
            <div>
              <Label className="text-[#94A3B8]">Описание</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Подробное описание..." className="bg-[#0F1115] border-[#2A2F3A]" rows={3} />
            </div>
            <div>
              <Label className="text-[#94A3B8]">Назначить *</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                  <SelectValue placeholder="Выберите админа" />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  {admins.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nickname} ({a.role === "super_admin" ? "Супер" : "Админ"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#94A3B8]">Приоритет</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="medium">Средний</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                    <SelectItem value="urgent">Срочно</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#94A3B8]">Дедлайн</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-[#0F1115] border-[#2A2F3A]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCreateModal(false); resetForm(); }} className="border-[#2A2F3A]">Отмена</Button>
              <Button onClick={handleCreate} className="btn-primary">Создать</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {editModal && (
        <Dialog open={true} onOpenChange={() => { setEditModal(null); resetForm(); }}>
          <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
            <DialogHeader>
              <DialogTitle className="text-[#FF9900] font-mono uppercase">
                {isSuperAdmin ? "Редактировать задачу" : "Обновить статус"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isSuperAdmin && (
                <>
                  <div>
                    <Label className="text-[#94A3B8]">Название</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-[#0F1115] border-[#2A2F3A]" />
                  </div>
                  <div>
                    <Label className="text-[#94A3B8]">Описание</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-[#0F1115] border-[#2A2F3A]" rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#94A3B8]">Приоритет</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                          <SelectItem value="low">Низкий</SelectItem>
                          <SelectItem value="medium">Средний</SelectItem>
                          <SelectItem value="high">Высокий</SelectItem>
                          <SelectItem value="urgent">Срочно</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[#94A3B8]">Дедлайн</Label>
                      <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-[#0F1115] border-[#2A2F3A]" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label className="text-[#94A3B8]">Статус</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="in_progress">В работе</SelectItem>
                    <SelectItem value="completed">Выполнено</SelectItem>
                    <SelectItem value="cancelled">Отменено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#94A3B8]">Ваша заметка</Label>
                <Textarea 
                  value={adminNotes} 
                  onChange={(e) => setAdminNotes(e.target.value)} 
                  placeholder="Комментарий по выполнению..." 
                  className="bg-[#0F1115] border-[#2A2F3A]" 
                  rows={3} 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setEditModal(null); resetForm(); }} className="border-[#2A2F3A]">Отмена</Button>
                <Button onClick={() => handleUpdate(editModal.id)} className="btn-primary">Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TasksPage;
