"use client";

import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Link from 'next/link';
import { FaCamera, FaSpinner, FaCheckCircle, FaSave, FaRedo } from 'react-icons/fa';

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

  const handleAnalysis = async () => {
    if (!imageSrc) return;

    setLoadingAnalysis(true);
    setSaved(false);
    try {
      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageSrc }),
      });

      if (!response.ok) throw new Error('Failed to get analysis.');
      const result = await response.json();
      if (result.success) setAnalysis(result.food);
      else throw new Error(result.error || 'Analysis failed.');

    } catch (error) {
      console.error("Analysis Error:", error);
      alert('음식 분석에 실패했습니다.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) return;

    setLoadingSave(true);
    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealData: analysis, imageBase64: imageSrc }), // Send both mealData and imageBase64
      });

      if (!response.ok) throw new Error('Failed to save meal.');
      const result = await response.json();
      if (result.success) {
        setSaved(true);
        // alert('성공적으로 저장되었습니다!'); // Removed alert for smoother UX
      } else {
        throw new Error(result.error || 'Save failed.');
      }
    } catch (error) {
      console.error("Save Error:", error);
      alert('데이터 저장에 실패했습니다.');
    } finally {
      setLoadingSave(false);
    }
  };

  const resetCapture = () => {
    setImageSrc(null);
    setAnalysis(null);
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-indigo-800 mb-8">사진 촬영</h1>
      {!imageSrc ? (
        <>
          <div className="relative border-4 border-indigo-300 rounded-lg overflow-hidden mb-8 shadow-xl">
            <Webcam
              audio={false}
              height={360}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={640}
              videoConstraints={videoConstraints}
              onUserMediaError={(error) => console.error("Camera access error:", error)}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 text-white text-lg font-semibold">
              카메라 미리보기
            </div>
          </div>
          <button
            onClick={capture}
            className="flex items-center px-8 py-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-xl font-bold transition duration-300 transform hover:scale-105"
          >
            <FaCamera className="mr-3 text-2xl" /> 사진 찍기
          </button>
        </>
      ) : (
        <div className="mt-8 text-center bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">찍은 사진:</h2>
          <img src={imageSrc} alt="Captured" className="max-w-full h-auto border border-gray-300 rounded-lg shadow-md mx-auto" />
          
          {loadingAnalysis && (
            <p className="mt-4 text-lg text-indigo-600 flex items-center justify-center">
              <FaSpinner className="animate-spin mr-2" /> AI가 분석 중입니다...
            </p>
          )}

          {analysis && (
            <div className="mt-6 p-4 bg-indigo-50 rounded-lg text-left border border-indigo-200">
              <h3 className="text-xl font-bold text-indigo-700 mb-2">{analysis.name}</h3>
              <p className="text-gray-700"><strong>칼로리:</strong> <span className="font-semibold">{analysis.calories} kcal</span></p>
              <p className="text-gray-700"><strong>영양 성분:</strong></p>
              <ul className="list-disc list-inside ml-4 text-gray-700">
                <li>탄수화물: <span className="font-semibold">{analysis.nutrients.carbohydrates}g</span></li>
                <li>단백질: <span className="font-semibold">{analysis.nutrients.protein}g</span></li>
                <li>지방: <span className="font-semibold">{analysis.nutrients.fat}g</span></li>
              </ul>
              {saved && (
                <p className="mt-4 text-green-600 font-bold flex items-center">
                  <FaCheckCircle className="mr-2" /> 데이터베이스에 저장 완료!
                </p>
              )}
            </div>
          )}

          <div className="flex justify-center space-x-4 mt-6">
            <button
              onClick={resetCapture}
              className="flex items-center px-6 py-3 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 text-lg font-semibold transition duration-300"
            >
              <FaRedo className="mr-2" /> 다시 찍기
            </button>
            {!analysis ? (
              <button
                onClick={handleAnalysis}
                disabled={loadingAnalysis}
                className="flex items-center px-6 py-3 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600 text-lg font-semibold transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loadingAnalysis ? <><FaSpinner className="animate-spin mr-2" /> 분석 중...</> : <><FaCamera className="mr-2" /> AI 분석 시작</>}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loadingSave || saved}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 text-lg font-semibold transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loadingSave ? <><FaSpinner className="animate-spin mr-2" /> 저장 중...</> : (saved ? <><FaCheckCircle className="mr-2" /> 저장 완료</> : <><FaSave className="mr-2" /> 저장하기</>)}
              </button>
            )}
          </div>
        </div>
      )}
      <Link href="/" className="mt-8 text-blue-500 hover:underline flex items-center">
        <FaRedo className="mr-2" /> 홈으로 돌아가기
      </Link>
    </div>
  );
}

