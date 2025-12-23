import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../App";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import StatusBadge from "../components/StatusBadge";

const ProblematicPage = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await api.get("/brands?status=PROBLEMATIC");
      setBrands(response.data.brands);
    } catch (error) {
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="problematic-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
          <AlertTriangle className="text-yellow-400" />
          Проблемные бренды
        </h1>
        <p className="text-[#94A3B8] mt-1">Бренды, требующие особого внимания</p>
      </div>

      {/* Table */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] overflow-hidden">
        <table className="w-full" data-testid="problematic-table">
          <thead>
            <tr className="table-header">
              <th className="py-3 px-4 text-left">Бренд</th>
              <th className="py-3 px-4 text-center">Приоритет</th>
              <th className="py-3 px-4 text-left">Статус</th>
              <th className="py-3 px-4 text-left">Этап</th>
              <th className="py-3 px-4 text-left">Последняя активность</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                  Загрузка...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                  <div className="space-y-2">
                    <AlertTriangle className="mx-auto text-green-400" size={32} />
                    <p>Нет проблемных брендов</p>
                  </div>
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr 
                  key={brand.id} 
                  className="table-row cursor-pointer"
                  onClick={() => navigate(`/brands/${brand.id}`)}
                  data-testid={`brand-row-${brand.id}`}
                >
                  <td className="table-cell font-medium">{brand.name_original}</td>
                  <td className="table-cell text-center font-mono text-[#FF9900]">{brand.priority_score}</td>
                  <td className="table-cell">
                    <StatusBadge status={brand.status} />
                  </td>
                  <td className="table-cell">
                    <StageBadge stage={brand.pipeline_stage} />
                  </td>
                  <td className="table-cell text-[#94A3B8] text-sm">
                    {brand.last_action_at 
                      ? new Date(brand.last_action_at).toLocaleString('ru-RU')
                      : "—"}
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

const StageBadge = ({ stage }) => {
  const stageConfig = {
    REVIEW: { label: "Рассмотрение", color: "bg-gray-800 text-gray-400 border-gray-700" },
    EMAIL_1_DONE: { label: "Письмо 1", color: "bg-blue-900/20 text-blue-400 border-blue-800" },
    EMAIL_2_DONE: { label: "Письмо 2", color: "bg-indigo-900/20 text-indigo-400 border-indigo-800" },
    MULTI_CHANNEL_DONE: { label: "Мультиканал", color: "bg-purple-900/20 text-purple-400 border-purple-800" },
    CALL_OR_PUSH_RECOMMENDED: { label: "Звонок/Пуш", color: "bg-orange-900/20 text-orange-400 border-orange-800" },
    CLOSED: { label: "Закрыт", color: "bg-green-900/20 text-green-400 border-green-800" },
  };
  const config = stageConfig[stage] || { label: stage, color: "bg-gray-800 text-gray-400" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
};

export default ProblematicPage;
