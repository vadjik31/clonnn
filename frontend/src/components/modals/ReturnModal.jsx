import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
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

export const returnReasons = [
  { value: "invalid_brand", label: "Не является брендом" },
  { value: "duplicate", label: "Дубликат другого бренда" },
  { value: "wrong_category", label: "Не подходит по категории" },
  { value: "no_contacts", label: "Невозможно найти контакты" },
  { value: "site_down", label: "Сайт недоступен" },
  { value: "language_barrier", label: "Языковой барьер" },
  { value: "other", label: "Другая причина" },
];

const ReturnModal = ({ open, onClose, onSubmit, title = "Вернуть" }) => {
  const [reasonCode, setReasonCode] = useState("");
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
      await onSubmit(reasonCode, note);
      setReasonCode("");
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
          <DialogTitle className="font-mono uppercase tracking-wider text-gray-400">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            Возврат в пул для перераспределения. Укажите причину.
          </p>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина *</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="return-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {returnReasons.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Заметка *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Подробности причины возврата..."
              required
              data-testid="return-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="btn-secondary" data-testid="submit-return">
              {loading ? "Сохранение..." : "Вернуть"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnModal;
