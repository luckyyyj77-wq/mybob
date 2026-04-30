"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaSpinner, FaUpload, FaArrowLeft, FaCamera, FaHome } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

type AnalysisResult = {
  name: string;
  calories: number;
  category?: string;
  amount?: string;
  nutrients: {
    carbohydrates: number;
    protein: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    vitaminA?: number;
    vitaminC?: number;
    vitaminD?: number;
    calcium?: number;
    iron?: number;
    potassium?: number;
  };
};

export default function CameraCapturePage() {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [saved, setSaved] = useState(false);
  // 카메라 권한을 한 번 얻으면 컴포넌트 생애 동안 유지
  const [cameraReady, setCameraReady] = useState(false);

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

  // 추가 촬영 — 웹캠은 유지, 이미지/결과만 초기화
  const retake = () => {
    setImageSrc(null);
    setAnalysis(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">

        {/* ── 카메라 뷰 ── */}
        {!imageSrc && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* 웹캠: audio=false로 고정, 한 번 마운트 후 유지 */}
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'environment' }}
              onUserMedia={() => setCameraReady(true)}
              onUserMediaError={() => alert('카메라 접근 권한이 필요합니다.')}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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
            <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', padding: '20px 24px 28px' }}>

              {/* 로딩 */}
              {loadingAnalysis && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FaSpinner style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
                  <p style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af' }}>AI 분석 중...</p>
                </div>
              )}

              {/* 안내 */}
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
                  {/* 음식명 + 칼로리 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 400, color: 'black', marginBottom: '2px' }}>{analysis.name}</h3>
                      {analysis.category && (
                        <span style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>{analysis.category} · {analysis.amount || '1인분'}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '20px', color: '#6B21A8', lineHeight: 1 }}>{analysis.calories}</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
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

              {/* 액션 버튼 영역 */}
              <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

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
                    AI 분석 시작
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
