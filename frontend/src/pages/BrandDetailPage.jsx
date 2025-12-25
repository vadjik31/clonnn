import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  ExternalLink, 
  Globe, 
  Users, 
  Clock, 
  MessageSquare,
  CheckCircle,
  XCircle,
  Reply,
  AlertTriangle,
  PauseCircle,
  RotateCcw,
  Plus,
  Undo2,
  Ban,
  Phone,
  Mail,
  Archive
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
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
import StatusBadge from "../components/StatusBadge";

const BrandDetailPage = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [undoInfo, setUndoInfo] = useState(null);
  
  // Sub-suppliers state
  const [subSuppliers, setSubSuppliers] = useState([]);
  const [subSupplierModal, setSubSupplierModal] = useState(false);

  // Modal states
  const [stageModal, setStageModal] = useState(false);
  const [outcomeModal, setOutcomeModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [problematicModal, setProblematicModal] = useState(false);
  const [onHoldModal, setOnHoldModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [infoModal, setInfoModal] = useState(false);
  const [noResponseModal, setNoResponseModal] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [repliedModal, setRepliedModal] = useState(false);

  useEffect(() => {
    fetchBrand();
    fetchUndoInfo();
    fetchSubSuppliers();
  }, [brandId]);
  
  const fetchSubSuppliers = async () => {
    try {
      const response = await api.get(`/brands/${brandId}/sub-suppliers`);
      setSubSuppliers(response.data.sub_suppliers || []);
    } catch (error) {
      console.error("Error fetching sub-suppliers:", error);
    }
  };

  const fetchBrand = async () => {
    try {
      const response = await api.get(`/brands/${brandId}`);
      setData(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки бренда");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const fetchUndoInfo = async () => {
    try {
      const response = await api.get(`/brands/${brandId}/last-action`);
      setUndoInfo(response.data);
    } catch (error) {
      setUndoInfo(null);
    }
  };

  const handleUndo = async () => {
    try {
      await api.post(`/brands/${brandId}/undo`);
      toast.success("Действие отменено");
      fetchBrand();
      fetchUndoInfo();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка отмены");
    }
  };

  const handleNoResponse = async (noteText) => {
    try {
      await api.post(`/brands/${brandId}/no-response`, { note_text: noteText });
      toast.success("Статус 'Нет ответа' установлен");
      setNoResponseModal(false);
      fetchBrand();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    }
  };

  const handleArchive = async () => {
    const reason = window.prompt("Причина архивации:");
    if (reason === null) return;
    try {
      await api.post("/super-admin/brands/bulk-archive", {
        brand_ids: [brandId],
        reason: reason || "Архивировано админом"
      });
      toast.success("Бренд отправлен в архив");
      navigate(-1);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    }
  };

  const handleBlacklist = async () => {
    const reason = window.prompt("Причина добавления в ЧС:");
    if (reason === null) return;
    try {
      await api.post("/super-admin/brands/bulk-blacklist", {
        brand_ids: [brandId],
        reason: reason || "Добавлено в ЧС админом"
      });
      toast.success("Бренд добавлен в чёрный список");
      navigate(-1);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  if (!data) return null;

  const { brand, items, notes, events, contacts = [] } = data;
  const isAssigned = brand.assigned_to_user_id === user?.id || user?.role === "admin" || user?.role === "super_admin";
  const canAct = brand.status !== "IN_POOL" && isAssigned;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="brand-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-[#94A3B8] hover:text-[#E6E6E6] p-2"
            data-testid="back-btn"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono">
              {brand.name_original}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={brand.status} />
              <span className="text-[#94A3B8] text-sm">
                Приоритет: <span className="text-[#FF9900] font-mono">{brand.priority_score}</span>
              </span>
              {brand.assigned_to_nickname && (
                <span className="text-[#94A3B8] text-sm">
                  Сёрчер: <span className="text-[#E6E6E6]">{brand.assigned_to_nickname}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setStageModal(true)}
              className="btn-secondary"
              data-testid="stage-btn"
            >
              <CheckCircle size={16} className="mr-2" />
              Этап выполнен
            </Button>
            <Button
              onClick={() => setRepliedModal(true)}
              className="btn-secondary text-blue-400"
              data-testid="replied-btn"
            >
              <Reply size={16} className="mr-2" />
              Ответил
            </Button>
            <Button
              onClick={() => setNoResponseModal(true)}
              className="btn-secondary text-gray-400"
              data-testid="no-response-btn"
            >
              <Ban size={16} className="mr-2" />
              Нет ответа
            </Button>
            <Button
              onClick={() => setOnHoldModal(true)}
              className="btn-secondary"
              data-testid="onhold-btn"
            >
              <PauseCircle size={16} className="mr-2" />
              На паузу
            </Button>
            <Button
              onClick={() => setProblematicModal(true)}
              className="btn-secondary text-yellow-400"
              data-testid="problematic-btn"
            >
              <AlertTriangle size={16} className="mr-2" />
              Проблемный
            </Button>
            <Button
              onClick={() => setReturnModal(true)}
              className="btn-secondary text-red-400"
              data-testid="return-btn"
            >
              <RotateCcw size={16} className="mr-2" />
              Очистить
            </Button>
            {/* Admin actions */}
            {(user?.role === "admin" || user?.role === "super_admin") && (
              <>
                <Button
                  onClick={handleArchive}
                  className="btn-secondary text-yellow-400"
                  data-testid="archive-btn"
                >
                  <Archive size={16} className="mr-2" />
                  В архив
                </Button>
                <Button
                  onClick={handleBlacklist}
                  className="btn-secondary text-red-500"
                  data-testid="blacklist-btn"
                >
                  <Ban size={16} className="mr-2" />
                  В ЧС
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Brand Info */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#E6E6E6] font-mono uppercase tracking-wider">
              Информация
            </h3>
            {canAct && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInfoModal(true)}
                className="text-[#94A3B8] hover:text-[#FF9900]"
                data-testid="edit-info-btn"
              >
                Изменить
              </Button>
            )}
          </div>
          
          <div className="space-y-4">
            <InfoRow 
              icon={Clock} 
              label="Этап воронки" 
              value={<StageBadge stage={brand.pipeline_stage} />} 
            />
            <InfoRow 
              icon={Globe} 
              label="Сайт" 
              value={
                brand.website_url ? (
                  <a 
                    href={brand.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#FF9900] hover:underline flex items-center gap-1"
                  >
                    {brand.website_url}
                    <ExternalLink size={12} />
                  </a>
                ) : "Не указан"
              }
            />
            <InfoRow 
              icon={CheckCircle} 
              label="Сайт найден" 
              value={brand.website_found ? "Да" : "Нет"} 
              valueColor={brand.website_found ? "text-green-400" : "text-[#94A3B8]"}
            />
            <InfoRow 
              icon={Users} 
              label="Контакты найдены" 
              value={brand.contacts_found ? "Да" : "Нет"}
              valueColor={brand.contacts_found ? "text-green-400" : "text-[#94A3B8]"}
            />
            {brand.next_action_at && (
              <InfoRow 
                icon={Clock} 
                label="След. действие" 
                value={new Date(brand.next_action_at).toLocaleDateString('ru-RU')}
                valueColor={new Date(brand.next_action_at) < new Date() ? "text-red-400" : "text-[#E6E6E6]"}
              />
            )}
            {brand.on_hold_reason && (
              <InfoRow 
                icon={PauseCircle} 
                label="Причина паузы" 
                value={brand.on_hold_reason}
              />
            )}
          </div>
        </div>

        {/* Items */}
        <div className="lg:col-span-2 bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider">
            Товары ({items.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="flex gap-3 p-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px]"
                data-testid={`item-${item.id}`}
              >
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.title || "Product"} 
                    className="w-16 h-16 object-cover rounded-[2px] flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-[#1A1D24] rounded-[2px] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#475569] text-xs">Нет фото</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E6E6E6] line-clamp-2">{item.title || "Без названия"}</p>
                  {item.asin && (
                    <p className="text-xs font-mono text-[#FF9900] mt-1">{item.asin}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notes & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-2">
              <Phone size={18} className="text-green-400" />
              Контакты ({contacts?.length || 0})
            </h3>
            {canAct && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setContactModal(true)}
                className="text-green-400 hover:text-green-300"
                data-testid="add-contact-btn"
              >
                <Plus size={16} className="mr-1" />
                Добавить
              </Button>
            )}
          </div>
          
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {!contacts || contacts.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет контактов</p>
            ) : (
              contacts.map((contact) => (
                <div 
                  key={contact.id} 
                  className="p-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ContactIcon type={contact.contact_type} />
                      <span className="text-sm font-medium text-[#E6E6E6]">{contact.value}</span>
                      {contact.is_primary && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-900/30 text-green-400 rounded">★</span>
                      )}
                    </div>
                    <span className="text-xs text-[#94A3B8] capitalize">{contact.contact_type}</span>
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-[#94A3B8] mt-1">{contact.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sub-Suppliers Section */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-2">
              <Users size={18} className="text-[#FF9900]" />
              Под-сапплаеры ({subSuppliers.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSubSupplierModal(true)}
              className="text-[#94A3B8] hover:text-[#FF9900]"
            >
              <Plus size={16} className="mr-1" />
              Добавить
            </Button>
          </div>
          
          <div className="space-y-2">
            {subSuppliers.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет под-сапплаеров</p>
            ) : (
              subSuppliers.map((ss) => (
                <div 
                  key={ss.id}
                  onClick={() => navigate(`/sub-suppliers/${ss.id}`)}
                  className="p-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px] cursor-pointer hover:border-[#FF9900] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-[#E6E6E6]">{ss.name}</span>
                      {ss.website_url && (
                        <a 
                          href={ss.website_url.startsWith('http') ? ss.website_url : `https://${ss.website_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-[#FF9900] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ss.website_url}
                        </a>
                      )}
                    </div>
                    <StatusBadge status={ss.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#94A3B8]">
                    <span>Этап: {ss.pipeline_stage}</span>
                    {ss.contact_email && <span>📧 {ss.contact_email}</span>}
                    {ss.next_action_at && (
                      <span className={new Date(ss.next_action_at) <= new Date() ? "text-amber-400" : ""}>
                        📅 {new Date(ss.next_action_at).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-2">
              <MessageSquare size={18} className="text-[#FF9900]" />
              Заметки
            </h3>
            {canAct && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNoteModal(true)}
                className="text-[#94A3B8] hover:text-[#FF9900]"
                data-testid="add-note-btn"
              >
                <Plus size={16} className="mr-1" />
                Добавить
              </Button>
            )}
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет заметок</p>
            ) : (
              notes.map((note) => (
                <div 
                  key={note.id} 
                  className="p-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px]"
                  data-testid={`note-${note.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#E6E6E6]">{note.user_nickname}</span>
                    <span className="text-xs text-[#94A3B8]">
                      {new Date(note.created_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-sm text-[#94A3B8]">{note.note_text}</p>
                  {note.note_type !== "general" && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-[#1A1D24] text-[#94A3B8] rounded-full">
                      {getNoteTypeLabel(note.note_type)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Events Timeline */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
            <Clock size={18} className="text-[#FF9900]" />
            История
          </h3>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет событий</p>
            ) : (
              events.map((event) => (
                <div 
                  key={event.id} 
                  className="flex gap-3 py-2 border-l-2 border-[#2A2F3A] pl-4"
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex-1">
                    <p className="text-sm text-[#E6E6E6]">{getEventLabel(event.event_type)}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {event.user_nickname} • {new Date(event.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <StageModal 
        open={stageModal} 
        onClose={() => setStageModal(false)} 
        brandId={brandId}
        onSuccess={fetchBrand}
      />
      <ReturnModal 
        open={returnModal} 
        onClose={() => setReturnModal(false)} 
        brandId={brandId}
        onSuccess={() => { fetchBrand(); navigate(-1); }}
      />
      <ProblematicModal 
        open={problematicModal} 
        onClose={() => setProblematicModal(false)} 
        brandId={brandId}
        onSuccess={fetchBrand}
      />
      <OnHoldModal 
        open={onHoldModal} 
        onClose={() => setOnHoldModal(false)} 
        brandId={brandId}
        onSuccess={fetchBrand}
      />
      <NoteModal 
        open={noteModal} 
        onClose={() => setNoteModal(false)} 
        brandId={brandId}
        onSuccess={fetchBrand}
      />
      <InfoModal 
        open={infoModal} 
        onClose={() => setInfoModal(false)} 
        brand={brand}
        onSuccess={fetchBrand}
      />
      <NoResponseModal
        open={noResponseModal}
        onClose={() => setNoResponseModal(false)}
        onSubmit={handleNoResponse}
      />
      <ContactModal
        open={contactModal}
        onClose={() => setContactModal(false)}
        brandId={brandId}
        onSuccess={fetchBrand}
      />
      <RepliedModal
        open={repliedModal}
        onClose={() => setRepliedModal(false)}
        brandId={brandId}
        onSuccess={fetchBrand}
      />
    </div>
  );
};

// Helper Components
const InfoRow = ({ icon: Icon, label, value, valueColor = "text-[#E6E6E6]" }) => (
  <div className="flex items-start gap-3">
    <Icon size={16} className="text-[#94A3B8] mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-xs text-[#94A3B8] uppercase tracking-wider">{label}</p>
      <p className={`text-sm ${valueColor} mt-0.5`}>{value}</p>
    </div>
  </div>
);

const ContactIcon = ({ type }) => {
  const iconMap = {
    email: <Mail size={14} className="text-blue-400" />,
    phone: <Phone size={14} className="text-green-400" />,
    linkedin: <span className="text-blue-500 text-xs font-bold">in</span>,
    instagram: <span className="text-pink-400 text-xs">IG</span>,
    facebook: <span className="text-blue-600 text-xs font-bold">f</span>,
    website_form: <Globe size={14} className="text-[#FF9900]" />,
    other: <MessageSquare size={14} className="text-[#94A3B8]" />,
  };
  return iconMap[type] || iconMap.other;
};

const StageBadge = ({ stage }) => {
  const stageConfig = {
    REVIEW: { label: "🔍 Изучение", color: "bg-gray-800 text-gray-400 border-gray-700" },
    EMAIL_1_DONE: { label: "1️⃣ Письмо 1", color: "bg-blue-900/20 text-blue-400 border-blue-800" },
    EMAIL_2_DONE: { label: "2️⃣ Письмо 2", color: "bg-indigo-900/20 text-indigo-400 border-indigo-800" },
    MULTI_CHANNEL_DONE: { label: "📱 Соцсети", color: "bg-purple-900/20 text-purple-400 border-purple-800" },
    CALL_OR_PUSH_RECOMMENDED: { label: "📞 Звонок", color: "bg-orange-900/20 text-orange-400 border-orange-800" },
    CLOSED: { label: "✅ Закрыт", color: "bg-green-900/20 text-green-400 border-green-800" },
  };
  const config = stageConfig[stage] || { label: stage, color: "bg-gray-800 text-gray-400" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
};

const getNoteTypeLabel = (type) => {
  const labels = {
    stage_done: "Этап",
    return_to_pool: "Возврат",
    problematic: "Проблема",
    general: "Общая",
    admin_note: "От админа",
    on_hold: "Пауза",
    outcome: "Исход"
  };
  return labels[type] || type;
};

const getEventLabel = (type) => {
  const labels = {
    user_login: "Вход в систему",
    user_logout: "Выход из системы",
    brands_assigned: "Получены бренды",
    status_changed: "Статус изменён",
    stage_completed: "Этап завершён",
    returned_to_pool: "Возвращён в пул",
    marked_no_response: "Нет ответа",
    undo_action: "Действие отменено",
    outcome_set: "Исход установлен",
    marked_problematic: "Помечен как проблемный",
    marked_on_hold: "Поставлен на паузу",
    reassigned: "Переназначен",
    admin_released: "Освобождён админом",
    heartbeat: "Активность",
    import_completed: "Импорт завершён"
  };
  return labels[type] || type;
};

// Modals
const StageModal = ({ open, onClose, brandId, onSuccess }) => {
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const stages = [
    { value: "EMAIL_1_DONE", label: "1️⃣ Письмо 1" },
    { value: "EMAIL_2_DONE", label: "2️⃣ Письмо 2" },
    { value: "MULTI_CHANNEL_DONE", label: "📱 Соцсети" },
    { value: "CALL_OR_PUSH_RECOMMENDED", label: "📞 Звонок" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stage || !note.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/stage`, { stage, note_text: note });
      toast.success("Этап завершён");
      onSuccess();
      onClose();
      setStage("");
      setNote("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Этап выполнен</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Этап</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="stage-select">
                <SelectValue placeholder="Выберите этап" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {stages.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Опишите результат..."
              required
              data-testid="stage-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="submit-stage">
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const OutcomeModal = ({ open, onClose, brandId, onSuccess }) => {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("");
  const [contactDate, setContactDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const outcomes = [
    { value: "OUTCOME_APPROVED", label: "Одобрил", icon: CheckCircle, color: "text-green-400" },
    { value: "OUTCOME_DECLINED", label: "Отказал", icon: XCircle, color: "text-red-400" },
    { value: "OUTCOME_REPLIED", label: "Ответил", icon: Reply, color: "text-blue-400" },
  ];

  const channels = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Телефон" },
    { value: "social_media", label: "Соцсети" },
    { value: "website_form", label: "Форма на сайте" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "other", label: "Другое" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!outcome || !note.trim() || !channel || !contactDate) {
      toast.error("Заполните все обязательные поля");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/outcome`, { 
        outcome, 
        note_text: note,
        channel,
        contact_date: contactDate
      });
      toast.success("Исход установлен");
      onSuccess();
      onClose();
      setOutcome("");
      setNote("");
      setChannel("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Установить исход</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Исход</Label>
            <div className="grid grid-cols-3 gap-2">
              {outcomes.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  className={`p-3 rounded-[2px] border transition-all flex flex-col items-center gap-2 ${
                    outcome === o.value 
                      ? "border-[#FF9900] bg-[#FF9900]/10" 
                      : "border-[#2A2F3A] hover:border-[#FF9900]/50"
                  }`}
                  data-testid={`outcome-${o.value}`}
                >
                  <o.icon size={24} className={o.color} />
                  <span className="text-sm">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Канал связи *</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="channel-select">
                  <SelectValue placeholder="Выберите канал" />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  {channels.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Дата контакта *</Label>
              <Input
                type="date"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
                className="bg-[#0F1115] border-[#2A2F3A]"
                required
                data-testid="contact-date"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Детали исхода..."
              required
              data-testid="outcome-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="submit-outcome">
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ReturnModal = ({ open, onClose, brandId, onSuccess }) => {
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const reasons = [
    { value: "invalid_brand", label: "Не является брендом" },
    { value: "duplicate", label: "Дубликат другого бренда" },
    { value: "wrong_category", label: "Не подходит по категории" },
    { value: "no_contacts", label: "Невозможно найти контакты" },
    { value: "site_down", label: "Сайт недоступен" },
    { value: "language_barrier", label: "Языковой барьер" },
    { value: "other", label: "Другая причина" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reasonCode || !note.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/return`, { reason_code: reasonCode, note_text: note });
      toast.success("Бренд возвращён в пул");
      onSuccess();
      onClose();
      setReasonCode("");
      setNote("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-red-400">Вернуть в пул</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина *</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="return-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {reasons.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Подробное объяснение..."
              required
              data-testid="return-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white" data-testid="submit-return">
              {loading ? "Возврат..." : "Вернуть в пул"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ProblematicModal = ({ open, onClose, brandId, onSuccess }) => {
  const [reasonCode, setReasonCode] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const reasons = [
    { value: "legal_issues", label: "Юридические проблемы" },
    { value: "aggressive_response", label: "Агрессивный/негативный ответ" },
    { value: "spam_complaint", label: "Жалоба на спам" },
    { value: "technical_issues", label: "Технические проблемы" },
    { value: "other", label: "Другое" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reasonCode || !note.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/problematic`, { 
        reason_code: reasonCode, 
        note_text: note,
        review_date: reviewDate || null
      });
      toast.success("Бренд помечен как проблемный");
      onSuccess();
      onClose();
      setReasonCode("");
      setReviewDate("");
      setNote("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-yellow-400">Проблемный бренд</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина *</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="problematic-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {reasons.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Дата пересмотра (опционально)</Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              data-testid="problematic-review-date"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Подробное описание проблемы..."
              required
              data-testid="problematic-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold" data-testid="submit-problematic">
              {loading ? "Сохранение..." : "Пометить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const OnHoldModal = ({ open, onClose, brandId, onSuccess }) => {
  const [reason, setReason] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || !reviewDate || !note.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    
    // Валидация даты
    const selectedDate = new Date(reviewDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    
    if (selectedDate < today) {
      toast.error("Дата не может быть в прошлом");
      return;
    }
    if (selectedDate > maxDate) {
      toast.error("Дата не может быть больше чем через год");
      return;
    }
    
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/on-hold`, { reason, review_date: reviewDate, note_text: note });
      toast.success("Бренд поставлен на паузу");
      onSuccess();
      onClose();
      setReason("");
      setReviewDate("");
      setNote("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">На паузу</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="Сайт лежит, редизайн..."
              required
              data-testid="onhold-reason"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Дата пересмотра (когда вернуться)</Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              className="bg-[#0F1115] border-[#2A2F3A]"
              required
              data-testid="onhold-date"
            />
            <p className="text-xs text-[#475569]">Формат: ДД.ММ.ГГГГ (макс. 1 год вперёд)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Подробности..."
              required
              data-testid="onhold-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="submit-onhold">
              {loading ? "Сохранение..." : "Поставить на паузу"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const NoteModal = ({ open, onClose, brandId, onSuccess }) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error("Введите текст заметки");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/note`, { note_text: note });
      toast.success("Заметка добавлена");
      onSuccess();
      onClose();
      setNote("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Новая заметка</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Текст заметки</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[120px]"
              placeholder="Введите заметку..."
              required
              data-testid="note-text"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="submit-note">
              {loading ? "Сохранение..." : "Добавить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const InfoModal = ({ open, onClose, brand, onSuccess }) => {
  const [websiteUrl, setWebsiteUrl] = useState(brand?.website_url || "");
  const [websiteFound, setWebsiteFound] = useState(brand?.website_found || false);
  const [contactsFound, setContactsFound] = useState(brand?.contacts_found || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (brand) {
      setWebsiteUrl(brand.website_url || "");
      setWebsiteFound(brand.website_found || false);
      setContactsFound(brand.contacts_found || false);
    }
  }, [brand]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/brands/${brand.id}/info`, {
        website_url: websiteUrl || null,
        website_found: websiteFound,
        contacts_found: contactsFound
      });
      toast.success("Информация обновлена");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Редактировать информацию</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">URL сайта</Label>
            <Input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="example.com или https://..."
              data-testid="website-url"
            />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="websiteFound"
              checked={websiteFound}
              onCheckedChange={setWebsiteFound}
              className="border-[#2A2F3A] data-[state=checked]:bg-[#FF9900]"
              data-testid="website-found"
            />
            <Label htmlFor="websiteFound" className="text-[#E6E6E6] cursor-pointer">
              Официальный сайт найден
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="contactsFound"
              checked={contactsFound}
              onCheckedChange={setContactsFound}
              className="border-[#2A2F3A] data-[state=checked]:bg-[#FF9900]"
              data-testid="contacts-found"
            />
            <Label htmlFor="contactsFound" className="text-[#E6E6E6] cursor-pointer">
              Контакты найдены
            </Label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="submit-info">
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const NoResponseModal = ({ open, onClose, onSubmit }) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error("Введите заметку");
      return;
    }
    setLoading(true);
    await onSubmit(note);
    setLoading(false);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-gray-400">Нет ответа</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            Используйте этот статус, когда связались с брендом, но не получили ответа.
            Это отличается от &quot;Отказал&quot; или &quot;Ответил&quot;.
          </p>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Описание попыток связаться..."
              required
              data-testid="no-response-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-secondary" data-testid="submit-no-response">
              {loading ? "Сохранение..." : "Пометить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ContactModal = ({ open, onClose, brandId, onSuccess }) => {
  const [contactType, setContactType] = useState("email");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);

  const contactTypes = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Телефон" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "website_form", label: "Форма на сайте" },
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "other", label: "Другое" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim()) {
      toast.error("Введите контакт");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/contacts`, {
        contacts: [{
          contact_type: contactType,
          value: value.trim(),
          is_primary: isPrimary,
          notes: notes.trim() || null
        }]
      });
      toast.success("Контакт добавлен");
      setValue("");
      setNotes("");
      setIsPrimary(false);
      onClose();
      onSuccess();
    } catch (error) {
      toast.error("Ошибка добавления контакта");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-green-400">
            Добавить контакт
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Тип контакта</Label>
            <Select value={contactType} onValueChange={setContactType}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {contactTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Контакт</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder={contactType === "email" ? "brand@example.com" : contactType === "phone" ? "+1234567890" : "Значение..."}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Примечание (опционально)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="Кто это, откуда взяли..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Checkbox 
              id="primary" 
              checked={isPrimary} 
              onCheckedChange={setIsPrimary}
              className="border-[#2A2F3A]"
            />
            <Label htmlFor="primary" className="text-[#94A3B8] text-sm cursor-pointer">
              Основной контакт
            </Label>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? "Добавление..." : "Добавить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RepliedModal = ({ open, onClose, brandId, onSuccess }) => {
  const [subStatus, setSubStatus] = useState("");
  const [note, setNote] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: "need_action", label: "Нужно действие с нашей стороны", description: "Бренд попросил что-то сделать (доп. инфо, предложение и т.д.)" },
    { value: "need_searcher_attention", label: "Надо внимание сёрчера!", description: "Требуется внимание сёрчера для дальнейших действий" },
    { value: "waiting", label: "Ожидаем от них", description: "Мы сделали свою часть, ждём их решения" },
    { value: "approved", label: "Одобрили сотрудничество", description: "Успех! Бренд согласен работать" },
    { value: "declined", label: "Отказали", description: "Бренд отказался от сотрудничества" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subStatus) {
      toast.error("Выберите подстатус");
      return;
    }
    if (!note.trim()) {
      toast.error("Введите заметку");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/brands/${brandId}/replied`, {
        sub_status: subStatus,
        note_text: note.trim(),
        next_action_date: nextActionDate || null
      });
      toast.success("Статус обновлён");
      setSubStatus("");
      setNote("");
      setNextActionDate("");
      onClose();
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6] max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider text-blue-400">
            Бренд ответил
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            Выберите что именно произошло после ответа бренда
          </p>
          
          <div className="space-y-2">
            {statusOptions.map(opt => (
              <label
                key={opt.value}
                className={`block p-3 rounded-[2px] border cursor-pointer transition-all ${
                  subStatus === opt.value 
                    ? "border-blue-500 bg-blue-900/20" 
                    : "border-[#2A2F3A] hover:border-[#FF9900]/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="subStatus"
                    value={opt.value}
                    checked={subStatus === opt.value}
                    onChange={(e) => setSubStatus(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-[#E6E6E6]">{opt.label}</div>
                    <div className="text-xs text-[#94A3B8]">{opt.description}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
          
          {(subStatus === "need_action" || subStatus === "need_searcher_attention" || subStatus === "waiting") && (
            <div className="space-y-2">
              <Label className="text-[#94A3B8]">Когда вернуться (опционально)</Label>
              <Input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Подробности (обязательно)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Что именно ответил бренд, какие следующие шаги..."
              required
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !subStatus} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BrandDetailPage;
