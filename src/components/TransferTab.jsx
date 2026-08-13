import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, MapPin, Building2, Activity, Phone, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const HOSPITALS_MAP_DATA = [
  {
    id: 'hosp-a',
    code: 'Hosp A',
    name: 'District Hospital Central',
    address: 'Indiranagar 100ft Road, East Zone',
    lat: 12.9716,
    lng: 77.5946,
    icuAvailable: 12,
    icuTotal: 30,
    ventAvailable: 6,
    type: 'District Secondary Hospital',
    status: 'ACTIVE_ORIGIN',
    statusText: 'Active Referral Origin',
    color: '#10b981', // Emerald green
    phone: '+91 80 2520 1923'
  },
  {
    id: 'hosp-b',
    code: 'Hosp B',
    name: 'City Super Specialty Hospital',
    address: 'Koramangala 4th Block, South Zone',
    lat: 12.9352,
    lng: 77.6245,
    icuAvailable: 3,
    icuTotal: 15,
    ventAvailable: 2,
    type: 'Tertiary Trauma Center',
    status: 'RECEIVING_TARGET',
    statusText: 'In-Transit Target Destination',
    color: '#2563eb', // Blue
    phone: '+91 80 4115 8800'
  },
  {
    id: 'hosp-c',
    code: 'Hosp C',
    name: 'Apex Trauma & Neurosurgery Institute',
    address: 'Malleshwaram West, North Zone',
    lat: 12.9988,
    lng: 77.5704,
    icuAvailable: 8,
    icuTotal: 25,
    ventAvailable: 5,
    type: 'Specialized Neuro Center',
    status: 'AVAILABLE_CANDIDATE',
    statusText: 'Available Candidate Match',
    color: '#d97706', // Amber
    phone: '+91 80 2334 5678'
  },
  {
    id: 'hosp-d',
    code: 'Hosp D',
    name: 'Valley Community Desk',
    address: 'Whitefield Main Road, East Zone',
    lat: 12.9698,
    lng: 77.7500,
    icuAvailable: 0,
    icuTotal: 10,
    ventAvailable: 0,
    type: 'Peripheral Desk',
    status: 'FULL_CAPACITY',
    statusText: 'No ICU Beds Available',
    color: '#dc2626', // Red
    phone: '+91 80 6718 2000'
  }
];

const createCustomIcon = (code, color, icuAvailable) => {
  return L.divIcon({
    className: 'custom-leaflet-hospital-icon',
    html: `
      <div style="
        background-color: ${color};
        color: white;
        padding: 5px 10px;
        border-radius: 9999px;
        font-family: monospace;
        font-size: 11px;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        cursor: pointer;
      ">
        <span style="width: 8px; height: 8px; border-radius: 9999px; background: white;"></span>
        <span>${code}</span>
        <span style="background: rgba(0,0,0,0.25); padding: 1px 5px; border-radius: 6px; font-size: 10px;">ICU: ${icuAvailable}</span>
      </div>
    `,
    iconSize: [110, 30],
    iconAnchor: [55, 15]
  });
};

export function TransferTab() {
  const [selectedTags, setSelectedTags] = useState(['ICU', 'Ventilator']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeHospital, setActiveHospital] = useState(null);
  const searchContainerRef = useRef(null);

  // Filter master resources based on searchQuery
  const filteredSuggestions = searchQuery.trim()
    ? MASTER_RESOURCES.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : MASTER_RESOURCES;

  // Filter map hospitals based on selected tags or query
  const filteredHospitals = HOSPITALS_MAP_DATA.filter(h => {
    if (selectedTags.length === 0 && !searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || h.name.toLowerCase().includes(query) || h.address.toLowerCase().includes(query);
    return matchesQuery;
  });

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

  // Coordinates for polyline connecting active origin (Hosp A) to receiving target (Hosp B)
  const routePolyline = [
    [12.9716, 77.5946], // Hosp A
    [12.9550, 77.6100], // Midpoint waypoint
    [12.9352, 77.6245]  // Hosp B
  ];

  return (
    <div className="space-y-6 font-sans max-w-5xl mx-auto pt-4">
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
      <div className="flex items-center justify-between">
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

      {/* Real Interactive OpenStreetMap Hospital Map Container */}
      <div className="eleven-card bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-sm space-y-0">
        <div className="p-4 bg-[#fafafa] border-b border-[#e7e5e4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0c0a09] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Real-Time Hospital & Regional Transfer Network Map</span>
            </h2>
            <p className="text-xs text-[#777169] font-light">
              Live capacity monitoring across regional trauma centers & active dispatch corridors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Origin
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Receiving Target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Candidate
            </span>
          </div>
        </div>

        {/* Leaflet OpenStreetMap View */}
        <div className="h-[480px] w-full relative z-10">
          <MapContainer
            center={[12.9716, 77.6100]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Emergency Transit Route Corridor Polyline */}
            <Polyline
              positions={routePolyline}
              pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8, dashArray: '8, 8' }}
            />

            {/* Hospital Markers */}
            {filteredHospitals.map(hosp => (
              <Marker
                key={hosp.id}
                position={[hosp.lat, hosp.lng]}
                icon={createCustomIcon(hosp.code, hosp.color, hosp.icuAvailable)}
                eventHandlers={{
                  click: () => setActiveHospital(hosp)
                }}
              >
                <Popup className="custom-hospital-leaflet-popup">
                  <div className="p-2 space-y-2 font-sans text-xs">
                    <div className="border-b border-[#e7e5e4] pb-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: hosp.color }}>
                        {hosp.statusText}
                      </span>
                      <h3 className="font-bold text-[#0c0a09] text-sm">{hosp.name}</h3>
                      <p className="text-[#777169] text-[11px]">{hosp.address}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#f5f5f5] p-2 rounded-lg font-mono">
                      <div>
                        <span className="text-[10px] text-[#777169] block">ICU Beds:</span>
                        <strong className="text-emerald-700 text-xs">{hosp.icuAvailable} free</strong> / {hosp.icuTotal}
                      </div>
                      <div>
                        <span className="text-[10px] text-[#777169] block">Ventilators:</span>
                        <strong className="text-blue-700 text-xs">{hosp.ventAvailable} free</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#777169] font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#292524]" /> {hosp.phone}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
