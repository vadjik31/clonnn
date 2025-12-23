import { useState, useEffect, useRef } from "react";
import { api } from "../App";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Button } from "../components/ui/button";

const ImportPage = () => {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchImports();
  }, []);

  const fetchImports = async () => {
    try {
      const response = await api.get("/import/history");
      setImports(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки истории импорта");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Только Excel файлы (.xlsx, .xls)");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setLastResult(response.data.stats);
      toast.success("Импорт завершён!");
      fetchImports();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка импорта");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="import-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider">
          Импорт Excel
        </h1>
        <p className="text-[#94A3B8] mt-1">Загрузка брендов из файлов Keepa</p>
      </div>

      {/* Upload Area */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-8">
        <div className="flex flex-col items-center justify-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls"
            className="hidden"
            data-testid="file-input"
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`w-full max-w-md p-8 border-2 border-dashed rounded-[2px] cursor-pointer transition-all ${
              uploading 
                ? "border-[#FF9900] bg-[#FF9900]/5" 
                : "border-[#2A2F3A] hover:border-[#FF9900]/50 hover:bg-[#1A1D24]"
            }`}
            data-testid="upload-area"
          >
            <div className="flex flex-col items-center text-center">
              {uploading ? (
                <>
                  <div className="w-12 h-12 border-4 border-[#FF9900] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-[#E6E6E6] font-medium">Обработка файла...</p>
                </>
              ) : (
                <>
                  <Upload size={48} className="text-[#94A3B8] mb-4" />
                  <p className="text-[#E6E6E6] font-medium mb-2">Перетащите файл или нажмите для выбора</p>
                  <p className="text-[#94A3B8] text-sm">Поддерживаются .xlsx и .xls файлы</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[#94A3B8] text-sm mb-2">Требуемые колонки:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-[#FF9900]/10 text-[#FF9900] rounded-[2px] text-sm font-mono">Brand</span>
              <span className="px-3 py-1 bg-[#2A2F3A] text-[#94A3B8] rounded-[2px] text-sm font-mono">ASIN</span>
              <span className="px-3 py-1 bg-[#2A2F3A] text-[#94A3B8] rounded-[2px] text-sm font-mono">Title</span>
              <span className="px-3 py-1 bg-[#2A2F3A] text-[#94A3B8] rounded-[2px] text-sm font-mono">Image</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Import Result */}
      {lastResult && (
        <div className="bg-[#13161B] border border-green-800 rounded-[2px] p-6" data-testid="last-result">
          <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            <CheckCircle size={20} />
            Результат последнего импорта
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Всего строк" value={lastResult.total_rows} />
            <StatCard label="Уникальных брендов" value={lastResult.unique_brands} />
            <StatCard label="Новых брендов" value={lastResult.new_brands} color="text-green-400" />
            <StatCard label="Дубликатов" value={lastResult.duplicate_brands} color="text-yellow-400" />
            <StatCard label="Товаров добавлено" value={lastResult.items_added} />
          </div>
          {lastResult.missing_columns?.length > 0 && (
            <div className="mt-4 flex items-start gap-2 text-yellow-400">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">Отсутствующие колонки: {lastResult.missing_columns.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {/* Import History */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
        <div className="p-4 border-b border-[#2A2F3A]">
          <h3 className="text-lg font-semibold text-[#E6E6E6] flex items-center gap-2">
            <Clock size={18} className="text-[#FF9900]" />
            История импортов
          </h3>
        </div>
        
        <table className="w-full" data-testid="imports-table">
          <thead>
            <tr className="table-header">
              <th className="py-3 px-4 text-left">Файл</th>
              <th className="py-3 px-4 text-left">Загрузил</th>
              <th className="py-3 px-4 text-center">Новых</th>
              <th className="py-3 px-4 text-center">Дублей</th>
              <th className="py-3 px-4 text-center">Товаров</th>
              <th className="py-3 px-4 text-left">Дата</th>
            </tr>
          </thead>
          <tbody>
            {imports.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                  Нет импортов
                </td>
              </tr>
            ) : (
              imports.map((imp) => (
                <tr key={imp.id} className="table-row" data-testid={`import-row-${imp.id}`}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-green-400" />
                      <span className="font-mono text-sm">{imp.file_name}</span>
                    </div>
                  </td>
                  <td className="table-cell">{imp.imported_by_nickname}</td>
                  <td className="table-cell text-center font-mono text-green-400">{imp.stats?.new_brands || 0}</td>
                  <td className="table-cell text-center font-mono text-yellow-400">{imp.stats?.duplicate_brands || 0}</td>
                  <td className="table-cell text-center font-mono">{imp.stats?.items_added || 0}</td>
                  <td className="table-cell text-[#94A3B8] text-sm">
                    {new Date(imp.imported_at).toLocaleString('ru-RU')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color = "text-[#E6E6E6]" }) => (
  <div className="text-center">
    <p className="text-[#94A3B8] text-sm">{label}</p>
    <p className={`text-2xl font-mono font-bold mt-1 ${color}`}>{value}</p>
  </div>
);

export default ImportPage;
