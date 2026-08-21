import React, { useState, useEffect, useRef } from 'react';
import { LogoIcon } from './LogoIcon';
import { KeyRound, ArrowRight, AlertCircle, MapPin, Compass, ShieldCheck, CheckCircle2, Search, Loader2 } from 'lucide-react';

export function AuthPage({ onLoginSuccess }) {
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalCode, setHospitalCode] = useState('HOSP-PASS-2026');
  
  // Real-time Address Autocomplete & GPS state
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: 28.6139, lng: 77.2090 });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const addressContainerRef = useRef(null);

  // Address search query with debouncing
  useEffect(() => {
    if (!address || address.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=5`);
        if (response.ok) {
          const data = await response.json();
          setAddressSuggestions(data || []);
        }
      } catch (err) {
        console.warn('Address autocomplete fetch notice:', err);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [address]);

  // Outside click handler to close address suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (addressContainerRef.current && !addressContainerRef.current.contains(event.target)) {
        setShowAddressDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAddressSuggestion = (item) => {
    setAddress(item.display_name);
    setCoords({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    });
    setShowAddressDropdown(false);
  };

  const handleDetectCurrentAddressGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation GPS is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.display_name) {
              setAddress(data.display_name);
            } else {
              setAddress(`Verified GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
            }
          }
        } catch (err) {
          setAddress(`GPS Position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        } finally {
          setIsDetectingGps(false);
        }
      },
      (err) => {
        console.error('GPS error:', err);
        setIsDetectingGps(false);
        setError('Could not acquire GPS position. Please type address manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const finalHospitalName = hospitalName.trim();
    if (!finalHospitalName) {
      setError('Please enter a valid Hospital Name.');
      return;
    }

    const finalAddress = address.trim() || 'Verified Medical Facility Address';
    const finalCode = hospitalCode.trim() || 'HOSP-PASS-2026';
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: finalHospitalName,
          hospitalCode: finalCode,
          address: finalAddress,
          lat: coords.lat,
          lng: coords.lng
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const authData = {
          hospitalId: data.hospitalId,
          hospitalName: data.hospitalName || finalHospitalName,
          address: data.address || finalAddress,
          lat: data.lat || coords.lat,
          lng: data.lng || coords.lng,
          roleDesk: data.role || 'Emergency Referral Officer',
          token: data.token,
          loginTime: new Date().toISOString()
        };

        localStorage.setItem('eron_auth_session', JSON.stringify(authData));
        window.location.reload();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to connect to database. Genuine login required.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Backend login error:', err);
      setError('Cannot reach server. Ensure backend is running.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#292524] flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      {/* Background Decorator Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#e7e5e4]/40 to-transparent pointer-events-none rounded-b-full blur-2xl" />

      <div className="w-full max-w-md space-y-6 relative z-10 py-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-[#e7e5e4] shadow-xs mx-auto">
            <LogoIcon className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-2xl font-light tracking-tight text-[#0c0a09]">ERON</h1>
            <p className="text-xs text-[#777169] mt-1 font-medium">
              Inter-Hospital Identity & Real-Time Registration Portal
            </p>
          </div>
        </div>

        {/* Auth & Registration Form Card */}
        <div className="eleven-card p-6 bg-white border-[#e7e5e4] shadow-sm space-y-5 rounded-2xl">
          {error && (
            <div className="p-3 rounded-xl bg-[#e8b8c4]/30 border border-[#e8b8c4] text-[#dc2626] text-xs flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* 1. Hospital Name Input */}
            <div className="space-y-1.5">
              <label htmlFor="hospital-name-input" className="text-[#0c0a09] font-extrabold block text-xs">
                Hospital Facility Name *
              </label>
              <input
                id="hospital-name-input"
                type="text"
                required
                placeholder="e.g. Apollo Super Specialty Hospital"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3 text-[#0c0a09] font-bold focus:outline-none focus:border-[#292524] focus:bg-white transition-all text-sm"
              />
            </div>

            {/* 2. Real-Time Address Input with Autocomplete & GPS Detection */}
            <div ref={addressContainerRef} className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label htmlFor="hospital-address-input" className="text-[#0c0a09] font-extrabold block text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hospital Physical Address (Real-Time Autocomplete) *</span>
                </label>
              </div>

              <div className="relative">
                <input
                  id="hospital-address-input"
                  type="text"
                  required
                  placeholder="Type address (e.g. MG Road, Indiranagar, Bengaluru)..."
                  value={address}
                  onFocus={() => setShowAddressDropdown(true)}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setShowAddressDropdown(true);
                  }}
                  className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3 pr-10 text-[#292524] font-medium focus:outline-none focus:border-[#292524] focus:bg-white transition-all text-xs"
                />

                {isSearchingAddress ? (
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute right-3 top-3 pointer-events-none" />
                ) : (
                  <Search className="w-4 h-4 text-[#777169] absolute right-3 top-3 pointer-events-none" />
                )}
              </div>

              {/* GPS Auto-Detect Button */}
              <button
                type="button"
                onClick={handleDetectCurrentAddressGps}
                disabled={isDetectingGps}
                className="w-full mt-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition-all text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Compass className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin text-emerald-600' : ''}`} />
                <span>{isDetectingGps ? 'Acquiring GPS Address...' : '📍 Detect Current Address (GPS)'}</span>
              </button>

              {/* Autocomplete Suggestions Dropdown */}
              {showAddressDropdown && addressSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e7e5e4] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-[#f0efed] animate-in fade-in duration-150">
                  {addressSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectAddressSuggestion(item)}
                      className="p-3 hover:bg-[#fafafa] cursor-pointer text-xs space-y-0.5"
                    >
                      <p className="font-bold text-[#0c0a09]">{item.display_name}</p>
                      <span className="text-[10px] font-mono text-[#777169] block">
                        Lat: {parseFloat(item.lat).toFixed(4)}, Lng: {parseFloat(item.lon).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Hospital Passcode Input */}
            <div className="space-y-1.5">
              <label htmlFor="hospital-code-input" className="text-[#4e4e4e] font-semibold block text-xs">
                Hospital Authorization Security Passcode:
              </label>

              <div className="relative">
                <input
                  id="hospital-code-input"
                  type="text"
                  placeholder="Enter passcode"
                  value={hospitalCode}
                  onChange={(e) => setHospitalCode(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3 text-[#292524] font-mono font-medium focus:outline-none focus:border-[#292524] focus:bg-white transition-all text-xs"
                />
                <KeyRound className="w-4 h-4 text-[#777169] absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 mt-2 shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <span>Registering & Authenticating...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-200" />
                  <span>Register Identity & Launch ERON Desk</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
