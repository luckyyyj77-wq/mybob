"use client";

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FaCamera, FaSpinner } from 'react-icons/fa';

type FoodItem = {
  name: string;
  calories: number;
  category?: string;
  amount?: string;
  confidence?: string;
};

type ProviderResult = {
  provider: string;
  model: string;
  success: boolean;
  items?: FoodItem[];
  error?: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
};

const PROVIDER_LABEL: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI GPT-4o',
  claude: 'Anthropic Claude',
};

const PROVIDER_COLOR: Record<string, string> = {
  gemini: '#4285F4',
  openai: '#10A37F',
  claude: '#D97757',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ModelTestPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProviderResult[] | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setResults(null);
    const base64 = await fileToBase64(file);
    setImagePreview(base64);

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('로그인이 필요합니다.'); setLoading(false); return; }

    try {
      const res = await fetch('/api/admin/model-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: base64 }),
      });
      const result = await res.json();
      if (result.success) setResults(result.results);
      else setError(result.error || '분석 실패');
    } catch {
      setError('요청 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px' }}>
      <div>
        <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>MODEL TEST</p>
        <h1 style={{ fontSize: '22px', fontWeight: 400, color: '#0f0f0f', lineHeight: 1 }}>음식 인식 모델 비교</h1>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
          사진 한 장으로 Gemini · GPT-4o · Claude 세 모델의 인식 결과를 동시에 비교합니다. (관리자 전용, 실제 사용자에게 영향 없음)
        </p>
      </div>

      {/* 업로드 영역 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '1px dashed #d1d5db', backgroundColor: 'white', padding: '32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          cursor: 'pointer',
        }}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="preview" style={{ maxHeight: '220px', maxWidth: '100%', objectFit: 'contain' }} />
        ) : (
          <FaCamera size={22} color="#9ca3af" />
        )}
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>{imagePreview ? '다른 사진으로 교체하려면 클릭' : '음식 사진을 클릭하여 업로드'}</p>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B21A8', fontSize: '13px' }}>
          <FaSpinner className="spin" size={14} />
          3개 모델에 동시 요청 중...
        </div>
      )}

      {error && <p style={{ fontSize: '12px', color: '#ef4444' }}>{error}</p>}

      {/* 결과 비교 */}
      {results && (
        <div className="model-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1px', backgroundColor: '#e5e7eb', border: '1px solid #e5e7eb' }}>
          {results.map(r => (
            <div key={r.provider} style={{ backgroundColor: 'white', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: PROVIDER_COLOR[r.provider] ?? '#374151' }}>{PROVIDER_LABEL[r.provider] ?? r.provider}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{r.model}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: '#9ca3af' }}>{r.latencyMs}ms</p>
                  {r.costUsd != null && <p style={{ fontSize: '11px', color: '#9ca3af' }}>${r.costUsd.toFixed(5)}</p>}
                </div>
              </div>

              {!r.success ? (
                <p style={{ fontSize: '12px', color: '#ef4444' }}>{r.error}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#f3f4f6' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 70px', padding: '6px 10px', backgroundColor: '#f9fafb' }}>
                    {['이름', '칼로리', '카테고리', '중량/확신'].map(h => (
                      <p key={h} style={{ fontSize: '9px', color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</p>
                    ))}
                  </div>
                  {r.items!.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 70px', padding: '8px 10px', backgroundColor: 'white', alignItems: 'center' }}>
                      <p style={{ fontSize: '12px', color: '#374151' }}>{item.name}</p>
                      <p style={{ fontSize: '12px', color: '#374151' }}>{item.calories}kcal</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af' }}>{item.category ?? '—'}</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af' }}>{item.amount ?? '—'} {item.confidence ? `· ${item.confidence}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) {
          .model-result-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
