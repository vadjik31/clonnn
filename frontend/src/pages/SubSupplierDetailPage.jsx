import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, useAuth } from "../App";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Globe, 

  Clock, 
  MessageSquare,
  CheckCircle,

  Reply,
  AlertTriangle,
  PauseCircle,
  RotateCcw,
  Plus,
  Phone,
  Mail,
  Package,
  Ban
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
  const [noResponseModal, setNoResponseModal] = useState(false);
  const [problematicModal, setProblematicModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);

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

  const isAssigned = ss.assigned_to_user_id === user?.id || user?.role === "admin" || user?.role === "super_admin";
  const canAct = ss.status !== "IN_POOL" && isAssigned;

  const handleNoResponse = async (noteText) => {
    try {
      await api.post(`/sub-suppliers/${subSupplierId}/no-response`, { note_text: noteText });
      toast.success("Статус 'Нет ответа' установлен");
      setNoResponseModal(false);
      fetchSubSupplier();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка");
    }
  };


  return (
    <div className="space-y-6 animate-fade-in" data-testid="sub-supplier-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/brands/${ss.parent_brand_id}`)}
            className="text-[#94A3B8] hover:text-[#E6E6E6] p-2"
            data-testid="back-btn"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#FF9900] bg-[#FF9900]/10 px-2 py-0.5 rounded">ПОД-САППЛАЕР</span>
              <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono">
                {ss.name}
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={ss.status} />
              <span className="text-[#94A3B8] text-sm">
                Приоритет: <span className="text-[#FF9900] font-mono">{ss.priority_score}</span>
              </span>
              {ss.assigned_to_nickname && (
                <span className="text-[#94A3B8] text-sm">
                  Сёрчер: <span className="text-[#E6E6E6]">{ss.assigned_to_nickname}</span>
                </span>
              )}
              <span className="text-[#94A3B8] text-sm">
                Бренд: <span 
                  className="text-[#FF9900] cursor-pointer hover:underline"
                  onClick={() => navigate(`/brands/${ss.parent_brand_id}`)}
                >
                  {ss.parent_brand_name}
                </span>
              </span>
            </div>
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
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
          <h3 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider">
            Информация
          </h3>
          <div className="space-y-4">
            <InfoRow 
              icon={Clock} 
              label="Этап воронки" 
              value={<StageBadge stage={ss.pipeline_stage} />} 
            />
            <InfoRow icon={Globe} label="Сайт" value={
              ss.website_url ? (
                <a 
                  href={ss.website_url.startsWith('http') ? ss.website_url : `https://${ss.website_url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#FF9900] hover:underline break-all"
                >
                  {ss.website_url}
                </a>
              ) : "Не указан"
            } />
            <InfoRow icon={Mail} label="Email" value={<span className="break-all">{ss.contact_email || "—"}</span>} />
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
                  <p className="text-sm text-[#94A3B8] whitespace-pre-wrap break-words">{note.note_text}</p>
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
        onSuccess={fetchSubSupplier}
      />
      <RepliedModal
        open={repliedModal}
        onClose={() => setRepliedModal(false)}
        subSupplierId={subSupplierId}
        onSuccess={fetchSubSupplier}
      />
      <NoResponseModal
        open={noResponseModal}
        onClose={() => setNoResponseModal(false)}
        onSubmit={handleNoResponse}
      />
      <OnHoldModal
        open={onHoldModal}
        onClose={() => setOnHoldModal(false)}
        subSupplierId={subSupplierId}
        onSuccess={fetchSubSupplier}
      />
      <ProblematicModal
        open={problematicModal}
        onClose={() => setProblematicModal(false)}
        subSupplierId={subSupplierId}
        onSuccess={fetchSubSupplier}
      />
      <ReturnModal
        open={returnModal}
        onClose={() => setReturnModal(false)}
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
const StageModal = ({ open, onClose, subSupplierId, onSuccess }) => {
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
      await api.post(`/sub-suppliers/${subSupplierId}/stage`, { stage, note_text: note });
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

// Stage Badge Component
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


// Replied Modal for Sub-Supplier
const RepliedModal = ({ open, onClose, subSupplierId, onSuccess }) => {
  const [subStatus, setSubStatus] = useState("");
  const [note, setNote] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: "need_action", label: "Нужно действие с нашей стороны", description: "Под-сапплаер попросил что-то сделать (доп. инфо, предложение и т.д.)" },
    { value: "need_searcher_attention", label: "Надо внимание сёрчера!", description: "Требуется внимание сёрчера для дальнейших действий" },
    { value: "waiting", label: "Ожидаем от них", description: "Мы сделали свою часть, ждём их решения" },
    { value: "approved", label: "Одобрили сотрудничество", description: "Успех! Под-сапплаер согласен работать" },
    { value: "declined", label: "Отказали", description: "Под-сапплаер отказался от сотрудничества" },
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
      await api.post(`/sub-suppliers/${subSupplierId}/replied`, {
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
            Под-сапплаер ответил
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            Выберите что именно произошло после ответа под-сапплаера
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
              placeholder="Что именно ответил под-сапплаер, какие следующие шаги..."
              required
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary" data-testid="submit-replied">
              {loading ? "Сохранение..." : "Сохранить"}
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

    // Валидация даты (как у бренда)
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
      await api.post(`/sub-suppliers/${subSupplierId}/on-hold`, { reason, review_date: reviewDate, note_text: note });
      toast.success("Под-сапплаер поставлен на паузу");
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
              placeholder="Почему на паузе..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Дата пересмотра</Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Дополнительно..."
              required
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

// Note Modal for Sub-Supplier
const NoteModal = ({ open, onClose, subSupplierId, onSuccess }) => {
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
      await api.post(`/sub-suppliers/${subSupplierId}/note`, { note_text: note });
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

// No Response Modal for Sub-Supplier
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
            Используйте этот статус, когда связались с под-сапплаером, но не получили ответа.
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

// Problematic Modal for Sub-Supplier
const ProblematicModal = ({ open, onClose, subSupplierId, onSuccess }) => {
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
      await api.post(`/sub-suppliers/${subSupplierId}/problematic`, {
        reason_code: reasonCode,
        note_text: note,
        review_date: reviewDate || null
      });
      toast.success("Под-сапплаер помечен как проблемный");
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
          <DialogTitle className="font-mono uppercase tracking-wider text-yellow-400">Проблемный под-сапплаер</DialogTitle>
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

// Return Modal for Sub-Supplier
const ReturnModal = ({ open, onClose, subSupplierId, onSuccess }) => {
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
      await api.post(`/sub-suppliers/${subSupplierId}/return`, { reason_code: reasonCode, note_text: note });
      toast.success("Под-сапплаер возвращён в пул");
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

export default SubSupplierDetailPage;
