"use client";

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaSpinner, FaUpload, FaArrowLeft, FaRedo } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

type AnalysisResult = {
  name: string;
  calories: number;
  nutrients: { carbohydrates: number; protein: number; fat: number };
};

export default function CameraCapturePage() {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [saved, setSaved] = useState(false);

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
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageSrc }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.details || result.error || '분석 오류');
      if (result.success) setAnalysis(result.food);
    } catch (err: any) {
      alert(`분석 실패: ${err.message}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) return;
    setLoadingSave(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const localMeal = {
      id: Date.now().toString(),
      food_name: analysis.name,
      calories: analysis.calories,
      nutrient: analysis.nutrients,
      photo_url: imageSrc,
      created_at: new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existing]));
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mealData: analysis, imageBase64: imageSrc }),
      });
    } catch { /* local save already done */ }
    setSaved(true);
    setLoadingSave(false);
  };

  const reset = () => {
    setImageSrc(null);
    setAnalysis(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    /* 바텀 네비 없음 → 화면 전체 사용 */
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">

        {/* ── 카메라 뷰 ── */}
        {!imageSrc && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* 웹캠 */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'environment' }}
              onUserMediaError={() => alert('카메라 접근 권한이 필요합니다.')}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* 뒤로가기 — 좌상단 */}
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

            {/* 조준선 */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '70px', height: '70px', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%' }} />
            </div>

            {/* 촬영 버튼 — 하단 중앙 */}
            <button
              onClick={capture}
              style={{
                position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                width: '68px', height: '68px',
                backgroundColor: 'white',
                borderRadius: '50%',
                border: '4px solid rgba(255,255,255,0.4)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10,
              }}
            >
              {/* 내부 원 */}
              <div style={{ width: '44px', height: '44px', backgroundColor: 'white', borderRadius: '50%', border: '2px solid #e5e7eb' }} />
            </button>
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

              {/* 다시 찍기 — 좌상단 */}
              <button
                onClick={reset}
                style={{
                  position: 'absolute', top: '16px', left: '16px', zIndex: 10,
                  width: '38px', height: '38px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '50%', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FaRedo size={13} color="white" />
              </button>
            </div>

            {/* 분석 패널 — 하단 55% */}
            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', padding: '20px 24px 24px' }}>

              {/* 로딩 */}
              {loadingAnalysis && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
                  <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>AI 분석 중...</p>
                </div>
              )}

              {/* 안내 문구 */}
              {!loadingAnalysis && !analysis && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>아래 버튼을 눌러 AI로 분석하세요.</p>
                </div>
              )}

              {/* 분석 결과 */}
              {!loadingAnalysis && analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '19px', fontWeight: 400, color: 'black' }}>{analysis.name}</h3>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '19px', color: '#6B21A8', lineHeight: 1 }}>{analysis.calories}</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { label: '탄수화물', value: analysis.nutrients.carbohydrates },
                      { label: '단백질', value: analysis.nutrients.protein },
                      { label: '지방', value: analysis.nutrients.fat },
                    ].map(n => (
                      <div key={n.label} style={{ padding: '10px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>{n.label}</p>
                        <p style={{ fontSize: '14px', color: 'black' }}>{n.value}g</p>
                      </div>
                    ))}
                  </div>

                  {saved && (
                    <div style={{ padding: '9px', backgroundColor: 'black', textAlign: 'center' }}>
                      <p style={{ fontSize: '11px', color: 'white', letterSpacing: '2px', textTransform: 'uppercase' }}>저장 완료</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 액션 버튼 — 항상 하단에 고정 */}
              <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                {!analysis ? (
                  <button
                    onClick={handleAnalysis}
                    disabled={loadingAnalysis}
                    style={{
                      width: '100%', padding: '15px',
                      backgroundColor: loadingAnalysis ? '#9ca3af' : 'black',
                      color: 'white', border: 'none',
                      fontSize: '13px', cursor: loadingAnalysis ? 'not-allowed' : 'pointer',
                      letterSpacing: '1px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    {loadingAnalysis
                      ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                      : 'AI 분석 시작'}
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={loadingSave || saved}
                    style={{
                      width: '100%', padding: '15px',
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
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
