"use client";

import dynamic from 'next/dynamic';

// recharts(~90KB gzip)를 페이지 초기 번들에서 분리 — 리포트/관리자 페이지에서만 필요.
export const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
export const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
export const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
export const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
export const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
export const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
export const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
export const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
export const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
export const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine), { ssr: false });
