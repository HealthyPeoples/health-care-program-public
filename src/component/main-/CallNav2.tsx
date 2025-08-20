"use client";
import React from 'react';
import { useState } from 'react';

export const CallNav2 = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="fixed top-0 left-0 w-full bg-white shadow-md z-50">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-gray-800">요양원 관리 시스템</span>
        </div>
        
        {isMenuOpen && (
          <div className="absolute top-full left-0 w-64 bg-white shadow-lg border-t">
            <nav className="py-2">
              <a href="/nursingHome" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                요양원 관리
              </a>
              <a href="/companyInfo" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                회사 정보
              </a>
              <a href="/dayNightCare" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                주야간 보호
              </a>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};
