"use client";

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaCamera, FaSpinner, FaCheckCircle, FaSave, FaRedo, FaUpload, FaArrowLeft } from 'react-icons/fa';
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
  const [modelUsed, setModelUsed] = useState<string | null>(null);
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
        setModelUsed(result.modelUsed);
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
    
    // 1. Prepare data for LocalStorage backup
    const localMeal = {
      id: Date.now().toString(),
      food_name: analysis.name,
      calories: analysis.calories,
      nutrient: analysis.nutrients,
      photo_url: imageSrc, // Save base64 image locally
      created_at: new Date().toISOString(),
      is_local: true
    };

    try {
      // 2. Save to LocalStorage first (Instant success)
      const existingMeals = JSON.parse(localStorage.getItem('mybob_meals') || '[]');
      localStorage.setItem('mybob_meals', JSON.stringify([localMeal, ...existingMeals]));
      
      // 3. Try saving to Cloud (Server)
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-24">
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md flex items-center justify-between py-4 mb-2"
      >
        <Link href="/">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400">
            <FaArrowLeft />
          </div>
        </Link>
        <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">Scan Meal</h1>
        <div className="w-10" /> {/* Spacer */}
      </motion.div>
      
      <AnimatePresence mode="wait">
        {!imageSrc ? (
          <motion.div 
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md flex flex-col items-center"
          >
            {/* Reduced Camera Size: Aspect-square or 4:3 for better fit */}
            <div className="relative w-full aspect-square max-h-[350px] rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl bg-black mb-6">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  ...videoConstraints,
                  width: { ideal: 720 },
                  height: { ideal: 720 }
                }}
                onUserMediaError={() => alert('카메라 접근 권한이 필요합니다.')}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-[1.5rem] border-black/10 pointer-events-none" />
            </div>
            
            <div className="flex gap-4 w-full">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={capture}
                className="flex-grow flex items-center justify-center py-5 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-100 text-lg font-black"
              >
                <FaCamera className="mr-3" /> 촬영하기
              </motion.button>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-5 bg-white text-slate-400 rounded-3xl shadow-sm border border-slate-100 font-black transition-all"
              >
                <FaUpload />
              </motion.button>
              
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md flex flex-col items-center"
          >
            <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 w-full mb-6">
              <div className="rounded-3xl overflow-hidden mb-4 aspect-square max-h-[300px]">
                <img src={imageSrc} alt="Captured" className="w-full h-full object-cover" />
              </div>
              
              {/* Analysis Results - More compact */}
              <AnimatePresence>
                {loadingAnalysis && (
                  <div className="flex flex-col items-center py-4">
                    <FaSpinner className="animate-spin text-3xl text-indigo-500 mb-2" />
                    <p className="text-slate-400 font-black text-[10px] tracking-widest">ANALYZING...</p>
                  </div>
                )}

                {analysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-slate-50 rounded-3xl border border-slate-100 mb-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-black text-slate-800">{analysis.name}</h3>
                      <span className="text-lg font-black text-indigo-600">{analysis.calories} <span className="text-[10px] opacity-50">kcal</span></span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Carb', value: analysis.nutrients.carbohydrates, color: 'bg-indigo-500' },
                        { label: 'Prot', value: analysis.nutrients.protein, color: 'bg-rose-500' },
                        { label: 'Fat', value: analysis.nutrients.fat, color: 'bg-emerald-500' }
                      ].map(n => (
                        <div key={n.label} className="bg-white p-2 rounded-xl border border-slate-100">
                          <p className="text-[9px] text-slate-400 font-black uppercase mb-1">{n.label}</p>
                          <p className="text-sm font-black text-slate-800">{n.value}g</p>
                        </div>
                      ))}
                    </div>
                    {saved && (
                      <p className="mt-4 text-emerald-500 font-black text-[10px] text-center uppercase tracking-widest bg-emerald-50 py-2 rounded-xl">Saved Successfully</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <button onClick={resetCapture} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Retake</button>
                {!analysis ? (
                  <button onClick={handleAnalysis} disabled={loadingAnalysis} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50">
                    {loadingAnalysis ? <FaSpinner className="animate-spin mx-auto" /> : 'AI 분석 시작'}
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={loadingSave || saved} className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest ${saved ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white'}`}>
                    {loadingSave ? <FaSpinner className="animate-spin mx-auto" /> : (saved ? '저장됨' : '일기에 저장')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
