"use client";

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaCamera, FaSpinner, FaUpload, FaArrowLeft, FaRedo } from 'react-icons/fa';
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
      setImageSrc(image);
      setAnalysis(null);
      setSaved(false);
    }
  }, [webcamRef]);

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
      setSaved(true);
    } catch {
      setSaved(true);
    } finally {
      setLoadingSave(false);
    }
  };

  const reset = () => {
    setImageSrc(null);
    setAnalysis(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {/* 카메라 화면: 전체 화면 꽉 채움, 바텀 네비 위 pb */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: '65px', /* 바텀 네비 높이만큼 */
        backgroundColor: 'black',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <AnimatePresence mode="wait">
          {!imageSrc ? (
            /* ── 카메라 뷰 ── */
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}
            >
              {/* 웹캠: 전체 영역 */}
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: 'environment' }}
                onUserMediaError={() => alert('카메라 접근 권한이 필요합니다.')}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* 뒤로가기 — 좌상단 오버레이 */}
              <Link href="/" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, textDecoration: 'none' }}>
                <div style={{
                  width: '40px', height: '40px',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FaArrowLeft size={15} color="white" />
                </div>
              </Link>

              {/* 갤러리 업로드 — 우상단 오버레이 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute', top: '20px', right: '20px', zIndex: 10,
                  width: '40px', height: '40px',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  borderRadius: '50%',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FaUpload size={14} color="white" />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />

              {/* 조준 가이드 */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: '72px', height: '72px', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%' }} />
              </div>

              {/* 촬영 버튼 — 하단 중앙 오버레이 */}
              <button
                onClick={capture}
                style={{
                  position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                  width: '64px', height: '64px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                <FaCamera size={22} color="black" />
              </button>
            </motion.div>
          ) : (
            /* ── 프리뷰 + 분석 결과 ── */
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}
            >
              {/* 이미지: 상단 절반 */}
              <div style={{ position: 'relative', flex: '0 0 50%', overflow: 'hidden', backgroundColor: 'black' }}>
                <img
                  src={imageSrc}
                  alt="Captured"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />

                {/* 뒤로가기 (다시찍기) — 좌상단 오버레이 */}
                <button
                  onClick={reset}
                  style={{
                    position: 'absolute', top: '16px', left: '16px', zIndex: 10,
                    width: '40px', height: '40px',
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    borderRadius: '50%',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <FaRedo size={13} color="white" />
                </button>
              </div>

              {/* 분석 패널: 하단 절반 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'hidden' }}>
                {loadingAnalysis && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
                    <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>AI 분석 중...</p>
                  </div>
                )}

                {!loadingAnalysis && !analysis && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>촬영된 음식을 AI로 분석합니다.</p>
                  </div>
                )}

                {!loadingAnalysis && analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '20px', fontWeight: 400, color: 'black' }}>{analysis.name}</h3>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '20px', color: '#6B21A8', lineHeight: 1 }}>{analysis.calories}</p>
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
                          <p style={{ fontSize: '15px', color: 'black' }}>{n.value}g</p>
                        </div>
                      ))}
                    </div>

                    {saved && (
                      <div style={{ padding: '10px', backgroundColor: 'black', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'white', letterSpacing: '2px', textTransform: 'uppercase' }}>저장 완료</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 액션 버튼 */}
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '12px' }}>
                  {!analysis ? (
                    <button
                      onClick={handleAnalysis}
                      disabled={loadingAnalysis}
                      style={{
                        flex: 1, padding: '14px',
                        backgroundColor: loadingAnalysis ? '#9ca3af' : 'black',
                        color: 'white', border: 'none',
                        fontSize: '13px', cursor: loadingAnalysis ? 'not-allowed' : 'pointer',
                        letterSpacing: '1px', textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      }}
                    >
                      {loadingAnalysis ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : 'AI 분석'}
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={loadingSave || saved}
                      style={{
                        flex: 1, padding: '14px',
                        backgroundColor: saved ? '#f3f4f6' : 'black',
                        color: saved ? '#9ca3af' : 'white',
                        border: 'none', fontSize: '13px',
                        cursor: (loadingSave || saved) ? 'not-allowed' : 'pointer',
                        letterSpacing: '1px', textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {loadingSave ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : (saved ? '저장됨' : '기록 저장')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
