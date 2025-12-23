import { useState, useEffect } from "react";
import { api } from "../App";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    delay_email2_days: 2,
    delay_multichannel_days: 2,
    delay_call_days: 2,
    brand_inactivity_days: 7
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get("/settings");
      setSettings(response.data);
    } catch (error) {
      toast.error("Ошибка загрузки настроек");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Настройки сохранены");
    } catch (error) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6E6E6] font-mono uppercase tracking-wider flex items-center gap-3">
            <Settings className="text-[#FF9900]" />
            Настройки
          </h1>
          <p className="text-[#94A3B8] mt-1">Параметры системы и таймингов</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
          data-testid="save-settings-btn"
        >
          <Save size={18} />
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>

      {/* Settings Form */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-6 font-mono uppercase tracking-wider">
          Тайминги воронки
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Задержка перед вторым письмом (дни)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={settings.delay_email2_days}
              onChange={(e) => setSettings({ ...settings, delay_email2_days: parseInt(e.target.value) || 2 })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] font-mono"
              data-testid="delay-email2"
            />
            <p className="text-xs text-[#475569]">После первого письма</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Задержка перед мультиканалом (дни)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={settings.delay_multichannel_days}
              onChange={(e) => setSettings({ ...settings, delay_multichannel_days: parseInt(e.target.value) || 2 })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] font-mono"
              data-testid="delay-multichannel"
            />
            <p className="text-xs text-[#475569]">После второго письма</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Задержка перед звонком/пушем (дни)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={settings.delay_call_days}
              onChange={(e) => setSettings({ ...settings, delay_call_days: parseInt(e.target.value) || 2 })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] font-mono"
              data-testid="delay-call"
            />
            <p className="text-xs text-[#475569]">После мультиканала</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[#94A3B8]">Порог неактивности бренда (дни)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.brand_inactivity_days}
              onChange={(e) => setSettings({ ...settings, brand_inactivity_days: parseInt(e.target.value) || 7 })}
              className="bg-[#0F1115] border-[#2A2F3A] text-[#E6E6E6] font-mono"
              data-testid="inactivity-days"
            />
            <p className="text-xs text-[#475569]">Бренд считается просроченным</p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-6">
        <h2 className="text-lg font-semibold text-[#E6E6E6] mb-4 font-mono uppercase tracking-wider">
          Справка
        </h2>
        <div className="space-y-4 text-[#94A3B8] text-sm">
          <p>
            <strong className="text-[#E6E6E6]">Тайминги воронки</strong> определяют рекомендуемые интервалы между этапами работы с брендом.
          </p>
          <p>
            <strong className="text-[#E6E6E6]">Порог неактивности</strong> используется для определения "просроченных" брендов в дашборде.
          </p>
          <p>
            Система автоматически подсвечивает бренды, требующие внимания, когда дата следующего действия прошла.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
