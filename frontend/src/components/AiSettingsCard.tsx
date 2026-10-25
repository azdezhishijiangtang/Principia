import { useEffect, useState } from 'react';
import { KeyRound, Check, Eye, EyeOff, AlertCircle, Save, Trash2, Zap, RefreshCw, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AI_PRESETS,
  AI_PROFILE_COUNT,
  AI_PROFILE_LABELS,
  readAiProfiles,
  saveAiProfile,
  clearAiProfile,
  getActiveProfile,
  setActiveProfile,
  fetchModels,
} from '@/lib/ai';
import type { AiConfig, AiProfile } from '@/lib/ai';

interface AiSettingsCardProps {
  /** 配置保存成功后的回调 */
  onSaved?: () => void;
  /** 紧凑模式（用于弹窗/侧栏） */
  compact?: boolean;
}

const emptyForm = (): AiProfile => ({
  name: '',
  baseUrl: AI_PRESETS[0].baseUrl,
  apiKey: '',
  model: AI_PRESETS[0].model,
  reasoningEffort: 'off',
});

/**
 * AI 服务配置卡片：三套独立存档（接口地址 / 模型 / 思考强度 / 密钥），
 * 可随时切换当前生效的存档。API Key 只写入浏览器 localStorage。
 */
const AiSettingsCard = ({ onSaved, compact = false }: AiSettingsCardProps) => {
  const [profiles, setProfiles] = useState<(AiProfile | null)[]>(() => readAiProfiles());
  const [active, setActive] = useState<number>(() => getActiveProfile());
  const [slot, setSlot] = useState<number>(() => getActiveProfile());
  const [form, setForm] = useState<AiProfile>(() => readAiProfiles()[getActiveProfile()] ?? emptyForm());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [manualModel, setManualModel] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [form]);

  /** 拉取该 Key 可用的模型列表；silent 模式下失败不弹提示 */
  const loadModels = async (baseUrl: string, apiKey: string, silent = false) => {
    if (!baseUrl.trim() || !apiKey.trim()) return;
    setLoadingModels(true);
    setModelError(null);
    try {
      const list = await fetchModels(baseUrl, apiKey);
      setModels(list);
      setManualModel(false);
    } catch (err) {
      setModels([]);
      setManualModel(true);
      if (!silent) setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingModels(false);
    }
  };

  /** 切换正在编辑的存档 */
  const switchSlot = (i: number) => {
    setSlot(i);
    const p = profiles[i];
    setForm(p ?? emptyForm());
    setSaved(false);
    setModels([]);
    setModelError(null);
    setManualModel(false);
    // 已配置过的存档静默尝试拉取模型列表
    if (p?.apiKey && p?.baseUrl) void loadModels(p.baseUrl, p.apiKey, true);
  };

  const applyPreset = (idx: number) => {
    const p = AI_PRESETS[idx];
    setForm((f) => ({ ...f, baseUrl: p.baseUrl, model: p.model }));
  };

  const handleSave = () => {
    if (!form.apiKey.trim() || !form.baseUrl.trim() || !form.model.trim()) return;
    const next: AiProfile = {
      name: form.name?.trim() || '',
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      reasoningEffort: form.reasoningEffort,
    };
    saveAiProfile(slot, next);
    setProfiles(readAiProfiles());
    setActive(slot);
    setSaved(true);
    onSaved?.();
  };

  const handleUse = (i: number) => {
    setActiveProfile(i);
    setActive(i);
    setProfiles(readAiProfiles());
  };

  const handleClear = (i: number) => {
    clearAiProfile(i);
    const list = readAiProfiles();
    setProfiles(list);
    setActive(getActiveProfile());
    setForm(list[i] ?? emptyForm());
  };

  return (
    <div className={compact ? 'space-y-4' : 'border border-border bg-card p-6 space-y-5'}>
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-info" />
        <h3 className="font-serif text-base font-semibold">API 密钥设置</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          三套存档 · 当前生效：
          <span className="text-success font-medium">{AI_PROFILE_LABELS[active]}</span>
        </span>
      </div>

      {/* 三个存档切换 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">接口存档（三套独立配置，互不覆盖）</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: AI_PROFILE_COUNT }, (_, i) => {
            const p = profiles[i];
            const isEditing = slot === i;
            const isActive = active === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => switchSlot(i)}
                className={`flex flex-col items-start gap-0.5 px-2.5 py-2 border text-left transition-colors duration-[var(--duration-fast)] ${
                  isEditing
                    ? 'border-info bg-info/10'
                    : 'border-border hover:border-info/50 hover:bg-secondary/60'
                }`}
              >
                <span className="flex items-center gap-1 text-xs font-medium">
                  {AI_PROFILE_LABELS[i]}
                  {isActive && (
                    <span className="text-[10px] px-1 bg-success/15 text-success border border-success/30">
                      使用中
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground truncate w-full">
                  {p ? p.name || p.model : '未配置'}
                </span>
              </button>
            );
          })}
        </div>
        {slot !== active && profiles[slot] && (
          <Button variant="outline" size="sm" onClick={() => handleUse(slot)} className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            启用{AI_PROFILE_LABELS[slot]}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-name">存档备注名（选填）</Label>
        <Input
          id="ai-name"
          value={form.name ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="例如：DeepSeek 主力 / 备用 Key"
          className="text-sm"
        />
      </div>

      {/* 服务商预设 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">快速选择服务商</Label>
        <div className="flex flex-wrap gap-1.5">
          {AI_PRESETS.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(i)}
              title={p.hint}
              className={`text-xs px-2.5 py-1.5 border transition-colors duration-[var(--duration-fast)] ${
                form.baseUrl === p.baseUrl && form.model === p.model
                  ? 'border-info bg-info/10 text-info'
                  : 'border-border text-muted-foreground hover:border-info/50 hover:text-foreground'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-baseurl">接口地址（Base URL）</Label>
        <Input
          id="ai-baseurl"
          value={form.baseUrl}
          onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
          placeholder="https://api.deepseek.com/v1"
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-model">模型名称</Label>
          <button
            type="button"
            onClick={() => void loadModels(form.baseUrl, form.apiKey)}
            disabled={!form.apiKey.trim() || !form.baseUrl.trim() || loadingModels}
            className="flex items-center gap-1 text-xs text-info hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
            {loadingModels ? '正在获取…' : '获取该 Key 可用模型'}
          </button>
        </div>

        {models.length > 0 && !manualModel ? (
          <select
            id="ai-model"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="h-9 w-full border border-input bg-background px-2 text-sm font-mono"
          >
            {/* 列表不含当前值时兜底保留，避免已保存配置被清空 */}
            {form.model && !models.includes(form.model) && (
              <option value={form.model}>{form.model}（当前）</option>
            )}
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="ai-model"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder="deepseek-chat（点击上方按钮可自动列出可用模型）"
            className="font-mono text-sm"
          />
        )}

        <div className="flex items-center justify-between gap-2 text-xs">
          {modelError ? (
            <span className="text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {modelError}
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <ListTree className="h-3.5 w-3.5 shrink-0" />
              {models.length > 0
                ? `已获取 ${models.length} 个可用模型`
                : '填入 Key 后点击右侧按钮，即可列出该账号可用的全部模型'}
            </span>
          )}
          {models.length > 0 && !manualModel && (
            <button type="button" onClick={() => setManualModel(true)} className="text-muted-foreground hover:text-foreground underline">
              手动输入
            </button>
          )}
          {models.length > 0 && manualModel && (
            <button type="button" onClick={() => setManualModel(false)} className="text-muted-foreground hover:text-foreground underline">
              返回列表选择
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-effort">思考强度（推理模型生效）</Label>
        <select
          id="ai-effort"
          value={form.reasoningEffort ?? 'off'}
          onChange={(e) =>
            setForm((f) => ({ ...f, reasoningEffort: e.target.value as AiConfig['reasoningEffort'] }))
          }
          className="h-9 w-full border border-input bg-background px-2 text-sm"
        >
          <option value="off">关闭（不发送推理参数）</option>
          <option value="low">低 · 快速回答</option>
          <option value="medium">中 · 均衡</option>
          <option value="high">高 · 深度推理</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-key">API Key</Label>
        <div className="relative">
          <Input
            id="ai-key"
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder="sk-..."
            className="font-mono text-sm pr-10"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showKey ? '隐藏密钥' : '显示密钥'}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-2.5 leading-relaxed">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
        <span>
          三个存档各自独立保存（含接口地址、模型、思考强度与密钥），只存在你自己的浏览器
          localStorage，不会上传到服务器；请求由浏览器直连你所选服务商。
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSave}
          disabled={!form.apiKey.trim() || !form.baseUrl.trim() || !form.model.trim()}
          className="bg-info text-info-foreground hover:bg-info/90 gap-1.5"
        >
          <Save className="h-4 w-4" />
          保存到{AI_PROFILE_LABELS[slot]}并启用
        </Button>
        {profiles[slot] && (
          <Button variant="outline" onClick={() => handleClear(slot)} className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            清除该存档
          </Button>
        )}
        {saved && (
          <span className="self-center text-xs text-success flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            已保存，可以开始提问了
          </span>
        )}
      </div>
    </div>
  );
};

export default AiSettingsCard;
