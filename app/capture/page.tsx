"use client";

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaCamera, FaSpinner, FaUpload, FaArrowLeft, FaRedo } from 'react-icons/fa';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: 'environment',
};

type AnalysisResult = {
  name: string;
  calories: number;
  category?: string;
  price?: number;
  location?: string;
  amount?: number;
  nutrients: {
    carbohydrates: number;
    protein: number;
    fat: number;
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

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot();
      setImageSrc(image);
      setAnalysis(null);
      setSaved(false);
    }
  }, [webcamRef]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
        setAnalysis(null);
        setSaved(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalysis = async () => {
    if (!imageSrc) return;
    setLoadingAnalysis(true);
    setSaved(false);
    try {
      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageSrc }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || '분석 중 오류가 발생했습니다.');
      if (result.success) {
        setAnalysis(result.food);
      }
    } catch (error: any) {
      alert(`음식 분석 실패: ${error.message}`);
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
      is_local: true
    };

    try {
      const existingMeals = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existingMeals]));

      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mealData: analysis, imageBase64: imageSrc }),
      });
      const result = await response.json();
      if (result.success) setSaved(true);
      else {
        setSaved(true);
        console.warn("Saved to LocalStorage only due to server error");
      }
    } catch (error: any) {
      console.error(`Cloud save failed, but saved to LocalStorage: ${error.message}`);
      setSaved(true);
    } finally {
      setLoadingSave(false);
    }
  };

  const resetCapture = () => {
    setImageSrc(null);
    setAnalysis(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '40px 32px 24px', borderBottom: '4px solid black', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
            SCAN
          </p>
          <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'black', letterSpacing: '-1.5px', lineHeight: 1 }}>
            음식 촬영
          </h1>
        </div>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '10px 16px',
            border: '3px solid black',
            fontSize: '12px',
            fontWeight: 900,
            color: 'black',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <FaArrowLeft size={10} /> 홈
          </div>
        </Link>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AnimatePresence mode="wait">
          {!imageSrc ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Camera View */}
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1',
                border: '4px solid black',
                overflow: 'hidden',
                backgroundColor: 'black',
                boxShadow: '6px 6px 0px black',
              }}>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ ...videoConstraints, width: { ideal: 720 }, height: { ideal: 720 } }}
                  onUserMediaError={() => alert('카메라 접근 권한이 필요합니다.')}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Crosshair */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: '60px', height: '60px', border: '2px solid rgba(255,255,255,0.6)', borderRadius: '50%' }} />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={capture}
                  style={{
                    flex: 1,
                    padding: '18px',
                    backgroundColor: 'black',
                    color: 'white',
                    border: '3px solid black',
                    fontSize: '14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '4px 4px 0px #6B21A8',
                  }}
                >
                  <FaCamera /> 촬영하기
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '18px 20px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '3px solid black',
                    cursor: 'pointer',
                    boxShadow: '4px 4px 0px black',
                  }}
                >
                  <FaUpload size={18} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Preview Image */}
              <div style={{ border: '4px solid black', overflow: 'hidden', boxShadow: '6px 6px 0px black' }}>
                <img
                  src={imageSrc}
                  alt="Captured"
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                />
              </div>

              {/* Analysis Results */}
              <AnimatePresence>
                {loadingAnalysis && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '12px', border: '3px solid black' }}>
                    <FaSpinner style={{ fontSize: '24px', animation: 'spin 1s linear infinite' }} />
                    <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#9ca3af' }}>AI 분석 중...</p>
                  </div>
                )}

                {analysis && !loadingAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ border: '3px solid black', padding: '20px', boxShadow: '4px 4px 0px black' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'black', letterSpacing: '-0.5px' }}>{analysis.name}</h3>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '22px', fontWeight: 900, color: '#6B21A8', lineHeight: 1 }}>{analysis.calories}</p>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '1px' }}>KCAL</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { label: '탄수화물', value: analysis.nutrients.carbohydrates },
                        { label: '단백질', value: analysis.nutrients.protein },
                        { label: '지방', value: analysis.nutrients.fat },
                      ].map(n => (
                        <div key={n.label} style={{ padding: '12px', border: '2px solid black', textAlign: 'center' }}>
                          <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{n.label}</p>
                          <p style={{ fontSize: '16px', fontWeight: 900, color: 'black' }}>{n.value}g</p>
                        </div>
                      ))}
                    </div>

                    {saved && (
                      <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'black', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', fontWeight: 900, color: 'white', letterSpacing: '2px', textTransform: 'uppercase' }}>저장 완료</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={resetCapture}
                  style={{
                    flex: 1,
                    padding: '16px',
                    backgroundColor: 'white',
                    color: 'black',
                    border: '3px solid black',
                    fontSize: '13px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <FaRedo size={12} /> 다시 찍기
                </button>

                {!analysis ? (
                  <button
                    onClick={handleAnalysis}
                    disabled={loadingAnalysis}
                    style={{
                      flex: 2,
                      padding: '16px',
                      backgroundColor: loadingAnalysis ? '#9ca3af' : 'black',
                      color: 'white',
                      border: `3px solid ${loadingAnalysis ? '#9ca3af' : 'black'}`,
                      fontSize: '13px',
                      fontWeight: 900,
                      cursor: loadingAnalysis ? 'not-allowed' : 'pointer',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      boxShadow: loadingAnalysis ? 'none' : '4px 4px 0px #6B21A8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {loadingAnalysis ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : 'AI 분석 시작'}
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={loadingSave || saved}
                    style={{
                      flex: 2,
                      padding: '16px',
                      backgroundColor: saved ? '#f3f4f6' : 'black',
                      color: saved ? '#9ca3af' : 'white',
                      border: `3px solid ${saved ? '#e5e7eb' : 'black'}`,
                      fontSize: '13px',
                      fontWeight: 900,
                      cursor: (loadingSave || saved) ? 'not-allowed' : 'pointer',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      boxShadow: saved ? 'none' : '4px 4px 0px #6B21A8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {loadingSave ? <FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> : (saved ? '저장됨' : '기록에 저장')}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
