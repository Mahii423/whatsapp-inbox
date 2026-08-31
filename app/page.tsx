"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-4 md:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Here's how your business is doing.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
            +923066571350 <span className="text-xs">▼</span>
          </div>
          <div className="w-10 h-10 bg-white border rounded-full flex items-center justify-center relative">
            🔔
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text- px-1.5 py-0.5 rounded-full">99+</span>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1 - Message Activity */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Message activity</h3>
            <span className="text-xs bg-gray-100 px-3 py-1 rounded-full">Last 14 days</span>
          </div>
          <div className="flex gap-4 text-xs mb-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-600 rounded-full"></span> Sent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-300 rounded-full"></span> Received</span>
          </div>
          {loading? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {[40, 70, 50, 90, 60, 80, 45, 85, 65, 75, 55, 95, 70, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col gap-1">
                  <div className="bg-green-600 rounded-t" style={{ height: `${h}%` }}></div>
                  <div className="bg-gray-200 rounded-t" style={{ height: `${h - 20}%` }}></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2 - Plan Usage */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Plan usage</h3>
            <span className="text-xs bg-gray-100 px-3 py-1 rounded-full">This billing cycle</span>
          </div>
          {loading? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full border-8 border-green-600 border-t-gray-200 flex items-center justify-center">
                <span className="font-bold">62%</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>Messages: <b>1,240 / 2,000</b></div>
                <div>Contacts: <b>340 / 500</b></div>
                <div className="text-green-600 font-medium mt-2">Manage plan →</div>
              </div>
            </div>
          )}
        </div>

        {/* Card 3 - Performance */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Performance</h3>
            <span className="text-xs bg-gray-100 px-3 py-1 rounded-full">Last 30 days across all numbers</span>
          </div>
          {loading? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-2xl font-bold">98.5%</div><div className="text-xs text-gray-500">Delivered</div></div>
              <div><div className="text-2xl font-bold">42%</div><div className="text-xs text-gray-500">Read</div></div>
              <div><div className="text-2xl font-bold">12%</div><div className="text-xs text-gray-500">Replied</div></div>
            </div>
          )}
        </div>

        {/* Card 4 - Messages per day */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Messages per day</h3>
            <span className="text-xs text-gray-500">Your messaging activity over the last 30 days</span>
          </div>
          <div className="flex gap-4 text-xs mb-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-600 rounded-full"></span> Sent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-300 rounded-full"></span> Received</span>
          </div>
          {loading? (
            <div className="h-32 flex items-center justify-center text-gray-400">Loading...</div>
          ) : (
            <div className="h-32 flex items-end">
              <svg className="w-full h-full" viewBox="0 0 100 30">
                <path d="M0,20 Q10,10 20,15 T40,12 T60,18 T80,10 T100,14" fill="none" stroke="#16a34a" strokeWidth="1" />
                <path d="M0,20 Q10,10 20,15 T40,12 T60,18 T80,10 T100,14 L100,30 L0,30 Z" fill="#dcfce7" opacity="0.5" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}