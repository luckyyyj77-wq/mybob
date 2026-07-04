"use client";

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from '@/i18n/routing';
import { FaSpinner, FaUpload, FaArrowLeft, FaCamera, FaHome } from 'react-icons/fa';
import { useAuth } from '@/lib/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { getStorageMode } from '@/lib/storage-mode';
import { savePhoto } from '@/lib/indexed-db';
import { updateGoalAchievement } from '@/lib/goal-achievement';
import { enqueuePendingMeal } from '@/lib/pending-meals';
import { getFrequentFoodNames } from '@/lib/frequent-foods';
import { useTranslations, useLocale } from 'next-intl';

type AnalysisResult = {
  name: string;
  calories: number;
  category?: string;
  amount?: string;
  confidence?: 'high' | 'medium' | 'low';
  itemCount?: number;
  nutrients: {
    carbohydrates: number;
    protein: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    caffeine?: number | null;
    vitaminA?: number;
    vitaminC?: number;
    vitaminD?: number;
    calcium?: number;
    iron?: number;
    potassium?: number;
  };
};

type Portion = 1 | 0.5 | 0.25;
type Rating = 2 | 1 | 0 | null;
type CaptureMode = 'food' | 'ocr';

// 클라이언트에서 이미지 리사이즈 (전송 용량 절감)
function resizeImage(dataUrl: string, maxWidth = 1024, quality = 0.92): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// video 프레임을 dataURL로 캡처
function captureFrameFromVideo(video: HTMLVideoElement, quality = 0.95): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

// 가이드 프레임 영역만 잘라 캡처 — 배경 노이즈를 줄여 인식률·분석 속도 개선
// 화면의 가이드 박스(min(78vw, 55vh) 정사각형)를 objectFit: cover 역산으로
// video 좌표계에 매핑하고, 프레임에 살짝 걸친 음식까지 담기게 8% 여유를 둔다
function captureCroppedFrame(video: HTMLVideoElement, quality = 0.95): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth || window.innerWidth;
  const ch = video.clientHeight || window.innerHeight;
  const guideSide = Math.min(cw * 0.78, ch * 0.55);
  const coverScale = Math.max(cw / vw, ch / vh);
  const cropSide = Math.min((guideSide / coverScale) * 1.08, vw, vh);
  const sx = (vw - cropSide) / 2;
  const sy = (vh - cropSide) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = cropSide;
  canvas.height = cropSide;
  canvas.getContext('2d')!.drawImage(video, sx, sy, cropSide, cropSide, 0, 0, cropSide, cropSide);
  return canvas.toDataURL('image/jpeg', quality);
}

const CONFIDENCE_COLOR: Record<string, string> = { high: '#16a34a', medium: '#d97706', low: '#9ca3af' };

type PermState = 'checking' | 'granted' | 'denied' | 'prompt';

export default function CameraCapturePage() {
  const { token } = useAuth();
  const t = useTranslations('Capture');
  const tc = useTranslations('Common');
  const locale = useLocale();
  
  const foodVideoRef = useRef<HTMLVideoElement>(null);
  const foodStreamRef = useRef<MediaStream | null>(null);
  const ocrVideoRef = useRef<HTMLVideoElement>(null);
  const ocrStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [resizedImageSrc, setResizedImageSrc] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permState, setPermState] = useState<PermState>('checking');
  const [uploadStatus, setUploadStatus] = useState<{ upload: { used: number; limit: number }; analysis: { used: number; limit: number }; plan: string } | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<'analysis' | 'upload'>('analysis');
  const [portion, setPortion] = useState<Portion>(1);
  const [rating, setRating] = useState<Rating>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('food');
  const [ocrMeta, setOcrMeta] = useState<{ barcode?: string | null; serving_size?: string; servings_per_container?: number | null } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'neighbors' | 'public'>('private');
  const [pendingSaved, setPendingSaved] = useState(false);

  const SOURCE_LABEL: Record<string, string> = useMemo(() => ({
    'korean_db+gemini':    t('sourceLabel.korean_db_gemini'),
    'openfoodfacts+gemini': t('sourceLabel.global_db_gemini'),
    'gemini_only':         t('sourceLabel.gemini'),
    'haiku_only':          t('sourceLabel.haiku'),
    'korean_db+haiku':     t('sourceLabel.korean_db_haiku'),
    'openfoodfacts+haiku': t('sourceLabel.global_db_haiku'),
    'korean_db_only':      t('sourceLabel.korean_db'),
    'openfoodfacts_only':  t('sourceLabel.global_db'),
    'ocr':                 t('sourceLabel.ocr'),
    'barcode+off':         t('sourceLabel.barcode_db'),
    'barcode+ocr':         t('sourceLabel.barcode_ocr'),
  }), [t]);

  const PORTION_LABELS: { value: Portion; label: string }[] = useMemo(() => [
    { value: 1, label: '1' },
    { value: 0.5, label: '½' },
    { value: 0.25, label: '¼' },
  ], []);

  const RATING_OPTIONS: { value: Rating; emoji: string; label: string }[] = useMemo(() => [
    { value: 2, emoji: '😊', label: t('ratings.excellent') },
    { value: 1, emoji: '😐', label: t('ratings.good') },
    { value: 0, emoji: '😞', label: t('ratings.poor') },
  ], [t]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/upload-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUploadStatus({ upload: data.upload, analysis: data.analysis, plan: data.plan }); })
      .catch(() => {});
  }, [token]);

  const startFoodCamera = useCallback(async () => {
    try {
      if (!foodStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        foodStreamRef.current = stream;
        localStorage.setItem('mybob_camera_granted', '1');
      }
      const stream = foodStreamRef.current!;
      const video = foodVideoRef.current;
      if (!video) return;

      if (video.srcObject === stream && !video.paused && video.readyState >= 2) return;

      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) { resolve(); return; }
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities() as any;
        if (caps?.focusMode?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
        }
      }
      setCameraReady(true);
    } catch (err) {
      const name = (err as DOMException)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        localStorage.removeItem('mybob_camera_granted');
        setPermState('denied');
      }
    }
  }, []);

  const stopFoodCamera = useCallback(() => {
    if (foodStreamRef.current) {
      foodStreamRef.current.getTracks().forEach(t => t.stop());
      foodStreamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    let permStatus: PermissionStatus | null = null;

    const checkCamera = async () => {
      if (navigator.permissions) {
        try {
          permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permStatus.state === 'granted') {
            localStorage.setItem('mybob_camera_granted', '1');
            setPermState('granted');
            return;
          } else if (permStatus.state === 'denied') {
            localStorage.removeItem('mybob_camera_granted');
            setPermState('denied');
            return;
          }
          permStatus.onchange = () => {
            if (permStatus!.state === 'granted') {
              localStorage.setItem('mybob_camera_granted', '1');
              setPermState('granted');
            } else if (permStatus!.state === 'denied') {
              localStorage.removeItem('mybob_camera_granted');
              setPermState('denied');
            }
          };
          setPermState('prompt');
          return;
        } catch { /* 미지원 */ }
      }

      if (localStorage.getItem('mybob_camera_granted') === '1') {
        setPermState('granted');
        return;
      }
      setPermState('prompt');
    };

    checkCamera();
    return () => { if (permStatus) permStatus.onchange = null; };
  }, []);

  useEffect(() => {
    if (permState === 'granted' && captureMode === 'food') {
      startFoodCamera();
    } else if (permState !== 'granted' || captureMode !== 'food') {
      stopFoodCamera();
    }
  }, [permState, captureMode, startFoodCamera, stopFoodCamera]);

  useEffect(() => {
    return () => { stopFoodCamera(); };
  }, [stopFoodCamera]);

  const requestCamera = () => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    }).then((stream) => {
      foodStreamRef.current = stream;
      localStorage.setItem('mybob_camera_granted', '1');
      setPermState('granted');
    }).catch((err) => {
      const name = (err as DOMException)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        localStorage.removeItem('mybob_camera_granted');
        setPermState('denied');
      }
    });
  };

  const startOcrCamera = useCallback(async () => {
    if (ocrStreamRef.current) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        return;
      }
    }
    ocrStreamRef.current = stream;

    const track = stream.getVideoTracks()[0];
    if (track) {
      const caps = track.getCapabilities() as any;
      if (caps?.focusMode?.includes('continuous')) {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }); } catch { /* 무시 */ }
      }
    }

    if (ocrVideoRef.current) {
      ocrVideoRef.current.srcObject = stream;
      await ocrVideoRef.current.play();
    }
  }, []);

  const stopOcrCamera = useCallback(() => {
    if (ocrStreamRef.current) {
      ocrStreamRef.current.getTracks().forEach(t => t.stop());
      ocrStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (captureMode === 'ocr' && !imageSrc && permState === 'granted') {
      const timer = setTimeout(() => { startOcrCamera(); }, 300);
      return () => { clearTimeout(timer); stopOcrCamera(); };
    } else {
      stopOcrCamera();
    }
    return () => { stopOcrCamera(); };
  }, [captureMode, imageSrc, permState, startOcrCamera, stopOcrCamera]);


  const capture = useCallback(() => {
    const video = foodVideoRef.current;
    if (video && video.readyState >= 2) {
      const image = captureCroppedFrame(video);
      if (image) {
        setImageSrc(image);
        setAnalysis(null);
        setSaved(false);
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSrc(reader.result as string);
      setAnalysis(null);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const savePending = async (resizedImg: string) => {
    try {
      const id = Date.now().toString();
      await enqueuePendingMeal({
        id,
        imageBase64: resizedImg,
        capturedAt: new Date().toISOString(),
        retryCount: 0,
        locale,
        storageMode: getStorageMode(),
        rating,
        portion,
        visibility,
      });
      setPendingSaved(true);
    } catch {
      setAnalysisError(t('errors.general'));
    }
  };

  const handleAnalysis = async () => {
    if (!imageSrc) return;
    if (!token) return;
    setLoadingAnalysis(true);
    setAnalysisError(null);
    const apiMode = captureMode === 'ocr' ? 'ocr' : 'food';
    let imageToSend: string | null = null;
    try {
      const resized = apiMode === 'ocr' ? imageSrc : await resizeImage(imageSrc, 800);
      if (apiMode !== 'ocr') setResizedImageSrc(resized);
      imageToSend = resized;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: imageToSend,
          mode: apiMode,
          locale,
          frequentFoods: apiMode === 'food' ? getFrequentFoodNames() : undefined,
        }),
      });
      const result = await res.json();

      if (res.status === 429 && result.error === 'ANALYSIS_LIMIT_EXCEEDED') {
        setUploadStatus(prev => prev ? {
          ...prev,
          analysis: { used: result.used, limit: result.limit },
        } : null);
        setLimitType('analysis');
        setShowLimitModal(true);
        return;
      }

      if (res.status === 429) {
        await savePending(imageToSend);
        return;
      }

      if (res.status === 503) {
        await savePending(imageToSend);
        return;
      }

      if (res.status === 422 && result.error === 'NOT_FOOD') {
        setAnalysisError(t('errors.notFood'));
        return;
      }

      if (res.status === 422 && result.error === 'OCR_NOT_READABLE') {
        setAnalysisError(t('errors.ocrFailed'));
        return;
      }

      if (!res.ok) {
        setAnalysisError(result.details || result.error || t('errors.general'));
        return;
      }
      if (result.success) {
        setAnalysis(result.food);
        setAnalysisSource(result.source || null);
        setAnalysisModel(result.modelUsed || null);
        setOcrMeta(result.ocrMeta || null);
        if (result.analysisStatus) {
          setUploadStatus(prev => prev ? {
            ...prev,
            analysis: { used: result.analysisStatus.used, limit: result.analysisStatus.limit },
          } : null);
        }
      }
    } catch {
      // 네트워크 오류(오프라인 등) — 이미지가 준비돼 있으면 pending 큐에 저장해 나중에 자동 분석
      if (imageToSend && apiMode === 'food') {
        await savePending(imageToSend);
      } else {
        setAnalysisError(t('errors.general'));
      }
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSave = async () => {
    if (!analysis || !imageSrc) return;
    setLoadingSave(true);

    const mode = getStorageMode();
    const mealId = Date.now().toString();

    const scaledCalories = Math.round(analysis.calories * portion);
    const scaledNutrients = Object.fromEntries(
      Object.entries(analysis.nutrients).map(([k, v]) =>
        [k, v != null ? Math.round((v as number) * portion * 10) / 10 : v]
      )
    );

    try {
      if (mode === 'local') {
        await savePhoto(mealId, imageSrc);

        const localMeal = {
          id: mealId,
          food_name: analysis.name,
          calories: scaledCalories,
          nutrient: scaledNutrients,
          category: analysis.category,
          photo_url: `local:${mealId}`,
          created_at: new Date().toISOString(),
          rating,
          portion,
          original_nutrition: { calories: analysis.calories, nutrients: analysis.nutrients },
          is_public: false,
          visibility: 'private',
        };
        const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
        localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
        updateGoalAchievement();
        { const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); Object.keys(localStorage).filter(k => k.startsWith('mybob_coach_') && k.includes(today)).forEach(k => localStorage.removeItem(k)); }

      } else {
        if (!token) {
          throw new Error('AUTH_ERROR');
        }

        let serverPhotoUrl: string | null = null;

        const resizedForUpload = resizedImageSrc ?? await resizeImage(imageSrc, 800);
        const res = await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mealData: {
              ...analysis,
              calories: scaledCalories,
              nutrients: scaledNutrients,
            },
            imageBase64: resizedForUpload,
            rating,
            portion,
            originalNutrition: { calories: analysis.calories, nutrients: analysis.nutrients },
            isPublic: visibility !== 'private',
            visibility,
          }),
        });
        const result = await res.json();

        if (res.status === 429 && result.error === 'UPLOAD_LIMIT_EXCEEDED') {
          setUploadStatus(prev => prev ? {
            ...prev,
            upload: { used: result.used, limit: result.limit },
          } : null);
          setLimitType('upload');
          setShowLimitModal(true);
          setLoadingSave(false);
          return;
        }

        if (!res.ok) {
          throw new Error('SAVE_FAILED');
        }

        let serverId = mealId;
        if (result.success && result.data?.[0]) {
          serverPhotoUrl = result.data[0].photo_url ?? null;
          serverId = result.data[0].id ?? mealId;
          if (result.uploadStatus) {
            setUploadStatus(prev => prev ? {
              ...prev,
              upload: { used: result.uploadStatus.used, limit: result.uploadStatus.limit },
            } : null);
          }
        }

        const localMeal = {
          id: serverId,
          food_name: analysis.name,
          calories: scaledCalories,
          nutrient: scaledNutrients,
          category: analysis.category,
          photo_url: serverPhotoUrl ?? imageSrc,
          created_at: new Date().toISOString(),
          rating,
          portion,
          original_nutrition: { calories: analysis.calories, nutrients: analysis.nutrients },
          is_public: visibility !== 'private',
          visibility,
        };
        const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
        localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
        updateGoalAchievement();
        { const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); Object.keys(localStorage).filter(k => k.startsWith('mybob_coach_') && k.includes(today)).forEach(k => localStorage.removeItem(k)); }
      }

      setSaved(true);
    } catch {
      setAnalysisError(t('errors.general'));
    } finally {
      setLoadingSave(false);
    }
  };

  const retake = () => {
    setImageSrc(null);
    setResizedImageSrc(null);
    setAnalysis(null);
    setAnalysisSource(null);
    setAnalysisModel(null);
    setSaved(false);
    setPortion(1);
    setRating(null);
    setOcrMeta(null);
    setAnalysisError(null);
    setPendingSaved(false);
    setCaptureMode('food');
    if (fileInputRef.current) fileInputRef.current.value = '';
    stopOcrCamera();
    // captureMode를 'food'로 바꾸면 useEffect가 startFoodCamera()를 실행함
  };

  if (permState === 'checking') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const galleryInput = (
    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
  );

  if (permState === 'denied') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '20px' }}>
        {galleryInput}
        <Link href="/" style={{ position: 'absolute', top: '20px', left: '20px', textDecoration: 'none' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={15} color="white" />
          </div>
        </Link>
        <FaCamera size={36} color="rgba(255,255,255,0.4)" />
        <p style={{ color: 'white', fontSize: '16px', fontWeight: 400, textAlign: 'center', lineHeight: 1.5 }}>{t('permDenied')}</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
          {t('permDeniedDetail')}
        </p>
        <button
          onClick={() => { localStorage.removeItem('mybob_camera_granted'); setPermState('prompt'); }}
          style={{ padding: '12px 28px', backgroundColor: 'white', color: 'black', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          {t('permRetry')}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '12px 28px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          {t('gallerySelect')}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (permState === 'prompt') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '20px' }}>
        {galleryInput}
        <Link href="/" style={{ position: 'absolute', top: '20px', left: '20px', textDecoration: 'none' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaArrowLeft size={15} color="white" />
          </div>
        </Link>
        <FaCamera size={36} color="white" />
        <p style={{ color: 'white', fontSize: '16px', fontWeight: 400, textAlign: 'center', lineHeight: 1.5 }}>{t('permPrompt')}</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', lineHeight: 1.8 }}>
          {t('permPromptDetail')}
        </p>
        <button
          onClick={requestCamera}
          style={{ padding: '14px 36px', backgroundColor: 'white', color: 'black', border: 'none', fontSize: '14px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          {tc('confirm')}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '12px 28px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          {t('gallerySelect')}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const LimitModal = () => {
    const isAnalysis = limitType === 'analysis';
    const current = isAnalysis ? uploadStatus?.analysis : uploadStatus?.upload;
    const isFree = uploadStatus?.plan === 'free';
    const typeLabel = isAnalysis ? t('limit.analysis') : t('limit.upload');
    return (
      <div style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 9999, display: 'flex', alignItems: 'flex-end',
      }}>
        <div style={{
          backgroundColor: 'white', width: '100%',
          borderRadius: '16px 16px 0 0', padding: '28px 24px 40px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>{isAnalysis ? '🤖' : '📸'}</p>
            <p style={{ fontSize: '16px', color: 'black', marginBottom: '6px' }}>
              {t('limit.title', { type: typeLabel })}
            </p>
            <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
              {isFree
                ? t('limit.freeDesc', { limit: current?.limit ?? 0, type: typeLabel })
                : t('limit.desc', { limit: current?.limit ?? 0 })}
            </p>
          </div>

          {isFree && (
            <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #e9d5ff', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#6B21A8', marginBottom: '4px' }}>🎖️ {t('Home.foundingMember')}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>{t('limit.desc', { limit: current?.limit ?? 0 })}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => { setShowLimitModal(false); window.location.href = '/'; }}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: 'white', color: 'black', border: '1px solid #e5e7eb',
                fontSize: '13px', cursor: 'pointer', letterSpacing: '1px',
              }}
            >
              {t('goHome')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', flexDirection: 'column' }}>
      {showLimitModal && <LimitModal />}

      <video
        ref={foodVideoRef}
        playsInline
        muted
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          display: (!imageSrc && captureMode === 'food') ? 'block' : 'none',
          zIndex: 0,
        }}
      />

      <AnimatePresence mode="wait">

        {!imageSrc && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {captureMode === 'ocr' && (
              <video
                ref={ocrVideoRef}
                playsInline
                muted
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                }}
              />
            )}

            <Link href="/" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, textDecoration: 'none' }}>
              <div style={{
                width: '40px', height: '40px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FaArrowLeft size={15} color="white" />
              </div>
            </Link>

            {captureMode === 'food' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute', top: '20px', right: '20px', zIndex: 10,
                  width: '40px', height: '40px',
                  backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FaUpload size={14} color="white" />
              </button>
            )}
            {galleryInput}

            {uploadStatus && (
              <div style={{
                position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, backgroundColor: 'rgba(0,0,0,0.55)',
                padding: '4px 12px', borderRadius: '20px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: uploadStatus.analysis.used >= uploadStatus.analysis.limit ? '#f87171' : 'white' }}>
                  {uploadStatus.analysis.used}/{uploadStatus.analysis.limit}
                </span>
                {uploadStatus.plan !== 'free' && (
                  <span style={{ fontSize: '9px', color: '#a78bfa', letterSpacing: '1px' }}>PRO</span>
                )}
              </div>
            )}

            {captureMode === 'food' ? (
              <button
                onClick={() => setCaptureMode('ocr')}
                style={{
                  position: 'absolute', bottom: '40px', right: '28px', zIndex: 10,
                  width: '48px', height: '48px',
                  backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                  border: 'none', cursor: 'pointer', fontSize: '22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                📋
              </button>
            ) : (
              <button
                onClick={() => { stopOcrCamera(); setCaptureMode('food'); }}
                style={{
                  position: 'absolute', bottom: '40px', right: '28px', zIndex: 10,
                  width: '48px', height: '48px',
                  backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                  border: 'none', cursor: 'pointer', fontSize: '22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                📷
              </button>
            )}

            {captureMode === 'food' && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                <div style={{ width: 'min(78vw, 55vh)', aspectRatio: '1', border: '1.5px solid rgba(255,255,255,0.55)', borderRadius: '16px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.32)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '24px', height: '24px', borderTop: '3px solid white', borderLeft: '3px solid white', borderRadius: '16px 0 0 0' }} />
                  <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '24px', height: '24px', borderTop: '3px solid white', borderRight: '3px solid white', borderRadius: '0 16px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '24px', height: '24px', borderBottom: '3px solid white', borderLeft: '3px solid white', borderRadius: '0 0 0 16px' }} />
                  <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '24px', height: '24px', borderBottom: '3px solid white', borderRight: '3px solid white', borderRadius: '0 0 16px 0' }} />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', letterSpacing: '0.5px', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{t('cropGuide')}</p>
              </div>
            )}

            {captureMode === 'ocr' && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '75%', height: '50%', border: '2px solid rgba(167,139,250,0.8)', borderRadius: '8px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '20px', height: '20px', borderTop: '3px solid #a78bfa', borderLeft: '3px solid #a78bfa', borderRadius: '8px 0 0 0' }} />
                  <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '20px', height: '20px', borderTop: '3px solid #a78bfa', borderRight: '3px solid #a78bfa', borderRadius: '0 8px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '20px', height: '20px', borderBottom: '3px solid #a78bfa', borderLeft: '3px solid #a78bfa', borderRadius: '0 0 0 8px' }} />
                  <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '20px', height: '20px', borderBottom: '3px solid #a78bfa', borderRight: '3px solid #a78bfa', borderRadius: '0 0 8px 0' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '2px', backgroundColor: 'rgba(167,139,250,0.7)', animation: 'scanline 2s ease-in-out infinite' }} />
                </div>
              </div>
            )}


            {captureMode === 'food' && (
              <button
                onClick={capture}
                disabled={!cameraReady}
                style={{
                  position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                  width: '68px', height: '68px',
                  backgroundColor: cameraReady ? 'white' : 'rgba(255,255,255,0.3)',
                  borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)',
                  cursor: cameraReady ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                <div style={{ width: '44px', height: '44px', backgroundColor: cameraReady ? 'white' : 'rgba(255,255,255,0.4)', borderRadius: '50%', border: '2px solid #e5e7eb' }} />
              </button>
            )}

            {captureMode === 'ocr' && (
              <button
                onClick={() => {
                  if (!ocrVideoRef.current) return;
                  const frame = captureFrameFromVideo(ocrVideoRef.current, 0.95);
                  stopOcrCamera();
                  setImageSrc(frame);
                }}
                style={{
                  position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                  width: '68px', height: '68px',
                  backgroundColor: 'white', borderRadius: '50%',
                  border: '4px solid rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                <div style={{ width: '44px', height: '44px', backgroundColor: 'white', borderRadius: '50%', border: '2px solid #e5e7eb' }} />
              </button>
            )}
          </motion.div>
        )}

        {imageSrc && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}
          >
            <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden', backgroundColor: 'black' }}>
              <img src={imageSrc} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {!loadingAnalysis && (
                <button
                  onClick={retake}
                  style={{
                    position: 'absolute', top: '16px', left: '16px',
                    width: '38px', height: '38px',
                    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <FaArrowLeft size={14} color="white" />
                </button>
              )}
            </div>

            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 0' }}>

                {loadingAnalysis && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
                    <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>{t('analyzing')}</p>
                  </div>
                )}

                {!loadingAnalysis && !analysis && pendingSaved && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '0 20px' }}>
                    <p style={{ fontSize: '28px' }}>📸</p>
                    <p style={{ fontSize: '14px', color: 'black', fontWeight: 500, textAlign: 'center' }}>{t('pending.saved')}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{t('pending.savedDesc')}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={retake}
                        style={{ padding: '10px 18px', backgroundColor: 'black', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {t('retake')}
                      </button>
                      <Link
                        href="/"
                        style={{ padding: '10px 18px', backgroundColor: 'white', color: 'black', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                      >
                        {t('goHome')}
                      </Link>
                    </div>
                  </div>
                )}

                {!loadingAnalysis && !analysis && !pendingSaved && analysisError && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '0 8px' }}>
                    <p style={{ fontSize: '22px' }}>⚠️</p>
                    <p style={{ fontSize: '13px', color: '#ef4444', textAlign: 'center', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{analysisError}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => setAnalysisError(null)}
                        style={{ padding: '10px 18px', backgroundColor: 'black', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {tc('retry')}
                      </button>
                      <button
                        onClick={retake}
                        style={{ padding: '10px 18px', backgroundColor: 'white', color: 'black', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {t('retake')}
                      </button>
                    </div>
                    <Link
                      href="/history?quicklog=1"
                      style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {t('manualEntry')}
                    </Link>
                  </div>
                )}

                {!loadingAnalysis && !analysis && !pendingSaved && !analysisError && (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>{t('analyzed')}</p>
                  </div>
                )}

                {!loadingAnalysis && analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 400, color: 'black' }}>{analysis.name}</h3>
                          {analysis.itemCount && analysis.itemCount > 1 && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#f3e8ff', color: '#6B21A8', borderRadius: '10px', flexShrink: 0 }}>
                              {analysis.itemCount}종
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {analysis.category && (
                            <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>{analysis.category} · {analysis.amount || '1 serving'}</span>
                          )}
                          {analysisSource && (
                            <span style={{
                              fontSize: '9px', padding: '2px 6px', letterSpacing: '0.5px',
                              backgroundColor: analysisSource === 'ocr' ? '#f3e8ff' : '#f3f4f6',
                              color: analysisSource === 'ocr' ? '#6B21A8' : '#6b7280',
                              fontWeight: analysisSource === 'ocr' ? 600 : 400,
                            }}>
                              {SOURCE_LABEL[analysisSource] || analysisSource}
                            </span>
                          )}
                          {analysis.confidence && analysisSource !== 'ocr' && (
                            <span style={{ fontSize: '9px', padding: '2px 6px', backgroundColor: '#f3f4f6', color: CONFIDENCE_COLOR[analysis.confidence], letterSpacing: '0.5px', fontWeight: 500 }}>
                              {tc('confirm')} {analysis.confidence === 'high' ? 'High' : analysis.confidence === 'medium' ? 'Medium' : 'Low'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '20px', color: '#6B21A8', lineHeight: 1 }}>{Math.round(analysis.calories * portion)}</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                      </div>
                    </div>

                    {ocrMeta && analysisSource === 'ocr' && (
                      <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#f3e8ff',
                        border: '1px solid #d8b4fe',
                        borderRadius: '6px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        <span style={{ fontSize: '14px' }}>📋</span>
                        <div>
                          <p style={{ fontSize: '11px', color: '#6B21A8', fontWeight: 500 }}>{t('ocrGuide')}</p>
                          <p style={{ fontSize: '10px', color: '#7c3aed', marginTop: '1px' }}>
                            {t('servingSize', { size: ocrMeta.serving_size || analysis.amount || '' })}
                            {ocrMeta.servings_per_container != null && t('totalServings', { count: ocrMeta.servings_per_container })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {analysisSource === 'ocr' ? t('portionLabelOCR') : t('portionLabel')}
                      </p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(analysisSource === 'ocr'
                          ? [
                              { value: 1 as Portion,    label: '1 serving' },
                              { value: 0.5 as Portion,  label: '½ serving' },
                              { value: 0.25 as Portion, label: '¼ serving' },
                            ]
                          : PORTION_LABELS
                        ).map(p => (
                          <button
                            key={p.value}
                            onClick={() => setPortion(p.value)}
                            style={{
                              flex: 1, padding: '8px 0',
                              backgroundColor: portion === p.value ? 'black' : 'white',
                              color: portion === p.value ? 'white' : 'black',
                              border: `1px solid ${portion === p.value ? 'black' : '#e5e7eb'}`,
                              fontSize: analysisSource === 'ocr' ? '12px' : '14px', cursor: 'pointer',
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>{t('ratingLabel')}</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {RATING_OPTIONS.map(r => (
                          <button
                            key={r.value}
                            onClick={() => setRating(rating === r.value ? null : r.value)}
                            style={{
                              flex: 1, padding: '8px 0',
                              backgroundColor: rating === r.value ? '#f3e8ff' : 'white',
                              border: `1px solid ${rating === r.value ? '#6B21A8' : '#e5e7eb'}`,
                              fontSize: '18px', cursor: 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                            }}
                          >
                            <span>{r.emoji}</span>
                            <span style={{ fontSize: '8px', color: rating === r.value ? '#6B21A8' : '#9ca3af', letterSpacing: '0.5px' }}>{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { label: t('nutrients.carbohydrates'), value: analysis.nutrients.carbohydrates, unit: 'g' },
                        { label: t('nutrients.protein'), value: analysis.nutrients.protein, unit: 'g' },
                        { label: t('nutrients.fat'), value: analysis.nutrients.fat, unit: 'g' },
                        { label: t('nutrients.fiber'), value: analysis.nutrients.fiber, unit: 'g' },
                        { label: t('nutrients.sugar'), value: analysis.nutrients.sugar, unit: 'g' },
                        { label: t('nutrients.sodium'), value: analysis.nutrients.sodium, unit: 'mg' },
                        { label: t('nutrients.caffeine'), value: analysis.nutrients.caffeine, unit: 'mg' },
                      ].filter(n => n.value != null && n.value !== 0).map(n => (
                        <div key={n.label} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                          <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '0.5px', marginBottom: '2px' }}>{n.label}</p>
                          <p style={{ fontSize: '13px', color: 'black' }}>{n.value}{n.unit}</p>
                        </div>
                      ))}
                    </div>

                    {[
                      { label: 'Vit A', value: analysis.nutrients.vitaminA, unit: 'μg' },
                      { label: 'Vit C', value: analysis.nutrients.vitaminC, unit: 'mg' },
                      { label: 'Vit D', value: analysis.nutrients.vitaminD, unit: 'μg' },
                      { label: 'Calcium', value: analysis.nutrients.calcium, unit: 'mg' },
                      { label: 'Iron', value: analysis.nutrients.iron, unit: 'mg' },
                      { label: 'Potassium', value: analysis.nutrients.potassium, unit: 'mg' },
                    ].filter(n => n.value != null && n.value !== 0).length > 0 && (
                      <div>
                        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>{t('nutrients.vitamins')}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[
                            { label: 'Vit A', value: analysis.nutrients.vitaminA, unit: 'μg' },
                            { label: 'Vit C', value: analysis.nutrients.vitaminC, unit: 'mg' },
                            { label: 'Vit D', value: analysis.nutrients.vitaminD, unit: 'μg' },
                            { label: 'Calcium', value: analysis.nutrients.calcium, unit: 'mg' },
                            { label: 'Iron', value: analysis.nutrients.iron, unit: 'mg' },
                            { label: 'Potassium', value: analysis.nutrients.potassium, unit: 'mg' },
                          ].filter(n => n.value != null && n.value !== 0).map(n => (
                            <div key={n.label} style={{ padding: '5px 10px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '10px', color: '#6b7280' }}>{n.label}</span>
                              <span style={{ fontSize: '11px', color: '#6B21A8' }}>{n.value}{n.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadStatus?.plan !== 'free' && !saved && (() => {
                      const VIS_OPTIONS = [
                        { value: 'private' as const, emoji: '🔒', label: t('visibility.private') },
                        { value: 'neighbors' as const, emoji: '👥', label: t('visibility.neighbors') },
                        { value: 'public' as const, emoji: '🌏', label: t('visibility.public') },
                      ];
                      return (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {VIS_OPTIONS.map(opt => {
                            const active = visibility === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setVisibility(opt.value)}
                                style={{
                                  flex: 1, padding: '8px 4px', border: `1px solid ${active ? '#a855f7' : '#e5e7eb'}`,
                                  backgroundColor: active ? '#f5f3ff' : 'white',
                                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                                }}
                              >
                                <span style={{ fontSize: '14px' }}>{opt.emoji}</span>
                                <span style={{ fontSize: '10px', color: active ? '#6B21A8' : '#6b7280', fontWeight: active ? 600 : 400 }}>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {saved && (
                      <div style={{ padding: '9px', backgroundColor: 'black', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'white', letterSpacing: '2px', textTransform: 'uppercase' }}>{t('saved')}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <div style={{ flexShrink: 0, padding: '10px 24px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {!analysis && !loadingAnalysis && !analysisError && !pendingSaved && (
                  <button
                    onClick={handleAnalysis}
                    style={{
                      width: '100%', padding: '14px',
                      backgroundColor: 'black', color: 'white', border: 'none',
                      fontSize: '13px', cursor: 'pointer',
                      letterSpacing: '1px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    {captureMode === 'ocr' ? t('ocrBtn') : t('analysisBtn')}
                  </button>
                )}

                {analysis && (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={loadingSave || saved}
                      style={{
                        width: '100%', padding: '14px',
                        backgroundColor: saved ? '#f3f4f6' : 'black',
                        color: saved ? '#9ca3af' : 'white',
                        border: 'none', fontSize: '13px',
                        cursor: (loadingSave || saved) ? 'not-allowed' : 'pointer',
                        letterSpacing: '1px', textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {loadingSave
                        ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                        : saved ? t('saved') : t('saveBtn')}
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={retake}
                        style={{
                          flex: 1, padding: '12px',
                          backgroundColor: 'white', color: 'black',
                          border: '1px solid #e5e7eb', fontSize: '12px',
                          cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                      >
                        <FaCamera size={12} /> {t('retake')}
                      </button>
                      <Link
                        href="/"
                        style={{
                          flex: 1, padding: '12px',
                          backgroundColor: 'white', color: 'black',
                          border: '1px solid #e5e7eb', fontSize: '12px',
                          cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          textDecoration: 'none',
                        }}
                      >
                        <FaHome size={12} /> {t('goHome')}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
        @keyframes scanline { 0%,100% { top:10%; } 50% { top:90%; } }
      `}</style>
    </div>
  );
}
