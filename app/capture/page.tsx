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
    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ mealData: analysis, imageBase64: imageSrc }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || '식단 저장에 실패했습니다.');
      if (result.success) setSaved(true);
    } catch (error: any) {
      alert(`저장 실패: ${error.message}`);
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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl text-center mb-8"
      >
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">MEAL CAPTURE</h1>
        <p className="text-slate-400 font-medium">AI가 당신의 식단을 분석합니다</p>
      </motion.div>
      
      <AnimatePresence mode="wait">
        {!imageSrc ? (
          <motion.div 
            key="camera"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-2xl flex flex-col items-center"
          >
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-black mb-8">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest bg-black/20 backdrop-blur-md px-4 py-2 rounded-full">Live Preview</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={capture}
                className="flex items-center px-10 py-5 bg-white text-slate-900 rounded-full shadow-xl text-xl font-black transition-all"
              >
                <FaCamera className="mr-3" /> CAPTURE
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-6 py-5 bg-slate-800 text-white rounded-full shadow-xl text-xl font-black transition-all border border-slate-700"
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
            <div className="bg-slate-800 p-4 rounded-[2.5rem] shadow-2xl w-full border border-slate-700">
              <div className="rounded-3xl overflow-hidden mb-6 shadow-inner">
                <img src={imageSrc} alt="Captured" className="w-full h-auto" />
              </div>
              
              <AnimatePresence>
                {loadingAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center py-6"
                  >
                    <FaSpinner className="animate-spin text-4xl text-teal-400 mb-4" />
                    <p className="text-teal-400 font-black text-xs tracking-widest uppercase">AI Analyzing...</p>
                  </motion.div>
                )}

                {analysis && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-6 bg-slate-900 rounded-3xl border border-slate-700 mb-6"
                  >
                    <h3 className="text-2xl font-black text-white mb-4">{analysis.name}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-800 p-3 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Calories</p>
                        <p className="text-xl font-black text-teal-400">{analysis.calories} kcal</p>
                      </div>
                      <div className="bg-slate-800 p-3 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Category</p>
                        <p className="text-xl font-black text-white">{analysis.category || 'Food'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {[
                        { label: 'Carbs', value: analysis.nutrients.carbohydrates, color: 'bg-yellow-500' },
                        { label: 'Protein', value: analysis.nutrients.protein, color: 'bg-rose-500' },
                        { label: 'Fat', value: analysis.nutrients.fat, color: 'bg-blue-500' }
                      ].map(n => (
                        <div key={n.label} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-bold">{n.label}</span>
                          <div className="flex items-center">
                            <span className="text-white font-black mr-2">{n.value}g</span>
                            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(n.value * 2, 100)}%` }}
                                className={`h-full ${n.color}`} 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {saved && (
                      <motion.p 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 text-green-400 font-black text-sm flex items-center justify-center bg-green-400/10 py-3 rounded-2xl border border-green-400/20"
                      >
                        <FaCheckCircle className="mr-2" /> SAVED SUCCESSFULLY
                      </motion.p>
                    )}
                    
                    {modelUsed && !saved && (
                      <p className="mt-4 text-[10px] text-slate-600 text-right italic font-medium">via {modelUsed}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetCapture}
                  className="flex-1 flex items-center justify-center py-4 bg-slate-700 text-white rounded-2xl font-black transition-all text-sm"
                >
                  <FaRedo className="mr-2" /> RETAKE
                </motion.button>
                
                {!analysis ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalysis}
                    disabled={loadingAnalysis}
                    className="flex-[2] flex items-center justify-center py-4 bg-teal-500 text-white rounded-2xl font-black transition-all text-sm disabled:opacity-50"
                  >
                    {loadingAnalysis ? <FaSpinner className="animate-spin" /> : <><FaCamera className="mr-2" /> START AI ANALYSIS</>}
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
                    disabled={loadingSave || saved}
                    className={`flex-[2] flex items-center justify-center py-4 rounded-2xl font-black transition-all text-sm ${saved ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900 shadow-xl'}`}
                  >
                    {loadingSave ? <FaSpinner className="animate-spin" /> : (saved ? <><FaCheckCircle className="mr-2" /> SAVED</> : <><FaSave className="mr-2" /> SAVE TO DIARY</>)}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Link href="/">
        <motion.div 
          whileHover={{ y: -2 }}
          className="mt-12 text-slate-500 hover:text-white flex items-center font-black text-xs uppercase tracking-widest transition-colors"
        >
          <FaArrowLeft className="mr-2" /> Back to Dashboard
        </motion.div>
      </Link>
    </div>
  );
}
