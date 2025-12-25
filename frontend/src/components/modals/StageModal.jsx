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

export const stageLabels = {
  REVIEW: "Изучение",
  EMAIL_1_DONE: "Письмо 1",
  EMAIL_2_DONE: "Письмо 2",
  MULTI_CHANNEL_DONE: "Соцсети",
  CALL_OR_PUSH_RECOMMENDED: "Звонок",
  CLOSED: "Закрыт"
};

export const stageOrder = [
  "REVIEW",
  "EMAIL_1_DONE",
  "EMAIL_2_DONE",
  "MULTI_CHANNEL_DONE",
  "CALL_OR_PUSH_RECOMMENDED",
  "CLOSED"
];

const StageModal = ({ open, onClose, currentStage, onSubmit, title = "Этап выполнен" }) => {
  const [nextStage, setNextStage] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const currentIndex = stageOrder.indexOf(currentStage);
  const availableStages = stageOrder.slice(currentIndex + 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nextStage) {
      toast.error("Выберите следующий этап");
      return;
    }
    if (!note.trim()) {
      toast.error("Введите заметку");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(nextStage, note);
      setNextStage("");
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
          <DialogTitle className="font-mono uppercase tracking-wider text-green-400">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Текущий этап</Label>
            <div className="p-3 bg-[#0F1115] rounded text-[#E6E6E6] font-medium">
              {stageLabels[currentStage] || currentStage}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Следующий этап</Label>
            <Select value={nextStage} onValueChange={setNextStage}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="next-stage">
                <SelectValue placeholder="Выберите этап" />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {availableStages.map(stage => (
                  <SelectItem key={stage} value={stage}>
                    {stageLabels[stage]}
                  </SelectItem>
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
              placeholder="Что сделали на этом этапе..."
              required
              data-testid="stage-note"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-[#2A2F3A] text-[#94A3B8]">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700" data-testid="submit-stage">
              {loading ? "Сохранение..." : "Подтвердить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StageModal;
