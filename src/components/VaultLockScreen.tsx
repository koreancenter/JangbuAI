import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Shield, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { isVaultLocked, hasVaultPin, unlockVault, getAutoLockConfig } from '../vaultSecurity';

interface VaultLockScreenProps {
  onUnlocked?: () => void;
}

export const VaultLockScreen: React.FC<VaultLockScreenProps> = ({ onUnlocked }) => {
  const [locked, setLocked] = useState<boolean>(isVaultLocked());
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pinConfigured = hasVaultPin();

  useEffect(() => {
    const checkState = () => {
      setLocked(isVaultLocked());
    };

    const handleLockEvent = (e: Event) => {
      const custom = e as CustomEvent<{ isLocked: boolean }>;
      const isNowLocked = custom.detail?.isLocked ?? isVaultLocked();
      setLocked(isNowLocked);
      if (isNowLocked) {
        setPin('');
        setError(null);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };

    window.addEventListener('vault-lock-state-changed', handleLockEvent);
    checkState();

    return () => {
      window.removeEventListener('vault-lock-state-changed', handleLockEvent);
    };
  }, []);

  useEffect(() => {
    if (locked) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [locked]);

  if (!locked) {
    return null;
  }

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsUnlocking(true);

    try {
      const res = await unlockVault(pinConfigured ? pin : undefined);
      if (res.success) {
        setLocked(false);
        setPin('');
        if (onUnlocked) onUnlocked();
      } else {
        setError(res.error || '올바르지 않은 PIN 번호입니다.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setError(err.message || '잠금 해제 중 오류가 발생했습니다.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div
      id="vault-lock-overlay"
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-200 select-none"
    >
      <div
        className={`w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-6 sm:p-8 shadow-2xl text-center space-y-6 ${
          shake ? 'animate-bounce duration-200' : ''
        }`}
      >
        {/* Shield & Lock Visual */}
        <div className="relative mx-auto w-18 h-18 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative w-18 h-18 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Lock size={32} className="text-emerald-400 stroke-[2.2]" />
          </div>
        </div>

        {/* Title & Security Notice */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            <span>Vibe Vault 보호 중</span>
            <Shield size={18} className="text-emerald-400" />
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            자산 및 거래 기록이 <span className="text-emerald-400 font-semibold">AES-GCM-256</span>으로
            안전하게 암호화되어 잠겨 있습니다.
          </p>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          {pinConfigured ? (
            <div className="space-y-2">
              <label htmlFor="vault-unlock-pin" className="block text-xs font-medium text-slate-300">
                보안 PIN 번호 입력
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="vault-unlock-pin"
                  type="password"
                  maxLength={12}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN 번호를 입력하세요"
                  autoComplete="off"
                  className="w-full text-center tracking-widest text-lg font-mono py-3 px-4 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <KeyRound size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {error && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 pt-1">
                  <AlertCircle size={13} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-2 text-xs text-slate-400 bg-slate-800/40 border border-white/5 rounded-xl p-3">
              <p>기기 전용 비추출 마스터 키로 안전하게 잠겨 있습니다.</p>
              <p className="text-[11px] text-slate-500 mt-1">설정에서 전용 PIN을 설정하여 보안을 한 단계 더 높일 수 있습니다.</p>
            </div>
          )}

          <button
            type="submit"
            id="btn-unlock-vault"
            disabled={isUnlocking || (pinConfigured && pin.length === 0)}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            <Unlock size={16} />
            <span>{isUnlocking ? '잠금 해제 중...' : '금고 잠금 해제 (Unlock)'}</span>
          </button>
        </form>

        {/* Security badge footer */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Sparkles size={12} className="text-emerald-400" />
          <span>Zero-Knowledge Web Crypto Protected</span>
        </div>
      </div>
    </div>
  );
};
