import { useEffect, useState } from 'react';
import { KeyRound, Check, Eye, EyeOff, AlertCircle, Save, Trash2, Zap, Brain, Sparkles, RefreshCw, ListTree, CloudDownload, Database } from 'lucide-react';
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
  thinkingModePref,
  readAutoModel,
  writeAutoModel,
} from '@/lib/ai';
import {
  getCatalog,
  describeCatalogAge,
  retiredModelHint,
  type CatalogEntry,
} from '@/lib/modelCatalog';
import type { AiProfile } from '@/lib/ai';

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
  thinkingMode: 'quick',
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
  const [catalog, setCatalog] = useState<CatalogEntry>({ models: [], source: 'builtin', fetchedAt: 0 });
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [manualModel, setManualModel] = useState(false);
  /** 智能选模型开关（全局，不随存档保存） */
  const [autoModel, setAutoModel] = useState<boolean>(() => readAutoModel());
  /** 当前生效的思考偏好（兼容旧存档里只存了 reasoningEffort 的情况） */
  const mode = thinkingModePref(form);

  useEffect(() => {
    setSaved(false);
  }, [form]);

  /**
   * 拉取模型目录（随服务商自动更新）。
   * 走 modelCatalog：缓存新鲜直接用，过期后台刷新，失败回退内置目录。
   * silent 模式下失败不打扰用户。
   */
  const loadModels = async (baseUrl: string, apiKey: string, opts: { force?: boolean; silent?: boolean } = {}) => {
    const { force = false, silent = false } = opts;
    if (!baseUrl.trim() || !apiKey.trim()) return;
    setLoadingModels(true);
    setModelError(null);
    try {
      const entry = await getCatalog(baseUrl, apiKey, { force });
      setCatalog(entry);
      // 只有「完全没有可用列表」时才需要手动输入
      setManualModel(entry.models.length === 0);
    } catch (err) {
      if (!silent) setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingModels(false);
    }
  };

  // 挂载即自动拉取一次（缓存新鲜则秒回，过期则后台静默刷新）
  useEffect(() => {
    if (form.baseUrl.trim() && form.apiKey.trim()) {
      void loadModels(form.baseUrl, form.apiKey, { silent: true });
    }
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Key / 接口地址填写变化后，防抖 800ms 自动拉取该服务商的最新模型目录
  useEffect(() => {
    if (!form.baseUrl.trim() || !form.apiKey.trim()) return;
    const timer = setTimeout(() => {
      void loadModels(form.baseUrl, form.apiKey, { silent: true });
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.baseUrl, form.apiKey]);

  /** 切换正在编辑的存档 */
  const switchSlot = (i: number) => {
    setSlot(i);
    const p = profiles[i];
    setForm(p ?? emptyForm());
    setSaved(false);
    setCatalog({ models: [], source: 'builtin', fetchedAt: 0 });
    setModelError(null);
    setManualModel(false);
    // 已配置过的存档静默尝试拉取模型列表
    if (p?.apiKey && p?.baseUrl) void loadModels(p.baseUrl, p.apiKey, { silent: true });
  };

  const applyPreset = (idx: number) => {
    const p = AI_PRESETS[idx];
    setForm((f) => ({ ...f, baseUrl: p.baseUrl, model: p.model }));
    // 已填 Key 时，应用预设后自动拉取该服务商的最新模型目录
    if (form.apiKey.trim()) void loadModels(p.baseUrl, form.apiKey);
  };

  const handleSave = () => {
    if (!form.apiKey.trim() || !form.baseUrl.trim() || !form.model.trim()) return;
    const next: AiProfile = {
      name: form.name?.trim() || '',
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      // 统一按新字段保存：旧存档的 reasoningEffort 会被解析成 thinkingMode
      thinkingMode: form.thinkingMode ?? thinkingModePref(form),
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
            onClick={() => void loadModels(form.baseUrl, form.apiKey, { force: true })}
            disabled={!form.apiKey.trim() || !form.baseUrl.trim() || loadingModels}
            className="flex items-center gap-1 text-xs text-info hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
            {loadingModels ? '正在获取…' : '刷新模型列表'}
          </button>
        </div>

        {catalog.models.length > 0 && !manualModel ? (
          <select
            id="ai-model"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="h-9 w-full border border-input bg-background px-2 text-sm font-mono"
          >
            {/* 列表不含当前值时兜底保留，避免已保存配置被清空 */}
            {form.model && !catalog.models.includes(form.model) && (
              <option value={form.model}>{form.model}（当前）</option>
            )}
            {catalog.models.map((m) => (
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
            placeholder="deepseek-flash（点击上方按钮可自动列出可用模型）"
            className="font-mono text-sm"
          />
        )}

        {/* 目录来源与更新时间 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {modelError ? (
            <span className="text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {modelError}
            </span>
          ) : catalog.models.length > 0 ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              {catalog.source === 'remote' ? (
                <>
                  <CloudDownload className="h-3.5 w-3.5 shrink-0 text-success" />
                  服务商实时列表 · {catalog.models.length} 个模型 · 更新于 {describeCatalogAge(catalog.fetchedAt)}
                  {catalog.stale && '（已过期，建议刷新）'}
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5 shrink-0 text-warning" />
                  内置参考列表 · {catalog.models.length} 个模型（实时拉取失败，可手动输入）
                </>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <ListTree className="h-3.5 w-3.5 shrink-0" />
              {loadingModels
                ? '正在从服务商获取最新模型列表…'
                : '填入 Key 后自动列出该服务商的最新模型（随服务商更新）'}
            </span>
          )}
          {catalog.models.length > 0 && !manualModel && (
            <button type="button" onClick={() => setManualModel(true)} className="text-muted-foreground hover:text-foreground underline">
              手动输入
            </button>
          )}
          {catalog.models.length > 0 && manualModel && (
            <button type="button" onClick={() => setManualModel(false)} className="text-muted-foreground hover:text-foreground underline">
              返回列表选择
            </button>
          )}
        </div>

        {/* 已保存/正在填写的模型若已退役，给出迁移提示 */}
        {retiredModelHint(form.model) && (
          <p className="flex items-start gap-1.5 text-xs text-warning leading-relaxed">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              模型 <span className="font-mono">{form.model}</span> 已被服务商退役或更名，建议更换为{' '}
              <span className="font-mono">{retiredModelHint(form.model)}</span>。
            </span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>思考模式</Label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, thinkingMode: 'quick' }))}
            aria-pressed={mode === 'quick'}
            className={`border px-2 py-2 text-left transition-colors duration-[var(--duration-fast)] ${
              mode === 'quick' ? 'border-info bg-info/10' : 'border-input hover:border-info/50'
            }`}
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              <Zap className="h-3.5 w-3.5" />
              快速
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
              直接给答案，不展示思考过程
            </span>
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, thinkingMode: 'deep' }))}
            aria-pressed={mode === 'deep'}
            className={`border px-2 py-2 text-left transition-colors duration-[var(--duration-fast)] ${
              mode === 'deep' ? 'border-info bg-info/10' : 'border-input hover:border-info/50'
            }`}
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              <Brain className="h-3.5 w-3.5" />
              深度
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
              先思考再作答，展示过程
            </span>
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, thinkingMode: 'auto' }))}
            aria-pressed={mode === 'auto'}
            className={`border px-2 py-2 text-left transition-colors duration-[var(--duration-fast)] ${
              mode === 'auto' ? 'border-info bg-info/10' : 'border-input hover:border-info/50'
            }`}
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              智能
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
              系统按难度自动选快速/深度
            </span>
          </button>
        </div>
        {mode === 'auto' && (
          <p className="text-[11px] text-muted-foreground">
            自动模式为增强项：简单题（概念/定义）自动快速回答省算力，证明/计算/推导等难题自动深度思考。
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>模型选择</Label>
        <button
          type="button"
          onClick={() => {
            const next = !autoModel;
            setAutoModel(next);
            writeAutoModel(next);
          }}
          aria-pressed={autoModel}
          className={`flex w-full items-start justify-between gap-3 border px-3 py-2 text-left transition-colors duration-[var(--duration-fast)] ${
            autoModel ? 'border-info bg-info/10' : 'border-input hover:border-info/50'
          }`}
        >
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              智能选模型（自动）
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              按题目难度在已配置存档中自动路由：简单题用便宜快的模型，难题用旗舰推理模型。
            </span>
          </span>
          <span
            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
              autoModel ? 'bg-info text-info-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {autoModel ? '已开启' : '手动'}
          </span>
        </button>
        {autoModel && (
          <p className="text-[11px] text-muted-foreground">
            需至少配置 2 个模型存档才会真正路由；当前仅 1 个或 0 个时仍使用当前激活存档。手动选择存档依然可用。
          </p>
        )}
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
