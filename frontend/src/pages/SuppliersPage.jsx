import { useState, useEffect } from "react";
import { api } from "../App";
import { useAuth } from "../App";
import { toast } from "sonner";
import { 
  Building2, Plus, Pencil, Trash2, Eye, EyeOff, Globe, User, Key, FileText,
  Search, X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const SuppliersPage = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    site: "",
    name: "",
    login: "",
    password: "",
    notes: ""
  });
  const [showPasswords, setShowPasswords] = useState({});
  const [saving, setSaving] = useState(false);

  // Check if user can edit
  const canEdit = ["searcher", "admin", "super_admin"].includes(user?.role);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get("/suppliers");
      setSuppliers(res.data.suppliers || []);
    } catch (error) {
      console.error(error);
      toast.error("Ошибка загрузки поставщиков");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({ site: "", name: "", login: "", password: "", notes: "" });
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      site: supplier.site || "",
      name: supplier.name || "",
      login: supplier.login || "",
      password: supplier.password || "",
      notes: supplier.notes || ""
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Введите имя поставщика");
      return;
    }
    setSaving(true);
    try {
      if (editingSupplier) {
        const res = await api.put(`/suppliers/${editingSupplier.id}`, formData);
        setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? res.data : s));
        toast.success("Поставщик обновлён");
      } else {
        const res = await api.post("/suppliers", formData);
        setSuppliers([res.data, ...suppliers]);
        toast.success("Поставщик создан");
      }
      setShowModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Удалить поставщика "${supplier.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      setSuppliers(suppliers.filter(s => s.id !== supplier.id));
      toast.success("Удалено");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const togglePassword = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} скопирован`);
  };

  // Filtered suppliers
  const filteredSuppliers = suppliers.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.site?.toLowerCase().includes(q) ||
      s.login?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q)
    );
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
            <Building2 className="text-[#FF9900]" /> Поставщики
          </h1>
          <p className="text-[#94A3B8] mt-1">Управление базой поставщиков</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateModal} className="bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold">
            <Plus size={16} className="mr-2" /> Добавить
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, сайту, логину..."
          className="pl-10 bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6]"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#E6E6E6]">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-12 text-center">
          <Building2 size={48} className="mx-auto text-[#FF9900] mb-4" />
          <h3 className="text-lg text-[#E6E6E6] mb-2">
            {suppliers.length === 0 ? "Нет поставщиков" : "Ничего не найдено"}
          </h3>
          <p className="text-[#94A3B8] text-sm mb-4">
            {suppliers.length === 0 ? "Добавьте первого поставщика" : "Попробуйте изменить поисковый запрос"}
          </p>
          {canEdit && suppliers.length === 0 && (
            <Button onClick={openCreateModal} className="bg-[#FF9900] hover:bg-[#E68A00] text-black">
              <Plus size={16} className="mr-2" /> Добавить
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0F1115] text-[#94A3B8] text-xs uppercase">
                <th className="py-3 px-4 text-left">Поставщик</th>
                <th className="py-3 px-4 text-left">Сайт</th>
                <th className="py-3 px-4 text-left">Логин</th>
                <th className="py-3 px-4 text-left">Пароль</th>
                <th className="py-3 px-4 text-left">Заметки</th>
                <th className="py-3 px-4 text-center">Создан</th>
                {canEdit && <th className="py-3 px-4 w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(supplier => (
                <tr key={supplier.id} className="border-t border-[#2A2F3A] hover:bg-[#1A1D24]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#FF9900]/20 flex items-center justify-center">
                        <Building2 size={14} className="text-[#FF9900]" />
                      </div>
                      <span className="text-[#E6E6E6] font-medium">{supplier.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {supplier.site ? (
                      <a 
                        href={supplier.site.startsWith("http") ? supplier.site : `https://${supplier.site}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#FF9900] hover:underline flex items-center gap-1 text-sm"
                      >
                        <Globe size={12} />
                        {supplier.site.replace(/^https?:\/\//, "").substring(0, 30)}
                        {supplier.site.length > 30 ? "..." : ""}
                      </a>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {supplier.login ? (
                      <button 
                        onClick={() => copyToClipboard(supplier.login, "Логин")}
                        className="text-[#E6E6E6] hover:text-[#FF9900] flex items-center gap-1 text-sm"
                      >
                        <User size={12} className="text-[#94A3B8]" />
                        {supplier.login}
                      </button>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {supplier.password ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[#E6E6E6] font-mono text-sm">
                          {showPasswords[supplier.id] ? supplier.password : "••••••••"}
                        </span>
                        <button 
                          onClick={() => togglePassword(supplier.id)}
                          className="text-[#94A3B8] hover:text-[#FF9900]"
                        >
                          {showPasswords[supplier.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button 
                          onClick={() => copyToClipboard(supplier.password, "Пароль")}
                          className="text-[#94A3B8] hover:text-[#FF9900]"
                        >
                          <Key size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {supplier.notes ? (
                      <span className="text-[#94A3B8] text-sm line-clamp-1" title={supplier.notes}>
                        {supplier.notes}
                      </span>
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[#94A3B8] text-xs">
                      {new Date(supplier.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4">
                      <div className="flex gap-1 justify-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(supplier)}
                          className="text-[#FF9900] h-7 w-7 p-0"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(supplier)}
                          className="text-red-400 h-7 w-7 p-0"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader>
            <DialogTitle className="text-[#FF9900] flex items-center gap-2">
              <Building2 size={18} />
              {editingSupplier ? "Редактировать поставщика" : "Новый поставщик"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#94A3B8] text-xs">Имя поставщика *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Название компании"
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            <div>
              <Label className="text-[#94A3B8] text-xs">Сайт поставщика</Label>
              <Input
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                placeholder="https://example.com"
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#94A3B8] text-xs">Логин</Label>
                <Input
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  placeholder="username"
                  className="bg-[#0F1115] border-[#2A2F3A] mt-1"
                />
              </div>
              <div>
                <Label className="text-[#94A3B8] text-xs">Пароль</Label>
                <Input
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="bg-[#0F1115] border-[#2A2F3A] mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-[#94A3B8] text-xs">Заметки</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация..."
                className="bg-[#0F1115] border-[#2A2F3A] mt-1 min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="border-[#2A2F3A]">
                Отмена
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !formData.name.trim()}
                className="bg-[#FF9900] hover:bg-[#E68A00] text-black"
              >
                {saving ? "..." : (editingSupplier ? "Сохранить" : "Создать")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuppliersPage;
