import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Landmark, 
  Banknote, 
  Wallet, 
  Check, 
  X, 
  Pencil, 
  Trash2, 
  Plus, 
  RotateCcw,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Asset, AssetType, Transaction, SupportedCurrency, FxRates } from '../types';
import { 
  getUserAssets, 
  saveUserAssets, 
  getAssetTypeKo, 
  getAIEngineConfig, 
  DEFAULT_USER_ASSETS,
  DEFAULT_FX_RATES,
  getUserPreferences
} from '../utils';
import { getAllTransactions } from '../db';
import { MonthlyBudgetSection } from './MonthlyBudgetSection';
import { SubscriptionManagerSection } from './SubscriptionManagerSection';
import { detectSubscriptions } from '../autonomousFinance';

interface SmartAssetSetupProps {
  onAssetsUpdated?: (assets: Asset[]) => void;
  theme?: 'dark' | 'light';
  currentCurrency?: SupportedCurrency;
  fxRates?: FxRates;
  initialSubTab?: 'assets' | 'budget' | 'subscriptions';
}

export const SmartAssetSetup: React.FC<SmartAssetSetupProps> = ({ 
  onAssetsUpdated,
  theme = 'dark',
  currentCurrency,
  fxRates,
  initialSubTab
}) => {
  const isLight = theme === 'light';
  const [activeSection, setActiveSection] = useState<'assets' | 'budget' | 'subscriptions'>(initialSubTab || 'assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [discoveredMethods, setDiscoveredMethods] = useState<string[]>([]);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AssetType>('CARD');
  const [editBillingDay, setEditBillingDay] = useState<string>('');

  // Manual addition state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<AssetType>('CARD');
  const [manualBillingDay, setManualBillingDay] = useState('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSection(initialSubTab);
    }
  }, [initialSubTab]);

  const effectiveCurrency: SupportedCurrency = React.useMemo(() => {
    if (currentCurrency) return currentCurrency;
    const prefs = getUserPreferences();
    return (prefs.currencySymbol as SupportedCurrency) || 'KRW';
  }, [currentCurrency]);

  const effectiveFxRates: FxRates = React.useMemo(() => {
    return fxRates || DEFAULT_FX_RATES;
  }, [fxRates]);

  const subscriptionsCount = React.useMemo(() => {
    return detectSubscriptions(transactions, effectiveCurrency, effectiveFxRates).length;
  }, [transactions, effectiveCurrency, effectiveFxRates]);

  // Load assets and discover payment methods from transactions
  useEffect(() => {
    const loaded = getUserAssets();
    setAssets(loaded);

    getAllTransactions()
      .then(txs => {
        setTransactions(txs || []);
        const existingNames = new Set(loaded.map(a => a.name.toLowerCase().replace(/\s+/g, '')));
        const discovered = new Set<string>();
        for (const tx of txs || []) {
          if (tx.paymentMethod) {
            const clean = tx.paymentMethod.trim();
            const key = clean.toLowerCase().replace(/\s+/g, '');
            if (clean && !existingNames.has(key)) {
              discovered.add(clean);
            }
          }
        }
        setDiscoveredMethods(Array.from(discovered));
      })
      .catch(() => {});
  }, []);

  const updateAssetsState = (newAssets: Asset[]) => {
    setAssets(newAssets);
    saveUserAssets(newAssets);
    if (onAssetsUpdated) {
      onAssetsUpdated(newAssets);
    }
  };

  const handleAddDiscoveredMethod = (methodName: string) => {
    let guessedType: AssetType = 'OTHER';
    if (/카드|card|체크|신용/i.test(methodName)) guessedType = 'CARD';
    else if (/은행|bank|통장|계좌/i.test(methodName)) guessedType = 'BANK';
    else if (/현금|cash/i.test(methodName)) guessedType = 'CASH';

    const newAsset: Asset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: methodName,
      type: guessedType,
      enabled: true,
    };
    const updated = [...assets, newAsset];
    updateAssetsState(updated);
    setDiscoveredMethods(prev => prev.filter(m => m !== methodName));
    setBanner({
      type: 'success',
      message: `'${methodName}' 결제수단을 등록했습니다.`
    });
  };

  // AI Smart Ingestion Handler
  const handleAnalyzeAssets = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isAnalyzing) return;

    setIsAnalyzing(true);
    setBanner(null);

    try {
      const config = getAIEngineConfig();
      const response = await fetch('/api/parse-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          engineConfig: config
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `서버 오류 (${response.status})`);
      }

      const data = await response.json();
      const incoming: Asset[] = data.assets || [];

      if (incoming.length === 0) {
        setBanner({
          type: 'error',
          message: '자산을 감지하지 못했습니다. 은행/카드명과 결제일을 포함해 입력해 주세요.'
        });
        return;
      }

      const existingMap = new Map(assets.map(a => [a.name.toLowerCase().replace(/\s+/g, ''), a]));
      let newCount = 0;
      let updatedCount = 0;
      const mergedList = [...assets];

      for (const inc of incoming) {
        const key = inc.name.toLowerCase().replace(/\s+/g, '');
        if (existingMap.has(key)) {
          const idx = mergedList.findIndex(a => a.name.toLowerCase().replace(/\s+/g, '') === key);
          if (idx !== -1) {
            mergedList[idx] = {
              ...mergedList[idx],
              type: inc.type || mergedList[idx].type,
              billingDay: inc.billingDay ?? mergedList[idx].billingDay,
              note: inc.note || mergedList[idx].note,
              enabled: true
            };
            updatedCount++;
          }
        } else {
          mergedList.push(inc);
          newCount++;
        }
      }

      updateAssetsState(mergedList);
      setInputText('');
      setBanner({
        type: 'success',
        message: `자산 등록 완료: ${newCount > 0 ? `${newCount}개 추가` : ''}${newCount > 0 && updatedCount > 0 ? ', ' : ''}${updatedCount > 0 ? `${updatedCount}개 업데이트` : ''}`
      });
    } catch (err: any) {
      console.error(err);
      setBanner({
        type: 'error',
        message: err.message || '자산 분석 중 오류가 발생했습니다.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleAsset = (id: string) => {
    const updated = assets.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    updateAssetsState(updated);
  };

  const handleDeleteAsset = (id: string) => {
    const updated = assets.filter(a => a.id !== id);
    updateAssetsState(updated);
  };

  const handleStartEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setEditName(asset.name);
    setEditType(asset.type);
    setEditBillingDay(asset.billingDay ? String(asset.billingDay) : '');
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;

    const bDay = parseInt(editBillingDay, 10);
    const validBDay = !isNaN(bDay) && bDay >= 1 && bDay <= 31 ? bDay : undefined;

    const updated = assets.map(a => {
      if (a.id === editingId) {
        return {
          ...a,
          name: editName.trim(),
          type: editType,
          billingDay: editType === 'CARD' ? validBDay : undefined
        };
      }
      return a;
    });

    updateAssetsState(updated);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveManual = () => {
    if (!manualName.trim()) return;

    const bDay = parseInt(manualBillingDay, 10);
    const validBDay = !isNaN(bDay) && bDay >= 1 && bDay <= 31 ? bDay : undefined;

    const newAsset: Asset = {
      id: `asset-manual-${Date.now()}`,
      name: manualName.trim(),
      type: manualType,
      billingDay: manualType === 'CARD' ? validBDay : undefined,
      enabled: true
    };

    updateAssetsState([...assets, newAsset]);
    setManualName('');
    setManualBillingDay('');
    setShowManualAdd(false);
  };

  const handleResetDefaults = () => {
    setShowResetConfirmModal(true);
  };

  const handleConfirmReset = () => {
    setShowResetConfirmModal(false);
    updateAssetsState(DEFAULT_USER_ASSETS);
    setBanner({
      type: 'success',
      message: '기본 권장 설정으로 복원되었습니다.'
    });
  };

  const getAssetIcon = (type: AssetType) => {
    switch (type) {
      case 'CARD':
        return <CreditCard size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />;
      case 'BANK':
        return <Landmark size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />;
      case 'CASH':
        return <Banknote size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />;
      case 'OTHER':
      default:
        return <Wallet size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Switcher: Assets vs Monthly Budget */}
      <div className={`flex items-center gap-4 border-b pb-2 ${
        isLight ? 'border-slate-200' : 'border-white/10'
      }`}>
        <button
          type="button"
          id="subtab-btn-assets"
          onClick={() => setActiveSection('assets')}
          className={`text-xs pb-1 transition-colors relative whitespace-nowrap ${
            activeSection === 'assets'
              ? isLight
                ? 'font-bold text-slate-950 border-b-2 border-slate-950'
                : 'font-bold text-white border-b-2 border-white'
              : isLight
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400 hover:text-white'
          }`}
        >
          보유 자산 ({assets.length})
        </button>

        <button
          type="button"
          id="subtab-btn-monthly-budget"
          onClick={() => setActiveSection('budget')}
          className={`text-xs pb-1 transition-colors relative whitespace-nowrap ${
            activeSection === 'budget'
              ? isLight
                ? 'font-bold text-slate-950 border-b-2 border-slate-950'
                : 'font-bold text-white border-b-2 border-white'
              : isLight
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400 hover:text-white'
          }`}
        >
          월간 예산 설정
        </button>

        <button
          type="button"
          id="subtab-btn-subscriptions"
          onClick={() => setActiveSection('subscriptions')}
          className={`text-xs pb-1 transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
            activeSection === 'subscriptions'
              ? isLight
                ? 'font-bold text-slate-950 border-b-2 border-slate-950'
                : 'font-bold text-white border-b-2 border-white'
              : isLight
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>고정 구독</span>
          {subscriptionsCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeSection === 'subscriptions'
                ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/20 text-white'
                : isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-[#00F5A0]/20 text-[#00F5A0]'
            }`}>
              {subscriptionsCount}
            </span>
          )}
        </button>
      </div>

      {activeSection === 'budget' ? (
        <MonthlyBudgetSection 
          theme={theme} 
          onBudgetChanged={() => {
            if (onAssetsUpdated) onAssetsUpdated(assets);
          }} 
        />
      ) : activeSection === 'subscriptions' ? (
        <SubscriptionManagerSection
          transactions={transactions}
          currentCurrency={effectiveCurrency}
          fxRates={effectiveFxRates}
          theme={theme}
          onTransactionChange={() => {
            getAllTransactions().then(txs => setTransactions(txs || []));
            if (onAssetsUpdated) onAssetsUpdated(assets);
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* 1. Smart Asset Setup: Single Sleek Textarea / Input + Action Button */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                id="smart-asset-input"
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAnalyzeAssets();
                  }
                }}
                placeholder="e.g., 주거래: 신한은행, 카드: 현대카드(14일)"
                className={`w-full rounded-xl px-3 py-2 text-xs outline-none resize-none leading-relaxed border transition-all ${
                  isLight
                    ? 'bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400'
                    : 'bg-white/[0.03] border-white/10 text-white placeholder:text-slate-500 focus:bg-white/[0.05] focus:border-white/25'
                }`}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                결제 문자나 문장을 입력하면 AI가 자동 등록합니다
              </span>
              <button
                type="button"
                id="btn-analyze-assets"
                disabled={!inputText.trim() || isAnalyzing}
                onClick={handleAnalyzeAssets}
                className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${
                  isLight
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-white text-slate-950 hover:bg-slate-100'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>분석 중...</span>
                  </>
                ) : (
                  <span>자산 분석 및 등록</span>
                )}
              </button>
            </div>

            {/* Notification Banner */}
            {banner && (
              <div className={`px-3 py-2 rounded-lg text-xs flex items-center justify-between animate-in fade-in duration-150 ${
                banner.type === 'success' 
                  ? (isLight ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')
                  : (isLight ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')
              }`}>
                <span className="font-medium truncate">{banner.message}</span>
                <button onClick={() => setBanner(null)} className="ml-2 font-bold text-xs opacity-70 hover:opacity-100">×</button>
              </div>
            )}
          </div>

          {/* Discovered payment methods prompt (subtle 1-line tag list) */}
          {discoveredMethods.length > 0 && (
            <div className={`px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 ${
              isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.03] text-slate-300'
            }`}>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
                <span className="text-[11px] font-medium shrink-0 text-slate-500">거래 감지:</span>
                {discoveredMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleAddDiscoveredMethod(m)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-400' 
                        : 'bg-white/10 border-white/10 text-white hover:border-white/30'
                    }`}
                  >
                    <span>{m}</span>
                    <Plus size={10} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Add Form Row */}
          {showManualAdd && (
            <div className={`p-3 rounded-xl border space-y-2.5 animate-in fade-in duration-150 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  새 자산 직접 추가
                </span>
                <button onClick={() => setShowManualAdd(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                  <X size={13} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="자산명 (예: 우리카드, 토스)"
                  className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                    isLight 
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-slate-400' 
                      : 'bg-black/40 border-white/10 text-white focus:border-white/30'
                  }`}
                />
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as AssetType)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none ${
                    isLight 
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-slate-400' 
                      : 'bg-black/40 border-white/10 text-white focus:border-white/30'
                  }`}
                >
                  <option value="CARD">신용/체크카드</option>
                  <option value="BANK">은행 계좌</option>
                  <option value="CASH">현금</option>
                  <option value="OTHER">기타 자산</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={manualBillingDay}
                  onChange={(e) => setManualBillingDay(e.target.value)}
                  placeholder="결제일 (1~31일)"
                  disabled={manualType !== 'CARD'}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none disabled:opacity-30 ${
                    isLight 
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-slate-400' 
                      : 'bg-black/40 border-white/10 text-white focus:border-white/30'
                  }`}
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowManualAdd(false)}
                  className={`px-2.5 py-1 text-xs rounded ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveManual}
                  disabled={!manualName.trim()}
                  className={`px-3 py-1 text-xs font-semibold rounded disabled:opacity-40 ${
                    isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-950'
                  }`}
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {/* 2. Registered Assets List: Clean 1-Line Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pt-1 px-0.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  등록된 자산 목록
                </span>
                <span className={`text-[11px] font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {assets.filter(a => a.enabled).length}/{assets.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualAdd(!showManualAdd)}
                  className={`text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus size={11} />
                  <span>직접 추가</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  title="기본 설정으로 복원"
                  className={`text-[11px] p-0.5 transition-colors ${
                    isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            </div>

            {assets.length === 0 ? (
              <div className={`py-6 px-4 text-center ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>
                <p className="text-xs">등록된 자산이 없습니다.</p>
                <p className="text-[11px] opacity-70 mt-0.5">상단 입력창에 결제 문자나 문장을 입력해 등록하세요.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {assets.map((asset) => {
                  const isEditingThis = editingId === asset.id;

                  if (isEditingThis) {
                    return (
                      <div
                        key={asset.id}
                        className={`px-3 py-2 flex items-center justify-between gap-2 border-l-2 ${
                          isLight ? 'bg-slate-50 border-slate-900' : 'bg-white/[0.03] border-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as AssetType)}
                            className={`text-xs px-1.5 py-1 rounded border outline-none ${
                              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/20 text-white'
                            }`}
                          >
                            <option value="CARD">카드</option>
                            <option value="BANK">은행</option>
                            <option value="CASH">현금</option>
                            <option value="OTHER">기타</option>
                          </select>

                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            placeholder="자산명"
                            autoFocus
                            className={`text-xs font-semibold px-2 py-1 rounded border outline-none flex-1 min-w-0 ${
                              isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-slate-500' : 'bg-slate-900 border-white/20 text-white focus:border-white/40'
                            }`}
                          />

                          {editType === 'CARD' && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={editBillingDay}
                                onChange={(e) => setEditBillingDay(e.target.value)}
                                placeholder="결제일"
                                className={`text-xs px-1.5 py-1 rounded border outline-none w-12 text-center ${
                                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/20 text-white'
                                }`}
                              />
                              <span className="text-[10px] text-slate-400">일</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className={`p-1.5 rounded text-xs font-bold transition-colors ${
                              isLight ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-950 hover:bg-slate-200'
                            }`}
                            title="저장"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className={`p-1.5 rounded text-xs transition-colors ${
                              isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-white/10'
                            }`}
                            title="취소"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={asset.id}
                      id={`asset-row-${asset.id}`}
                      className={`group px-3 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        asset.enabled ? '' : 'opacity-40'
                      } ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-white/[0.02]'}`}
                    >
                      {/* Left: Icon/Type Badge + Asset Name + Billing Day */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        {/* Type Icon & Badge */}
                        <div className="flex items-center gap-1 shrink-0">
                          {getAssetIcon(asset.type)}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                            isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-300'
                          }`}>
                            {getAssetTypeKo(asset.type)}
                          </span>
                        </div>

                        {/* Asset Name (Never wraps vertically) */}
                        <span 
                          onClick={() => handleStartEdit(asset)}
                          className={`text-xs font-semibold whitespace-nowrap truncate cursor-pointer hover:underline ${
                            isLight ? 'text-slate-900' : 'text-slate-100'
                          }`}
                          title="클릭하여 수정"
                        >
                          {asset.name}
                        </span>

                        {/* Billing Day (e.g. 14일) */}
                        {asset.billingDay && (
                          <span className={`text-[11px] whitespace-nowrap shrink-0 font-normal ${
                            isLight ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            ({asset.billingDay}일)
                          </span>
                        )}

                        {/* Edit Pencil Icon (subtle) */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(asset)}
                          className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${
                            isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="수정"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>

                      {/* Right: Toggle Switch + Delete Icon */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          id={`toggle-asset-tracking-${asset.id}`}
                          aria-checked={asset.enabled}
                          onClick={() => handleToggleAsset(asset.id)}
                          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none p-0.5 ${
                            asset.enabled
                              ? (isLight ? 'bg-emerald-600' : 'bg-emerald-500')
                              : (isLight ? 'bg-slate-300' : 'bg-slate-700')
                          }`}
                          title={asset.enabled ? '추적 끄기' : '추적 켜기'}
                          aria-label={`${asset.name} 추적 토글`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-sm transition duration-200 ease-in-out ${
                              asset.enabled ? 'translate-x-3' : 'translate-x-0'
                            } bg-white`}
                          />
                        </button>

                        {/* Delete Icon */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset.id)}
                          className={`p-1 rounded transition-colors ${
                            isLight ? 'text-slate-300 hover:text-rose-600' : 'text-slate-600 hover:text-rose-400'
                          }`}
                          title="자산 삭제"
                          aria-label={`${asset.name} 삭제`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Resetting Assets (Iframe & cross-origin safe) */}
      {showResetConfirmModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowResetConfirmModal(false)}
        >
          <div 
            className={`w-full max-w-xs rounded-2xl border p-4 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-xl ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'}`}>
                <RotateCcw size={16} />
              </div>
              <h4 className="text-xs font-bold">기본 자산 목록 복원</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              기본 자산 목록으로 복원하시겠습니까? 현재 등록된 커스텀 결제수단 및 카드 설정이 초기 권장값으로 재설정됩니다.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
                }`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all active:scale-95"
              >
                복원하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
