import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Loader2, 
  Sparkles, 
  X, 
  Check, 
  FileText, 
  WifiOff, 
  RefreshCw, 
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { ParsedReceiptData, SupportedCurrency } from '../types';
import { getAIEngineConfig, getCurrencySymbol } from '../utils';
import { parseReceiptWithResilience } from '../autonomousFinance';
import { parseReceiptTextLocally } from '../financialParser';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (receipt: ParsedReceiptData) => void;
  theme?: 'dark' | 'light';
  currentCurrency?: SupportedCurrency;
}

interface CompressionMetadata {
  originalKB: number;
  compressedKB: number;
  mimeType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
}

/**
 * Client-Side Image Pre-processing & Compression:
 * - Downscales large receipts to a maximum of 1280x1280px maintaining aspect ratio.
 * - Draws to HTML5 Canvas, which automatically neutralizes EXIF/orientation metadata.
 * - Encodes to WebP (fallback to JPEG) at 0.8 quality to minimize token usage and latency.
 */
async function preprocessReceiptImage(file: File): Promise<{
  base64: string;
  metadata: CompressionMetadata;
}> {
  return new Promise((resolve, reject) => {
    const originalKB = Math.round(file.size / 1024);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const maxDimension = 1280;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context creation failed');
        }

        // Draw image onto canvas - strips camera EXIF/GPS metadata and normalizes pixels
        ctx.drawImage(img, 0, 0, width, height);

        // Attempt WebP encoding first, fallback to JPEG
        let mimeType: 'image/webp' | 'image/jpeg' = 'image/webp';
        let dataUrl = canvas.toDataURL('image/webp', 0.8);

        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        }

        const base64Index = dataUrl.indexOf(',');
        const rawBase64 = dataUrl.slice(base64Index + 1);
        const compressedKB = Math.round((rawBase64.length * 3) / 4 / 1024);

        resolve({
          base64: dataUrl,
          metadata: {
            originalKB,
            compressedKB,
            mimeType,
            width,
            height
          }
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('이미지 압축 중 오류가 발생했습니다.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 파일을 로드하지 못했습니다. 유효한 사진 파일인지 확인해주세요.'));
    };

    img.src = objectUrl;
  });
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  theme = 'dark',
  currentCurrency = 'KRW'
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressionMeta, setCompressionMeta] = useState<CompressionMetadata | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; reason: string } | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedReceiptData | null>(null);
  const [sourceType, setSourceType] = useState<'gemini' | 'local_fallback' | 'local_deterministic' | null>(null);

  // Manual & Offline Fallback States
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [fallbackRawText, setFallbackRawText] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isLight = theme === 'light';

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일(JPG, PNG, WebP)만 업로드 가능합니다.');
      return;
    }

    setError(null);
    setParsedResult(null);
    setRetryInfo(null);
    setIsScanning(true);

    try {
      // Step 1: Preprocess & compress image to <= 1280px WebP
      const { base64, metadata } = await preprocessReceiptImage(file);
      setImagePreview(base64);
      setCompressionMeta(metadata);

      // Step 2: If offline, guide to heuristic fallback
      if (isOffline) {
        setIsScanning(false);
        setShowManualFallback(true);
        setError('현재 오프라인 상태입니다. 영수증 텍스트를 입력하시면 온디바이스 로컬 파서로 즉시 분석합니다.');
        return;
      }

      // Step 3: Run Resilient Receipt Parser with exponential backoff
      await runAnalysis(base64, metadata.mimeType);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '영수증 이미지 처리 중 문제가 발생했습니다.';
      setError(message);
      setIsScanning(false);
    }
  };

  const runAnalysis = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setError(null);
    setRetryInfo(null);

    try {
      const engineConfig = getAIEngineConfig();
      const result = await parseReceiptWithResilience({
        imageBase64: base64Image,
        mimeType,
        engineConfig,
        defaultCurrency: currentCurrency,
        rawFallbackText: fallbackRawText,
        maxRetries: 3,
        onRetry: (attempt, delayMs, reason) => {
          setRetryInfo({
            attempt,
            reason: `${reason} (약 ${(delayMs / 1000).toFixed(1)}초 후 ${attempt + 1}회차 재시도)`
          });
        }
      });

      setParsedResult(result.receipt);
      setSourceType(result.source);
    } catch (err: unknown) {
      console.error('Receipt parse failure:', err);
      const message = err instanceof Error ? err.message : '영수증 분석 중 문제가 발생했습니다.';
      setError(message);
      // Automatically reveal manual fallback so user is not blocked
      setShowManualFallback(true);
    } finally {
      setIsScanning(false);
      setRetryInfo(null);
    }
  };

  const handleRunLocalFallback = () => {
    if (!fallbackRawText.trim()) {
      setError('분석할 영수증 텍스트를 입력해주세요.');
      return;
    }

    setError(null);
    try {
      const localParsed = parseReceiptTextLocally(fallbackRawText, currentCurrency);
      setParsedResult(localParsed);
      setSourceType('local_fallback');
      setShowManualFallback(false);
    } catch (err: unknown) {
      setError('로컬 파서 분석 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setCompressionMeta(null);
    setParsedResult(null);
    setError(null);
    setRetryInfo(null);
    setShowManualFallback(false);
    setFallbackRawText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApply = () => {
    if (parsedResult) {
      onConfirm(parsedResult);
      onClose();
      handleReset();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden transition-all flex flex-col max-h-[90vh] ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0E1526] border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
          isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
            }`}>
              <Camera size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold tracking-tight">AI 영수증 스캐너</h3>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  Phase 1 AI
                </span>
              </div>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                1280px 자동 압축 & 구조화된 JSON Vision 추출
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              isLight ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Network & Offline Status Banner */}
        {isOffline && (
          <div className="px-5 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
            <WifiOff size={14} className="shrink-0" />
            <span className="font-medium text-[11px]">오프라인 상태입니다. 온디바이스 로컬 파서 모드가 활성화됩니다.</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setError(null)} 
                className="text-sm font-bold text-rose-400 hover:text-rose-600 shrink-0"
              >
                ×
              </button>
            </div>
          )}

          {/* Retry notification */}
          {retryInfo && (
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs flex items-center gap-2.5 animate-pulse">
              <RefreshCw size={14} className="animate-spin shrink-0" />
              <div>
                <span className="font-bold">자동 복구 재시도 중 ({retryInfo.attempt}/3회)</span>
                <p className="text-[11px] opacity-80 mt-0.5">{retryInfo.reason}</p>
              </div>
            </div>
          )}

          {!imagePreview ? (
            /* Upload Drop Area */
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isLight 
                    ? 'border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/20' 
                    : 'border-white/10 hover:border-[#00F5A0]/40 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs ${
                  isLight ? 'bg-white border-slate-200 text-indigo-600' : 'bg-white/[0.05] border-white/10 text-[#00F5A0]'
                }`}>
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold">영수증 사진 업로드 또는 터치하여 촬영</p>
                  <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                    드래그 앤 드롭 또는 카메라로 실시간 캡처
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] opacity-75 mt-1">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  <span>1280px 자동 최적화 & 위치/EXIF 메타데이터 자동 제거</span>
                </div>
              </div>

              {/* Quick toggle to manual text fallback */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowManualFallback(prev => !prev)}
                  className={`text-xs font-medium underline underline-offset-4 hover:opacity-80 transition-opacity ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {showManualFallback ? '사진 업로드 모드로 돌아가기' : '사진 대신 영수증 텍스트 직접 입력하기'}
                </button>
              </div>
            </div>
          ) : (
            /* Image Preview & Scan Result */
            <div className="space-y-3.5">
              <div className="relative rounded-2xl overflow-hidden border border-black/10 max-h-44 bg-black/40 flex items-center justify-center">
                <img 
                  src={imagePreview} 
                  alt="영수증 프리뷰" 
                  className="w-full h-44 object-cover opacity-90"
                />
                
                {/* Compression Specs Badge */}
                {compressionMeta && (
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white flex items-center gap-2">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ImageIcon size={10} />
                      {compressionMeta.width}×{compressionMeta.height}
                    </span>
                    <span className="opacity-40">|</span>
                    <span>{compressionMeta.mimeType.replace('image/', '').toUpperCase()}</span>
                    <span className="opacity-40">|</span>
                    <span>{compressionMeta.originalKB}KB → <strong className="text-emerald-400">{compressionMeta.compressedKB}KB</strong></span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black transition-colors"
                  title="다른 이미지 선택"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Scanning indicator */}
              {isScanning && (
                <div className={`p-4 rounded-2xl border text-center space-y-2 flex flex-col items-center ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'
                }`}>
                  <Loader2 size={24} className="animate-spin text-emerald-500" />
                  <p className="text-xs font-bold">Gemini Vision AI 구조화 분석 중...</p>
                  <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                    가맹점명, 총액, 상세 품목을 JSON 스키마로 추출하고 있습니다
                  </p>
                </div>
              )}

              {/* Parsed Result Card */}
              {parsedResult && !isScanning && (
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-white/[0.03] border-white/10'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold flex items-center gap-1 text-emerald-600 dark:text-[#00F5A0]">
                        <Sparkles size={14} /> 인식 완료
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        sourceType === 'local_fallback' 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {sourceType === 'local_fallback' ? '로컬 오프라인 파서' : 'Gemini 3.8 Flash'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono opacity-70">
                      신뢰도 {Math.round(parsedResult.confidenceScore * 100)}%
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[11px] block ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>가맹점</span>
                      <span className="text-sm font-bold block mt-0.5">{parsedResult.merchantName || parsedResult.merchant}</span>
                      <span className="text-[10px] opacity-60 block">{parsedResult.date}</span>
                    </div>

                    <div className="text-right">
                      <span className={`text-[11px] block ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>총 결제 금액</span>
                      <span className="text-base font-black text-emerald-600 dark:text-[#00F5A0] block mt-0.5 font-mono">
                        {getCurrencySymbol(parsedResult.currency as SupportedCurrency)}{parsedResult.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  {parsedResult.items && parsedResult.items.length > 0 && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/5">
                      <span className={`text-[10px] font-semibold uppercase block mb-1.5 ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                        추출된 상세 품목 ({parsedResult.items.length}개)
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-none pr-1">
                        {parsedResult.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                            <span className="truncate pr-2">{it.name} {it.quantity && it.quantity > 1 ? `× ${it.quantity}` : ''}</span>
                            <span className="font-mono shrink-0">
                              {getCurrencySymbol(parsedResult.currency as SupportedCurrency)}{(it.price || it.amount || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium ${
                      isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
                    }`}>
                      카테고리: {parsedResult.category || parsedResult.suggestedCategory}
                    </span>
                    {parsedResult.paymentMethod && (
                      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium ${
                        isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
                      }`}>
                        결제: {parsedResult.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual / Offline Heuristic Fallback Panel */}
          {showManualFallback && (
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/10'
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <FileText size={14} className="text-indigo-500" />
                <span>영수증 텍스트 직접 입력 / 로컬 파서</span>
              </div>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                영수증에 적힌 내용이나 카드 결제 문자를 붙여넣으면 오프라인 규칙 엔진으로 즉시 분석합니다.
              </p>
              <textarea
                value={fallbackRawText}
                onChange={(e) => setFallbackRawText(e.target.value)}
                placeholder="예: 스타벅스 강남점&#10;2026-09-19&#10;아메리카노 4,500원&#10;합계: 4,500원"
                rows={3}
                className={`w-full p-2.5 rounded-xl border text-xs font-mono resize-none focus:outline-hidden transition-colors ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500' 
                    : 'bg-black/30 border-white/10 text-white focus:border-[#00F5A0]'
                }`}
              />
              <button
                type="button"
                onClick={handleRunLocalFallback}
                className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                로컬 휴리스틱 분석 실행
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`px-5 py-3 border-t flex items-center justify-between gap-2 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-100' : 'bg-black/20 border-white/5'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            닫기
          </button>
          
          <div className="flex items-center gap-2">
            {imagePreview && !isScanning && !parsedResult && (
              <button
                type="button"
                onClick={() => {
                  if (imagePreview && compressionMeta) {
                    runAnalysis(imagePreview, compressionMeta.mimeType);
                  }
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                  isLight ? 'border-slate-300 hover:bg-slate-200 text-slate-700' : 'border-white/20 hover:bg-white/10 text-white'
                }`}
              >
                <RefreshCw size={12} />
                <span>재분석</span>
              </button>
            )}

            {parsedResult && (
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#00F5A0] to-[#00D9F5] text-[#0B0F17] hover:opacity-95 active:scale-95 shadow-md flex items-center gap-1.5 transition-all"
              >
                <Check size={14} />
                <span>가계부에 기록</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
