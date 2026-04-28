"use client";

import Link from 'next/link';
import { FaBell, FaUser, FaArrowLeft } from 'react-icons/fa';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl text-center py-6">
        <h1 className="text-5xl font-extrabold text-gray-800 mb-2">설정</h1>
        <p className="text-xl text-gray-600">개인 정보 및 앱 환경 설정</p>
      </header>

      <main className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 md:p-8 mt-8 space-y-8">
        {/* 알림 주기 변경 */}
        <section>
          <h2 className="text-3xl font-bold text-gray-800 mb-4 flex items-center">
            <FaBell className="mr-3 text-gray-600" /> 알림 설정
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm">
              <label htmlFor="notification-frequency" className="text-lg text-gray-700">푸시 알림 주기:</label>
              <select id="notification-frequency" className="p-2 border border-gray-300 rounded-md text-lg">
                <option>1시간 후</option>
                <option>2시간 후</option>
                <option>수동</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm">
              <span className="text-lg text-gray-700">AI 분석 알림:</span>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </section>

        {/* 개인 정보 관리 */}
        <section>
          <h2 className="text-3xl font-bold text-gray-800 mb-4 flex items-center">
            <FaUser className="mr-3 text-gray-600" /> 개인 정보
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-lg text-gray-700 font-semibold mb-2">이메일 주소:</p>
              <p className="text-xl text-gray-900">user@example.com</p>
              <button className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-base">변경</button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-lg text-gray-700 font-semibold mb-2">회원 탈퇴</p>
              <button className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base">회원 탈퇴하기</button>
            </div>
          </div>
        </section>
      </main>

      <Link href="/" className="mt-12 text-gray-600 hover:underline flex items-center">
        <FaArrowLeft className="mr-2" /> 홈으로 돌아가기
      </Link>

      <style jsx>{`
        /* The switch - the box around the slider */
        .switch {
          position: relative;
          display: inline-block;
          width: 60px;
          height: 34px;
        }

        /* Hide default HTML checkbox */
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        /* The slider */
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          -webkit-transition: .4s;
          transition: .4s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          -webkit-transition: .4s;
          transition: .4s;
        }

        input:checked + .slider {
          background-color: #2196F3;
        }

        input:focus + .slider {
          box-shadow: 0 0 1px #2196F3;
        }

        input:checked + .slider:before {
          -webkit-transform: translateX(26px);
          -ms-transform: translateX(26px);
          transform: translateX(26px);
        }

        /* Rounded sliders */
        .slider.round {
          border-radius: 34px;
        }

        .slider.round:before {
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
