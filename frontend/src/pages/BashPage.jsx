import { useState, useEffect } from "react";
import { api } from "../App";
import { toast } from "sonner";
import { 
  Boxes, 
  Plus, 
  Upload, 
  Calculator,
  TrendingUp,
  Package,
  DollarSign,
  Percent,
  Weight,
  Trash2,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  FileSpreadsheet,
  StickyNote
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

// Константы для расчётов
const PREP_RATE_PER_LB = 0.9;  // $ за фунт на преп
const AMAZON_RATE_PER_LB = 0.8;  // $ за фунт на Amazon

// Конвертация граммов в фунты
const gramsToLbs = (grams) => grams / 453.592;

// Расчёт профита
const calculateProfit = (item) => {
  const buyBox = parseFloat(item.buy_box) || 0;
  const refFee = parseFloat(item.referral_fee) || 0;
  const fbaFee = parseFloat(item.fba_fee) || 0;
  const cost = parseFloat(item.cost) || 0;
  const prepCost = parseFloat(item.prep_cost) || 0;
  const amazonCost = parseFloat(item.amazon_cost) || 0;
  const extraCost = parseFloat(item.extra_cost) || 0;
  
  return buyBox - refFee - fbaFee - cost - prepCost - amazonCost - extraCost;
};

// Расчёт ROI
const calculateROI = (item) => {
  const profit = calculateProfit(item);
  const cost = parseFloat(item.cost) || 0;
  const amazonCost = parseFloat(item.amazon_cost) || 0;
  const base = cost + amazonCost;
  
  if (base <= 0) return 0;
  return (profit / base) * 100;
};

const BashPage = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Модалки
  const [createModal, setCreateModal] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  
  // Фильтры и пагинация
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("roi");
  const [sortOrder, setSortOrder] = useState("desc");
  const itemsPerPage = 20;

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      fetchItems(selectedBatch.id);
    }
  }, [selectedBatch]);

  const fetchBatches = async () => {
    try {
      const res = await api.get("/bash/batches");
      setBatches(res.data.batches || []);
      if (res.data.batches?.length > 0 && !selectedBatch) {
        setSelectedBatch(res.data.batches[0]);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (batchId) => {
    try {
      const res = await api.get(`/bash/batches/${batchId}/items`);
      setItems(res.data.items || []);
    } catch (error) {
      toast.error("Ошибка загрузки товаров");
    }
  };

  const handleCreateBatch = async () => {
    if (!batchName.trim()) {
      toast.error("Введите название партии");
      return;
    }
    try {
      const res = await api.post("/bash/batches", { name: batchName });
      toast.success("Партия создана");
      setBatches([res.data.batch, ...batches]);
      setSelectedBatch(res.data.batch);
      setBatchName("");
      setCreateModal(false);
    } catch (error) {
      toast.error("Ошибка создания партии");
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBatch) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post(`/bash/batches/${selectedBatch.id}/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`Импортировано ${res.data.imported_count} товаров`);
      fetchItems(selectedBatch.id);
      fetchBatches();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка импорта");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUpdateItem = async (itemId, updates) => {
    try {
      await api.patch(`/bash/items/${itemId}`, updates);
      setItems(items.map(i => i.id === itemId ? { ...i, ...updates } : i));
      setEditingItem(null);
      toast.success("Сохранено");
    } catch (error) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm("Удалить партию и все товары?")) return;
    try {
      await api.delete(`/bash/batches/${batchId}`);
      toast.success("Партия удалена");
      setBatches(batches.filter(b => b.id !== batchId));
      if (selectedBatch?.id === batchId) {
        setSelectedBatch(batches.find(b => b.id !== batchId) || null);
      }
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  // Фильтрация и сортировка
  const filteredItems = items
    .filter(item => 
      !search || 
      item.asin?.toLowerCase().includes(search.toLowerCase()) ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.ean?.toLowerCase().includes(search.toLowerCase())
    )
    .map(item => ({
      ...item,
      profit: calculateProfit(item),
      roi: calculateROI(item)
    }))
    .sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Суммарайз по партии
  const summary = {
    totalItems: filteredItems.length,
    totalCost: filteredItems.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0),
    totalProfit: filteredItems.reduce((sum, i) => sum + i.profit, 0),
    avgROI: filteredItems.length > 0 
      ? filteredItems.reduce((sum, i) => sum + i.roi, 0) / filteredItems.length 
      : 0,
    totalRevenue: filteredItems.reduce((sum, i) => sum + (parseFloat(i.buy_box) || 0), 0)
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
            <Boxes className="text-[#FF9900]" />
            BASH — Партии
          </h1>
          <p className="text-[#94A3B8] mt-1">Управление партиями товаров и расчёт прибыльности</p>
        </div>
        <Button onClick={() => setCreateModal(true)} className="btn-primary">
          <Plus size={16} className="mr-2" />
          Новая партия
        </Button>
      </div>

      {/* Batches Tabs */}
      <div className="flex gap-2 flex-wrap">
        {batches.map(batch => (
          <button
            key={batch.id}
            onClick={() => { setSelectedBatch(batch); setPage(1); }}
            className={`px-4 py-2 rounded-[2px] font-mono text-sm transition-colors flex items-center gap-2 ${
              selectedBatch?.id === batch.id 
                ? "bg-[#FF9900] text-black" 
                : "bg-[#13161B] text-[#E6E6E6] hover:bg-[#1A1D24] border border-[#2A2F3A]"
            }`}
          >
            <FileSpreadsheet size={14} />
            {batch.name}
            <span className="text-xs opacity-70">({batch.items_count || 0})</span>
          </button>
        ))}
      </div>

      {selectedBatch && (
        <>
          {/* Batch Actions & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Upload */}
            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <h3 className="text-sm font-medium text-[#E6E6E6] mb-3 flex items-center gap-2">
                <Upload size={16} className="text-[#FF9900]" />
                Загрузить Keepa Excel
              </h3>
              <label className="block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadFile}
                  disabled={uploading}
                  className="hidden"
                />
                <div className={`border-2 border-dashed border-[#2A2F3A] rounded-[2px] p-4 text-center cursor-pointer hover:border-[#FF9900]/50 transition-colors ${uploading ? 'opacity-50' : ''}`}>
                  {uploading ? (
                    <span className="text-[#FF9900]">Загрузка...</span>
                  ) : (
                    <span className="text-[#94A3B8] text-sm">Нажмите для выбора файла</span>
                  )}
                </div>
              </label>
            </div>

            {/* Summary Cards */}
            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package size={16} className="text-blue-400" />
                <span className="text-[#94A3B8] text-sm">Товаров</span>
              </div>
              <p className="text-2xl font-mono font-bold text-[#E6E6E6]">{summary.totalItems}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-green-400" />
                <span className="text-[#94A3B8] text-sm">Потенциальный профит</span>
              </div>
              <p className={`text-2xl font-mono font-bold ${summary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${summary.totalProfit.toFixed(2)}
              </p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent size={16} className="text-purple-400" />
                <span className="text-[#94A3B8] text-sm">Средний ROI</span>
              </div>
              <p className={`text-2xl font-mono font-bold ${summary.avgROI >= 30 ? 'text-green-400' : summary.avgROI >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                {summary.avgROI.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Поиск по ASIN, EAN, названию..."
                className="pl-10 bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] bg-[#0F1115] border-[#2A2F3A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                <SelectItem value="roi">ROI</SelectItem>
                <SelectItem value="profit">Профит</SelectItem>
                <SelectItem value="buy_box">Buy Box</SelectItem>
                <SelectItem value="cost">Себестоимость</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="border-[#2A2F3A]"
            >
              <ArrowUpDown size={14} className="mr-1" />
              {sortOrder === "desc" ? "↓" : "↑"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteBatch(selectedBatch.id)}
              className="border-red-500/30 text-red-400 hover:bg-red-900/20 ml-auto"
            >
              <Trash2 size={14} className="mr-1" />
              Удалить партию
            </Button>
          </div>

          {/* Items Table */}
          <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header text-xs">
                    <th className="py-3 px-2 text-left">Фото</th>
                    <th className="py-3 px-2 text-left">ASIN</th>
                    <th className="py-3 px-2 text-left">EAN</th>
                    <th className="py-3 px-2 text-right">Buy Box</th>
                    <th className="py-3 px-2 text-right">BB 90d</th>
                    <th className="py-3 px-2 text-right">Ref Fee</th>
                    <th className="py-3 px-2 text-right">FBA Fee</th>
                    <th className="py-3 px-2 text-right">Вес (lb)</th>
                    <th className="py-3 px-2 text-right">Prep</th>
                    <th className="py-3 px-2 text-right">Amazon</th>
                    <th className="py-3 px-2 text-right">Себест.</th>
                    <th className="py-3 px-2 text-right">Доп.</th>
                    <th className="py-3 px-2 text-right">Профит</th>
                    <th className="py-3 px-2 text-right">ROI</th>
                    <th className="py-3 px-2 text-center">Конк.</th>
                    <th className="py-3 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(item => (
                    <tr key={item.id} className="table-row hover:bg-[#1A1D24]">
                      <td className="table-cell">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-[#2A2F3A] rounded flex items-center justify-center">
                            <Package size={16} className="text-[#94A3B8]" />
                          </div>
                        )}
                      </td>
                      <td className="table-cell font-mono text-xs text-[#FF9900]">{item.asin}</td>
                      <td className="table-cell font-mono text-xs text-[#94A3B8]">{item.ean || "—"}</td>
                      <td className="table-cell text-right font-mono">${item.buy_box?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right font-mono text-[#94A3B8]">${item.buy_box_90d?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right font-mono text-red-400">${item.referral_fee?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right font-mono text-red-400">${item.fba_fee?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right font-mono text-[#94A3B8]">{item.weight_lbs?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right font-mono text-orange-400">${item.prep_cost?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right font-mono text-orange-400">${item.amazon_cost?.toFixed(2) || "0.00"}</td>
                      <td className="table-cell text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.cost || ""}
                          onChange={(e) => {
                            const cost = parseFloat(e.target.value) || 0;
                            handleUpdateItem(item.id, { cost });
                          }}
                          className="w-16 px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="table-cell text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.extra_cost || ""}
                          onChange={(e) => {
                            const extra_cost = parseFloat(e.target.value) || 0;
                            handleUpdateItem(item.id, { extra_cost });
                          }}
                          className="w-14 px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs"
                          placeholder="0"
                        />
                      </td>
                      <td className={`table-cell text-right font-mono font-bold ${item.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${item.profit.toFixed(2)}
                      </td>
                      <td className={`table-cell text-right font-mono font-bold ${item.roi >= 30 ? 'text-green-400' : item.roi >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {item.roi.toFixed(0)}%
                      </td>
                      <td className="table-cell text-center font-mono text-[#94A3B8]">{item.offer_count || "—"}</td>
                      <td className="table-cell text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                          className="p-1 h-auto text-[#94A3B8] hover:text-[#FF9900]"
                        >
                          <StickyNote size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={16} className="text-center py-8 text-[#94A3B8]">
                        {items.length === 0 ? "Загрузите Excel файл для добавления товаров" : "Ничего не найдено"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#2A2F3A]">
                <span className="text-sm text-[#94A3B8]">
                  Показано {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, filteredItems.length)} из {filteredItems.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="border-[#2A2F3A]"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span className="px-3 py-1 bg-[#0F1115] border border-[#2A2F3A] rounded text-sm font-mono">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="border-[#2A2F3A]"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {batches.length === 0 && (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-12 text-center">
          <Boxes size={48} className="mx-auto text-[#FF9900] mb-4" />
          <h3 className="text-lg font-medium text-[#E6E6E6] mb-2">Нет партий</h3>
          <p className="text-[#94A3B8] mb-4">Создайте первую партию для начала работы</p>
          <Button onClick={() => setCreateModal(true)} className="btn-primary">
            <Plus size={16} className="mr-2" />
            Создать партию
          </Button>
        </div>
      )}

      {/* Create Batch Modal */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-[#FF9900]">
              Новая партия
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#94A3B8]">Название партии</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Например: Партия #1 - Декабрь 2025"
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCreateModal(false)} className="border-[#2A2F3A]">
                Отмена
              </Button>
              <Button onClick={handleCreateBatch} className="btn-primary">
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6] max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-mono uppercase tracking-wider text-[#FF9900]">
                {editingItem.asin}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-[#94A3B8]">Заметка</Label>
                <Textarea
                  value={editingItem.note || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                  placeholder="Добавьте заметку..."
                  className="bg-[#0F1115] border-[#2A2F3A] mt-1 min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[#94A3B8]">Себестоимость ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingItem.cost || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, cost: parseFloat(e.target.value) || 0 })}
                    className="bg-[#0F1115] border-[#2A2F3A] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[#94A3B8]">Доп. расходы ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingItem.extra_cost || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, extra_cost: parseFloat(e.target.value) || 0 })}
                    className="bg-[#0F1115] border-[#2A2F3A] mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingItem(null)} className="border-[#2A2F3A]">
                  Отмена
                </Button>
                <Button 
                  onClick={() => handleUpdateItem(editingItem.id, { 
                    cost: editingItem.cost, 
                    extra_cost: editingItem.extra_cost,
                    note: editingItem.note 
                  })} 
                  className="btn-primary"
                >
                  Сохранить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default BashPage;
