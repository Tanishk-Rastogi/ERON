import React, { useState } from 'react';
import { Search } from 'lucide-react';

export function TransferTab() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-8 font-sans max-w-4xl mx-auto pt-4">
      {/* Prominent Large Search Bar */}
      <div className="w-full relative">
        <input
          type="text"
          placeholder="Search transfers by patient ID, hospital, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-[#d6d3d1] rounded-2xl py-4 pl-12 pr-10 text-base text-[#0c0a09] font-medium placeholder-[#777169] focus:outline-none focus:border-[#292524] focus:ring-2 focus:ring-[#292524]/20 transition-all shadow-sm hover:shadow-md"
        />
        <Search className="w-5 h-5 text-[#777169] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#777169] hover:text-[#0c0a09] p-1 flex items-center justify-center"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="min-h-[350px] w-full" />
    </div>
  );
}
