"use client";

import { FaTrophy, FaLock, FaCalendarAlt } from 'react-icons/fa';

export default function CommunityChallengePage() {
  const challenges = [
    { title: "7일 클린 식단 챌린지", period: "1주", status: "준비 중" },
    { title: "노슈가(No Sugar) 도전", period: "14일", status: "준비 중" },
    { title: "매일 아침 샐러드 먹기", period: "30일", status: "준비 중" },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white p-10 rounded-3xl shadow-lg border border-orange-100 text-center">
        <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <FaTrophy className="text-4xl text-orange-500" />
        </div>
        <h2 className="text-3xl font-black text-gray-800 mb-2">챌린지 시스템 업데이트 예정</h2>
        <p className="text-gray-500 font-medium">친구들과 함께 목표를 달성하고 포인트와 뱃지를 획득하세요!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {challenges.map((challenge, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between opacity-70 grayscale relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <FaLock className="text-gray-300" />
            </div>
            <div>
              <div className="flex items-center text-xs text-orange-600 font-bold mb-1">
                <FaCalendarAlt className="mr-1" /> {challenge.period}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{challenge.title}</h3>
            </div>
            <span className="bg-gray-100 text-gray-400 text-xs font-bold px-3 py-1.5 rounded-full">
              {challenge.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
