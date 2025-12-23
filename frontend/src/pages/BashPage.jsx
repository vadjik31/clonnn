import { useState, useEffect, useCallback } from "react";
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
  StickyNote,
  Truck,
  RefreshCw,
  ExternalLink
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

const BashPage = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Модалки
  const [uploadModal, setUploadModal] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [batchSupplier, setBatchSupplier] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [trackingModal, setTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  
  // Фильтры и пагинация
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("roi");
  const [sortOrder, setSortOrder] = useState("desc");
  const itemsPerPage = 25;

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      fetchBatchData(selectedBatch.id);
    }
  }, [selectedBatch]);

  const fetchBatches = async () => {
    try {
      const res = await api.get("/bash");
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

  const fetchBatchData = async (batchId) => {
    try {
      const res = await api.get(`/bash/${batchId}`);
      setBatchData(res.data);
    } catch (error) {
      toast.error("Ошибка загрузки партии");
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      toast.error("Выберите файл");
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    if (batchName) formData.append("batch_name", batchName);
    if (batchSupplier) formData.append("supplier", batchSupplier);
    
    try {
      const res = await api.post("/bash/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`Создана партия "${res.data.batch_name}" с ${res.data.items_count} товарами`);
      fetchBatches();
      setUploadModal(false);
      setBatchName("");
      setBatchSupplier("");
      setSelectedFile(null);
      // Выбираем новую партию
      setSelectedBatch({ id: res.data.batch_id });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateItem = useCallback(async (itemId, updates) => {
    try {
      const res = await api.put(`/bash/item/${itemId}`, updates);
      // Обновляем локально
      if (batchData) {
        setBatchData({
          ...batchData,
          items: batchData.items.map(i => i.id === itemId ? res.data : i)
        });
      }
    } catch (error) {
      toast.error("Ошибка сохранения");
    }
  }, [batchData]);

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm("Удалить партию и все товары?")) return;
    try {
      await api.delete(`/bash/${batchId}`);
      toast.success("Партия удалена");
      setBatches(batches.filter(b => b.id !== batchId));
      if (selectedBatch?.id === batchId) {
        const remaining = batches.filter(b => b.id !== batchId);
        setSelectedBatch(remaining[0] || null);
        setBatchData(null);
      }
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleTrackBatch = async () => {
    if (!trackingNumber.trim()) {
      toast.error("Введите трекинг номер");
      return;
    }
    
    try {
      // Сохраняем трекинг номер
      await api.put(`/bash/${selectedBatch.id}`, { tracking_number: trackingNumber });
      
      // Получаем статус
      const res = await api.post(`/bash/${selectedBatch.id}/track`);
      setTrackingData(res.data);
      
      // Обновляем данные партии
      fetchBatchData(selectedBatch.id);
    } catch (error) {
      toast.error("Ошибка отслеживания");
    }
  };

  // Фильтрация и сортировка
  const items = batchData?.items || [];
  const filteredItems = items
    .filter(item => 
      !search || 
      item.asin?.toLowerCase().includes(search.toLowerCase()) ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      
      // Для ROI сортируем только товары с cost_price > 0
      if (sortBy === "roi") {
        if ((a.cost_price || 0) <= 0) aVal = sortOrder === "desc" ? -Infinity : Infinity;
        if ((b.cost_price || 0) <= 0) bVal = sortOrder === "desc" ? -Infinity : Infinity;
      }
      
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Суммари
  const stats = batchData?.calculated_stats || {};

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
            BASH — Управление партиями
          </h1>
          <p className="text-[#94A3B8] mt-1">Загрузка Keepa Excel, расчёт прибыльности, отслеживание</p>
        </div>
        <Button onClick={() => setUploadModal(true)} className="bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold">
          <Upload size={16} className="mr-2" />
          Загрузить Excel
        </Button>
      </div>

      {/* Batches Tabs */}
      {batches.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {batches.map(batch => (
            <button
              key={batch.id}
              onClick={() => { setSelectedBatch(batch); setPage(1); setBatchData(null); }}
              className={`px-4 py-2 rounded-[2px] font-mono text-sm transition-colors flex items-center gap-2 ${
                selectedBatch?.id === batch.id 
                  ? "bg-[#FF9900] text-black font-bold" 
                  : "bg-[#13161B] text-[#E6E6E6] hover:bg-[#1A1D24] border border-[#2A2F3A]"
              }`}
            >
              <FileSpreadsheet size={14} />
              {batch.name}
              <span className="text-xs opacity-70">({batch.items_count || 0})</span>
            </button>
          ))}
        </div>
      )}

      {selectedBatch && batchData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package size={16} className="text-blue-400" />
                <span className="text-[#94A3B8] text-sm">Товаров</span>
              </div>
              <p className="text-2xl font-mono font-bold text-[#E6E6E6]">{batchData.items_count}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-yellow-400" />
                <span className="text-[#94A3B8] text-sm">Затраты</span>
              </div>
              <p className="text-2xl font-mono font-bold text-[#E6E6E6]">${stats.total_cost?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-blue-400" />
                <span className="text-[#94A3B8] text-sm">Выручка (потенц.)</span>
              </div>
              <p className="text-2xl font-mono font-bold text-blue-400">${stats.total_revenue?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calculator size={16} className="text-green-400" />
                <span className="text-[#94A3B8] text-sm">Профит (потенц.)</span>
              </div>
              <p className={`text-2xl font-mono font-bold ${(stats.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${stats.total_profit?.toFixed(2) || "0.00"}
              </p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent size={16} className="text-purple-400" />
                <span className="text-[#94A3B8] text-sm">Средний ROI</span>
              </div>
              <p className={`text-2xl font-mono font-bold ${(stats.avg_roi || 0) >= 30 ? 'text-green-400' : (stats.avg_roi || 0) >= 15 ? 'text-yellow-400' : 'text-[#94A3B8]'}`}>
                {stats.avg_roi?.toFixed(1) || "0.0"}%
              </p>
            </div>
          </div>

          {/* Actions & Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Поиск по ASIN, названию, бренду..."
                className="pl-10 bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] bg-[#0F1115] border-[#2A2F3A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                <SelectItem value="roi">ROI</SelectItem>
                <SelectItem value="profit_per_unit">Профит</SelectItem>
                <SelectItem value="buy_box_price">Buy Box</SelectItem>
                <SelectItem value="cost_price">Себестоимость</SelectItem>
                <SelectItem value="monthly_sold">Продажи/мес</SelectItem>
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
              onClick={() => setTrackingModal(true)}
              className="border-[#2A2F3A] text-[#E6E6E6]"
            >
              <Truck size={14} className="mr-1" />
              Отслеживание
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteBatch(selectedBatch.id)}
              className="border-red-500/30 text-red-400 hover:bg-red-900/20 ml-auto"
            >
              <Trash2 size={14} className="mr-1" />
              Удалить
            </Button>
          </div>

          {/* Items Table */}
          <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0F1115] text-[#94A3B8] text-xs uppercase tracking-wider">
                    <th className="py-3 px-2 text-left">Фото</th>
                    <th className="py-3 px-2 text-left">ASIN</th>
                    <th className="py-3 px-2 text-left max-w-[200px]">Название</th>
                    <th className="py-3 px-2 text-right">Buy Box</th>
                    <th className="py-3 px-2 text-right">Ref Fee</th>
                    <th className="py-3 px-2 text-right">FBA Fee</th>
                    <th className="py-3 px-2 text-right">Доставка</th>
                    <th className="py-3 px-2 text-right">Себест.</th>
                    <th className="py-3 px-2 text-right">Доп.</th>
                    <th className="py-3 px-2 text-right">Кол-во</th>
                    <th className="py-3 px-2 text-right">Профит</th>
                    <th className="py-3 px-2 text-right">ROI</th>
                    <th className="py-3 px-2 text-center">Прод/мес</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(item => (
                    <tr key={item.id} className="border-t border-[#2A2F3A] hover:bg-[#1A1D24]">
                      <td className="py-2 px-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-[#2A2F3A] rounded flex items-center justify-center">
                            <Package size={16} className="text-[#94A3B8]" />
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <a 
                          href={`https://www.amazon.com/dp/${item.asin}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-[#FF9900] hover:underline flex items-center gap-1"
                        >
                          {item.asin}
                          <ExternalLink size={10} />
                        </a>
                        {item.brand && (
                          <div className="text-[10px] text-[#94A3B8] mt-0.5">{item.brand}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 max-w-[200px]">
                        <div className="text-xs text-[#E6E6E6] truncate" title={item.title}>
                          {item.title || "—"}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[#E6E6E6]">
                        ${item.buy_box_price?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-red-400 text-xs">
                        ${item.referral_fee?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-red-400 text-xs">
                        ${item.fba_fee?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-orange-400 text-xs">
                        ${item.shipping_cost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.cost_price || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItem(item.id, { cost_price: val });
                          }}
                          className="w-16 px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs text-[#E6E6E6]"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.extra_costs || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItem(item.id, { extra_costs: val });
                          }}
                          className="w-14 px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs text-[#E6E6E6]"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={item.quantity || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            handleUpdateItem(item.id, { quantity: val });
                          }}
                          className="w-12 px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs text-[#E6E6E6]"
                        />
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${(item.profit_per_unit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${item.profit_per_unit?.toFixed(2) || "0.00"}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${
                        (item.cost_price || 0) <= 0 ? 'text-[#94A3B8]' :
                        (item.roi || 0) >= 30 ? 'text-green-400' : 
                        (item.roi || 0) >= 15 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(item.cost_price || 0) > 0 ? `${item.roi?.toFixed(0) || "0"}%` : "—"}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-[#94A3B8] text-xs">
                        {item.monthly_sold || item.bought_past_month || "—"}
                      </td>
                    </tr>
                  ))}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={13} className="text-center py-8 text-[#94A3B8]">
                        {items.length === 0 ? "Нет товаров в партии" : "Ничего не найдено"}
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
                  <span className="px-3 py-1 bg-[#0F1115] border border-[#2A2F3A] rounded text-sm font-mono text-[#E6E6E6]">
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
          <p className="text-[#94A3B8] mb-4">Загрузите Excel файл из Keepa для создания первой партии</p>
          <Button onClick={() => setUploadModal(true)} className="bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold">
            <Upload size={16} className="mr-2" />
            Загрузить Excel
          </Button>
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={uploadModal} onOpenChange={setUploadModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-[#FF9900]">
              Загрузка Keepa Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#94A3B8]">Файл Excel</Label>
              <label className="block mt-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className={`border-2 border-dashed border-[#2A2F3A] rounded-[2px] p-6 text-center cursor-pointer hover:border-[#FF9900]/50 transition-colors ${selectedFile ? 'border-[#FF9900]' : ''}`}>
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-[#FF9900]">
                      <FileSpreadsheet size={20} />
                      <span>{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-[#94A3B8]">
                      <Upload size={24} className="mx-auto mb-2" />
                      <span className="text-sm">Нажмите для выбора .xlsx файла</span>
                    </div>
                  )}
                </div>
              </label>
            </div>
            
            <div>
              <Label className="text-[#94A3B8]">Название партии (опционально)</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Например: Партия #1 - Декабрь 2025"
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            
            <div>
              <Label className="text-[#94A3B8]">Поставщик (опционально)</Label>
              <Input
                value={batchSupplier}
                onChange={(e) => setBatchSupplier(e.target.value)}
                placeholder="Название поставщика"
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setUploadModal(false)} className="border-[#2A2F3A]">
                Отмена
              </Button>
              <Button 
                onClick={handleUploadFile} 
                disabled={!selectedFile || uploading}
                className="bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold"
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Загрузить
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tracking Modal */}
      <Dialog open={trackingModal} onOpenChange={setTrackingModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-[#FF9900] flex items-center gap-2">
              <Truck size={20} />
              Отслеживание партии
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#94A3B8]">Трекинг номер</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Введите трекинг номер..."
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            
            <Button 
              onClick={handleTrackBatch}
              className="w-full bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold"
            >
              <Search size={16} className="mr-2" />
              Отследить
            </Button>
            
            {trackingData && (
              <div className="mt-4 p-4 bg-[#0F1115] rounded-[2px] border border-[#2A2F3A]">
                <h4 className="text-sm font-medium text-[#FF9900] mb-2">Результат</h4>
                <pre className="text-xs text-[#94A3B8] overflow-auto max-h-[200px]">
                  {JSON.stringify(trackingData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BashPage;
