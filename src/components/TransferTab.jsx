import React, { useState } from 'react';
import { Search } from 'lucide-react';

export function TransferTab() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6 font-sans">
      {/* Search Input Bar */}
      <div className="max-w-md w-full relative">
        <input
          type="text"
          placeholder="Search transfers by patient ID, hospital, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-[#e7e5e4] rounded-full py-2 pl-10 pr-8 text-xs text-[#292524] placeholder-[#a8a29e] focus:outline-none focus:border-[#292524] focus:ring-1 focus:ring-[#292524] transition-all shadow-2xs"
        />
        <Search className="w-4 h-4 text-[#777169] absolute left-3.5 top-2.5 pointer-events-none" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-[#a8a29e] hover:text-[#0c0a09]"
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
