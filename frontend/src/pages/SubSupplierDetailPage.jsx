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
  Reply,
  PauseCircle,
  Plus,
  Phone,
  Mail,
  Package
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import StatusBadge from "../components/StatusBadge";

const SubSupplierDetailPage = () => {
  const { subSupplierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [stageModal, setStageModal] = useState(false);
  const [repliedModal, setRepliedModal] = useState(false);
  const [onHoldModal, setOnHoldModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);

  useEffect(() => {
    fetchSubSupplier();
  }, [subSupplierId]);

  const fetchSubSupplier = async () => {
    try {
      const response = await api.get(`/sub-suppliers/${subSupplierId}`);
      setData(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки под-сапплаера");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF9900]"></div>
      </div>
    );
  }

  if (!data) return null;

  const { sub_supplier: ss, items, notes, contacts } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/brands/${ss.parent_brand_id}`)}
            className="text-[#94A3B8] hover:text-white"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#FF9900] bg-[#FF9900]/10 px-2 py-0.5 rounded">ПОД-САППЛАЕР</span>
              <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider">
                {ss.name}
              </h1>
            </div>
            <p className="text-sm text-[#94A3B8] mt-1">
              Бренд: <span 
                className="text-[#FF9900] cursor-pointer hover:underline"
                onClick={() => navigate(`/brands/${ss.parent_brand_id}`)}
              >
                {ss.parent_brand_name}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={ss.status} />
          <span className="px-2 py-1 text-xs bg-[#1A1D24] text-[#94A3B8] rounded font-mono">
            {ss.pipeline_stage}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setStageModal(true)}
          className="btn-secondary"
        >
          <CheckCircle size={16} className="mr-2" />
          Этап выполнен
        </Button>
        <Button
          onClick={() => setRepliedModal(true)}
          className="btn-secondary text-blue-400"
        >
          <Reply size={16} className="mr-2" />
          Ответил
        </Button>
        <Button
          onClick={() => setOnHoldModal(true)}
          className="btn-secondary text-yellow-400"
        >
          <PauseCircle size={16} className="mr-2" />
          На паузу
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider">
            Информация
          </h3>
          <div className="space-y-4">
            <InfoRow icon={Globe} label="Сайт" value={ss.website_url || "—"} />
            <InfoRow icon={Mail} label="Email" value={ss.contact_email || "—"} />
            <InfoRow icon={Phone} label="Телефон" value={ss.contact_phone || "—"} />
            <InfoRow icon={Package} label="Товаров" value={ss.items_count} />
            <InfoRow icon={Clock} label="Приоритет" value={ss.priority_score} valueColor="text-[#FF9900]" />
            {ss.next_action_at && (
              <InfoRow 
                icon={Clock} 
                label="След. действие" 
                value={new Date(ss.next_action_at).toLocaleDateString('ru-RU')}
                valueColor={new Date(ss.next_action_at) <= new Date() ? "text-amber-400" : "text-[#94A3B8]"}
              />
            )}
          </div>
        </div>

        {/* Items from Parent Brand */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider flex items-center gap-2">
            <Package size={18} className="text-[#FF9900]" />
            Товары бренда ({ss.items_count})
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {items?.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет товаров</p>
            ) : (
              items?.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px]">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-[#FF9900]">{item.asin || "—"}</p>
                    <p className="text-xs text-[#94A3B8] truncate">{item.title || "Без названия"}</p>
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
              Заметки ({notes?.length || 0})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNoteModal(true)}
              className="text-[#94A3B8] hover:text-[#FF9900]"
            >
              <Plus size={16} className="mr-1" />
              Добавить
            </Button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {!notes || notes.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4">Нет заметок</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="p-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#E6E6E6]">{note.user_nickname}</span>
                    <span className="text-xs text-[#94A3B8]">
                      {new Date(note.created_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-sm text-[#94A3B8]">{note.note_text}</p>
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
        subSupplierId={subSupplierId}
        currentStage={ss.pipeline_stage}
        onSuccess={fetchSubSupplier}
      />
      <RepliedModal
        open={repliedModal}
        onClose={() => setRepliedModal(false)}
        subSupplierId={subSupplierId}
        onSuccess={fetchSubSupplier}
      />
      <OnHoldModal
        open={onHoldModal}
        onClose={() => setOnHoldModal(false)}
        subSupplierId={subSupplierId}
        onSuccess={fetchSubSupplier}
      />
      <NoteModal
        open={noteModal}
        onClose={() => setNoteModal(false)}
        subSupplierId={subSupplierId}
        onSuccess={fetchSubSupplier}
      />
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value, valueColor = "text-[#E6E6E6]" }) => (
  <div className="flex items-start gap-3">
    <Icon size={16} className="text-[#94A3B8] mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-xs text-[#94A3B8] uppercase tracking-wider">{label}</p>
      <p className={`text-sm ${valueColor} mt-0.5`}>{value}</p>
    </div>
  </div>
);

// Stage Modal for Sub-Supplier
const StageModal = ({ open, onClose, subSupplierId, currentStage, onSuccess }) => {
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const stages = [
    { value: "review", label: "Изучение" },
    { value: "letter_1", label: "Письмо 1" },
    { value: "letter_2", label: "Письмо 2" },
    { value: "letter_3", label: "Письмо 3" },
    { value: "call", label: "Звонок" },
    { value: "negotiation", label: "Переговоры" },
    { value: "completed", label: "Завершено" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stage) return;
    setLoading(true);
    try {
      await api.post(`/sub-suppliers/${subSupplierId}/stage`, {
        new_stage: stage,
        note_text: note
      });
      toast.success("Этап обновлён");
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
      <DialogContent className="bg-[#13161B] border border-[#2A2F3A] text-[#E6E6E6] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Этап выполнен</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Новый этап</Label>
            <div className="grid grid-cols-2 gap-2">
              {stages.map((s) => (
                <Button
                  key={s.value}
                  type="button"
                  variant={stage === s.value ? "default" : "outline"}
                  onClick={() => setStage(s.value)}
                  className={stage === s.value ? "bg-[#FF9900] text-black" : "border-[#2A2F3A]"}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Заметка</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="Что было сделано..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={loading || !stage} className="bg-[#FF9900] text-black">
              {loading ? "..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Replied Modal for Sub-Supplier
const RepliedModal = ({ open, onClose, subSupplierId, onSuccess }) => {
  const [subStatus, setSubStatus] = useState("");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: "need_action", label: "Нужно действие" },
    { value: "need_searcher_attention", label: "Внимание сёрчера!" },
    { value: "waiting", label: "Ожидаем от них" },
    { value: "approved", label: "Одобрили" },
    { value: "declined", label: "Отказали" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subStatus || !note.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/sub-suppliers/${subSupplierId}/replied`, {
        sub_status: subStatus,
        note_text: note,
        next_action_date: nextDate || null
      });
      toast.success("Статус обновлён");
      onSuccess();
      onClose();
      setSubStatus("");
      setNote("");
      setNextDate("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#13161B] border border-[#2A2F3A] text-[#E6E6E6] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Под-сапплаер ответил</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Результат</Label>
            <div className="space-y-2">
              {statusOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 p-2 border border-[#2A2F3A] rounded cursor-pointer hover:border-[#FF9900]">
                  <input
                    type="radio"
                    name="subStatus"
                    value={opt.value}
                    checked={subStatus === opt.value}
                    onChange={(e) => setSubStatus(e.target.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          {(subStatus === "need_action" || subStatus === "need_searcher_attention" || subStatus === "waiting") && (
            <div className="space-y-2">
              <Label>Когда вернуться</Label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="bg-[#0F1115] border-[#2A2F3A]"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Заметка *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="Детали разговора..."
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={loading || !subStatus} className="bg-blue-600">
              {loading ? "..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// On Hold Modal for Sub-Supplier
const OnHoldModal = ({ open, onClose, subSupplierId, onSuccess }) => {
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
    setLoading(true);
    try {
      await api.post(`/sub-suppliers/${subSupplierId}/on-hold`, {
        reason,
        review_date: reviewDate,
        note_text: note
      });
      toast.success("На паузе");
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
      <DialogContent className="bg-[#13161B] border border-[#2A2F3A] text-[#E6E6E6] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">На паузу</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Причина</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="Почему на паузе..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Дата пересмотра</Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Заметка</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              placeholder="Дополнительно..."
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={loading} className="bg-yellow-600">
              {loading ? "..." : "На паузу"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Note Modal for Sub-Supplier
const NoteModal = ({ open, onClose, subSupplierId, onSuccess }) => {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    try {
      await api.post(`/sub-suppliers/${subSupplierId}/note`, {
        note_text: note,
        note_type: "general"
      });
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
      <DialogContent className="bg-[#13161B] border border-[#2A2F3A] text-[#E6E6E6] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-wider">Добавить заметку</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-[#0F1115] border-[#2A2F3A] min-h-[120px]"
            placeholder="Заметка..."
            required
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={loading} className="bg-[#FF9900] text-black">
              {loading ? "..." : "Добавить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubSupplierDetailPage;
