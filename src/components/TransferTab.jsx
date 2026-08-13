import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, MapPin, Phone, Building2, Navigation, ShieldCheck, X, ChevronRight, Layers, Maximize2, Locate, Eye } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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
    distanceKm: '0.0', // Origin location
    phone: '+91 80 2520 1923',
    color: '#10b981', // Emerald green
    statusText: 'Active Referral Origin',
    resources: [
      { name: 'ICU', available: 12, total: 30 },
      { name: 'Ventilator', available: 6, total: 15 },
      { name: 'CT Scan', available: 2, total: 3 },
      { name: 'X-ray', available: 5, total: 10 },
      { name: 'Ultrasound', available: 4, total: 6 },
      { name: 'Emergency Department', available: 15, total: 40 },
      { name: 'Trauma Center', available: 8, total: 20 },
      { name: 'General Surgeon', available: 3, total: 5 },
      { name: 'Intensivist', available: 2, total: 4 },
      { name: 'Anesthesiologist', available: 3, total: 6 },
      { name: 'Blood Bank', available: 25, total: 50 },
      { name: 'ECG', available: 8, total: 12 }
    ]
  },
  {
    id: 'hosp-b',
    code: 'Hosp B',
    name: 'City Super Specialty Hospital',
    address: 'Koramangala 4th Block, South Zone',
    lat: 12.9352,
    lng: 77.6245,
    distanceKm: '5.2',
    phone: '+91 80 4115 8800',
    color: '#2563eb', // Blue
    statusText: 'In-Transit Target Destination',
    resources: [
      { name: 'ICU', available: 3, total: 15 },
      { name: 'Trauma ICU', available: 2, total: 8 },
      { name: 'Ventilator', available: 2, total: 8 },
      { name: 'HFNC', available: 4, total: 10 },
      { name: 'CT Scan', available: 1, total: 2 },
      { name: 'MRI', available: 1, total: 2 },
      { name: 'Neurosurgeon', available: 2, total: 3 },
      { name: 'Cardiologist', available: 3, total: 5 },
      { name: 'Stroke Unit', available: 4, total: 10 },
      { name: 'Emergency OT', available: 2, total: 4 },
      { name: 'Blood Bank', available: 14, total: 30 },
      { name: 'Anesthesiologist', available: 4, total: 6 }
    ]
  },
  {
    id: 'hosp-c',
    code: 'Hosp C',
    name: 'Apex Trauma & Neurosurgery Institute',
    address: 'Malleshwaram West, North Zone',
    lat: 12.9988,
    lng: 77.5704,
    distanceKm: '3.4',
    phone: '+91 80 2334 5678',
    color: '#d97706', // Amber
    statusText: 'Available Candidate Match',
    resources: [
      { name: 'ICU', available: 8, total: 25 },
      { name: 'Trauma ICU', available: 5, total: 12 },
      { name: 'PICU', available: 3, total: 10 },
      { name: 'NICU', available: 4, total: 10 },
      { name: 'Ventilator', available: 5, total: 12 },
      { name: 'HFNC', available: 6, total: 15 },
      { name: 'Emergency Department', available: 20, total: 50 },
      { name: 'Trauma Center', available: 12, total: 30 },
      { name: 'Emergency OT', available: 3, total: 6 },
      { name: 'Blood Bank', available: 30, total: 60 },
      { name: 'CT Scan', available: 2, total: 3 },
      { name: 'MRI', available: 2, total: 3 },
      { name: 'Neurosurgeon', available: 4, total: 5 },
      { name: 'Trauma Surgeon', available: 3, total: 4 },
      { name: 'Orthopedic Surgeon', available: 4, total: 6 },
      { name: 'Stroke Unit', available: 6, total: 12 },
      { name: 'Dialysis', available: 5, total: 10 }
    ]
  },
  {
    id: 'hosp-d',
    code: 'Hosp D',
    name: 'Valley Community Desk',
    address: 'Whitefield Main Road, East Zone',
    lat: 12.9698,
    lng: 77.7500,
    distanceKm: '12.8',
    phone: '+91 80 6718 2000',
    color: '#dc2626', // Red
    statusText: 'No ICU Beds Available',
    resources: [
      { name: 'X-ray', available: 3, total: 5 },
      { name: 'ECG', available: 4, total: 6 },
      { name: 'General Surgeon', available: 1, total: 2 },
      { name: 'Pediatrician', available: 2, total: 4 }
    ]
  }
];

// Inner Leaflet component for smooth flying/bounding navigation
function MapFlyToController({ targetPos, targetZoom, targetBounds }) {
  const map = useMap();
  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, { padding: [40, 40] });
    } else if (targetPos) {
      map.flyTo(targetPos, targetZoom || 13, { duration: 0.8 });
    }
  }, [targetPos, targetZoom, targetBounds, map]);
  return null;
}

// Custom Google Maps Location Pin Marker with Medical Cross (+) Sign
const createGoogleMapsPinIcon = (code, color, isMatch) => {
  return L.divIcon({
    className: 'custom-google-maps-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        opacity: ${isMatch ? 1 : 0.35};
        filter: ${isMatch ? 'none' : 'grayscale(80%)'};
        transition: all 0.25s ease;
        transform: scale(${isMatch ? 1 : 0.85});
        cursor: pointer;
      ">
        <div style="
          background-color: ${color};
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        ">
          <div style="
            transform: rotate(45deg);
            font-size: 16px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
          ">
            ✚
          </div>
        </div>
        <div style="
          background: #1c1917;
          color: white;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 6px;
          margin-top: 4px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
        ">
          ${code}
        </div>
      </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 48]
  });
};

export function TransferTab() {
  const [selectedTags, setSelectedTags] = useState(['ICU', 'Ventilator']);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detailHospitalModal, setDetailHospitalModal] = useState(null);
  
  // Navigation map target state
  const [mapTargetPos, setMapTargetPos] = useState([12.9716, 77.6100]);
  const [mapTargetZoom, setMapTargetZoom] = useState(12);
  const [mapTargetBounds, setMapTargetBounds] = useState(null);
  const [enableWheelZoom, setEnableWheelZoom] = useState(false);

  const searchContainerRef = useRef(null);

  // Filter master resources based on searchQuery
  const filteredSuggestions = searchQuery.trim()
    ? MASTER_RESOURCES.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : MASTER_RESOURCES;

  // Real-time map hospital filtering based on selected filter tags
  const filteredHospitals = HOSPITALS_MAP_DATA.map(h => {
    const hasAllSelectedTags = selectedTags.every(tag => {
      const res = h.resources.find(r => r.name.toLowerCase() === tag.toLowerCase());
      return res && res.available > 0;
    });

    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || h.name.toLowerCase().includes(query) || h.address.toLowerCase().includes(query);

    const isMatch = hasAllSelectedTags && matchesQuery;
    return { ...h, isMatch };
  });

  const activeMatchesCount = filteredHospitals.filter(h => h.isMatch).length;

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

  const handleFocusHospitalOnMap = (hosp) => {
    setMapTargetBounds(null);
    setMapTargetPos([hosp.lat, hosp.lng]);
    setMapTargetZoom(14);
  };

  const handleFitAllHospitalsOnMap = () => {
    const bounds = L.latLngBounds(HOSPITALS_MAP_DATA.map(h => [h.lat, h.lng]));
    setMapTargetBounds(bounds);
  };

  const routePolyline = [
    [12.9716, 77.5946], // Hosp A
    [12.9550, 77.6100], // Waypoint
    [12.9352, 77.6245]  // Hosp B
  ];

  return (
    <div className="min-h-screen space-y-8 font-sans max-w-5xl mx-auto pt-4 pb-32">
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

        <div className="text-xs font-mono text-[#777169]">
          Matching Hospitals: <strong className="text-[#0c0a09]">{activeMatchesCount}</strong> / {HOSPITALS_MAP_DATA.length}
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
              Use quick focus buttons below to navigate map smoothly without page scroll lock.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Origin
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Destination
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Candidate Match
            </span>
          </div>
        </div>

        {/* Map Ergonomic Navigation Toolbar */}
        <div className="p-3 bg-[#f5f5f5] border-b border-[#e7e5e4] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-[#777169] uppercase font-bold mr-1">Quick Focus:</span>
            
            <button
              onClick={handleFitAllHospitalsOnMap}
              className="px-2.5 py-1 bg-white border border-[#e7e5e4] rounded-lg hover:bg-[#292524] hover:text-white transition-all text-[11px] font-semibold shadow-2xs flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3" /> Fit All (4)
            </button>

            {HOSPITALS_MAP_DATA.map(hosp => (
              <button
                key={hosp.id}
                onClick={() => handleFocusHospitalOnMap(hosp)}
                className="px-2.5 py-1 bg-white border rounded-lg hover:bg-[#292524] hover:text-white transition-all text-[11px] font-semibold shadow-2xs flex items-center gap-1 text-[#292524]"
                style={{ borderColor: hosp.color + '60' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hosp.color }}></span>
                {hosp.code}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEnableWheelZoom(!enableWheelZoom)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                enableWheelZoom 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-white text-[#777169] border-[#e7e5e4] hover:text-[#0c0a09]'
              }`}
              title="Toggle mouse scroll wheel zoom"
            >
              <span>{enableWheelZoom ? 'Wheel Zoom: ON' : 'Wheel Zoom: OFF (Scroll Safe)'}</span>
            </button>
          </div>
        </div>

        {/* Leaflet OpenStreetMap View */}
        <div className="h-[480px] w-full relative z-10">
          <MapContainer
            center={[12.9716, 77.6100]}
            zoom={12}
            scrollWheelZoom={enableWheelZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <MapFlyToController 
              targetPos={mapTargetPos} 
              targetZoom={mapTargetZoom} 
              targetBounds={mapTargetBounds} 
            />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Emergency Transit Route Corridor Polyline */}
            <Polyline
              positions={routePolyline}
              pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8, dashArray: '8, 8' }}
            />

            {/* Google-Style Hospital Pins with Medical Cross Sign */}
            {filteredHospitals.map(hosp => (
              <Marker
                key={hosp.id}
                position={[hosp.lat, hosp.lng]}
                icon={createGoogleMapsPinIcon(hosp.code, hosp.color, hosp.isMatch)}
                eventHandlers={{
                  dblclick: () => setDetailHospitalModal(hosp)
                }}
              >
                <Popup className="custom-hospital-leaflet-popup">
                  <div className="p-2.5 space-y-2.5 font-sans text-xs min-w-[240px]">
                    <div className="border-b border-[#e7e5e4] pb-2">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{ color: hosp.color, borderColor: hosp.color + '40', backgroundColor: hosp.color + '15' }}>
                          {hosp.statusText}
                        </span>
                        {!hosp.isMatch && (
                          <span className="text-[9px] font-mono text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md font-bold">
                            FILTER MISMATCH
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-[#0c0a09] text-sm">{hosp.name}</h3>
                      <p className="text-[#777169] text-[11px] mt-0.5">{hosp.address}</p>
                    </div>

                    {/* Distance from Current Location */}
                    <div className="bg-[#f5f5f5] p-2 rounded-xl flex items-center justify-between font-mono text-xs">
                      <span className="text-[#777169] text-[11px] flex items-center gap-1 font-sans">
                        <Navigation className="w-3.5 h-3.5 text-emerald-600" /> Distance from origin:
                      </span>
                      <strong className="text-[#0c0a09] font-bold">
                        {hosp.distanceKm === '0.0' ? 'Current Origin' : `${hosp.distanceKm} km`}
                      </strong>
                    </div>

                    {/* Available Bed Count Summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
                        <span className="text-[10px] text-[#777169] block font-sans">ICU Beds:</span>
                        <strong className="text-emerald-700">{hosp.resources.find(r=>r.name==='ICU')?.available || 0} Available</strong>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg">
                        <span className="text-[10px] text-[#777169] block font-sans">Ventilators:</span>
                        <strong className="text-blue-700">{hosp.resources.find(r=>r.name==='Ventilator')?.available || 0} Available</strong>
                      </div>
                    </div>

                    {/* Action Button to Open Full Hospital Resource Details Modal */}
                    <button
                      onClick={() => setDetailHospitalModal(hosp)}
                      className="w-full eleven-button eleven-button-primary text-xs py-2 px-3 justify-center font-bold shadow-2xs hover:bg-[#292524] transition-all"
                    >
                      <span>View Full Resource Details</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="text-[10px] text-[#a8a29e] text-center font-mono">
                      (Hint: Double-click pin anytime to open details)
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Hospital Network Summary List Cards (Big Scroll Page Section) */}
      <div className="space-y-4 pt-4 border-t border-[#e7e5e4]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0c0a09] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#292524]" />
              <span>Regional Hospital Directory ({filteredHospitals.length})</span>
            </h3>
            <p className="text-xs text-[#777169]">
              Scroll down to inspect individual hospital capacity or focus directly on map.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHospitals.map(hosp => (
            <div 
              key={hosp.id} 
              className={`eleven-card p-5 space-y-3 bg-white border transition-all ${
                hosp.isMatch ? 'border-[#e7e5e4] hover:border-[#292524]' : 'border-red-200 bg-red-50/30 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{ color: hosp.color, borderColor: hosp.color + '40', backgroundColor: hosp.color + '15' }}>
                    {hosp.statusText}
                  </span>
                  <h4 className="font-bold text-[#0c0a09] text-base mt-1">{hosp.name}</h4>
                  <p className="text-xs text-[#777169]">{hosp.address}</p>
                </div>

                <div className="text-right font-mono flex-shrink-0">
                  <span className="text-xs text-[#777169] block">Distance:</span>
                  <strong className="text-sm text-[#0c0a09]">
                    {hosp.distanceKm === '0.0' ? 'Origin' : `${hosp.distanceKm} km`}
                  </strong>
                </div>
              </div>

              {/* Bed Availability Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#fafafa] p-2.5 rounded-xl border border-[#f0efed]">
                <div>
                  <span className="text-[10px] text-[#777169] block font-sans">ICU Beds:</span>
                  <strong className="text-emerald-700">{hosp.resources.find(r=>r.name==='ICU')?.available || 0} Available</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#777169] block font-sans">Ventilators:</span>
                  <strong className="text-blue-700">{hosp.resources.find(r=>r.name==='Ventilator')?.available || 0} Available</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0efed]">
                <button
                  onClick={() => handleFocusHospitalOnMap(hosp)}
                  className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 font-semibold flex items-center gap-1"
                >
                  <Locate className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Focus Map</span>
                </button>

                <button
                  onClick={() => setDetailHospitalModal(hosp)}
                  className="eleven-button eleven-button-primary text-xs py-1.5 px-3 font-semibold flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hospital Full Details Modal */}
      {detailHospitalModal && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="eleven-card w-full max-w-2xl bg-white border-[#d6d3d1] max-h-[85vh] flex flex-col shadow-2xl rounded-2xl">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white px-6 py-4 border-b border-[#e7e5e4] flex items-center justify-between rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: detailHospitalModal.color }}></span>
                  <h2 className="text-lg font-bold text-[#0c0a09]">{detailHospitalModal.name}</h2>
                </div>
                <p className="text-xs text-[#777169] mt-0.5">{detailHospitalModal.address} • {detailHospitalModal.phone}</p>
              </div>

              <button
                onClick={() => setDetailHospitalModal(null)}
                aria-label="Close modal"
                className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 font-bold hover:bg-[#292524] hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            {/* Scrollable Resource Details Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
              {/* Distance & Contact Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#fafafa] border border-[#e7e5e4] p-3 rounded-xl text-xs font-mono">
                <div>
                  <span className="text-[#777169] text-[10px] block font-sans">Distance from Origin:</span>
                  <strong className="text-[#0c0a09] text-sm">
                    {detailHospitalModal.distanceKm === '0.0' ? 'Origin Location' : `${detailHospitalModal.distanceKm} km`}
                  </strong>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block font-sans">Hospital Status:</span>
                  <strong style={{ color: detailHospitalModal.color }}>{detailHospitalModal.statusText}</strong>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block font-sans">Direct Desk Phone:</span>
                  <strong className="text-[#292524]">{detailHospitalModal.phone}</strong>
                </div>
              </div>

              {/* 1. CHOSEN FILTER REQUIREMENTS (Displayed FIRST!) */}
              {selectedTags.length > 0 && (
                <div className="space-y-3 bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl">
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Chosen Filter Requirements ({selectedTags.length})</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedTags.map(tag => {
                      const res = detailHospitalModal.resources.find(r => r.name.toLowerCase() === tag.toLowerCase());
                      const isAvailable = res && res.available > 0;
                      return (
                        <div 
                          key={tag} 
                          className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                            isAvailable 
                              ? 'bg-white border-emerald-300 shadow-2xs' 
                              : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isAvailable ? (
                              <Check className="w-4 h-4 text-emerald-600 font-bold" />
                            ) : (
                              <X className="w-4 h-4 text-red-600 font-bold" />
                            )}
                            <span className="font-bold text-[#0c0a09]">[{tag}]</span>
                          </div>

                          <div className="font-mono text-right">
                            {isAvailable ? (
                              <span className="text-emerald-700 font-bold">{res.available} Available</span>
                            ) : (
                              <span className="text-red-600 font-bold">Unavailable</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. ALL OTHER AVAILABLE FACILITIES & SPECIALISTS */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#777169] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#292524]" />
                  <span>All Other Available Hospital Resources ({detailHospitalModal.resources.length})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detailHospitalModal.resources
                    .filter(r => !selectedTags.some(t => t.toLowerCase() === r.name.toLowerCase()))
                    .map(r => (
                      <div key={r.name} className="p-3 bg-white border border-[#e7e5e4] rounded-lg flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#292524]">{r.name}</span>
                        <span className="font-mono text-xs font-bold text-emerald-600">
                          {r.available} Available {r.total ? `/ ${r.total}` : ''}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
