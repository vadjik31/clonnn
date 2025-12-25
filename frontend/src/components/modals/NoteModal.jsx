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

export const noteTypes = [
  { value: "general", label: "Общая" },
  { value: "contact_attempt", label: "Попытка связи" },
  { value: "response_received", label: "Получен ответ" },
  { value: "internal", label: "Внутренняя" },
];

const NoteModal = ({ open, onClose, onSubmit, title = "Добавить заметку" }) => {
  const [noteType, setNoteType] = useState("general");
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
      await onSubmit(noteType, note);
      setNoteType("general");
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
          <DialogTitle className="font-mono uppercase tracking-wider text-[#FF9900]">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Тип заметки</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]" data-testid="note-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                {noteTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

export default NoteModal;
