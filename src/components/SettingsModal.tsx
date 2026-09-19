import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Cpu, 
  KeyRound, 
  Lock, 
  Sliders, 
  Database, 
  Download, 
  Upload, 
  AlertTriangle, 
  Check, 
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Wallet,
  Sparkles,
  Palette
} from 'lucide-react';
import { 
  getAIEngineConfig, 
  saveAIEngineConfig, 
  AIEngineConfig, 
  getUserPreferences, 
  saveUserPreferences, 
  applyTheme,
  getEffectiveTheme,
  ThemeMode,
  UserPreferences 
} from '../utils';
import { getAllTransactions, addTransactions, clearAllTransactions, replaceAllTransactions } from '../db';
import { Transaction, ChartPaletteType, EncryptedBackupPayload, UnencryptedBackupPayloadV2 } from '../types';
import { SmartAssetSetup } from './SmartAssetSetup';
import { CHART_PALETTES } from '../themePalettes';
import { encryptBackupData, decryptBackupData, mergeTransactionsDeduplicated } from '../cryptoBackup';
import { loadSavedSubscriptions, saveSubscriptions } from '../autonomousFinance';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
  onDataReset?: () => void;
  initialTab?: 'assets' | 'engine' | 'preferences' | 'privacy';
}

// Custom Dark Dropdown Component (replaces browser native <select> to fix white scrollbars and OS styling)
interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (val: string) => void;
  id?: string;
  className?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md';
}

const CustomDarkSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  options, 
  onChange, 
  id, 
  className = '', 
  theme = 'dark',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isLight = theme === 'light';
  const isSm = size === 'sm';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left rounded-xl text-xs flex items-center justify-between transition-all focus:outline-none active:scale-[0.99] ${
          isSm ? 'px-2.5 py-1.5 rounded-lg' : 'px-3.5 py-2.5 rounded-xl'
        } ${
          isLight
            ? 'bg-white border border-slate-300 hover:border-slate-400 text-slate-900 shadow-xs'
            : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-100'
        }`}
      >
        <span className="truncate font-medium">
          {selectedOption?.label}
          {selectedOption?.sublabel && (
            <span className={`text-[11px] ml-2 font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {selectedOption.sublabel}
            </span>
          )}
        </span>
        <ChevronDown 
          size={isSm ? 12 : 14} 
          className={`transition-transform duration-200 shrink-0 ml-1 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          } ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className={`absolute right-0 min-w-full top-full mt-1 backdrop-blur-md rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-150 scrollbar-none ${
          isLight
            ? 'bg-white border border-slate-300 text-slate-800'
            : 'bg-slate-900/95 border border-slate-700/80 text-slate-100'
        }`}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left text-xs flex items-center justify-between transition-colors ${
                  isSm ? 'px-2.5 py-1.5' : 'px-3.5 py-2.5'
                } ${
                  isSelected 
                    ? isLight
                      ? 'bg-emerald-50 text-emerald-700 font-bold'
                      : 'bg-emerald-500/15 text-emerald-400 font-semibold' 
                    : isLight
                      ? 'text-slate-800 hover:bg-slate-100 hover:text-slate-950'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="truncate pr-2">
                  <span className="block truncate font-medium">{opt.label}</span>
                  {opt.sublabel && (
                    <span className={`text-[11px] block truncate font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {opt.sublabel}
                    </span>
                  )}
                </div>
                {isSelected && <Check size={isSm ? 12 : 14} className={isLight ? 'text-emerald-600 shrink-0' : 'text-emerald-400 shrink-0'} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataChanged, onDataReset, initialTab }) => {
  // 4-Tab Segmented Control: [ 스마트 자산 | AI 엔진 | 일반 설정 | 데이터 관리 ]
  const [activeTab, setActiveTab] = useState<'assets' | 'engine' | 'preferences' | 'privacy'>(initialTab || 'assets');

  // Tab 1: AI Engine state
  const [engineType, setEngineType] = useState<'local' | 'byok'>('local');
  const [localModel, setLocalModel] = useState<'gemma-2b' | 'llama3-8b'>('gemma-2b');
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [modelTier, setModelTier] = useState<string>('1.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'valid' | 'invalid' | null; message: string }>({
    status: null,
    message: ''
  });

  // Tab 2: Financial Preferences state
  const [budgetStartDay, setBudgetStartDay] = useState<number>(1);
  const [currencySymbol, setCurrencySymbol] = useState<string>('KRW');
  const [stealthMode, setStealthMode] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [chartPalette, setChartPalette] = useState<ChartPaletteType>('default');
  const [autoCategorization, setAutoCategorization] = useState<boolean>(true);
  const [defaultLaunchScreen, setDefaultLaunchScreen] = useState<'vault' | 'ledger'>('vault');

  // Tab 3: Data & Privacy state
  const [lastExportedDate, setLastExportedDate] = useState<string>('없음');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>('');
  const [isClearingData, setIsClearingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Phase 4: AES-GCM-256 Encrypted Backup & Smart Deduplicated Merge
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [enablePasswordProtection, setEnablePasswordProtection] = useState(false);
  const [isDecryptModalOpen, setIsDecryptModalOpen] = useState(false);
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [pendingEncryptedData, setPendingEncryptedData] = useState<any>(null);
  const [pendingRestorePayload, setPendingRestorePayload] = useState<any>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Budget Day Options (1일 ~ 31일) for sleek dropdown picker
  const budgetDayOptions: CustomSelectOption[] = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}일`,
  }));

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      // Load current AI Engine config
      const engineCfg = getAIEngineConfig();
      setEngineType(engineCfg.engineType || 'local');
      setLocalModel(engineCfg.localModel || 'gemma-2b');
      setProvider(engineCfg.provider || 'gemini');
      setModelTier(engineCfg.modelTier || (engineCfg.provider === 'openai' ? 'gpt-4o-mini' : '1.5-flash'));
      setApiKey(engineCfg.apiKey || '');
      setShowKey(false);
      setTestResult({ status: null, message: '' });

      // Load User Preferences
      const prefs = getUserPreferences();
      setBudgetStartDay(prefs.budgetStartDay ?? 1);
      setCurrencySymbol(prefs.currencySymbol || 'KRW');
      setStealthMode(prefs.stealthMode ?? false);
      setTheme(prefs.theme || 'dark');
      setChartPalette(prefs.chartPalette || 'default');
      setAutoCategorization(prefs.autoCategorization !== undefined ? !!prefs.autoCategorization : true);
      setDefaultLaunchScreen(prefs.defaultLaunchScreen || 'vault');

      // Load last export date from localStorage
      const lastExp = localStorage.getItem('vibe_last_export_date');
      setLastExportedDate(lastExp || '없음');

      setShowDeleteModal(false);
      setDeleteConfirmationText('');
      setStatusMessage(null);
    }
  }, [isOpen]);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    const prefs = getUserPreferences();
    saveUserPreferences({ ...prefs, theme: newTheme, autoCategorization });
    if (onDataChanged) onDataChanged();
  };

  const handleChartPaletteChange = (newPalette: ChartPaletteType) => {
    setChartPalette(newPalette);
    const prefs = getUserPreferences();
    saveUserPreferences({ ...prefs, chartPalette: newPalette });
    if (onDataChanged) onDataChanged();
  };

  // Provider options
  const providerOptions: CustomSelectOption[] = [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
  ];

  // Model tier options dynamically mapped
  const getModelTierOptions = (): CustomSelectOption[] => {
    if (provider === 'gemini') {
      return [
        { value: '1.5-flash', label: 'Gemini 1.5 Flash', sublabel: '기본 권장, 초고속 처리' },
        { value: '1.5-pro', label: 'Gemini 1.5 Pro', sublabel: '심층 추론 및 정밀 분석' },
      ];
    }
    if (provider === 'openai') {
      return [
        { value: 'gpt-4o-mini', label: 'GPT-4o-mini', sublabel: '경량 및 신속 처리' },
        { value: 'gpt-4o', label: 'GPT-4o', sublabel: '옴니 플래그십 모델' },
      ];
    }
    return [
      { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', sublabel: '고정밀 분석' },
      { value: 'claude-3-haiku', label: 'Claude 3 Haiku', sublabel: '저지연 초고속' },
    ];
  };

  // Local model options
  const localModelOptions: CustomSelectOption[] = [
    { value: 'gemma-2b', label: 'Gemma 2B', sublabel: '초고속 경량 - 1.3GB' },
    { value: 'llama3-8b', label: 'Llama 3 8B', sublabel: '심층 처리 - 4.5GB' },
  ];

  // Currency options
  const currencyOptions: CustomSelectOption[] = [
    { value: 'KRW', label: '원화 (₩)', sublabel: '대한민국 원' },
    { value: 'USD', label: '달러 ($)', sublabel: '미국 달러' },
    { value: 'EUR', label: '유로 (€)', sublabel: '유럽 유로' },
    { value: 'JPY', label: '엔화 (¥)', sublabel: '일본 엔' },
  ];

  const handleProviderChange = (newProvider: string) => {
    const prov = newProvider as 'gemini' | 'openai' | 'anthropic';
    setProvider(prov);
    setTestResult({ status: null, message: '' });
    if (prov === 'gemini') setModelTier('1.5-flash');
    else if (prov === 'openai') setModelTier('gpt-4o-mini');
    else setModelTier('claude-3-5-sonnet');
  };

  // Test API Key
  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ status: 'invalid', message: 'API 키를 먼저 입력해 주세요' });
      return;
    }
    setIsTestingKey(true);
    setTestResult({ status: null, message: '' });

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, modelTier })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setTestResult({ status: 'valid', message: '🟢 유효한 API 키 확인됨' });
      } else {
        setTestResult({ status: 'invalid', message: '🔴 연결 실패 (키를 다시 확인해 주세요)' });
      }
    } catch (e: any) {
      setTestResult({ status: 'invalid', message: '🔴 연결 실패 (네트워크를 확인해 주세요)' });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Save Settings
  const handleSaveAll = () => {
    const engineConfig: AIEngineConfig = {
      engineType,
      localModel,
      provider,
      modelTier,
      apiKey: apiKey.trim()
    };
    saveAIEngineConfig(engineConfig);

    const userPrefs: UserPreferences = {
      budgetStartDay,
      currencySymbol,
      stealthMode,
      theme,
      chartPalette,
      autoCategorization
    };
    saveUserPreferences(userPrefs);
    applyTheme(theme);

    if (onDataChanged) onDataChanged();
    setStatusMessage({ type: 'success', text: '모든 설정이 기기에 안전하게 저장되었습니다.' });
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Phase 4: Export with optional AES-GCM-256 Encryption
  const handleOpenExportModal = () => {
    setExportPassphrase('');
    setEnablePasswordProtection(false);
    setIsExportModalOpen(true);
  };

  const handlePerformExport = async () => {
    try {
      const txs = await getAllTransactions();
      const subs = loadSavedSubscriptions();
      const assetsRaw = localStorage.getItem('vibe_user_assets');
      const assets = assetsRaw ? JSON.parse(assetsRaw) : [];

      const backupPayload: UnencryptedBackupPayloadV2 = {
        version: '2.0',
        format: 'vibe-backup-v2',
        createdAt: new Date().toISOString(),
        transactions: txs,
        preferences: getUserPreferences(),
        subscriptions: subs,
        assets
      };

      let downloadDataStr = '';
      let downloadFilename = `vibe-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;

      if (enablePasswordProtection) {
        if (!exportPassphrase.trim()) {
          setStatusMessage({ type: 'error', text: '암호화할 비밀번호를 입력해주세요.' });
          return;
        }
        const encrypted = await encryptBackupData(backupPayload, exportPassphrase.trim());
        downloadDataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(encrypted, null, 2));
        downloadFilename = `vibe-ledger-backup-encrypted-${new Date().toISOString().slice(0, 10)}.vibe.enc`;
      } else {
        downloadDataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      }

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", downloadDataStr);
      downloadAnchor.setAttribute("download", downloadFilename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      const nowFormatted = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      setLastExportedDate(nowFormatted);
      localStorage.setItem('vibe_last_export_date', nowFormatted);

      setIsExportModalOpen(false);
      setStatusMessage({ 
        type: 'success', 
        text: enablePasswordProtection 
          ? `AES-256 암호화된 백업 파일(${txs.length}건)을 안전하게 내보냈습니다.` 
          : `${txs.length}건의 거래 내역을 JSON 파일로 내보냈습니다.` 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '내보내기 실패: ' + err.message });
    }
  };

  // Phase 4: Restore File (handles plain JSON & AES-GCM encrypted .vibe.enc)
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Check if file is encrypted with AES-GCM-256
      if (json.cipher === 'AES-GCM-256' || json.format === 'vibe-encrypted-v2') {
        setPendingEncryptedData(json);
        setDecryptPassphrase('');
        setIsDecryptModalOpen(true);
        return;
      }

      // Plain JSON backup
      prepareRestore(json);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '백업 파일을 읽는 데 실패했습니다: ' + err.message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Decryption execution
  const handlePerformDecryption = async () => {
    if (!decryptPassphrase.trim() || !pendingEncryptedData) return;
    try {
      const decrypted = await decryptBackupData(pendingEncryptedData, decryptPassphrase.trim());
      setIsDecryptModalOpen(false);
      setPendingEncryptedData(null);
      prepareRestore(decrypted);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || '복호화에 실패했습니다.' });
    }
  };

  // Prepare restore payload and prompt for merge choice
  const prepareRestore = (payload: any) => {
    let importedTxs: Transaction[] = [];
    if (Array.isArray(payload.transactions)) {
      importedTxs = payload.transactions;
    } else if (Array.isArray(payload)) {
      importedTxs = payload;
    }

    if (importedTxs.length === 0) {
      setStatusMessage({ type: 'error', text: '파일에서 유효한 거래 내역을 찾을 수 없습니다.' });
      return;
    }

    setPendingRestorePayload(payload);
    setIsMergeModalOpen(true);
  };

  // Execute restore with selected mode ('merge' vs 'overwrite')
  const handleExecuteRestore = async (mode: 'merge' | 'overwrite') => {
    if (!pendingRestorePayload) return;
    try {
      let importedTxs: Transaction[] = [];
      if (Array.isArray(pendingRestorePayload.transactions)) {
        importedTxs = pendingRestorePayload.transactions;
      } else if (Array.isArray(pendingRestorePayload)) {
        importedTxs = pendingRestorePayload;
      }

      const currentTxs = await getAllTransactions();
      const { finalTransactions, addedCount, updatedCount, skippedCount } = mergeTransactionsDeduplicated(
        currentTxs,
        importedTxs,
        mode
      );

      if (mode === 'overwrite') {
        await replaceAllTransactions(finalTransactions);
      } else {
        await addTransactions(finalTransactions);
      }

      // Restore preferences & assets & subscriptions if present
      if (pendingRestorePayload.preferences) {
        saveUserPreferences(pendingRestorePayload.preferences);
        setBudgetStartDay(pendingRestorePayload.preferences.budgetStartDay ?? 1);
        setCurrencySymbol(pendingRestorePayload.preferences.currencySymbol || 'KRW');
        setStealthMode(!!pendingRestorePayload.preferences.stealthMode);
        if (pendingRestorePayload.preferences.theme) {
          setTheme(pendingRestorePayload.preferences.theme);
          applyTheme(pendingRestorePayload.preferences.theme);
        }
      }

      if (Array.isArray(pendingRestorePayload.subscriptions)) {
        saveSubscriptions(pendingRestorePayload.subscriptions);
      }

      if (Array.isArray(pendingRestorePayload.assets)) {
        localStorage.setItem('vibe_user_assets', JSON.stringify(pendingRestorePayload.assets));
      }

      setIsMergeModalOpen(false);
      setPendingRestorePayload(null);

      const msg = mode === 'merge'
        ? `스마트 병합 완료: 신규 ${addedCount}건 추가, ${updatedCount}건 갱신 (중복 ${skippedCount}건 제외)`
        : `전체 덮어쓰기 완료: ${finalTransactions.length}건 반영`;

      setStatusMessage({ type: 'success', text: msg });
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '복원 처리 중 오류가 발생했습니다: ' + err.message });
    }
  };

  // Safety Confirmation Modal Delete Execution
  const handleExecuteDelete = async () => {
    const confirmation = deleteConfirmationText.trim();
    if (confirmation !== '초기화' && confirmation.toUpperCase() !== 'DELETE') return;

    setIsClearingData(true);
    try {
      await clearAllTransactions();
      localStorage.removeItem('vibe_engine_config');
      localStorage.removeItem('vibe_user_preferences');
      localStorage.removeItem('vibe_user_assets');
      localStorage.removeItem('vibe_last_export_date');

      // Reset local states
      setApiKey('');
      setEngineType('local');
      setLocalModel('gemma-2b');
      setBudgetStartDay(1);
      setCurrencySymbol('KRW');
      setStealthMode(false);
      setTheme('dark');
      applyTheme('dark');
      setLastExportedDate('없음');
      setShowDeleteModal(false);
      setDeleteConfirmationText('');

      setStatusMessage({ type: 'success', text: '모든 데이터와 API 키가 완전히 초기화되었습니다.' });
      if (onDataChanged) onDataChanged();
      if (onDataReset) onDataReset();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: '데이터 초기화 오류: ' + err.message });
    } finally {
      setIsClearingData(false);
    }
  };

  if (!isOpen) return null;

  const isLight = getEffectiveTheme(theme) === 'light';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl backdrop-blur-2xl border shadow-2xl flex flex-col h-[84dvh] sm:h-[630px] overflow-hidden animate-in slide-in-from-bottom-6 duration-200 transition-colors ${
          isLight
            ? 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-300/40'
            : 'bg-[#0E1524]/95 border-white/10 text-slate-100 shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        <div className={`w-12 h-1 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0 ${
          isLight ? 'bg-slate-300' : 'bg-white/20'
        }`} />

        {/* Top Header */}
        <div className={`flex justify-between items-center px-5 sm:px-6 py-3.5 border-b shrink-0 transition-colors ${
          isLight ? 'border-slate-200 bg-slate-50/60' : 'border-white/10 bg-white/[0.02]'
        }`}>
          <h2 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-950' : 'text-white'}`}>
            <Sliders className={`w-4 h-4 ${isLight ? 'text-slate-800' : 'text-slate-200'}`} />
            <span>환경 설정</span>
          </h2>
          <button 
            onClick={onClose} 
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              isLight
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            aria-label="설정 창 닫기"
          >
            <X size={17} />
          </button>
        </div>

        {/* Tab Bar: Simple text links, NO background pills, NO horizontal overflow */}
        <div className={`grid grid-cols-4 border-b shrink-0 px-4 sm:px-6 transition-colors ${
          isLight ? 'border-slate-200' : 'border-white/10'
        }`}>
          <button
            id="tab-assets"
            onClick={() => setActiveTab('assets')}
            className={`py-3 text-xs text-center transition-colors relative whitespace-nowrap ${
              activeTab === 'assets'
                ? isLight
                  ? 'text-slate-950 font-bold border-b-2 border-slate-950'
                  : 'text-white font-bold border-b-2 border-white'
                : isLight
                  ? 'text-slate-500 hover:text-slate-900 font-medium'
                  : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            자산 관리
          </button>

          <button
            id="tab-ai-engine"
            onClick={() => setActiveTab('engine')}
            className={`py-3 text-xs text-center transition-colors relative whitespace-nowrap ${
              activeTab === 'engine'
                ? isLight
                  ? 'text-slate-950 font-bold border-b-2 border-slate-950'
                  : 'text-white font-bold border-b-2 border-white'
                : isLight
                  ? 'text-slate-500 hover:text-slate-900 font-medium'
                  : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            AI 엔진
          </button>

          <button
            id="tab-prefs"
            onClick={() => setActiveTab('preferences')}
            className={`py-3 text-xs text-center transition-colors relative whitespace-nowrap ${
              activeTab === 'preferences'
                ? isLight
                  ? 'text-slate-950 font-bold border-b-2 border-slate-950'
                  : 'text-white font-bold border-b-2 border-white'
                : isLight
                  ? 'text-slate-500 hover:text-slate-900 font-medium'
                  : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            일반 설정
          </button>

          <button
            id="tab-data"
            onClick={() => setActiveTab('privacy')}
            className={`py-3 text-xs text-center transition-colors relative whitespace-nowrap ${
              activeTab === 'privacy'
                ? isLight
                  ? 'text-slate-950 font-bold border-b-2 border-slate-950'
                  : 'text-white font-bold border-b-2 border-white'
                : isLight
                  ? 'text-slate-500 hover:text-slate-900 font-medium'
                  : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            데이터 관리
          </button>
        </div>

        {/* Status Toast inside Modal */}
        {statusMessage && (
          <div className={`mx-6 mt-1 px-3.5 py-2 rounded-2xl text-xs flex items-center justify-between shrink-0 ${
            statusMessage.type === 'success' ? 'bg-[#00F5A0]/15 border border-[#00F5A0]/30 text-[#00F5A0]' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}>
            <span className="truncate">{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="ml-1 text-sm font-bold">×</button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 px-5 py-3 overflow-y-auto text-sm flex flex-col justify-between scrollbar-none">
          
          {/* TAB 0: SMART ASSET SETUP */}
          {activeTab === 'assets' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <SmartAssetSetup 
                theme={theme}
                onAssetsUpdated={() => {
                  if (onDataChanged) onDataChanged();
                }} 
              />
            </div>
          )}

          {/* TAB 1: AI ENGINE CONFIGURATION */}
          {activeTab === 'engine' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col gap-2">
                <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>AI 처리 방식</span>
                
                {/* 2-Card Segment Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEngineType('local')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      engineType === 'local'
                        ? isLight
                          ? 'border-emerald-500 bg-emerald-50 text-slate-900 shadow-xs'
                          : 'border-[#00F5A0]/70 bg-[#00F5A0]/10 text-white shadow-sm'
                        : isLight
                          ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          : 'border-white/10 bg-white/[0.02] text-[#94A3B8] hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 font-semibold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <Cpu size={14} className={engineType === 'local' ? (isLight ? 'text-emerald-600' : 'text-[#00F5A0]') : (isLight ? 'text-slate-400' : 'text-[#94A3B8]')} />
                      <span>온디바이스 AI</span>
                    </div>
                    <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>100% 기기 내 처리, 오프라인 작동</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEngineType('byok')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      engineType === 'byok'
                        ? isLight
                          ? 'border-emerald-500 bg-emerald-50 text-slate-900 shadow-xs'
                          : 'border-[#00F5A0]/70 bg-[#00F5A0]/10 text-white shadow-sm'
                        : isLight
                          ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          : 'border-white/10 bg-white/[0.02] text-[#94A3B8] hover:border-white/20 hover:text-slate-200'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 font-semibold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <KeyRound size={14} className={engineType === 'byok' ? (isLight ? 'text-emerald-600' : 'text-[#00F5A0]') : (isLight ? 'text-slate-400' : 'text-[#94A3B8]')} />
                      <span>클라우드 AI (API 키)</span>
                    </div>
                    <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>Gemini, OpenAI, Claude</span>
                  </button>
                </div>
              </div>

              {/* On-Device Sub-Fields: Borderless row */}
              {engineType === 'local' && (
                <div className="pt-2 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
                  }`}>
                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>하드웨어 가속:</span>
                    <span className={`text-xs font-medium flex items-center gap-1.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      <span className={`w-2 h-2 rounded-full animate-pulse ${isLight ? 'bg-emerald-500' : 'bg-emerald-400'}`} />
                      WebGPU 그래픽 가속 활성화됨
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      온디바이스 로컬 모델
                    </label>
                    <CustomDarkSelect
                      value={localModel}
                      options={localModelOptions}
                      onChange={(val) => setLocalModel(val as any)}
                      theme={theme}
                    />
                  </div>
                </div>
              )}

              {/* BYOK Sub-Fields: Borderless row */}
              {engineType === 'byok' && (
                <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Provider & Model Tier Custom Selects */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        제공사 선택
                      </label>
                      <CustomDarkSelect
                        value={provider}
                        options={providerOptions}
                        onChange={handleProviderChange}
                        theme={theme}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        세부 모델
                      </label>
                      <CustomDarkSelect
                        value={modelTier}
                        options={getModelTierOptions()}
                        onChange={(val) => setModelTier(val)}
                        theme={theme}
                      />
                    </div>
                  </div>

                  {/* API Key Input + Show/Hide + [Test Key] */}
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      API 키 입력
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => { 
                            setApiKey(e.target.value); 
                            setTestResult({ status: null, message: '' }); 
                          }}
                          placeholder="API 키를 입력하세요 (AIza... 또는 sk-...)"
                          className={`w-full rounded-lg pl-3 pr-8 py-2 text-xs outline-none transition-colors border ${
                            isLight 
                              ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500' 
                              : 'bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-emerald-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className={`absolute right-2.5 top-2 transition-colors ${
                            isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestKey}
                        disabled={isTestingKey || !apiKey.trim()}
                        className={`px-3 py-2 disabled:opacity-40 rounded-lg text-xs font-medium border shrink-0 transition-all active:scale-95 ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {isTestingKey ? <Loader2 size={13} className="animate-spin" /> : '키 검사'}
                      </button>
                    </div>

                    {/* Inline Validation Status Badge */}
                    {testResult.status && (
                      <div className={`mt-1.5 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${
                        testResult.status === 'valid' 
                          ? isLight ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium' 
                          : isLight ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {testResult.status === 'valid' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        <span>{testResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GENERAL PREFERENCES (Compact, Elegant, Non-scrolling iOS Grouped Style) */}
          {activeTab === 'preferences' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Section 1: Display & Theme */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-bold px-1 uppercase tracking-wider block ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  화면 및 테마
                </span>
                <div className="space-y-1 px-1">
                  {/* Row 0: Default Launch Screen Segmented Control */}
                  <div className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <span className={`text-xs font-semibold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        기본 시작 화면
                      </span>
                      <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        앱 실행 시 첫 화면을 지정합니다
                      </span>
                    </div>
                    <div className={`flex p-0.5 rounded-xl border ${
                      isLight ? 'bg-slate-200/70 border-slate-300/60' : 'bg-black/40 border-white/5'
                    }`}>
                      <button
                        type="button"
                        id="launch-screen-vault-btn"
                        onClick={() => {
                          setDefaultLaunchScreen('vault');
                          const prefs = getUserPreferences();
                          saveUserPreferences({ ...prefs, defaultLaunchScreen: 'vault' });
                          if (onDataChanged) onDataChanged();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                          defaultLaunchScreen === 'vault'
                            ? isLight
                              ? 'bg-white text-slate-950 shadow-xs font-bold'
                              : 'bg-white/15 text-white shadow-xs font-bold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <ShieldCheck size={12} className="text-blue-400" />
                        <span>볼트 (Vault)</span>
                      </button>
                      <button
                        type="button"
                        id="launch-screen-ledger-btn"
                        onClick={() => {
                          setDefaultLaunchScreen('ledger');
                          const prefs = getUserPreferences();
                          saveUserPreferences({ ...prefs, defaultLaunchScreen: 'ledger' });
                          if (onDataChanged) onDataChanged();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                          defaultLaunchScreen === 'ledger'
                            ? isLight
                              ? 'bg-white text-slate-950 shadow-xs font-bold'
                              : 'bg-white/15 text-white shadow-xs font-bold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Wallet size={12} className="text-emerald-400" />
                        <span>가계부 (Ledger)</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 1: Screen Theme (3-way Segmented Control: Dark | Light | System) */}
                  <div className="py-2 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      화면 테마
                    </span>
                    <div className={`flex p-0.5 rounded-xl border ${
                      isLight ? 'bg-slate-200/70 border-slate-300/60' : 'bg-black/40 border-white/5'
                    }`}>
                      <button
                        type="button"
                        id="theme-dark-btn"
                        onClick={() => handleThemeChange('dark')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                          theme === 'dark'
                            ? isLight
                              ? 'bg-white text-slate-950 shadow-xs font-bold'
                              : 'bg-white/15 text-white shadow-xs font-bold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Moon size={12} />
                        <span>다크</span>
                      </button>
                      <button
                        type="button"
                        id="theme-light-btn"
                        onClick={() => handleThemeChange('light')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                          theme === 'light'
                            ? isLight
                              ? 'bg-white text-slate-950 shadow-xs font-bold'
                              : 'bg-white/15 text-white shadow-xs font-bold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Sun size={12} />
                        <span>라이트</span>
                      </button>
                      <button
                        type="button"
                        id="theme-system-btn"
                        onClick={() => handleThemeChange('system')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                          theme === 'system'
                            ? isLight
                              ? 'bg-white text-slate-950 shadow-xs font-bold'
                              : 'bg-white/15 text-white shadow-xs font-bold'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Monitor size={12} />
                        <span>시스템</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Chart Color Theme (Horizontal Color Swatch Row) */}
                  <div className="py-1.5 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold shrink-0 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      차트 컬러
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                      {Object.values(CHART_PALETTES).map((palette) => {
                        const isSelected = chartPalette === palette.id;
                        return (
                          <button
                            key={palette.id}
                            type="button"
                            id={`chart-palette-btn-${palette.id}`}
                            onClick={() => handleChartPaletteChange(palette.id)}
                            title={`${palette.name} (${palette.subtitle})`}
                            className={`px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 active:scale-95 shrink-0 ${
                              isSelected
                                ? isLight
                                  ? 'bg-white border-emerald-500 ring-1 ring-emerald-500/30 shadow-2xs'
                                  : 'bg-white/10 border-[#00F5A0] ring-1 ring-[#00F5A0]/30 text-white'
                                : isLight
                                  ? 'bg-slate-100/80 border-transparent hover:bg-slate-200/70 text-slate-600'
                                  : 'bg-white/[0.04] border-transparent hover:bg-white/[0.08] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-xs leading-none select-none">{palette.emoji}</span>
                            <div className="flex items-center -space-x-1">
                              {palette.swatches.slice(0, 3).map((color, i) => (
                                <span
                                  key={i}
                                  className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <span className={`text-[11px] ${
                              isSelected
                                ? isLight ? 'text-emerald-700 font-bold' : 'text-[#00F5A0] font-bold'
                                : 'font-medium'
                            }`}>
                              {palette.name.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Ledger Preferences */}
              <div className="space-y-1.5 pt-2">
                <span className={`text-[11px] font-bold px-1 uppercase tracking-wider block ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  가계부 설정
                </span>
                <div className="space-y-1 px-1">
                  {/* Row 1: Budget Start Day (Sleek Number Picker Dropdown) */}
                  <div className="py-1.5 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      예산 시작일
                    </span>
                    <div className="w-24">
                      <CustomDarkSelect
                        id="budget-start-day-select"
                        value={String(budgetStartDay)}
                        options={budgetDayOptions}
                        onChange={(val) => {
                          const num = parseInt(val, 10) || 1;
                          setBudgetStartDay(num);
                          const prefs = getUserPreferences();
                          saveUserPreferences({ ...prefs, budgetStartDay: num });
                          if (onDataChanged) onDataChanged();
                        }}
                        theme={isLight ? 'light' : 'dark'}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Row 2: Default Currency Symbol Dropdown */}
                  <div className="py-1.5 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      기본 통화
                    </span>
                    <div className="w-28">
                      <CustomDarkSelect
                        id="currency-select"
                        value={currencySymbol}
                        options={currencyOptions}
                        onChange={(val) => {
                          setCurrencySymbol(val);
                          const prefs = getUserPreferences();
                          saveUserPreferences({ ...prefs, currencySymbol: val });
                          if (onDataChanged) onDataChanged();
                        }}
                        theme={isLight ? 'light' : 'dark'}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Row 3: Stealth Mode Toggle Switch */}
                  <div className="py-2 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      스텔스 모드 (금액 숨김)
                    </span>
                    <button
                      id="toggle-stealth-mode"
                      type="button"
                      onClick={() => {
                        const next = !stealthMode;
                        setStealthMode(next);
                        const prefs = getUserPreferences();
                        saveUserPreferences({ ...prefs, stealthMode: next });
                        if (onDataChanged) onDataChanged();
                      }}
                      aria-label="스텔스 모드 토글"
                      className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 active:scale-95 ${
                        stealthMode
                          ? 'bg-emerald-500'
                          : isLight
                            ? 'bg-slate-300'
                            : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                          stealthMode ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Row 4: Smart Auto-Categorization Toggle Switch */}
                  <div className="py-2 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      스마트 자동 분류
                    </span>
                    <button
                      id="toggle-auto-categorization"
                      type="button"
                      onClick={() => {
                        const next = !autoCategorization;
                        setAutoCategorization(next);
                        const prefs = getUserPreferences();
                        saveUserPreferences({ ...prefs, autoCategorization: next });
                        if (onDataChanged) onDataChanged();
                      }}
                      aria-label="스마트 자동 분류 토글"
                      className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 active:scale-95 ${
                        autoCategorization
                          ? 'bg-emerald-500'
                          : isLight
                            ? 'bg-slate-300'
                            : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                          autoCategorization ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA & PRIVACY (LOCAL-FIRST) */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Backup & Restore with Last Exported status */}
              <div className="pt-1 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                    데이터 백업 및 복원
                  </span>
                  <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    마지막 백업: <span className={`font-medium ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{lastExportedDate}</span>
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleOpenExportModal}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
                      isLight 
                        ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800' 
                        : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-slate-200'
                    }`}
                  >
                    <Download size={13} className={isLight ? 'text-slate-700' : 'text-slate-300'} />
                    <span>백업 내보내기</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
                      isLight 
                        ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800' 
                        : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-slate-200'
                    }`}
                  >
                    <Upload size={13} className={isLight ? 'text-slate-700' : 'text-slate-300'} />
                    <span>백업 복원 / 병합</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.enc"
                    className="hidden"
                    onChange={handleRestoreFile}
                  />
                </div>

                {/* AES-GCM 256 Security Indicator */}
                <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-400">
                  <Lock size={12} className={isLight ? 'text-slate-500' : 'text-slate-400'} />
                  <span>AES-GCM 256 암호화 및 무손실 스마트 중복제거 병합 지원</span>
                </div>
              </div>

              {/* Danger Zone: Clear All Data & API Keys */}
              <div className="pt-3 space-y-2">
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                  isLight ? 'text-rose-700' : 'text-rose-400'
                }`}>
                  <AlertTriangle size={13} /> 데이터 초기화 (주의)
                </span>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className={`w-full py-2 px-3 rounded-lg border font-medium text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                    isLight
                      ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                      : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-400'
                  }`}
                >
                  <Trash2 size={13} />
                  <span>모든 거래 내역 삭제 및 설정 초기화</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Action Bar (Apply & Save) */}
          <div className={`pt-3 border-t mt-2 shrink-0 flex items-center justify-between ${
            isLight ? 'border-slate-200' : 'border-white/10'
          }`}>
            <div className={`flex items-center gap-1.5 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <ShieldCheck size={14} className={isLight ? 'text-slate-600' : 'text-slate-400'} />
              <span>기기 로컬 저장</span>
            </div>

            <button
              type="button"
              onClick={handleSaveAll}
              className={`h-9 px-4 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${
                isLight 
                  ? 'bg-slate-900 text-white hover:bg-slate-800' 
                  : 'bg-white text-slate-950 hover:bg-slate-200'
              }`}
            >
              <Check size={14} />
              <span>설정 저장</span>
            </button>
          </div>
        </div>

      </div>

      {/* Phase 4: Export Modal with AES-256 Password Protection */}
      {isExportModalOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div 
            className={`w-full max-w-sm border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0E1526] border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-[#00F5A0]/15 text-[#00F5A0]'}`}>
                <Download size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold">데이터 백업 내보내기 (v2.0)</h3>
                <p className="text-[11px] text-slate-400">거래, 구독, 자산 설정 통합 저장</p>
              </div>
            </div>

            {/* Password Protection Toggle */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/10'
            }`}>
              <div>
                <span className="text-xs font-bold block flex items-center gap-1.5">
                  <Lock size={12} className={isLight ? 'text-emerald-600' : 'text-[#00F5A0]'} />
                  AES-256 비밀번호 암호화
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  비밀번호 없이는 타인이 열람할 수 없도록 암호화합니다
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEnablePasswordProtection(!enablePasswordProtection)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                  enablePasswordProtection ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-800'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform transform ${
                  enablePasswordProtection ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {enablePasswordProtection && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[11px] font-semibold text-slate-400 block">
                  암호화 비밀번호 설정
                </label>
                <input
                  type="password"
                  value={exportPassphrase}
                  onChange={(e) => setExportPassphrase(e.target.value)}
                  placeholder="8자 이상의 안전한 비밀번호 입력"
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                  }`}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold ${
                  isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePerformExport}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00F5A0] to-[#00D9F5] text-slate-950 text-xs font-bold shadow-md shadow-[#00F5A0]/20"
              >
                내보내기 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Decrypt Password Prompt Modal */}
      {isDecryptModalOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setIsDecryptModalOpen(false)}
        >
          <div 
            className={`w-full max-w-sm border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0E1526] border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold">암호화된 백업 복호화</h3>
                <p className="text-[11px] text-slate-400">AES-GCM 256 암호화 보호됨</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              이 백업 파일은 비밀번호로 안전하게 암호화되어 있습니다. 백업 생성 시 설정한 복호화 비밀번호를 입력해주세요.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 block">
                복호화 비밀번호
              </label>
              <input
                type="password"
                value={decryptPassphrase}
                onChange={(e) => setDecryptPassphrase(e.target.value)}
                placeholder="비밀번호 입력"
                autoFocus
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePerformDecryption();
                }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsDecryptModalOpen(false);
                  setPendingEncryptedData(null);
                }}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold ${
                  isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                취소
              </button>
              <button
                type="button"
                disabled={!decryptPassphrase.trim()}
                onClick={handlePerformDecryption}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00F5A0] to-[#00D9F5] disabled:opacity-40 text-slate-950 text-xs font-bold"
              >
                복호화 및 계속
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: Smart Deduplicated Merge Choice Modal */}
      {isMergeModalOpen && pendingRestorePayload && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setIsMergeModalOpen(false)}
        >
          <div 
            className={`w-full max-w-sm border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0E1526] border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                <Database size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold">백업 데이터 복원 방식</h3>
                <p className="text-[11px] text-slate-400">
                  가져올 거래: {pendingRestorePayload.transactions?.length || 0}건
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              기존에 기록된 거래 내역과 백업 파일을 어떻게 합칠지 선택해주세요.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleExecuteRestore('merge')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                  isLight 
                    ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/80 text-slate-900' 
                    : 'bg-[#00F5A0]/10 border-[#00F5A0]/30 hover:bg-[#00F5A0]/15 text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <CheckCircle2 size={14} className={isLight ? 'text-emerald-700' : 'text-[#00F5A0]'} />
                  <span>스마트 중복제거 병합 (권장)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  기존 데이터를 안전하게 유지하며, 중복 없는 신규 거래만 덧붙입니다.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteRestore('overwrite')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                  isLight 
                    ? 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-900' 
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                  <AlertTriangle size={14} />
                  <span>전체 덮어쓰기 (Overwrite)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  기존 가계부 내역을 모두 지우고 백업 데이터로 완전히 교체합니다.
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMergeModalOpen(false);
                setPendingRestorePayload(null);
              }}
              className={`w-full py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white`}
            >
              복원 취소
            </button>
          </div>
        </div>
      )}

      {/* Safety Confirmation Modal: Type "DELETE" */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`w-full max-w-xs border rounded-2xl p-4 space-y-3.5 shadow-2xl animate-in zoom-in-95 duration-150 ${
            isLight ? 'bg-white border-rose-300 text-slate-900' : 'bg-slate-900 border-rose-500/40 text-slate-100'
          }`}>
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle size={18} className="shrink-0" />
              <h3 className="text-xs font-bold">데이터 완전 초기화 확인</h3>
            </div>
            
            <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              저장된 모든 거래 내역과 환경 설정, 등록된 API 키가 영구적으로 삭제되며 되돌릴 수 없습니다.
            </p>

            <div className="space-y-1.5">
              <label className={`text-xs block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                삭제를 확인하려면 아래에 <span className="text-rose-500 font-bold select-all">초기화</span>를 입력하세요:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="초기화"
                autoFocus
                className={`w-full rounded-xl px-3 py-2 text-xs font-bold tracking-widest outline-none border ${
                  isLight 
                    ? 'bg-slate-50 border-slate-300 text-rose-600 focus:border-rose-500' 
                    : 'bg-slate-950 border-slate-800 text-rose-300 focus:border-rose-500'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmationText('');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-colors border ${
                  isLight 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                취소
              </button>

              <button
                type="button"
                disabled={
                  (deleteConfirmationText.trim() !== '초기화' && deleteConfirmationText.trim().toUpperCase() !== 'DELETE') ||
                  isClearingData
                }
                onClick={handleExecuteDelete}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all flex items-center justify-center gap-1 shadow-md"
              >
                {isClearingData ? <Loader2 size={14} className="animate-spin" /> : '완전 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
