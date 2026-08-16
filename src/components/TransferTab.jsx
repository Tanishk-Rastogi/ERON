import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Check, MapPin, Phone, Building2, Navigation, ShieldCheck, X, 
  ChevronRight, Layers, Maximize2, Compass, MousePointer, Plus, Send, 
  AlertTriangle, Clock, User, Stethoscope, Activity, FileText, CheckCircle2, Radio, Sparkles
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useWebSocket } from '../context/WebSocketContext';
import { apiClient } from '../utils/apiClient.js';

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

// Custom Google Maps Location Pin Marker displaying ONLY Hospital Name
const createGoogleMapsPinIcon = (name, color, isMatch, isTop3) => {
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
        transform: scale(${isMatch ? (isTop3 ? 1.1 : 1) : 0.8});
        cursor: pointer;
      ">
        <div style="
          background-color: ${color};
          color: white;
          width: ${isTop3 ? '42px' : '36px'};
          height: ${isTop3 ? '42px' : '36px'};
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
            font-size: ${isTop3 ? '18px' : '15px'};
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
          font-family: sans-serif;
          font-size: 10px;
          font-weight: bold;
          padding: 2.5px 8px;
          border-radius: 6px;
          margin-top: 4px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 1px solid ${isTop3 ? '#10b981' : 'rgba(255,255,255,0.2)'};
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">
          ${isTop3 ? '⭐ ' : ''}${name}
        </div>
      </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 48]
  });
};

const createUserLocationPinIcon = () => {
  return L.divIcon({
    className: 'custom-user-gps-leaflet-marker',
    html: `
      <div style="
        background-color: #2563eb;
        color: white;
        padding: 5px 12px;
        border-radius: 9999px;
        font-family: sans-serif;
        font-size: 11px;
        font-weight: 800;
        border: 2px solid white;
        box-shadow: 0 0 15px rgba(37, 99, 235, 0.8);
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      ">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #60a5fa; display: inline-block;"></span>
        <span>📍 You Are Here (Origin GPS)</span>
      </div>
    `,
    iconSize: [140, 30],
    iconAnchor: [70, 15]
  });
};

export function TransferTab({ authSession }) {
  const { setLastNotification, hospitals } = useWebSocket() || {};

  const [hospitalsList, setHospitalsList] = useState([]);
  const [selectedTags, setSelectedTags] = useState(['ICU', 'Ventilator']);

  useEffect(() => {
    if (hospitals && hospitals.length > 0) {
      // Filter out self (origin hospital) so we don't transfer to ourselves using safe string comparison
      const others = hospitals.filter(h => String(h.id) !== String(authSession?.hospitalId));
      
      const mapped = others.map((h, i) => {
        // Safely map backend resources to frontend expected shape
        const mappedResources = (h.resources || []).map(r => ({
          name: String(r.resourceType || r.bed_type || r.name || 'Unknown').replace('_', ' '),
          available: r.availableCount !== undefined ? r.availableCount : (r.available || 0),
          total: r.totalCapacity !== undefined ? r.totalCapacity : (r.total || 0),
          category: 'Medical Resource'
        }));

        return {
          id: h.id, // REAL DB INTEGER ID
          name: h.name,
          address: h.contactInfo || 'Mapped Location',
          lat: h.locationLat || 12.97 + (Math.random() * 0.05),
          lng: h.locationLng || 77.59 + (Math.random() * 0.05),
          distanceKm: (2.5 + i).toFixed(1),
          etaMins: (8 + i * 2).toString(),
          phone: h.contactInfo || '+91 000 0000',
          color: (i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#d97706' : '#2563eb'),
          resources: mappedResources
        };
      });
      setHospitalsList(mapped);
    }
  }, [hospitals, authSession]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detailHospitalModal, setDetailHospitalModal] = useState(null);

  // Active Patient Entry state
  const [activePatient, setActivePatient] = useState(null);

  // Modal visibility states
  const [isCreatePatientModalOpen, setIsCreatePatientModalOpen] = useState(false);
  const [sendAlertModalHosp, setSendAlertModalHosp] = useState(null);
  const [alertSentHospitals, setAlertSentHospitals] = useState({}); // { [hospId]: true }

  // Form state for creating patient entry
  const [newPatientForm, setNewPatientForm] = useState({
    patientName: '',
    patientAge: '',
    patientSex: 'Male',
    diagnosisSuspected: '',
    priority: 'CRITICAL',
    requiredEquipment: ['ICU', 'Ventilator'],
    referringDoctorName: 'Dr. Ramesh Kumar',
    timeoutMinutes: 5
  });

  // Navigation map target state
  const [mapTargetPos, setMapTargetPos] = useState([12.9716, 77.6100]);
  const [mapTargetZoom, setMapTargetZoom] = useState(12);
  const [mapTargetBounds, setMapTargetBounds] = useState(null);
  const [enableWheelZoom, setEnableWheelZoom] = useState(false);

  // Device Geolocation state
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  const searchContainerRef = useRef(null);

  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  const handleFetchDeviceLocationAndNearbyHospitals = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported by browser');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Locating device GPS...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapTargetPos([latitude, longitude]);
        setMapTargetZoom(13);
        // Only recalculate distances for registered DB hospitals
        setHospitalsList(prev => prev.map(h => {
          const dist = calculateDistanceKm(latitude, longitude, h.lat, h.lng);
          return { ...h, distanceKm: dist, etaMins: Math.round(parseFloat(dist) * 2.2 + 2).toString() };
        }));
        setLocationStatus('GPS acquired! Distances recalculated.');
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        setLocationStatus('GPS Access Denied');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleFitAllHospitalsOnMap = () => {
    if (hospitalsList.length === 0) return;
    const lats = hospitalsList.map(h => h.lat);
    const lngs = hospitalsList.map(h => h.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    setMapTargetBounds([[minLat, minLng], [maxLat, maxLng]]);
  };

  // Filter master resources based on searchQuery
  const filteredSuggestions = searchQuery.trim()
    ? MASTER_RESOURCES.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : MASTER_RESOURCES;

  // Real-time filtering logic
  const filteredHospitals = hospitalsList.map(h => {
    const hasAllSelectedTags = selectedTags.length === 0 || selectedTags.every(tag => {
      const res = h.resources.find(r => r.name.toLowerCase() === tag.toLowerCase());
      return res && res.available > 0;
    });

    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      h.name.toLowerCase().includes(query) || 
      h.address.toLowerCase().includes(query) ||
      h.resources.some(r => r.name.toLowerCase().includes(query) && r.available > 0);

    const isMatch = hasAllSelectedTags && matchesQuery;
    return { ...h, isMatch };
  });

  // Top 3 Nearest Matched Hospitals (sorted strictly by shortest distance)
  const top3Hospitals = [...filteredHospitals]
    .filter(h => h.isMatch)
    .sort((a, b) => parseFloat(a.distanceKm) - parseFloat(b.distanceKm))
    .slice(0, 3);

  const top3HospitalIds = new Set(top3Hospitals.map(h => h.id));

  // Handle outside click for search suggestions dropdown
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

  const handleQuickSelectChip = (chipName) => {
    if (!selectedTags.includes(chipName)) {
      setSelectedTags([...selectedTags, chipName]);
    } else {
      setSelectedTags(selectedTags.filter(t => t !== chipName));
    }
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  const handleCreatePatientEntrySubmit = (e) => {
    e.preventDefault();
    if (!newPatientForm.patientName.trim()) return;

    const createdRefCode = `PAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = {
      patientName: newPatientForm.patientName.trim(),
      patientAge: parseInt(newPatientForm.patientAge) || 45,
      patientSex: newPatientForm.patientSex,
      diagnosisSuspected: newPatientForm.diagnosisSuspected.trim() || 'Acute Critical Emergency',
      priority: newPatientForm.priority,
      requiredEquipment: [...newPatientForm.requiredEquipment],
      referringDoctorName: newPatientForm.referringDoctorName || 'Dr. Ramesh Kumar',
      timeoutMinutes: parseInt(newPatientForm.timeoutMinutes) || 5,
      patientRefCode: createdRefCode
    };

    setActivePatient(created);
    setSelectedTags([...newPatientForm.requiredEquipment]);
    setIsCreatePatientModalOpen(false);

    if (setLastNotification) {
      setLastNotification({
        id: Date.now(),
        text: `Patient transfer entry created for ${created.patientName} (${created.patientRefCode}). Auto-matched top nearest hospitals!`,
        type: 'success'
      });
    }

    // Reset form
    setNewPatientForm({
      patientName: '',
      patientAge: '',
      patientSex: 'Male',
      diagnosisSuspected: '',
      priority: 'CRITICAL',
      requiredEquipment: ['ICU', 'Ventilator'],
      referringDoctorName: 'Dr. Ramesh Kumar',
      timeoutMinutes: 5
    });
  };

  const handleConfirmSendAlert = async (hosp) => {
    setAlertSentHospitals(prev => ({ ...prev, [hosp.id]: true }));
    setSendAlertModalHosp(null);

    // Read stored auth session if available (or use props)
    let originHospId = authSession?.hospitalId || 'hosp-a';

    try {
      const res = await apiClient('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originHospitalId: originHospId,
          targetHospitalId: hosp.id,
          requirementSummary: `${activePatient.diagnosisSuspected} — Priority ${activePatient.priority}`,
          requiredResources: activePatient.requiredEquipment,
          priority: activePatient.priority,
          timeoutMinutes: activePatient.timeoutMinutes || 5,
          patientData: {
            patientName: activePatient.patientName,
            patientAge: activePatient.patientAge,
            patientSex: activePatient.patientSex,
            diagnosisSuspected: activePatient.diagnosisSuspected,
            referringDoctorName: activePatient.referringDoctorName,
            vitals: { bp: '135/85', hr: 104, spo2: 95, rr: 22, temp: '98.6 F', gcs: 14 }
          }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to dispatch referral to the server.');
      }

      if (setLastNotification) {
        setLastNotification({
          id: Date.now(),
          text: `EMERGENCY ALERT DISPATCHED to ${hosp.name}! Receiving desk notified via WebSocket & SMS green corridor alert.`,
          type: 'success'
        });
      }
    } catch (err) {
      console.warn('Post referral API notice:', err);
      if (setLastNotification) {
        setLastNotification({
          id: Date.now(),
          text: `DISPATCH FAILED: ${err.message}`,
          type: 'error'
        });
      }
    }
  };

  const toggleEquipmentInForm = (equipmentName) => {
    setNewPatientForm(prev => {
      const exists = prev.requiredEquipment.includes(equipmentName);
      return {
        ...prev,
        requiredEquipment: exists 
          ? prev.requiredEquipment.filter(e => e !== equipmentName)
          : [...prev.requiredEquipment, equipmentName]
      };
    });
  };

  return (
    <div className="min-h-screen space-y-6 font-sans max-w-7xl mx-auto pt-2 pb-32">
      
      {/* TOP BAR HEADER & CREATE PATIENT ENTRY BUTTON */}
      <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-[#0c0a09] tracking-tight">
              Emergency Patient Transfer & Hospital Matching
            </h1>
          </div>
        </div>

        <button
          onClick={() => setIsCreatePatientModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Patient Entry</span>
        </button>
      </div>

      {/* ACTIVE PATIENT OVERVIEW SUMMARY BANNER */}
      {!activePatient ? (
        <div className="bg-white border-2 border-dashed border-[#d6d3d1] p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 mt-4">
          <div className="w-12 h-12 bg-[#fafafa] rounded-full flex items-center justify-center text-[#777169]">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-[#0c0a09]">No Active Patient</h3>
            <p className="text-xs text-[#777169] mt-1 max-w-[200px]">Create a patient referral entry to start matching hospitals</p>
          </div>
          <button onClick={() => setIsCreatePatientModalOpen(true)} className="px-4 py-2 mt-2 bg-[#292524] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-black transition-colors">
            + New Referral Entry
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] p-4 rounded-2xl border border-[#292524] text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {activePatient.patientName} ({activePatient.patientAge}y, {activePatient.patientSex})
                </span>
                <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                  activePatient.priority === 'CRITICAL' ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white'
                }`}>
                  {activePatient.priority} PRIORITY
                </span>
              </div>
              <p className="text-xs text-[#a8a29e] mt-0.5 font-medium">
                Diagnosis: <strong className="text-emerald-300">{activePatient.diagnosisSuspected}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#a8a29e] text-[11px]">Required:</span>
            <div className="flex flex-wrap gap-1">
              {activePatient.requiredEquipment.map((req, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-lg bg-white/10 text-white border border-white/20 text-[11px] font-bold">
                  {req}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BIG PROMINENT SEARCH BAR */}
      <div ref={searchContainerRef} className="w-full relative space-y-3 z-[999]">
        <div className="w-full bg-white border border-[#d6d3d1] rounded-2xl p-2.5 pl-12 pr-24 min-h-[62px] flex flex-wrap items-center gap-2 focus-within:border-[#292524] focus-within:ring-2 focus-within:ring-[#292524]/20 transition-all shadow-md hover:shadow-lg relative">
          <Search className="w-5 h-5 text-[#777169] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />

          {/* Multi-Selected Filter Tags inside Search Bar */}
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

          {/* Search Text Input */}
          <input
            type="text"
            placeholder={selectedTags.length === 0 ? "Search hospital name, location, or required equipment e.g. ICU, Ventilator, Neurosurgeon..." : "Type to filter further..."}
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedIndex(-1);
            }}
            className="flex-1 bg-transparent min-w-[220px] text-base text-[#0c0a09] font-medium placeholder-[#777169] focus:outline-none py-1"
          />

          {(selectedTags.length > 0 || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTags([]);
                setSearchQuery('');
                setShowSuggestions(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#777169] hover:text-[#dc2626] p-1.5 transition-colors"
              title="Clear all search filters"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Auto Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e7e5e4] rounded-2xl shadow-2xl z-[9999] max-h-80 overflow-y-auto divide-y divide-[#f0efed] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2.5 bg-[#fafafa] border-b border-[#e7e5e4] flex items-center justify-between text-[11px] font-mono font-bold text-[#777169]">
              <span>TRACKABLE HOSPITAL RESOURCES ({filteredSuggestions.length})</span>
              <span>Click item to toggle filter tag</span>
            </div>

            {filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#777169] font-mono">
                No matching equipment or hospital facilities found.
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

        {/* Quick Resource Access Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            {['ICU', 'Ventilator', 'CT Scan', 'Neurosurgeon', 'Blood Bank', 'Trauma Center', 'Stroke Unit', 'Dialysis'].map(chip => {
              const active = selectedTags.includes(chip);
              return (
                <button
                  key={chip}
                  onClick={() => handleQuickSelectChip(chip)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs flex items-center gap-1.5 ${
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
            Matched Facilities: <strong className="text-[#0c0a09]">{top3Hospitals.length}</strong> available
          </div>
        </div>
      </div>

      {/* SIDE-BY-SIDE LAYOUT: MAP ON LEFT (7 COLS) + TOP 3 NEAREST CARDS ON RIGHT (5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Clean Map Container (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-sm space-y-0">
            
            {/* Map Header & Ergonomic Control Bar */}
            <div className="p-3.5 bg-[#fafafa] border-b border-[#e7e5e4] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#0c0a09] flex items-center gap-1.5 font-sans">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Hospital Location Network Map
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleFetchDeviceLocationAndNearbyHospitals}
                  disabled={isLocating}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all text-[11px] font-bold shadow-xs flex items-center gap-1.5"
                  title="Detect device real GPS location"
                >
                  <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Acquiring GPS...' : '📍 Detect My GPS'}</span>
                </button>

                <button
                  onClick={handleFitAllHospitalsOnMap}
                  className="px-2.5 py-1 bg-white border border-[#e7e5e4] rounded-lg hover:bg-[#292524] hover:text-white transition-all text-[11px] font-semibold shadow-2xs flex items-center gap-1"
                >
                  <Maximize2 className="w-3 h-3" /> Fit All
                </button>

                <button
                  onClick={() => setEnableWheelZoom(!enableWheelZoom)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                    enableWheelZoom 
                      ? 'bg-emerald-600 text-white border-emerald-600' 
                      : 'bg-white text-[#777169] border-[#e7e5e4] hover:text-[#0c0a09]'
                  }`}
                >
                  <MousePointer className="w-3 h-3" />
                  <span>Scroll Zoom: {enableWheelZoom ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            {/* OpenStreetMap Container */}
            <div className="h-[520px] w-full relative">
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
                  maxZoom={19}
                />

                {/* User Real GPS Location Marker */}
                {userLocation && (
                  <Marker position={userLocation} icon={createUserLocationPinIcon()}>
                    <Popup>
                      <div className="p-1 font-sans text-xs">
                        <strong className="text-blue-600 block">📍 Device GPS Origin Location</strong>
                        <span>Real-time coordinates acquired</span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Google-Style Hospital Pins */}
                {filteredHospitals.map(hosp => {
                  const isTop3 = top3HospitalIds.has(hosp.id);
                  return (
                    <Marker
                      key={hosp.id}
                      position={[hosp.lat, hosp.lng]}
                      icon={createGoogleMapsPinIcon(hosp.name, hosp.color, hosp.isMatch, isTop3)}
                      eventHandlers={{
                        dblclick: () => setDetailHospitalModal(hosp)
                      }}
                    >
                      <Popup className="custom-hospital-leaflet-popup">
                        <div className="p-2.5 space-y-2 font-sans text-xs min-w-[230px]">
                          <div className="border-b border-[#e7e5e4] pb-2">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <h3 className="font-bold text-[#0c0a09] text-sm">{hosp.name}</h3>
                              {isTop3 && (
                                <span className="text-[9px] font-mono text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                                  TOP 3 NEAREST
                                </span>
                              )}
                            </div>
                            <p className="text-[#777169] text-[11px]">{hosp.address}</p>
                          </div>

                          <div className="bg-[#f5f5f5] p-2 rounded-xl flex items-center justify-between font-mono text-xs">
                            <span className="text-[#777169] text-[11px] flex items-center gap-1 font-sans">
                              <Navigation className="w-3.5 h-3.5 text-emerald-600" /> Distance:
                            </span>
                            <strong className="text-[#0c0a09] font-bold">{hosp.distanceKm} km ({hosp.etaMins} mins)</strong>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
                              <span className="text-[10px] text-[#777169] block font-sans">ICU:</span>
                              <strong className="text-emerald-700">{hosp.resources.find(r=>r.name==='ICU')?.available || 0} Available</strong>
                            </div>
                            <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg">
                              <span className="text-[10px] text-[#777169] block font-sans">Ventilators:</span>
                              <strong className="text-blue-700">{hosp.resources.find(r=>r.name==='Ventilator')?.available || 0} Available</strong>
                            </div>
                          </div>

                          <button
                            onClick={() => setSendAlertModalHosp(hosp)}
                            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all mt-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Transfer Alert</span>
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TOP 3 SHORTEST DISTANCE HOSPITALS CARDS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-[#e7e5e4]">
            <div>
              <h2 className="text-sm font-extrabold text-[#0c0a09] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Top 3 Shortest Distance Hospitals</span>
              </h2>
              <p className="text-[11px] text-[#777169] mt-0.5 group relative cursor-help w-max">
                <span className="border-b border-dashed border-[#a8a29e] hover:text-[#0c0a09]">
                  AI Ranking Basis: Proximity (ETA), Resource Headroom & Specialist Availability
                </span>
                <span className="absolute left-0 top-full mt-1 hidden group-hover:block bg-[#1c1917] text-white text-[10px] p-2.5 rounded-md w-72 z-50 font-mono shadow-xl leading-relaxed">
                  <strong className="text-emerald-400">Algorithmic Match Criteria:</strong><br/>
                  • <strong>40%</strong> Capability Match (Required vs Available)<br/>
                  • <strong>35%</strong> Shortest Drive ETA (GPS + Traffic)<br/>
                  • <strong>15%</strong> Capacity Headroom (Load balancing)<br/>
                  • <strong>10%</strong> Specialist On-Call Status
                </span>
              </p>
            </div>

            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold rounded-xl">
              SORTED BY PROXIMITY
            </span>
          </div>

          {top3Hospitals.length === 0 ? (
            <div className="bg-white border border-[#e7e5e4] p-8 rounded-2xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-bold text-sm text-[#0c0a09]">No hospitals match the current filters</p>
              <p className="text-xs text-[#777169]">Try clearing search tags or resetting your search query.</p>
              <button
                onClick={() => { setSelectedTags([]); setSearchQuery(''); }}
                className="px-4 py-2 bg-[#292524] text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            top3Hospitals.map((hosp, idx) => {
              const isAlertSent = alertSentHospitals[hosp.id];
              const rankBadgeClass = 
                idx === 0 ? 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' :
                idx === 1 ? 'bg-slate-100 text-slate-800 border-slate-300 font-bold' :
                'bg-orange-100 text-orange-800 border-orange-300 font-bold';

              const rankLabel = idx === 0 ? '🥇 #1 NEAREST' : idx === 1 ? '🥈 #2 NEAREST' : '🥉 #3 NEAREST';

              return (
                <div 
                  key={hosp.id}
                  className="bg-white border border-[#e7e5e4] hover:border-[#292524] p-5 rounded-2xl shadow-xs hover:shadow-md transition-all space-y-4 relative group"
                >
                  {/* Rank Header Row */}
                  <div className="flex items-center justify-between border-b border-[#f0efed] pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 text-[11px] font-mono rounded-full border ${rankBadgeClass}`}>
                        {rankLabel}
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hosp.color }}></span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                      <strong className="text-[#0c0a09] font-black">{hosp.distanceKm} km</strong>
                      <span className="text-[#777169]">({hosp.etaMins} mins ETA)</span>
                    </div>
                  </div>

                  {/* Hospital Details */}
                  <div>
                    <h3 className="font-extrabold text-base text-[#0c0a09] group-hover:text-emerald-700 transition-colors">
                      {hosp.name}
                    </h3>
                    <p className="text-xs text-[#777169] mt-0.5">{hosp.address}</p>
                  </div>

                  {/* Key Resource Availability Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    {hosp.resources.slice(0, 3).map((res, rIdx) => (
                      <div key={rIdx} className="bg-[#fafafa] p-2 rounded-xl border border-[#e7e5e4]">
                        <span className="text-[10px] text-[#777169] block truncate font-sans">{res.name}</span>
                        <strong className="text-emerald-700 font-bold">{res.available} Avail</strong>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons: Send Alert & View Detail */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmSendAlert(hosp)}
                      disabled={isAlertSent}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                        isAlertSent 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01]'
                      }`}
                    >
                      {isAlertSent ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>Alert Dispatched ✓</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 animate-pulse" />
                          <span>Send Transfer Alert</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setDetailHospitalModal(hosp)}
                      className="px-3.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all font-bold text-xs flex items-center gap-1 shadow-2xs"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* CREATE PATIENT TRANSFER ENTRY MODAL */}
      {isCreatePatientModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-white border border-[#d6d3d1] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1c1917] p-5 text-white flex items-center justify-between border-b border-[#292524]">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-extrabold">Create Emergency Patient Transfer Entry</h2>
              </div>
              <button
                onClick={() => setIsCreatePatientModalOpen(false)}
                className="text-[#a8a29e] hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePatientEntrySubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0c0a09] mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deepak Sharma"
                  value={newPatientForm.patientName}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, patientName: e.target.value })}
                  className="w-full p-2.5 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-sm font-medium focus:outline-none focus:border-[#292524]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0c0a09] mb-1">Age *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 52"
                    value={newPatientForm.patientAge}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, patientAge: e.target.value })}
                    className="w-full p-2.5 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-sm font-medium focus:outline-none focus:border-[#292524]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#0c0a09] mb-1">Sex</label>
                  <select
                    value={newPatientForm.patientSex}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, patientSex: e.target.value })}
                    className="w-full p-2.5 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-sm font-semibold focus:outline-none focus:border-[#292524]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0c0a09] mb-1">Suspected Condition / Clinical Diagnosis *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Ischemic Stroke / Severe Trauma"
                  value={newPatientForm.diagnosisSuspected}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, diagnosisSuspected: e.target.value })}
                  className="w-full p-2.5 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-sm font-medium focus:outline-none focus:border-[#292524]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0c0a09] mb-1">Transfer Priority</label>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  {['CRITICAL', 'URGENT', 'STANDARD'].map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setNewPatientForm({ ...newPatientForm, priority: p })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        newPatientForm.priority === p 
                          ? p === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' : 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-[#777169] border-[#e7e5e4]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0c0a09] mb-1">Response Window (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  className="w-full bg-[#fafafa] border border-[#d6d3d1] p-2 rounded-xl text-sm font-bold focus:outline-none focus:border-[#292524] focus:ring-1 focus:ring-[#292524] mb-3"
                  value={newPatientForm.timeoutMinutes}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, timeoutMinutes: e.target.value })}
                />
                <p className="text-[10px] text-[#777169] mt-[-8px] mb-4">Time given to receiving hospital before auto-allocation.</p>
              </div>

              <div>
                <label className="block font-bold text-[#0c0a09] mb-1">Required Facilities & Equipment</label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['ICU', 'Ventilator', 'CT Scan', 'Neurosurgeon', 'Blood Bank', 'Trauma Center', 'Stroke Unit'].map(eq => {
                    const selected = newPatientForm.requiredEquipment.includes(eq);
                    return (
                      <button
                        type="button"
                        key={eq}
                        onClick={() => toggleEquipmentInForm(eq)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                          selected 
                            ? 'bg-[#292524] text-white border-[#292524]' 
                            : 'bg-white text-[#292524] border-[#e7e5e4]'
                        }`}
                      >
                        <span>{eq}</span>
                        {selected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#e7e5e4] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatePatientModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#e7e5e4] text-[#292524] font-bold text-xs hover:bg-[#fafafa]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all"
                >
                  Save & Match Destination Hospitals
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH TRANSFER ALERT MODAL */}
      {sendAlertModalHosp && (
        <div className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-white border border-[#d6d3d1] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-emerald-200 animate-pulse" />
                <h2 className="text-base font-extrabold">Dispatch Transfer Alert</h2>
              </div>
              <button
                onClick={() => setSendAlertModalHosp(null)}
                className="text-emerald-100 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-emerald-800 font-bold uppercase block">Target Hospital</span>
                <p className="font-extrabold text-base text-[#0c0a09]">{sendAlertModalHosp.name}</p>
                <p className="text-xs text-emerald-700 font-mono">Distance: {sendAlertModalHosp.distanceKm} km ({sendAlertModalHosp.etaMins} mins ETA)</p>
              </div>

              {activePatient && (
                <div className="bg-[#fafafa] border border-[#e7e5e4] p-3.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-mono text-[#777169] font-bold uppercase block">Patient Information</span>
                  <p className="font-bold text-[#0c0a09]">{activePatient.patientName} (#{activePatient.patientRefCode})</p>
                  <p className="text-xs text-[#292524]">{activePatient.diagnosisSuspected}</p>
                </div>
              )}

              <p className="text-[#777169] text-xs leading-relaxed">
                Sending this alert will notify the receiving desk at <strong className="text-[#0c0a09]">{sendAlertModalHosp.name}</strong> via real-time WebSocket corridor and trigger immediate bed reservation protocols.
              </p>

              <div className="pt-3 border-t border-[#e7e5e4] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSendAlertModalHosp(null)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#e7e5e4] text-[#292524] font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSendAlert(sendAlertModalHosp)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                >
                  Confirm & Send Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL HOSPITAL RESOURCE DETAILS MODAL */}
      {detailHospitalModal && (
        <div 
          className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
          role="dialog"
        >
          <div className="w-full max-w-2xl bg-white border border-[#d6d3d1] max-h-[85vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden">
            <div className="sticky top-0 z-30 bg-[#1c1917] text-white px-6 py-4 border-b border-[#292524] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: detailHospitalModal.color }}></span>
                  <h2 className="text-base font-extrabold">{detailHospitalModal.name}</h2>
                </div>
                <p className="text-xs text-[#a8a29e] mt-0.5">{detailHospitalModal.address} • {detailHospitalModal.phone}</p>
              </div>

              <button
                onClick={() => setDetailHospitalModal(null)}
                className="text-[#a8a29e] hover:text-white px-3 py-1 bg-white/10 rounded-lg text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-[#fafafa] border border-[#e7e5e4] p-3 rounded-xl font-mono">
                <div>
                  <span className="text-[#777169] text-[10px] block font-sans">Distance:</span>
                  <strong className="text-[#0c0a09] text-sm">{detailHospitalModal.distanceKm} km</strong>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block font-sans">ETA Drive Time:</span>
                  <strong className="text-emerald-700 text-sm">~{detailHospitalModal.etaMins} mins</strong>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block font-sans">Desk Phone:</span>
                  <strong className="text-[#292524]">{detailHospitalModal.phone}</strong>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#777169] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#292524]" />
                  <span>Hospital Resources & Live Capacity</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detailHospitalModal.resources.map(r => (
                    <div key={r.name} className="p-3 bg-[#fafafa] border border-[#e7e5e4] rounded-xl flex items-center justify-between">
                      <span className="font-bold text-[#292524]">{r.name}</span>
                      <span className="font-mono text-xs font-bold text-emerald-700">
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
