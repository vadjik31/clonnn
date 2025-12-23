import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../App";
import { useAuth } from "../App";
import { toast } from "sonner";
import { 
  Boxes, 
  Upload, 
  Calculator,
  TrendingUp,
  Package,
  DollarSign,
  Percent,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  FileSpreadsheet,
  Truck,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Link,
  ChevronDown,
  ChevronUp,
  X
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

// Debounce hook для предотвращения лишних запросов
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Компонент для редактируемого поля с debounce
const EditableCell = ({ value, onChange, type = "number", placeholder = "", className = "" }) => {
  const [localValue, setLocalValue] = useState(value || "");
  const debouncedUpdate = useDebounce(onChange, 500);
  
  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);
  
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (type === "number") {
      const numValue = parseFloat(newValue) || 0;
      debouncedUpdate(numValue);
    } else {
      debouncedUpdate(newValue);
    }
  };
  
  return (
    <input
      type={type}
      step={type === "number" ? "0.01" : undefined}
      min={type === "number" ? "0" : undefined}
      value={localValue}
      onChange={handleChange}
      className={`px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs text-[#E6E6E6] focus:border-[#FF9900] focus:outline-none ${className}`}
      placeholder={placeholder}
    />
  );
};

const BashPage = () => {
  const { user } = useAuth();
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
  const [trackingModal, setTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [notesModal, setNotesModal] = useState(null); // item or null for batch
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [expandedItem, setExpandedItem] = useState(null);
  
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
    if (selectedBatch?.id) {
      fetchBatchData(selectedBatch.id);
    }
  }, [selectedBatch?.id]);

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
      // Загружаем трекинг номер
      if (res.data.tracking_number) {
        setTrackingNumber(res.data.tracking_number);
      }
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
      setSelectedBatch({ id: res.data.batch_id });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateItem = useCallback(async (itemId, field, value) => {
    try {
      const res = await api.put(`/bash/item/${itemId}`, { [field]: value });
      // Обновляем локально без перезагрузки всей страницы
      if (batchData) {
        setBatchData(prev => ({
          ...prev,
          items: prev.items.map(i => i.id === itemId ? res.data : i)
        }));
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
      const remaining = batches.filter(b => b.id !== batchId);
      setBatches(remaining);
      if (selectedBatch?.id === batchId) {
        setSelectedBatch(remaining[0] || null);
        setBatchData(null);
      }
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleSaveTracking = async () => {
    if (!trackingNumber.trim()) {
      toast.error("Введите трекинг номер");
      return;
    }
    
    try {
      // Сохраняем трекинг номер
      await api.put(`/bash/${selectedBatch.id}`, { tracking_number: trackingNumber });
      toast.success("Трекинг номер сохранён");
      fetchBatchData(selectedBatch.id);
    } catch (error) {
      toast.error("Ошибка сохранения");
    }
  };

  const handleTrackShipment = async () => {
    if (!batchData?.tracking_number) {
      toast.error("Сначала сохраните трекинг номер");
      return;
    }
    
    setTrackingLoading(true);
    try {
      const res = await api.post(`/bash/${selectedBatch.id}/track`);
      setTrackingData(res.data);
    } catch (error) {
      toast.error("Ошибка отслеживания");
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchNotes = async (itemId = null) => {
    try {
      const url = itemId 
        ? `/bash/${selectedBatch.id}/notes?item_id=${itemId}`
        : `/bash/${selectedBatch.id}/notes`;
      const res = await api.get(url);
      setNotes(res.data.notes || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await api.post(`/bash/${selectedBatch.id}/notes`, {
        text: newNote,
        item_id: notesModal?.id || null
      });
      toast.success("Заметка добавлена");
      setNewNote("");
      fetchNotes(notesModal?.id);
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.delete(`/bash/notes/${noteId}`);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const openNotesModal = (item = null) => {
    setNotesModal(item || { batch: true });
    fetchNotes(item?.id);
  };

  // Фильтрация и сортировка
  const items = batchData?.items || [];
  const filteredItems = items
    .filter(item => 
      !search || 
      item.asin?.toLowerCase().includes(search.toLowerCase()) ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier_sku?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      
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

      {/* Batches List */}
      {batches.length > 0 && (
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
          <h3 className="text-sm font-medium text-[#94A3B8] mb-3 uppercase tracking-wider">Выберите партию</h3>
          <div className="flex gap-3 flex-wrap">
            {batches.map(batch => (
              <button
                key={batch.id}
                onClick={() => { 
                  setSelectedBatch(batch); 
                  setPage(1); 
                  setBatchData(null);
                  setTrackingData(null);
                }}
                className={`px-4 py-3 rounded-[2px] transition-all flex flex-col items-start min-w-[180px] ${
                  selectedBatch?.id === batch.id 
                    ? "bg-[#FF9900] text-black" 
                    : "bg-[#0F1115] text-[#E6E6E6] hover:bg-[#1A1D24] border border-[#2A2F3A]"
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-sm font-bold">
                  <FileSpreadsheet size={14} />
                  {batch.name}
                </div>
                <div className={`text-xs mt-1 ${selectedBatch?.id === batch.id ? 'text-black/70' : 'text-[#94A3B8]'}`}>
                  {batch.items_count || 0} товаров • {batch.supplier || "Без поставщика"}
                </div>
                {batch.tracking_number && (
                  <div className={`text-xs mt-1 flex items-center gap-1 ${selectedBatch?.id === batch.id ? 'text-black/70' : 'text-green-400'}`}>
                    <Truck size={10} />
                    {batch.tracking_number}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedBatch && batchData && (
        <>
          {/* Summary & Tracking */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package size={16} className="text-blue-400" />
                <span className="text-[#94A3B8] text-xs">Товаров</span>
              </div>
              <p className="text-xl font-mono font-bold text-[#E6E6E6]">{batchData.items_count}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-yellow-400" />
                <span className="text-[#94A3B8] text-xs">Затраты</span>
              </div>
              <p className="text-xl font-mono font-bold text-[#E6E6E6]">${stats.total_cost?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-blue-400" />
                <span className="text-[#94A3B8] text-xs">Выручка</span>
              </div>
              <p className="text-xl font-mono font-bold text-blue-400">${stats.total_revenue?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calculator size={16} className="text-green-400" />
                <span className="text-[#94A3B8] text-xs">Профит</span>
              </div>
              <p className={`text-xl font-mono font-bold ${(stats.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${stats.total_profit?.toFixed(2) || "0.00"}
              </p>
            </div>

            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent size={16} className="text-purple-400" />
                <span className="text-[#94A3B8] text-xs">Ср. ROI</span>
              </div>
              <p className={`text-xl font-mono font-bold ${(stats.avg_roi || 0) >= 30 ? 'text-green-400' : (stats.avg_roi || 0) >= 15 ? 'text-yellow-400' : 'text-[#94A3B8]'}`}>
                {stats.avg_roi?.toFixed(1) || "0.0"}%
              </p>
            </div>

            {/* Tracking Card */}
            <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={16} className="text-orange-400" />
                <span className="text-[#94A3B8] text-xs">Трекинг</span>
              </div>
              {batchData.tracking_number ? (
                <div>
                  <p className="text-sm font-mono text-orange-400">{batchData.tracking_number}</p>
                  <button 
                    onClick={() => setTrackingModal(true)}
                    className="text-xs text-[#FF9900] hover:underline mt-1"
                  >
                    Отследить →
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setTrackingModal(true)}
                  className="text-sm text-[#94A3B8] hover:text-[#FF9900]"
                >
                  + Добавить трекинг
                </button>
              )}
            </div>
          </div>

          {/* Actions & Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Поиск по ASIN, названию, бренду, SKU..."
                className="pl-10 bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] bg-[#0F1115] border-[#2A2F3A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                <SelectItem value="roi">ROI</SelectItem>
                <SelectItem value="profit_per_unit">Профит/шт</SelectItem>
                <SelectItem value="total_profit">Профит (всего)</SelectItem>
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
              onClick={() => openNotesModal()}
              className="border-[#2A2F3A] text-[#E6E6E6]"
            >
              <MessageSquare size={14} className="mr-1" />
              Заметки
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
                    <th className="py-3 px-2 text-left w-12"></th>
                    <th className="py-3 px-2 text-left">Фото</th>
                    <th className="py-3 px-2 text-left">ASIN / Название</th>
                    <th className="py-3 px-2 text-right">Buy Box</th>
                    <th className="py-3 px-2 text-right">Fees</th>
                    <th className="py-3 px-2 text-right">Себест.</th>
                    <th className="py-3 px-2 text-right">Доп.</th>
                    <th className="py-3 px-2 text-right">Кол-во</th>
                    <th className="py-3 px-2 text-right">Профит/шт</th>
                    <th className="py-3 px-2 text-right">Профит</th>
                    <th className="py-3 px-2 text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(item => (
                    <>
                      <tr key={item.id} className="border-t border-[#2A2F3A] hover:bg-[#1A1D24]">
                        <td className="py-2 px-2">
                          <button 
                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                            className="text-[#94A3B8] hover:text-[#FF9900]"
                          >
                            {expandedItem === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="py-2 px-2">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-10 bg-[#2A2F3A] rounded flex items-center justify-center">
                              <Package size={16} className="text-[#94A3B8]" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 max-w-[300px]">
                          <a 
                            href={`https://www.amazon.com/dp/${item.asin}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-[#FF9900] hover:underline flex items-center gap-1"
                          >
                            {item.asin}
                            <ExternalLink size={10} />
                          </a>
                          <div 
                            className="text-xs text-[#E6E6E6] mt-0.5 line-clamp-2 cursor-pointer hover:line-clamp-none"
                            title={item.title}
                          >
                            {item.title || "—"}
                          </div>
                          {item.brand && (
                            <div className="text-[10px] text-[#94A3B8] mt-0.5">{item.brand}</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="font-mono text-[#E6E6E6]">${item.buy_box_price?.toFixed(2) || "0.00"}</div>
                          {item.buy_box_90d && item.buy_box_90d !== item.buy_box_price && (
                            <div className="text-[10px] text-[#94A3B8]">90d: ${item.buy_box_90d?.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="text-xs text-red-400">
                            <div>Ref: ${item.referral_fee?.toFixed(2) || "0"}</div>
                            <div>FBA: ${item.fba_fee?.toFixed(2) || "0"}</div>
                            <div className="text-orange-400">Ship: ${item.shipping_cost?.toFixed(2) || "0"}</div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <EditableCell
                            value={item.cost_price}
                            onChange={(val) => handleUpdateItem(item.id, "cost_price", val)}
                            className="w-16"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <EditableCell
                            value={item.extra_costs}
                            onChange={(val) => handleUpdateItem(item.id, "extra_costs", val)}
                            className="w-14"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <EditableCell
                            value={item.quantity}
                            onChange={(val) => handleUpdateItem(item.id, "quantity", Math.max(1, parseInt(val) || 1))}
                            className="w-12"
                            placeholder="1"
                          />
                        </td>
                        <td className={`py-2 px-2 text-right font-mono text-xs ${(item.profit_per_unit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${item.profit_per_unit?.toFixed(2) || "0.00"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${(item.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${item.total_profit?.toFixed(2) || "0.00"}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${
                          (item.cost_price || 0) <= 0 ? 'text-[#94A3B8]' :
                          (item.roi || 0) >= 30 ? 'text-green-400' : 
                          (item.roi || 0) >= 15 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {(item.cost_price || 0) > 0 ? `${item.roi?.toFixed(0) || "0"}%` : "—"}
                        </td>
                      </tr>
                      {/* Expanded Row */}
                      {expandedItem === item.id && (
                        <tr className="bg-[#0F1115]">
                          <td colSpan={11} className="p-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <Label className="text-[#94A3B8] text-xs">Ссылка на поставщика</Label>
                                <Input
                                  value={item.supplier_link || ""}
                                  onChange={(e) => handleUpdateItem(item.id, "supplier_link", e.target.value)}
                                  placeholder="https://..."
                                  className="bg-[#13161B] border-[#2A2F3A] mt-1 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[#94A3B8] text-xs">SKU/Название у поставщика</Label>
                                <Input
                                  value={item.supplier_sku || ""}
                                  onChange={(e) => handleUpdateItem(item.id, "supplier_sku", e.target.value)}
                                  placeholder="Артикул или название"
                                  className="bg-[#13161B] border-[#2A2F3A] mt-1 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[#94A3B8] text-xs">Категория</Label>
                                <p className="text-xs text-[#E6E6E6] mt-1">{item.category || "—"}</p>
                              </div>
                              <div>
                                <Label className="text-[#94A3B8] text-xs">Продажи</Label>
                                <p className="text-xs text-[#E6E6E6] mt-1">
                                  {item.monthly_sold || item.bought_past_month || "—"} / мес
                                </p>
                              </div>
                              <div className="lg:col-span-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openNotesModal(item)}
                                  className="border-[#2A2F3A] text-xs"
                                >
                                  <MessageSquare size={12} className="mr-1" />
                                  Заметки к товару
                                </Button>
                                {item.supplier_link && (
                                  <a 
                                    href={item.supplier_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-xs text-[#FF9900] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Link size={12} />
                                    Открыть у поставщика
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-[#94A3B8]">
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
                  {(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, filteredItems.length)} из {filteredItems.length}
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
              <Label className="text-[#94A3B8]">Название партии</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Например: Партия #1 - Декабрь 2025"
                className="bg-[#0F1115] border-[#2A2F3A] mt-1"
              />
            </div>
            
            <div>
              <Label className="text-[#94A3B8]">Поставщик</Label>
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
              <div className="flex gap-2 mt-1">
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Введите трекинг номер..."
                  className="bg-[#0F1115] border-[#2A2F3A]"
                />
                <Button 
                  onClick={handleSaveTracking}
                  variant="outline"
                  className="border-[#2A2F3A]"
                >
                  Сохранить
                </Button>
              </div>
            </div>
            
            {batchData?.tracking_number && (
              <Button 
                onClick={handleTrackShipment}
                disabled={trackingLoading}
                className="w-full bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold"
              >
                {trackingLoading ? (
                  <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    Отслеживание...
                  </>
                ) : (
                  <>
                    <Search size={16} className="mr-2" />
                    Отследить через 17track
                  </>
                )}
              </Button>
            )}
            
            {trackingData && (
              <div className="mt-4 p-4 bg-[#0F1115] rounded-[2px] border border-[#2A2F3A]">
                <h4 className="text-sm font-medium text-[#FF9900] mb-2">Статус отправления</h4>
                {trackingData.status === "success" ? (
                  <div className="text-xs text-[#E6E6E6]">
                    {trackingData.data?.data?.accepted?.length > 0 ? (
                      <pre className="overflow-auto max-h-[200px] whitespace-pre-wrap">
                        {JSON.stringify(trackingData.data.data.accepted[0], null, 2)}
                      </pre>
                    ) : trackingData.data?.data?.rejected?.length > 0 ? (
                      <p className="text-yellow-400">
                        {trackingData.data.data.rejected[0]?.error?.message || "Нет информации об отправлении"}
                      </p>
                    ) : (
                      <p className="text-[#94A3B8]">Нет данных</p>
                    )}
                  </div>
                ) : (
                  <p className="text-red-400 text-sm">{trackingData.error || "Ошибка отслеживания"}</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes Modal */}
      <Dialog open={!!notesModal} onOpenChange={() => setNotesModal(null)}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-[#FF9900] flex items-center gap-2">
              <MessageSquare size={20} />
              Заметки {notesModal?.asin ? `— ${notesModal.asin}` : "к партии"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Добавить заметку..."
                className="bg-[#0F1115] border-[#2A2F3A] min-h-[80px]"
              />
              <Button 
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="mt-2 bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold"
              >
                Добавить
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-center text-[#94A3B8] py-4">Нет заметок</p>
              ) : (
                notes.map(note => (
                  <div 
                    key={note.id} 
                    className={`p-3 rounded-[2px] border ${
                      note.created_by_role === 'super_admin' 
                        ? 'bg-purple-900/20 border-purple-500/30' 
                        : 'bg-[#0F1115] border-[#2A2F3A]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${
                        note.created_by_role === 'super_admin' ? 'text-purple-400' : 'text-[#FF9900]'
                      }`}>
                        {note.created_by_nickname} ({note.created_by_role === 'super_admin' ? 'Супер-админ' : 'Админ'})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(note.created_at).toLocaleString('ru-RU')}
                        </span>
                        <button 
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[#94A3B8] hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[#E6E6E6]">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BashPage;
