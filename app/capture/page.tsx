"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaSpinner, FaUpload, FaArrowLeft, FaCamera, FaHome } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { getStorageMode } from '@/lib/storage-mode';
import { savePhoto } from '@/lib/indexed-db';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

type AnalysisResult = {
  name: string;
  calories: number;
  category?: string;
  amount?: string;
  confidence?: 'high' | 'medium' | 'low';
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

const PORTION_LABELS: { value: Portion; label: string }[] = [
  { value: 1, label: '1' },
  { value: 0.5, label: '½' },
  { value: 0.25, label: '¼' },
];

const RATING_OPTIONS: { value: Rating; emoji: string; label: string }[] = [
  { value: 2, emoji: '😊', label: '좋음' },
  { value: 1, emoji: '😐', label: '보통' },
  { value: 0, emoji: '😞', label: '나쁨' },
];

// 클라이언트에서 이미지 리사이즈 (전송 용량 절감)
function resizeImage(dataUrl: string, maxWidth = 800, quality = 0.88): Promise<string> {
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

const SOURCE_LABEL: Record<string, string> = {
  'korean_db+gemini':    '한식DB+AI',
  'openfoodfacts+gemini':'글로벌DB+AI',
  'gemini_only':         'AI추론',
  'korean_db_only':      '한식DB',
  'openfoodfacts_only':  '글로벌DB',
  'ocr':                 '영양표 직접 인식',
  'barcode+off':         '바코드 DB',
  'barcode+ocr':         '바코드+영양표',
};
const CONFIDENCE_COLOR: Record<string, string> = { high: '#16a34a', medium: '#d97706', low: '#9ca3af' };

type PermState = 'checking' | 'granted' | 'denied' | 'prompt';

export default function CameraCapturePage() {
  const webcamRef = useRef<Webcam>(null);
  const ocrVideoRef = useRef<HTMLVideoElement>(null);
  const ocrStreamRef = useRef<MediaStream | null>(null);
  const barcodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const barcodeScanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
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
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeDetected, setBarcodeDetected] = useState<string | null>(null);

  useEffect(() => {
    // 업로드/분석 현황 조회
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.access_token) return;
      try {
        const res = await fetch('/api/upload-status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUploadStatus({ upload: data.upload, analysis: data.analysis, plan: data.plan });
        }
      } catch { /* 무시 */ }
    });
  }, []);

  useEffect(() => {
    // 이미 허용된 것으로 캐시된 경우 바로 granted
    if (localStorage.getItem('mybob_camera_granted') === '1') {
      setPermState('granted');
      return;
    }
    // Permissions API로 현재 상태 확인 (재요청 없이)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then(status => {
        if (status.state === 'granted') {
          localStorage.setItem('mybob_camera_granted', '1');
          setPermState('granted');
        } else if (status.state === 'denied') {
          setPermState('denied');
        } else {
          setPermState('prompt');
        }
        status.onchange = () => {
          if (status.state === 'granted') {
            localStorage.setItem('mybob_camera_granted', '1');
            setPermState('granted');
          } else if (status.state === 'denied') {
            setPermState('denied');
          }
        };
      }).catch(() => {
        // Permissions API 미지원 브라우저 — 바로 웹캠 시도
        setPermState('prompt');
      });
    } else {
      setPermState('prompt');
    }
  }, []);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
      localStorage.setItem('mybob_camera_granted', '1');
      setPermState('granted');
    } catch {
      setPermState('denied');
    }
  };

  // OCR 모드 전용 카메라 스트림 시작
  const startOcrCamera = useCallback(async () => {
    if (ocrStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      ocrStreamRef.current = stream;
      if (ocrVideoRef.current) {
        ocrVideoRef.current.srcObject = stream;
        await ocrVideoRef.current.play();
      }
    } catch {
      // 권한 문제 시 무시 (기존 webcam이 이미 처리함)
    }
  }, []);

  const stopOcrCamera = useCallback(() => {
    barcodeScanningRef.current = false;
    barcodeReaderRef.current = null;
    if (ocrStreamRef.current) {
      ocrStreamRef.current.getTracks().forEach(t => t.stop());
      ocrStreamRef.current = null;
    }
    setBarcodeScanning(false);
    setBarcodeDetected(null);
  }, []);

  // OCR 모드 진입/해제 시 카메라 전환
  useEffect(() => {
    if (captureMode === 'ocr' && !imageSrc && permState === 'granted') {
      startOcrCamera();
    } else {
      stopOcrCamera();
    }
    return () => { stopOcrCamera(); };
  }, [captureMode, imageSrc, permState, startOcrCamera, stopOcrCamera]);

  // 바코드 실시간 스캔 — decodeOnceFromVideoElement 루프 방식
  const startBarcodeScanning = useCallback(async () => {
    if (barcodeScanningRef.current || !ocrVideoRef.current) return;
    barcodeScanningRef.current = true;
    setBarcodeScanning(true);

    const reader = new BrowserMultiFormatReader();
    barcodeReaderRef.current = reader;

    const loop = async () => {
      if (!barcodeScanningRef.current || !ocrVideoRef.current) return;
      try {
        const result = await reader.decodeOnceFromVideoElement(ocrVideoRef.current);
        if (!barcodeScanningRef.current) return;
        barcodeScanningRef.current = false;
        setBarcodeDetected(result.getText());
        setBarcodeScanning(false);
        const frame = captureFrameFromVideo(ocrVideoRef.current);
        setImageSrc(frame);
      } catch (e) {
        if (e instanceof NotFoundException && barcodeScanningRef.current) {
          // 아직 없음 — 짧은 딜레이 후 재시도
          await new Promise(r => setTimeout(r, 200));
          loop();
        }
      }
    };
    loop();
  }, []);

  // video가 재생되기 시작하면 바코드 스캔 시작
  const handleOcrVideoPlay = useCallback(() => {
    startBarcodeScanning();
  }, [startBarcodeScanning]);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot();
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

  const handleAnalysis = async () => {
    if (!imageSrc) return;
    setLoadingAnalysis(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // OCR 모드는 해상도를 높게 유지 (1200px), 음식 모드는 800px
      const resized = await resizeImage(imageSrc, captureMode === 'ocr' ? 1200 : 800);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: resized, mode: captureMode }),
      });
      const result = await res.json();

      // AI 분석 횟수 초과
      if (res.status === 429 && result.error === 'ANALYSIS_LIMIT_EXCEEDED') {
        setUploadStatus(prev => prev ? {
          ...prev,
          analysis: { used: result.used, limit: result.limit },
        } : null);
        setLimitType('analysis');
        setShowLimitModal(true);
        return;
      }

      // 영양표 인식 실패
      if (res.status === 422 && result.error === 'OCR_NOT_READABLE') {
        alert('영양성분표를 인식하지 못했습니다.\n표가 화면에 가득 차도록 다시 촬영해주세요.');
        return;
      }

      if (!res.ok) throw new Error(result.details || result.error || '분석 오류');
      if (result.success) {
        setAnalysis(result.food);
        setAnalysisSource(result.source || null);
        setAnalysisModel(result.modelUsed || null);
        setOcrMeta(result.ocrMeta || null);
        // 분석 카운트 반영
        if (result.analysisStatus) {
          setUploadStatus(prev => prev ? {
            ...prev,
            analysis: { used: result.analysisStatus.used, limit: result.analysisStatus.limit },
          } : null);
        }
      }
    } catch (err: any) {
      alert(`분석 실패: ${err.message}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSave = async () => {
    if (!analysis || !imageSrc) return;
    setLoadingSave(true);

    const mode = getStorageMode();
    const mealId = Date.now().toString();

    // portion 적용: 칼로리 및 영양정보에 배수 적용
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
        };
        const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
        localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));

      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        }

        let serverPhotoUrl: string | null = null;

        const resizedForUpload = await resizeImage(imageSrc, 800);
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
          throw new Error(result.error || result.stack || `서버 저장 실패 (${res.status})`);
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
        };
        const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
        localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
      }

      setSaved(true);
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setLoadingSave(false);
    }
  };

  const retake = () => {
    setImageSrc(null);
    setAnalysis(null);
    setAnalysisSource(null);
    setAnalysisModel(null);
    setSaved(false);
    setPortion(1);
    setRating(null);
    setOcrMeta(null);
    setBarcodeDetected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // OCR 모드면 카메라 재시작 + 바코드 스캔 재시작
    if (captureMode === 'ocr') {
      stopOcrCamera();
      setTimeout(() => startOcrCamera(), 100);
    }
  };

  // 확인 중
  if (permState === 'checking') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 공통 hidden input (권한 화면에서도 갤러리 선택 가능)
  const galleryInput = (
    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
  );

  // 권한 거부됨
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
        <p style={{ color: 'white', fontSize: '16px', fontWeight: 400, textAlign: 'center', lineHeight: 1.5 }}>카메라 권한이 차단되어 있습니다</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', lineHeight: 1.8 }}>
          브라우저 주소창 왼쪽의 자물쇠 아이콘을 탭한 후<br />
          카메라 권한을 <strong style={{ color: 'white' }}>허용</strong>으로 변경하세요.
        </p>
        <button
          onClick={() => { localStorage.removeItem('mybob_camera_granted'); setPermState('prompt'); }}
          style={{ padding: '12px 28px', backgroundColor: 'white', color: 'black', border: 'none', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          다시 시도
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '12px 28px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          갤러리에서 선택
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 권한 요청 필요
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
        <p style={{ color: 'white', fontSize: '16px', fontWeight: 400, textAlign: 'center', lineHeight: 1.5 }}>카메라 접근 권한이 필요합니다</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', lineHeight: 1.8 }}>
          허용을 누르면 이후 다시 묻지 않습니다.
        </p>
        <button
          onClick={requestCamera}
          style={{ padding: '14px 36px', backgroundColor: 'white', color: 'black', border: 'none', fontSize: '14px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          카메라 허용
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '12px 28px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
        >
          갤러리에서 선택
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 제한 초과 모달 (분석/저장 공통)
  const LimitModal = () => {
    const isAnalysis = limitType === 'analysis';
    const current = isAnalysis ? uploadStatus?.analysis : uploadStatus?.upload;
    const isFree = uploadStatus?.plan === 'free';
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
              오늘 {isAnalysis ? 'AI 분석' : '저장'} 한도에 도달했습니다
            </p>
            <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
              {isFree
                ? `무료 플랜은 하루 ${current?.limit}회까지 ${isAnalysis ? '분석' : '저장'}할 수 있습니다.`
                : `오늘 ${current?.limit}회를 모두 사용했습니다.`}
              {'\n'}내일 자정에 초기화됩니다.
            </p>
          </div>

          {isFree && (
            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>PRO 플랜으로 업그레이드</p>
              <p style={{ fontSize: '22px', color: '#6B21A8', marginBottom: '4px' }}>하루 25회</p>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>월 900원 · 광고 없음 · 프리미엄 기능</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isFree && (
              <button
                style={{
                  width: '100%', padding: '14px',
                  backgroundColor: '#6B21A8', color: 'white', border: 'none',
                  fontSize: '13px', cursor: 'pointer', letterSpacing: '1px',
                }}
                onClick={() => setShowLimitModal(false)}
              >
                업그레이드 (준비 중)
              </button>
            )}
            <button
              onClick={() => { setShowLimitModal(false); window.location.href = '/'; }}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: 'white', color: 'black', border: '1px solid #e5e7eb',
                fontSize: '13px', cursor: 'pointer', letterSpacing: '1px',
              }}
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', flexDirection: 'column' }}>
      {showLimitModal && <LimitModal />}
      <AnimatePresence mode="wait">

        {/* ── 카메라 뷰 ── */}
        {!imageSrc && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* 음식 모드 카메라 */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.95}
              videoConstraints={{
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }}
              onUserMedia={() => setCameraReady(true)}
              onUserMediaError={() => {
                localStorage.removeItem('mybob_camera_granted');
                setPermState('denied');
              }}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                display: captureMode === 'food' ? 'block' : 'none',
              }}
            />

            {/* OCR 모드 카메라 — 고해상도 직접 스트림 */}
            <video
              ref={ocrVideoRef}
              playsInline
              muted
              onPlay={handleOcrVideoPlay}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                display: captureMode === 'ocr' ? 'block' : 'none',
              }}
            />

            {/* 홈 — 좌상단 */}
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

            {/* 갤러리 — 우상단 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute', top: '20px', right: '20px', zIndex: 10,
                width: '40px', height: '40px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: '50%',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FaUpload size={14} color="white" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />

            {/* 오늘 AI 분석 현황 배지 */}
            {uploadStatus && (
              <div style={{
                position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, backgroundColor: 'rgba(0,0,0,0.55)',
                padding: '4px 12px', borderRadius: '20px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.5px' }}>분석</span>
                <span style={{
                  fontSize: '12px', fontWeight: 500,
                  color: uploadStatus.analysis.used >= uploadStatus.analysis.limit ? '#f87171' : 'white',
                }}>
                  {uploadStatus.analysis.used}/{uploadStatus.analysis.limit}
                </span>
                {uploadStatus.plan !== 'free' && (
                  <span style={{ fontSize: '9px', color: '#a78bfa', letterSpacing: '1px', textTransform: 'uppercase' }}>PRO</span>
                )}
              </div>
            )}

            {/* 촬영 모드 탭 */}
            <div style={{
              position: 'absolute', bottom: '120px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 10, display: 'flex', gap: '0',
              backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '24px', padding: '3px',
            }}>
              {([
                { value: 'food', label: '🍱 음식' },
                { value: 'ocr',  label: '📋 영양표' },
              ] as { value: CaptureMode; label: string }[]).map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setCaptureMode(tab.value)}
                  style={{
                    padding: '7px 18px',
                    backgroundColor: captureMode === tab.value ? 'white' : 'transparent',
                    color: captureMode === tab.value ? 'black' : 'rgba(255,255,255,0.7)',
                    border: 'none', borderRadius: '20px',
                    fontSize: '12px', cursor: 'pointer',
                    fontWeight: captureMode === tab.value ? 500 : 400,
                    transition: 'all 0.2s',
                    letterSpacing: '0.3px',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 촬영 가이드 (OCR 모드) */}
            {captureMode === 'ocr' && (
              <div style={{
                position: 'absolute', bottom: '165px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, backgroundColor: barcodeScanning ? 'rgba(107,33,168,0.85)' : 'rgba(0,0,0,0.6)',
                padding: '5px 14px', borderRadius: '12px', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background-color 0.3s',
              }}>
                {barcodeScanning && (
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: '#a78bfa',
                    animation: 'pulse 1s ease-in-out infinite',
                  }} />
                )}
                <p style={{ fontSize: '11px', color: 'white', letterSpacing: '0.3px' }}>
                  {barcodeScanning ? '바코드 자동 감지 중...' : '바코드 또는 영양성분표를 비춰주세요'}
                </p>
              </div>
            )}

            {/* 조준선 (음식 모드에서만) */}
            {captureMode === 'food' && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '70px', height: '70px', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%' }} />
            </div>
            )}

            {/* OCR 프레임 가이드 */}
            {captureMode === 'ocr' && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: '75%', height: '50%',
                  border: '2px solid rgba(167,139,250,0.8)',
                  borderRadius: '8px',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
                }}>
                  <div style={{
                    position: 'absolute', top: '-1px', left: '-1px', width: '20px', height: '20px',
                    borderTop: '3px solid #a78bfa', borderLeft: '3px solid #a78bfa', borderRadius: '8px 0 0 0',
                  }} />
                  <div style={{
                    position: 'absolute', top: '-1px', right: '-1px', width: '20px', height: '20px',
                    borderTop: '3px solid #a78bfa', borderRight: '3px solid #a78bfa', borderRadius: '0 8px 0 0',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '-1px', left: '-1px', width: '20px', height: '20px',
                    borderBottom: '3px solid #a78bfa', borderLeft: '3px solid #a78bfa', borderRadius: '0 0 0 8px',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '-1px', right: '-1px', width: '20px', height: '20px',
                    borderBottom: '3px solid #a78bfa', borderRight: '3px solid #a78bfa', borderRadius: '0 0 8px 0',
                  }} />
                </div>
              </div>
            )}

            {/* 촬영 버튼 */}
            {captureMode === 'food' ? (
              <button
                onClick={capture}
                disabled={!cameraReady}
                style={{
                  position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                  width: '68px', height: '68px',
                  backgroundColor: cameraReady ? 'white' : 'rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  border: '4px solid rgba(255,255,255,0.4)',
                  cursor: cameraReady ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                  transition: 'background-color 0.3s',
                }}
              >
                <div style={{ width: '44px', height: '44px', backgroundColor: cameraReady ? 'white' : 'rgba(255,255,255,0.4)', borderRadius: '50%', border: '2px solid #e5e7eb' }} />
              </button>
            ) : (
              // OCR 모드: 수동 촬영 버튼 (바코드 자동 감지 실패 시 직접 촬영)
              <button
                onClick={() => {
                  if (!ocrVideoRef.current) return;
                  const frame = captureFrameFromVideo(ocrVideoRef.current, 0.95);
                  stopOcrCamera();
                  setImageSrc(frame);
                }}
                style={{
                  position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                  padding: '14px 32px',
                  backgroundColor: 'white', color: 'black', border: 'none',
                  fontSize: '13px', cursor: 'pointer', letterSpacing: '1px',
                  zIndex: 10,
                  borderRadius: '2px',
                }}
              >
                직접 촬영
              </button>
            )}
          </motion.div>
        )}

        {/* ── 프리뷰 + 분석 패널 ── */}
        {imageSrc && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}
          >
            {/* 이미지 — 상단 45% */}
            <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden', backgroundColor: 'black' }}>
              <img src={imageSrc} alt="촬영됨" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>

            {/* 분석 패널 — 하단 55% */}
            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* 스크롤 가능한 결과 영역 */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 0' }}>

                {/* 로딩 */}
                {loadingAnalysis && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
                    <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>AI 분석 중...</p>
                  </div>
                )}

                {/* 안내 */}
                {!loadingAnalysis && !analysis && (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>아래 버튼을 눌러 AI로 분석하세요.</p>
                  </div>
                )}

                {/* 분석 결과 */}
                {!loadingAnalysis && analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}
                  >
                    {/* 음식명 + 칼로리 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 400, color: 'black', marginBottom: '4px' }}>{analysis.name}</h3>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {analysis.category && (
                            <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>{analysis.category} · {analysis.amount || '1인분'}</span>
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
                              신뢰도 {analysis.confidence === 'high' ? '높음' : analysis.confidence === 'medium' ? '보통' : '낮음'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '20px', color: '#6B21A8', lineHeight: 1 }}>{Math.round(analysis.calories * portion)}</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                      </div>
                    </div>

                    {/* OCR/바코드 전용: 출처 안내 배너 */}
                    {ocrMeta && analysisSource && ['ocr','barcode+off','barcode+ocr'].includes(analysisSource) && (
                      <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#f3e8ff',
                        border: '1px solid #d8b4fe',
                        borderRadius: '6px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        <span style={{ fontSize: '14px' }}>
                          {analysisSource === 'barcode+off' ? '🔖' : '📋'}
                        </span>
                        <div>
                          <p style={{ fontSize: '11px', color: '#6B21A8', fontWeight: 500 }}>
                            {analysisSource === 'barcode+off'
                              ? `바코드 DB에서 가져온 정확한 값 ${ocrMeta.barcode ? `(${ocrMeta.barcode})` : ''}`
                              : analysisSource === 'barcode+ocr'
                              ? `바코드 인식 후 영양표로 보완 ${ocrMeta.barcode ? `(${ocrMeta.barcode})` : ''}`
                              : '영양성분표에서 직접 읽은 값'}
                          </p>
                          <p style={{ fontSize: '10px', color: '#7c3aed', marginTop: '1px' }}>
                            1회 제공량: {ocrMeta.serving_size || analysis.amount}
                            {ocrMeta.servings_per_container != null && ` · 총 ${ocrMeta.servings_per_container}회분`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 식사량 선택 */}
                    <div>
                      <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {analysisSource === 'ocr' ? '섭취량 (1회 제공량 기준)' : '식사량'}
                      </p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(analysisSource === 'ocr'
                          ? [
                              { value: 1 as Portion,    label: '1회분' },
                              { value: 0.5 as Portion,  label: '½회분' },
                              { value: 0.25 as Portion, label: '¼회분' },
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

                    {/* AI 추론 평가 */}
                    <div>
                      <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>AI 추론 평가</p>
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

                    {/* 탄단지 + 식이섬유 + 나트륨 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { label: '탄수화물', value: analysis.nutrients.carbohydrates, unit: 'g' },
                        { label: '단백질', value: analysis.nutrients.protein, unit: 'g' },
                        { label: '지방', value: analysis.nutrients.fat, unit: 'g' },
                        { label: '식이섬유', value: analysis.nutrients.fiber, unit: 'g' },
                        { label: '당류', value: analysis.nutrients.sugar, unit: 'g' },
                        { label: '나트륨', value: analysis.nutrients.sodium, unit: 'mg' },
                        { label: '카페인', value: analysis.nutrients.caffeine, unit: 'mg' },
                      ].filter(n => n.value != null && n.value !== 0).map(n => (
                        <div key={n.label} style={{ padding: '8px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                          <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '0.5px', marginBottom: '2px' }}>{n.label}</p>
                          <p style={{ fontSize: '13px', color: 'black' }}>{n.value}{n.unit}</p>
                        </div>
                      ))}
                    </div>

                    {/* 비타민·무기질 (값 있는 것만) */}
                    {[
                      { label: '비타민A', value: analysis.nutrients.vitaminA, unit: 'μg' },
                      { label: '비타민C', value: analysis.nutrients.vitaminC, unit: 'mg' },
                      { label: '비타민D', value: analysis.nutrients.vitaminD, unit: 'μg' },
                      { label: '칼슘', value: analysis.nutrients.calcium, unit: 'mg' },
                      { label: '철분', value: analysis.nutrients.iron, unit: 'mg' },
                      { label: '칼륨', value: analysis.nutrients.potassium, unit: 'mg' },
                    ].filter(n => n.value != null && n.value !== 0).length > 0 && (
                      <div>
                        <p style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>비타민 · 무기질</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[
                            { label: '비타민A', value: analysis.nutrients.vitaminA, unit: 'μg' },
                            { label: '비타민C', value: analysis.nutrients.vitaminC, unit: 'mg' },
                            { label: '비타민D', value: analysis.nutrients.vitaminD, unit: 'μg' },
                            { label: '칼슘', value: analysis.nutrients.calcium, unit: 'mg' },
                            { label: '철분', value: analysis.nutrients.iron, unit: 'mg' },
                            { label: '칼륨', value: analysis.nutrients.potassium, unit: 'mg' },
                          ].filter(n => n.value != null && n.value !== 0).map(n => (
                            <div key={n.label} style={{ padding: '5px 10px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '10px', color: '#6b7280' }}>{n.label}</span>
                              <span style={{ fontSize: '11px', color: '#6B21A8' }}>{n.value}{n.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {saved && (
                      <div style={{ padding: '9px', backgroundColor: 'black', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'white', letterSpacing: '2px', textTransform: 'uppercase' }}>저장 완료</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* 액션 버튼 영역 — 항상 하단 고정 */}
              <div style={{ flexShrink: 0, padding: '10px 24px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* 분석 전: AI 분석 버튼 */}
                {!analysis && !loadingAnalysis && (
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
                    {captureMode === 'ocr' ? '📋 영양표 읽기' : 'AI 분석 시작'}
                  </button>
                )}

                {/* 분석 후: 저장 + 추가촬영 + 홈 */}
                {analysis && (
                  <>
                    {/* 저장 */}
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
                        : saved ? '저장됨' : '기록에 저장'}
                    </button>

                    {/* 추가촬영 + 홈 */}
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
                        <FaCamera size={12} /> 추가 촬영
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
                        <FaHome size={12} /> 홈으로
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
      `}</style>
    </div>
  );
}
