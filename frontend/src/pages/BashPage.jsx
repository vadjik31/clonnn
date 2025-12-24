import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../App";
import { useAuth } from "../App";
import { toast } from "sonner";
import { 
  Boxes, Upload, Calculator, TrendingUp, Package, DollarSign, Percent, Trash2,
  ChevronLeft, ChevronRight, ArrowUpDown, Search, FileSpreadsheet, Truck, RefreshCw,
  ExternalLink, MessageSquare, Link, ChevronDown, ChevronUp, X, Filter, Plus, Eye,
  Download, Copy
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

// Debounce hook
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  return useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

// Editable cell for numbers
const EditableCell = ({ value, onChange, type = "number", placeholder = "", className = "" }) => {
  const [localValue, setLocalValue] = useState(value ?? "");
  const debouncedUpdate = useDebounce(onChange, 600);
  useEffect(() => { setLocalValue(value ?? ""); }, [value]);
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedUpdate(type === "number" ? (parseFloat(newValue) || 0) : newValue);
  };
  return (
    <input type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? "0" : undefined}
      value={localValue} onChange={handleChange}
      className={`px-1 py-0.5 bg-[#0F1115] border border-[#2A2F3A] rounded text-right font-mono text-xs text-[#E6E6E6] focus:border-[#FF9900] focus:outline-none ${className}`}
      placeholder={placeholder} />
  );
};

// Text input with debounce - for SKU and other text fields
const DebouncedTextInput = ({ value, onChange, placeholder = "", className = "" }) => {
  const [localValue, setLocalValue] = useState(value || "");
  const timeoutRef = useRef(null);
  
  useEffect(() => { 
    setLocalValue(value || ""); 
  }, [value]);
  
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 800); // Longer debounce for text
  };
  
  return (
    <Input 
      value={localValue} 
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

// Status badge
const StatusBadge = ({ status, onClick }) => {
  if (!status) {
    return <button onClick={onClick} className="px-2 py-0.5 rounded text-[10px] text-[#94A3B8] border border-dashed border-[#2A2F3A] hover:border-[#FF9900]">+ статус</button>;
  }
  return <button onClick={onClick} className="px-2 py-0.5 rounded text-[10px] bg-[#FF9900]/20 text-[#FF9900] border border-[#FF9900]/40 hover:bg-[#FF9900]/30 whitespace-nowrap max-w-[80px] truncate">{status}</button>;
};

const BashPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState("list");
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const abortControllerRef = useRef(null);
  
  // Modals
  const [uploadModal, setUploadModal] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [batchSupplier, setBatchSupplier] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [trackingModal, setTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [carrierCode, setCarrierCode] = useState("");
  const [carriers, setCarriers] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [notesModal, setNotesModal] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [expandedItem, setExpandedItem] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [customStatus, setCustomStatus] = useState("");
  const [deleteByStatusModal, setDeleteByStatusModal] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [exportSkuModal, setExportSkuModal] = useState(false);
  const [exportedItems, setExportedItems] = useState([]);
  const [zoomImage, setZoomImage] = useState(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("roi");
  const [sortOrder, setSortOrder] = useState("desc");
  const itemsPerPage = 25;
  
  // Store sorted item IDs to prevent "jumping" on edit
  const [sortedItemIds, setSortedItemIds] = useState([]);

  useEffect(() => { fetchBatches(); }, []);
  useEffect(() => { if (selectedBatch?.id && view === "detail") fetchBatchData(selectedBatch.id); }, [selectedBatch?.id, view]);

  const fetchBatches = async () => {
    try {
      const res = await api.get("/bash");
      setBatches(res.data.batches || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const fetchBatchData = async (batchId) => {
    try {
      const res = await api.get(`/bash/${batchId}`);
      setBatchData(res.data);
      if (res.data.tracking_number) {
        setTrackingNumber(res.data.tracking_number);
        setCarrierCode(res.data.carrier_code || "");
        setCarrierName(res.data.carrier_name || "");
      }
    } catch (error) { toast.error("Ошибка загрузки"); }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) { toast.error("Выберите файл"); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    if (batchName) formData.append("batch_name", batchName);
    if (batchSupplier) formData.append("supplier", batchSupplier);
    try {
      const res = await api.post("/bash/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Партия "${res.data.batch_name}" с ${res.data.items_count} товарами`);
      fetchBatches();
      setUploadModal(false); setBatchName(""); setBatchSupplier(""); setSelectedFile(null);
      setSelectedBatch({ id: res.data.batch_id, name: res.data.batch_name });
      setView("detail");
    } catch (error) { toast.error(error.response?.data?.detail || "Ошибка"); }
    finally { setUploading(false); }
  };

  // Обновление с пересчётом статистики
  const handleUpdateItem = useCallback(async (itemId, field, value) => {
    try {
      const res = await api.put(`/bash/item/${itemId}`, { [field]: value });
      if (batchData) {
        const newItems = batchData.items.map(i => i.id === itemId ? res.data : i);
        const itemsWithCost = newItems.filter(i => (i.cost_price || 0) > 0);
        const total_cost = newItems.reduce((s, i) => s + ((i.cost_price || 0) * (i.quantity || 1)), 0);
        const total_profit = newItems.reduce((s, i) => s + (i.total_profit || 0), 0);
        const total_revenue = newItems.reduce((s, i) => s + ((i.buy_box_price || 0) * (i.quantity || 1)), 0);
        
        let avg_roi = 0;
        if (itemsWithCost.length > 0) {
          const profit_priced = itemsWithCost.reduce((s, i) => s + (i.total_profit || 0), 0);
          const investment = itemsWithCost.reduce((s, i) => s + ((i.cost_price || 0) + (i.shipping_cost || 0) + (i.extra_costs || 0)) * (i.quantity || 1), 0);
          if (investment > 0) avg_roi = (profit_priced / investment) * 100;
        }
        
        // Пересчёт уникальных статусов
        const unique_statuses = [...new Set(newItems.map(i => i.status).filter(Boolean))];
        
        setBatchData(prev => ({
          ...prev,
          items: newItems,
          unique_statuses,
          calculated_stats: {
            total_cost: Math.round(total_cost * 100) / 100,
            total_profit: Math.round(total_profit * 100) / 100,
            total_revenue: Math.round(total_revenue * 100) / 100,
            avg_roi: Math.round(avg_roi * 10) / 10,
            items_with_cost: itemsWithCost.length
          }
        }));
      }
    } catch (error) { toast.error("Ошибка"); }
  }, [batchData]);

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm("Удалить партию?")) return;
    try {
      await api.delete(`/bash/${batchId}`);
      toast.success("Удалено");
      setBatches(batches.filter(b => b.id !== batchId));
      if (selectedBatch?.id === batchId) { setSelectedBatch(null); setBatchData(null); setView("list"); }
    } catch (error) { toast.error("Ошибка"); }
  };

  const handleSaveTracking = async () => {
    try {
      await api.put(`/bash/${selectedBatch.id}`, { tracking_number: trackingNumber, carrier_code: carrierCode, carrier_name: carrierName });
      toast.success("Сохранено");
      fetchBatchData(selectedBatch.id);
    } catch (error) { toast.error("Ошибка"); }
  };

  const handleTrackShipment = async () => {
    if (!batchData?.tracking_number) return;
    setTrackingLoading(true);
    try { await api.post(`/bash/${selectedBatch.id}/track`); await fetchBatchData(selectedBatch.id); toast.success("Обновлено"); }
    catch (error) { toast.error("Ошибка"); }
    finally { setTrackingLoading(false); }
  };

  const searchCarriers = async (q) => {
    try { const res = await api.get(`/bash/carriers?q=${encodeURIComponent(q)}`); setCarriers(res.data.carriers || []); }
    catch (error) { console.error(error); }
  };

  const fetchNotes = async (itemId = null) => {
    try { const res = await api.get(itemId ? `/bash/${selectedBatch.id}/notes?item_id=${itemId}` : `/bash/${selectedBatch.id}/notes`); setNotes(res.data.notes || []); }
    catch (error) { console.error(error); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try { await api.post(`/bash/${selectedBatch.id}/notes`, { text: newNote, item_id: notesModal?.id || null }); toast.success("Добавлено"); setNewNote(""); fetchNotes(notesModal?.id); }
    catch (error) { toast.error("Ошибка"); }
  };

  const handleDeleteNote = async (noteId) => {
    try { await api.delete(`/bash/notes/${noteId}`); setNotes(notes.filter(n => n.id !== noteId)); }
    catch (error) { toast.error("Ошибка"); }
  };

  const handleSetStatus = async (status) => {
    if (!statusModal) return;
    await handleUpdateItem(statusModal.id, "status", status);
    setStatusModal(null); setCustomStatus("");
  };

  const handleDeleteByStatus = async () => {
    if (selectedStatuses.length === 0) { toast.error("Выберите статусы"); return; }
    if (!window.confirm(`Удалить товары: ${selectedStatuses.join(", ")}?`)) return;
    try {
      const res = await api.delete(`/bash/${selectedBatch.id}/items-by-status?${selectedStatuses.map(s => `statuses=${encodeURIComponent(s)}`).join("&")}`);
      toast.success(`Удалено ${res.data.deleted_count}`);
      fetchBatchData(selectedBatch.id);
      setDeleteByStatusModal(false); setSelectedStatuses([]);
    } catch (error) { toast.error("Ошибка"); }
  };

  const handleExportSku = async () => {
    try { const res = await api.get(`/bash/${selectedBatch.id}/export-sku-quantity`); setExportedItems(res.data.items || []); setExportSkuModal(true); }
    catch (error) { toast.error("Ошибка"); }
  };

  const copyExport = () => {
    const text = exportedItems.map(i => `${i.supplier_sku}\t${i.quantity}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Скопировано");
  };

  const openNotesModal = (item = null) => { setNotesModal(item || { batch: true }); fetchNotes(item?.id); };
  const openBatchDetail = (batch) => { setSelectedBatch(batch); setView("detail"); };

  // Фильтрация
  const items = batchData?.items || [];
  const uniqueStatuses = batchData?.unique_statuses || [];
  
  // Filter items first
  const filteredItemsBase = items.filter(item => {
    if (statusFilter === "__empty__" && (item.status || "")) return false;
    if (statusFilter !== "all" && statusFilter !== "__empty__" && (item.status || "") !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return item.asin?.toLowerCase().includes(s) || item.title?.toLowerCase().includes(s) || item.brand?.toLowerCase().includes(s) || item.supplier_sku?.toLowerCase().includes(s);
  });
  
  // Sort and update sortedItemIds only when sort params, filter, or batch changes
  useEffect(() => {
    if (filteredItemsBase.length === 0) {
      setSortedItemIds([]);
      return;
    }
    const sorted = [...filteredItemsBase].sort((a, b) => {
      let aVal = a[sortBy] || 0, bVal = b[sortBy] || 0;
      if (sortBy === "roi") {
        if ((a.cost_price || 0) <= 0) aVal = sortOrder === "desc" ? -Infinity : Infinity;
        if ((b.cost_price || 0) <= 0) bVal = sortOrder === "desc" ? -Infinity : Infinity;
      }
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    setSortedItemIds(sorted.map(i => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, statusFilter, search, selectedBatch?.id, items.length]);
  
  // Use stored order to prevent jumping on edit
  const filteredItems = sortedItemIds.length > 0
    ? sortedItemIds
        .map(id => filteredItemsBase.find(item => item.id === id))
        .filter(Boolean)
    : filteredItemsBase;

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const stats = batchData?.calculated_stats || {};
  const statusCounts = items.reduce((acc, item) => { const st = item.status || ""; acc[st] = (acc[st] || 0) + 1; return acc; }, {});

  // Tracking display
  const getTrackingDisplay = () => {
    if (!batchData?.tracking_parsed) return null;
    const p = batchData.tracking_parsed;
    const statusMap = { 0: { text: "Нет инфо", color: "text-[#94A3B8]" }, 10: { text: "В пути", color: "text-blue-400" }, 20: { text: "Истёк", color: "text-red-400" }, 30: { text: "Не доставлено", color: "text-red-400" }, 35: { text: "Ожидание", color: "text-yellow-400" }, 40: { text: "Доставлено", color: "text-green-400" }, 50: { text: "Нет инфо", color: "text-[#94A3B8]" } };
    const info = statusMap[p.status_code] || statusMap[0];
    // Use status_text from API if available, otherwise use mapped text
    const displayText = p.status_text || info.text;
    return { statusText: displayText, statusColor: info.color, lastEvent: p.last_event, lastTime: p.last_time };
  };
  const trackingDisplay = getTrackingDisplay();

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-[#FF9900] font-mono">Загрузка...</div></div>;

  // ==================== LIST VIEW ====================
  if (view === "list") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase flex items-center gap-3"><Boxes className="text-[#FF9900]" /> BASH — Партии</h1>
            <p className="text-[#94A3B8] mt-1">Управление партиями товаров</p>
          </div>
          <Button onClick={() => setUploadModal(true)} className="bg-[#FF9900] hover:bg-[#E68A00] text-black font-bold"><Plus size={16} className="mr-2" /> Новая</Button>
        </div>

        {batches.length === 0 ? (
          <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-12 text-center">
            <Boxes size={48} className="mx-auto text-[#FF9900] mb-4" />
            <h3 className="text-lg text-[#E6E6E6] mb-2">Нет партий</h3>
            <Button onClick={() => setUploadModal(true)} className="bg-[#FF9900] hover:bg-[#E68A00] text-black"><Upload size={16} className="mr-2" /> Загрузить</Button>
          </div>
        ) : (
          <div className="bg-[#13161B] border border-[#2A2F3A] rounded overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-[#0F1115] text-[#94A3B8] text-xs uppercase">
                <th className="py-3 px-4 text-left">Название</th>
                <th className="py-3 px-4 text-left">Поставщик</th>
                <th className="py-3 px-4 text-center">Товаров</th>
                <th className="py-3 px-4 text-right">Профит</th>
                <th className="py-3 px-4 text-center">Трекинг</th>
                <th className="py-3 px-4 text-center">Дата</th>
                <th className="py-3 px-4 w-20"></th>
              </tr></thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id} className="border-t border-[#2A2F3A] hover:bg-[#1A1D24] cursor-pointer" onClick={() => openBatchDetail(batch)}>
                    <td className="py-3 px-4"><div className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-[#FF9900]" /><span className="text-[#E6E6E6]">{batch.name}</span></div></td>
                    <td className="py-3 px-4 text-[#94A3B8]">{batch.supplier || "—"}</td>
                    <td className="py-3 px-4 text-center font-mono text-[#E6E6E6]">{batch.items_count || 0}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${(batch.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>${(batch.total_profit || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">{batch.tracking_number ? <span className="text-xs text-green-400"><Truck size={12} className="inline mr-1" />{batch.tracking_number.slice(0, 10)}...</span> : <span className="text-xs text-[#94A3B8]">—</span>}</td>
                    <td className="py-3 px-4 text-center text-xs text-[#94A3B8]">{new Date(batch.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}><div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="sm" onClick={() => openBatchDetail(batch)} className="text-[#FF9900] h-7 w-7 p-0"><Eye size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteBatch(batch.id)} className="text-red-400 h-7 w-7 p-0"><Trash2 size={14} /></Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={uploadModal} onOpenChange={setUploadModal}>
          <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
            <DialogHeader><DialogTitle className="text-[#FF9900]">Новая партия</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <label className="block"><input type="file" accept=".xlsx,.xls" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
                <div className={`border-2 border-dashed border-[#2A2F3A] rounded p-6 text-center cursor-pointer ${selectedFile ? 'border-[#FF9900]' : ''}`}>
                  {selectedFile ? <span className="text-[#FF9900]">{selectedFile.name}</span> : <span className="text-[#94A3B8]"><Upload size={24} className="mx-auto mb-2" />Выберите .xlsx</span>}
                </div>
              </label>
              <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Название" className="bg-[#0F1115] border-[#2A2F3A]" />
              <Input value={batchSupplier} onChange={(e) => setBatchSupplier(e.target.value)} placeholder="Поставщик" className="bg-[#0F1115] border-[#2A2F3A]" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setUploadModal(false)} className="border-[#2A2F3A]">Отмена</Button>
                <Button onClick={handleUploadFile} disabled={!selectedFile || uploading} className="bg-[#FF9900] hover:bg-[#E68A00] text-black">{uploading ? "..." : "Создать"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== DETAIL VIEW ====================
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setView("list")} className="text-[#94A3B8]"><ChevronLeft size={20} /> Назад</Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#E6E6E6] font-mono flex items-center gap-2"><FileSpreadsheet className="text-[#FF9900]" size={20} />{batchData?.name || "Партия"}</h1>
          <p className="text-[#94A3B8] text-sm">{batchData?.supplier || "Без поставщика"} • {batchData?.items_count || 0} товаров</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => openNotesModal()} className="border-[#2A2F3A]"><MessageSquare size={14} className="mr-1" /> Заметки</Button>
        <Button variant="outline" size="sm" onClick={() => handleDeleteBatch(selectedBatch.id)} className="border-red-500/30 text-red-400"><Trash2 size={14} /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-3">
          <div className="text-[#94A3B8] text-xs mb-1">Товаров</div>
          <p className="text-lg font-mono font-bold text-[#E6E6E6]">{batchData?.items_count || 0}</p>
        </div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-3">
          <div className="text-[#94A3B8] text-xs mb-1">Затраты</div>
          <p className="text-lg font-mono font-bold text-[#E6E6E6]">${stats.total_cost?.toFixed(2) || "0"}</p>
        </div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-3">
          <div className="text-[#94A3B8] text-xs mb-1">Выручка</div>
          <p className="text-lg font-mono font-bold text-blue-400">${stats.total_revenue?.toFixed(2) || "0"}</p>
        </div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-3">
          <div className="text-[#94A3B8] text-xs mb-1">Профит</div>
          <p className={`text-lg font-mono font-bold ${(stats.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>${stats.total_profit?.toFixed(2) || "0"}</p>
        </div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-3">
          <div className="text-[#94A3B8] text-xs mb-1">ROI ({stats.items_with_cost || 0})</div>
          <p className={`text-lg font-mono font-bold ${(stats.avg_roi || 0) >= 30 ? 'text-green-400' : (stats.avg_roi || 0) >= 15 ? 'text-yellow-400' : 'text-[#94A3B8]'}`}>{stats.avg_roi?.toFixed(1) || "0"}%</p>
        </div>
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#94A3B8] text-xs"><Truck size={12} className="inline" /></span>
            <button onClick={() => setTrackingModal(true)} className="text-[#FF9900] text-[10px]">{batchData?.tracking_number ? "⚙" : "+"}</button>
          </div>
          {batchData?.tracking_number ? (
            <div>
              <p className="font-mono text-[10px] text-[#94A3B8] truncate">{batchData.tracking_number}</p>
              {trackingDisplay ? <p className={`text-xs font-medium ${trackingDisplay.statusColor}`}>{trackingDisplay.statusText}</p> : <button onClick={handleTrackShipment} disabled={trackingLoading} className="text-[10px] text-[#FF9900]">{trackingLoading ? "..." : "Обновить"}</button>}
            </div>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ASIN, название, SKU..." className="pl-9 bg-[#0F1115] border-[#2A2F3A] h-8 text-sm" />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] bg-[#0F1115] border-[#2A2F3A] h-8 text-sm"><Filter size={14} className="mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
            <SelectItem value="all">Все ({items.length})</SelectItem>
            <SelectItem value="__empty__">Без статуса ({statusCounts[""] || 0})</SelectItem>
            {uniqueStatuses.map(s => <SelectItem key={s} value={s}>{s} ({statusCounts[s] || 0})</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[100px] bg-[#0F1115] border-[#2A2F3A] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
            <SelectItem value="roi">ROI</SelectItem>
            <SelectItem value="total_profit">Профит</SelectItem>
            <SelectItem value="buy_box_price">Buy Box</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")} className="border-[#2A2F3A] h-8 px-2"><ArrowUpDown size={14} /></Button>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleExportSku} className="border-[#2A2F3A] h-8 text-xs"><Download size={14} className="mr-1" /> Экспорт</Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteByStatusModal(true)} className="border-red-500/30 text-red-400 h-8 text-xs"><Trash2 size={14} className="mr-1" /> По статусу</Button>
      </div>

      {/* Table */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#0F1115] text-[#94A3B8] text-[10px] uppercase">
              <th className="py-2 px-2 w-6"></th>
              <th className="py-2 px-1 w-10">Фото</th>
              <th className="py-2 px-2 text-left w-[280px]">Товар</th>
              <th className="py-2 px-2 text-right">Buy Box</th>
              <th className="py-2 px-2 text-right">Ref</th>
              <th className="py-2 px-2 text-right">FBA</th>
              <th className="py-2 px-2 text-right w-12">Ship</th>
              <th className="py-2 px-2 text-right w-12">Преп.</th>
              <th className="py-2 px-2 text-right w-14">Себест.</th>
              <th className="py-2 px-2 text-right w-12">Доп.</th>
              <th className="py-2 px-2 text-right w-10">Кол.</th>
              <th className="py-2 px-2 text-right">Профит</th>
              <th className="py-2 px-2 text-right">ROI</th>
              <th className="py-2 px-2 text-center w-20">Статус</th>
            </tr></thead>
            <tbody>
              {paginatedItems.map(item => (
                <>
                  <tr key={item.id} className="border-t border-[#2A2F3A] hover:bg-[#1A1D24]">
                    <td className="py-1 px-2"><button onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)} className="text-[#94A3B8] hover:text-[#FF9900]">{expandedItem === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td>
                    <td className="py-1 px-1">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-8 h-8 object-cover rounded cursor-pointer hover:ring-2 hover:ring-[#FF9900]" onClick={() => setZoomImage(item.image_url)} />
                      ) : (
                        <div className="w-8 h-8 bg-[#2A2F3A] rounded flex items-center justify-center"><Package size={12} className="text-[#94A3B8]" /></div>
                      )}
                    </td>
                    <td className="py-1 px-2 w-[280px]">
                      <a href={`https://amazon.com/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-[#FF9900] hover:underline flex items-center gap-0.5">{item.asin} <ExternalLink size={8} /></a>
                      <div className="text-[11px] text-[#E6E6E6] leading-tight line-clamp-2 hover:line-clamp-none" title={item.title}>{item.title || "—"}</div>
                      {item.brand && <span className="text-[9px] text-[#94A3B8]">{item.brand}</span>}
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-xs text-[#E6E6E6]">${item.buy_box_price?.toFixed(2) || "0"}</td>
                    <td className="py-1 px-2 text-right font-mono text-[10px] text-red-400">${item.referral_fee?.toFixed(2) || "0"}</td>
                    <td className="py-1 px-2 text-right font-mono text-[10px] text-red-400">${item.fba_fee?.toFixed(2) || "0"}</td>
                    <td className="py-1 px-2 text-right"><EditableCell value={item.shipping_cost} onChange={(v) => handleUpdateItem(item.id, "shipping_cost", v)} className="w-12" placeholder="0" /></td>
                    <td className="py-1 px-2 text-right"><EditableCell value={item.prep_cost} onChange={(v) => handleUpdateItem(item.id, "prep_cost", v)} className="w-12" placeholder="0" /></td>
                    <td className="py-1 px-2 text-right"><EditableCell value={item.cost_price} onChange={(v) => handleUpdateItem(item.id, "cost_price", v)} className="w-14" placeholder="0" /></td>
                    <td className="py-1 px-2 text-right"><EditableCell value={item.extra_costs} onChange={(v) => handleUpdateItem(item.id, "extra_costs", v)} className="w-12" placeholder="0" /></td>
                    <td className="py-1 px-2 text-right"><EditableCell value={item.quantity} onChange={(v) => handleUpdateItem(item.id, "quantity", Math.max(1, parseInt(v) || 1))} className="w-10" /></td>
                    <td className={`py-1 px-2 text-right font-mono text-xs font-bold ${(item.total_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>${item.total_profit?.toFixed(2) || "0"}</td>
                    <td className={`py-1 px-2 text-right font-mono text-xs font-bold ${(item.cost_price || 0) <= 0 ? 'text-[#94A3B8]' : (item.roi || 0) >= 30 ? 'text-green-400' : (item.roi || 0) >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>{(item.cost_price || 0) > 0 ? `${item.roi?.toFixed(0)}%` : "—"}</td>
                    <td className="py-1 px-2 text-center"><StatusBadge status={item.status} onClick={() => { setStatusModal(item); setCustomStatus(item.status || ""); }} /></td>
                  </tr>
                  {expandedItem === item.id && (
                    <tr className="bg-[#0F1115]">
                      <td colSpan={14} className="p-3">
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><Label className="text-[#94A3B8] text-[10px]">SKU поставщика</Label><DebouncedTextInput value={item.supplier_sku} onChange={(v) => handleUpdateItem(item.id, "supplier_sku", v)} placeholder="Артикул" className="bg-[#13161B] border-[#2A2F3A] mt-1 h-7 text-xs" /></div>
                          <div><Label className="text-[#94A3B8] text-[10px]">Ссылка поставщика</Label><DebouncedTextInput value={item.supplier_link} onChange={(v) => handleUpdateItem(item.id, "supplier_link", v)} placeholder="https://..." className="bg-[#13161B] border-[#2A2F3A] mt-1 h-7 text-xs" /></div>
                          <div><Label className="text-[#94A3B8] text-[10px]">Категория</Label><p className="text-[#E6E6E6] mt-2 text-xs">{item.category || "—"}</p></div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button variant="outline" size="sm" onClick={() => openNotesModal(item)} className="border-[#2A2F3A] text-[10px] h-6"><MessageSquare size={10} className="mr-1" /> Заметки</Button>
                          {item.supplier_link && <a href={item.supplier_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#FF9900] hover:underline flex items-center gap-1"><Link size={10} /> Поставщик</a>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#2A2F3A] text-xs">
            <span className="text-[#94A3B8]">{(page - 1) * itemsPerPage + 1}-{Math.min(page * itemsPerPage, filteredItems.length)} из {filteredItems.length}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="border-[#2A2F3A] h-6 w-6 p-0"><ChevronLeft size={14} /></Button>
              <span className="px-2 py-1 bg-[#0F1115] border border-[#2A2F3A] rounded font-mono">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="border-[#2A2F3A] h-6 w-6 p-0"><ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </div>

      {/* ZOOM IMAGE MODAL */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] p-2 max-w-md">
          {zoomImage && <img src={zoomImage} alt="" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>

      {/* STATUS MODAL */}
      <Dialog open={!!statusModal} onOpenChange={() => { setStatusModal(null); setCustomStatus(""); }}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6] max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Статус товара</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[#94A3B8] text-xs">Введите статус</Label>
              <Input value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder="не нашёл, тяжелый..." className="bg-[#0F1115] border-[#2A2F3A] mt-1" onKeyDown={(e) => e.key === "Enter" && handleSetStatus(customStatus)} /></div>
            {uniqueStatuses.length > 0 && <div><Label className="text-[#94A3B8] text-xs">Или выберите:</Label>
              <div className="flex flex-wrap gap-1 mt-1">{uniqueStatuses.map(s => <button key={s} onClick={() => handleSetStatus(s)} className="px-2 py-1 rounded text-xs bg-[#FF9900]/20 text-[#FF9900] hover:bg-[#FF9900]/30">{s}</button>)}</div></div>}
            <div className="flex gap-2">
              <Button onClick={() => handleSetStatus(customStatus)} className="flex-1 bg-[#FF9900] hover:bg-[#E68A00] text-black">Сохранить</Button>
              <Button variant="outline" onClick={() => handleSetStatus("")} className="border-[#2A2F3A]">Очистить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE BY STATUS */}
      <Dialog open={deleteByStatusModal} onOpenChange={setDeleteByStatusModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader><DialogTitle className="text-[#FF9900]">Удалить по статусу</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {uniqueStatuses.length === 0 ? <p className="text-center text-[#94A3B8] py-4">Нет товаров со статусами</p> : (
              <div className="space-y-2">{uniqueStatuses.map(s => (
                <label key={s} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-[#1A1D24] border border-[#2A2F3A]">
                  <Checkbox checked={selectedStatuses.includes(s)} onCheckedChange={(c) => c ? setSelectedStatuses([...selectedStatuses, s]) : setSelectedStatuses(selectedStatuses.filter(v => v !== s))} />
                  <span className="text-sm text-[#FF9900]">{s}</span>
                  <span className="text-[#94A3B8] text-xs ml-auto">({statusCounts[s] || 0})</span>
                </label>
              ))}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteByStatusModal(false); setSelectedStatuses([]); }} className="border-[#2A2F3A]">Отмена</Button>
              <Button onClick={handleDeleteByStatus} disabled={selectedStatuses.length === 0} className="bg-red-600 hover:bg-red-700 text-white"><Trash2 size={14} className="mr-1" /> Удалить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EXPORT SKU */}
      <Dialog open={exportSkuModal} onOpenChange={setExportSkuModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader><DialogTitle className="text-[#FF9900]">Экспорт SKU + Кол-во</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-[#94A3B8]">Товары с артикулом поставщика и кол-вом &gt; 0:</p>
            {exportedItems.length > 0 ? (
              <>
                <Textarea readOnly value={exportedItems.map(i => `${i.supplier_sku}\t${i.quantity}`).join("\n")} className="bg-[#0F1115] border-[#2A2F3A] min-h-[150px] font-mono text-xs" />
                <Button onClick={copyExport} className="w-full bg-[#FF9900] hover:bg-[#E68A00] text-black"><Copy size={14} className="mr-1" /> Копировать</Button>
              </>
            ) : <p className="text-center text-[#94A3B8] py-8">Нет данных</p>}
            <p className="text-xs text-[#94A3B8]">Всего: {exportedItems.length}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* TRACKING */}
      <Dialog open={trackingModal} onOpenChange={setTrackingModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader><DialogTitle className="text-[#FF9900]"><Truck size={18} className="inline mr-2" />Отслеживание</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[#94A3B8] text-xs">Трекинг номер</Label><Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Номер" className="bg-[#0F1115] border-[#2A2F3A] mt-1" /></div>
            <div><Label className="text-[#94A3B8] text-xs">Перевозчик (введите название или код)</Label>
              <Input value={carrierName} onChange={(e) => { setCarrierName(e.target.value); searchCarriers(e.target.value); }} placeholder="DHL, 100001, USPS..." className="bg-[#0F1115] border-[#2A2F3A] mt-1" />
              {carriers.length > 0 && carrierName && <div className="mt-1 bg-[#0F1115] border border-[#2A2F3A] rounded max-h-[150px] overflow-y-auto">{carriers.map(c => <button key={c.key} onClick={() => { setCarrierName(c.name); setCarrierCode(c.key); setCarriers([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#1A1D24] text-[#E6E6E6] flex justify-between"><span>{c.name}</span><span className="text-[#FF9900] font-mono text-xs">{c.key}</span></button>)}</div>}
              {carrierCode && <p className="text-xs text-[#94A3B8] mt-1">Код: <span className="text-[#FF9900] font-mono">{carrierCode}</span></p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveTracking} className="flex-1 bg-[#FF9900] hover:bg-[#E68A00] text-black">Сохранить</Button>
              {batchData?.tracking_number && <Button onClick={handleTrackShipment} disabled={trackingLoading} variant="outline" className="border-[#2A2F3A]">{trackingLoading ? <RefreshCw size={14} className="animate-spin" /> : "Обновить"}</Button>}
            </div>
            {trackingDisplay && <div className="p-3 bg-[#0F1115] rounded border border-[#2A2F3A]"><p className={`text-sm font-medium ${trackingDisplay.statusColor}`}>{trackingDisplay.statusText}</p>{trackingDisplay.lastEvent && <p className="text-xs text-[#E6E6E6] mt-1">{trackingDisplay.lastEvent}</p>}</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* NOTES */}
      <Dialog open={!!notesModal} onOpenChange={() => setNotesModal(null)}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader><DialogTitle className="text-[#FF9900]">Заметки {notesModal?.asin ? `— ${notesModal.asin}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Новая заметка..." className="bg-[#0F1115] border-[#2A2F3A] min-h-[60px]" /><Button onClick={handleAddNote} disabled={!newNote.trim()} className="mt-2 bg-[#FF9900] hover:bg-[#E68A00] text-black" size="sm">Добавить</Button></div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {notes.length === 0 ? <p className="text-center text-[#94A3B8] py-4 text-sm">Нет заметок</p> : notes.map(note => (
                <div key={note.id} className={`p-2 rounded border-l-4 ${note.created_by_role === 'super_admin' ? 'bg-purple-900/20 border-l-purple-500' : 'bg-orange-900/20 border-l-[#FF9900]'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium ${note.created_by_role === 'super_admin' ? 'text-purple-400' : 'text-[#FF9900]'}`}>{note.created_by_nickname} ({note.created_by_role === 'super_admin' ? 'СА' : 'А'})</span>
                    <div className="flex items-center gap-2"><span className="text-[9px] text-[#94A3B8]">{new Date(note.created_at).toLocaleString('ru-RU')}</span><button onClick={() => handleDeleteNote(note.id)} className="text-[#94A3B8] hover:text-red-400"><X size={12} /></button></div>
                  </div>
                  <p className="text-xs text-[#E6E6E6] mt-1">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UPLOAD (from detail) */}
      <Dialog open={uploadModal} onOpenChange={setUploadModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader><DialogTitle className="text-[#FF9900]">Новая партия</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block"><input type="file" accept=".xlsx,.xls" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" /><div className={`border-2 border-dashed border-[#2A2F3A] rounded p-4 text-center cursor-pointer ${selectedFile ? 'border-[#FF9900]' : ''}`}>{selectedFile ? <span className="text-[#FF9900]">{selectedFile.name}</span> : <span className="text-[#94A3B8]">Выберите файл</span>}</div></label>
            <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Название" className="bg-[#0F1115] border-[#2A2F3A]" />
            <Input value={batchSupplier} onChange={(e) => setBatchSupplier(e.target.value)} placeholder="Поставщик" className="bg-[#0F1115] border-[#2A2F3A]" />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setUploadModal(false)} className="border-[#2A2F3A]">Отмена</Button><Button onClick={handleUploadFile} disabled={!selectedFile || uploading} className="bg-[#FF9900] hover:bg-[#E68A00] text-black">{uploading ? "..." : "Создать"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BashPage;
