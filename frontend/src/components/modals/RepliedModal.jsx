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

export const repliedStatusOptions = [
  { value: "need_action", label: "Нужно действие с нашей стороны", description: "Бренд попросил что-то сделать" },
  { value: "need_searcher_attention", label: "Надо внимание сёрчера!", description: "Требуется внимание сёрчера" },
  { value: "waiting", label: "Ожидаем от них", description: "Мы сделали свою часть, ждём их решения" },
  { value: "approved", label: "Одобрили сотрудничество", description: "Успех! Согласен работать" },
  { value: "declined", label: "Отказали", description: "Отказ от сотрудничества" },
];

const RepliedModal = ({ open, onClose, onSubmit, title = "Ответил" }) => {
  const [subStatus, setSubStatus] = useState("");
  const [note, setNote] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [loading, setLoading] = useState(false);

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
      await onSubmit(subStatus, note, nextActionDate);
      setSubStatus("");
      setNote("");
      setNextActionDate("");
      onClose();
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
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Что произошло? *</Label>
            <Select value={subStatus} onValueChange={setSubStatus}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="replied-status">
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {repliedStatusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-xs text-[#94A3B8]">{opt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Подробности ответа *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Что конкретно ответили..."
              required
              data-testid="replied-note"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Дата следующего действия (опционально)</Label>
            <Input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              data-testid="next-action-date"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700" data-testid="submit-replied">
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RepliedModal;
