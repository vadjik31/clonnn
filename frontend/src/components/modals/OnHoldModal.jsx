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

const OnHoldModal = ({ open, onClose, onSubmit, title = "На паузу" }) => {
  const [reason, setReason] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Укажите причину");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(reason, reviewDate);
      setReason("");
      setReviewDate("");
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
          <DialogTitle className="font-mono uppercase tracking-wider text-orange-400">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            Работа будет приостановлена до указанной даты. Можно вернуться к работе раньше.
          </p>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Причина приостановки *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A] min-h-[100px]"
              placeholder="Почему приостанавливаем работу..."
              required
              data-testid="on-hold-reason"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Дата пересмотра</Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="bg-[#0F1115] border-[#2A2F3A]"
              data-testid="on-hold-date"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700" data-testid="submit-on-hold">
              {loading ? "Сохранение..." : "Приостановить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OnHoldModal;
