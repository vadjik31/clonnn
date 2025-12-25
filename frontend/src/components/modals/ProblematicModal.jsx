import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export const problematicReasons = [
  { value: "legal_issues", label: "Юридические проблемы" },
  { value: "aggressive_response", label: "Агрессивный/негативный ответ" },
  { value: "spam_complaint", label: "Жалоба на спам" },
  { value: "technical_issues", label: "Технические проблемы" },
  { value: "other", label: "Другое" },
];

const ProblematicModal = ({ open, onClose, onSubmit, title = "Проблемный" }) => {
  const [reasonCode, setReasonCode] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reasonCode || !note.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(reasonCode, note, reviewDate);
      setReasonCode("");
      setReviewDate("");
      setNote("");
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
          <DialogTitle className="font-mono uppercase tracking-wider text-yellow-400">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина *</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="problematic-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {problematicReasons.map(r => (
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
            <Label className="text-[#94A3B8]">Заметка *</Label>
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

export default ProblematicModal;
