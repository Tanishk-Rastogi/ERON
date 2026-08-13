import React, { useState, useRef, useEffect } from 'react';
import { Search, Check } from 'lucide-react';

const MASTER_RESOURCES = [
  { name: 'ICU', category: 'Beds & Care Units' },
  { name: 'Trauma ICU', category: 'Beds & Care Units' },
  { name: 'PICU', category: 'Beds & Care Units' },
  { name: 'NICU', category: 'Beds & Care Units' },
  { name: 'Ventilator', category: 'Respiratory Support' },
  { name: 'HFNC', category: 'Respiratory Support' },
  { name: 'Emergency Department', category: 'Emergency & Trauma' },
  { name: 'Trauma Center', category: 'Emergency & Trauma' },
  { name: 'Emergency OT', category: 'Operating Theaters' },
  { name: 'Blood Bank', category: 'Blood & Transfusion' },
  { name: 'CT Scan', category: 'Imaging & Radiology' },
  { name: 'MRI', category: 'Imaging & Radiology' },
  { name: 'X-ray', category: 'Imaging & Radiology' },
  { name: 'Ultrasound', category: 'Imaging & Radiology' },
  { name: 'ECG', category: 'Cardiac Care' },
  { name: 'Stroke Unit', category: 'Neurology & Stroke' },
  { name: 'Dialysis', category: 'Specialized Treatment' },
  { name: 'General Surgeon', category: 'Specialist Availability' },
  { name: 'Trauma Surgeon', category: 'Specialist Availability' },
  { name: 'Neurosurgeon', category: 'Specialist Availability' },
  { name: 'Orthopedic Surgeon', category: 'Specialist Availability' },
  { name: 'Cardiologist', category: 'Specialist Availability' },
  { name: 'Neurologist', category: 'Specialist Availability' },
  { name: 'Anesthesiologist', category: 'Specialist Availability' },
  { name: 'Intensivist', category: 'Specialist Availability' },
  { name: 'Burn Unit', category: 'Burn Care' },
  { name: 'Obstetrician', category: 'Obstetrics & Gynecology' },
  { name: 'Labor Room', category: 'Obstetrics & Gynecology' },
  { name: 'Neonatologist', category: 'Pediatric Services' },
  { name: 'Pediatrician', category: 'Pediatric Services' },
];

export function TransferTab() {
  const [selectedTags, setSelectedTags] = useState(['ICU', 'Ventilator']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchContainerRef = useRef(null);

  // Filter master resources based on searchQuery
  const filteredSuggestions = searchQuery.trim()
    ? MASTER_RESOURCES.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : MASTER_RESOURCES;

  // Handle outside clicks to close suggestion box
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (resourceName) => {
    if (!selectedTags.includes(resourceName)) {
      setSelectedTags([...selectedTags, resourceName]);
    } else {
      // Toggle off if already selected
      setSelectedTags(selectedTags.filter(t => t !== resourceName));
    }
    setSearchQuery('');
    setShowSuggestions(true);
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && !searchQuery && selectedTags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      setSelectedTags(selectedTags.slice(0, -1));
      return;
    }

    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(filteredSuggestions[selectedIndex].name);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-8 font-sans max-w-4xl mx-auto pt-4">
      {/* Prominent Multi-Select Search Bar */}
      <div ref={searchContainerRef} className="w-full relative">
        <div className="w-full bg-white border border-[#d6d3d1] rounded-2xl p-2.5 pl-11 pr-20 min-h-[58px] flex flex-wrap items-center gap-2 focus-within:border-[#292524] focus-within:ring-2 focus-within:ring-[#292524]/20 transition-all shadow-sm hover:shadow-md relative">
          <Search className="w-5 h-5 text-[#777169] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

          {/* Multi-Selected Filter Tags */}
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#292524] text-white text-xs font-bold font-mono animate-in zoom-in-95 duration-150 shadow-2xs"
            >
              <span>[{tag}]</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                className="hover:text-amber-400 font-bold ml-0.5 text-xs text-[#a8a29e]"
                title={`Remove ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}

          {/* Text Input Field */}
          <input
            type="text"
            placeholder={selectedTags.length === 0 ? "Search transfers or multi-select resources e.g. ICU, Ventilator..." : "Add more filter tags..."}
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent min-w-[200px] text-base text-[#0c0a09] font-medium placeholder-[#777169] focus:outline-none py-1"
          />

          {(selectedTags.length > 0 || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTags([]);
                setSearchQuery('');
                setShowSuggestions(false);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#777169] hover:text-[#dc2626] p-1 transition-colors"
              title="Clear all filters"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Auto Suggestions Dropdown Box */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e7e5e4] rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-[#f0efed] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2.5 bg-[#fafafa] border-b border-[#e7e5e4] flex items-center justify-between text-[11px] font-mono font-bold text-[#777169]">
              <span>TRACKABLE HOSPITAL RESOURCES ({filteredSuggestions.length})</span>
              <span>Click to add / remove tags</span>
            </div>

            {filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#777169] font-mono">
                No matching resources found.
              </div>
            ) : (
              filteredSuggestions.map((item, idx) => {
                const isSelected = selectedTags.includes(item.name);
                return (
                  <div
                    key={item.name}
                    onClick={() => handleSelectSuggestion(item.name)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                      isSelected 
                        ? 'bg-emerald-50 text-[#0c0a09] font-bold' 
                        : idx === selectedIndex 
                          ? 'bg-[#292524] text-white' 
                          : 'hover:bg-[#f5f5f5] text-[#0c0a09]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 font-bold" />}
                      <span className="font-bold">{item.name}</span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      isSelected 
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : idx === selectedIndex 
                          ? 'bg-[#4e4e4e] text-white border-[#4e4e4e]' 
                          : 'bg-[#fafafa] text-[#777169] border-[#e7e5e4]'
                    }`}>
                      {isSelected ? 'ADDED' : item.category}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Quick Access Multi-Select Resource Chips */}
      <div className="space-y-2">
        <span className="text-xs font-mono font-bold text-[#777169] uppercase tracking-wider block">
          Quick Multi-Select Filters:
        </span>
        <div className="flex flex-wrap gap-2">
          {['ICU', 'Ventilator', 'CT Scan', 'Neurosurgeon', 'Blood Bank', 'Trauma Center', 'Stroke Unit', 'Dialysis'].map(chip => {
            const active = selectedTags.includes(chip);
            return (
              <button
                key={chip}
                onClick={() => handleSelectSuggestion(chip)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-2xs flex items-center gap-1.5 ${
                  active 
                    ? 'bg-[#292524] text-white border-[#292524]' 
                    : 'bg-white text-[#292524] border-[#e7e5e4] hover:bg-[#292524] hover:text-white'
                }`}
              >
                <span>{chip}</span>
                {active && <span className="text-[10px] text-amber-400 font-bold">✕</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[300px] w-full" />
    </div>
  );
}
