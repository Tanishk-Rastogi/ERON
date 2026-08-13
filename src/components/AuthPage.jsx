import React, { useState } from 'react';
import { LogoIcon } from './LogoIcon';
import { 
  Building2, 
  KeyRound, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Building
} from 'lucide-react';

export function AuthPage({ onLoginSuccess }) {
  const [hospitalName, setHospitalName] = useState('St. Jude Trauma Center');
  const [customHospital, setCustomHospital] = useState('');
  const [hospitalCode, setHospitalCode] = useState('STJUDE-99');
  const [roleDesk, setRoleDesk] = useState('Emergency Referral Officer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const presetHospitals = [
    { id: 'hosp-b', name: 'St. Jude Trauma Center', code: 'STJUDE-99', type: 'Tertiary Trauma Center' },
    { id: 'hosp-a', name: 'City Central Hospital', code: 'CITY-101', type: 'District Secondary Hospital' },
    { id: 'hosp-c', name: 'Metro General Hospital', code: 'METRO-2026', type: 'Specialized Medical Center' },
    { id: 'hosp-d', name: 'Valley Clinic', code: 'VALLEY-04', type: 'Peripheral Community Desk' }
  ];

  const handleSelectPreset = (preset) => {
    setHospitalName(preset.name);
    setHospitalCode(preset.code);
    setCustomHospital('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const finalHospitalName = hospitalName === 'OTHER' ? customHospital.trim() : hospitalName;

    if (!finalHospitalName) {
      setError('Please select or enter a valid hospital name.');
      return;
    }

    if (!hospitalCode.trim()) {
      setError('Please enter your hospital authorization code.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const authData = {
        hospitalName: finalHospitalName,
        hospitalCode: hospitalCode.trim(),
        roleDesk,
        loginTime: new Date().toISOString()
      };

      localStorage.setItem('eron_auth_session', JSON.stringify(authData));
      setLoading(false);
      onLoginSuccess(authData);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#292524] flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      {/* Background Decorator Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#e7e5e4]/40 to-transparent pointer-events-none rounded-b-full blur-2xl" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-[#e7e5e4] shadow-xs">
            <LogoIcon className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-2xl font-light tracking-tight text-[#0c0a09]">ERON Gateway</h1>
            <p className="text-xs text-[#777169] mt-1 font-light">
              Emergency Referral Orchestration Network — Hospital Access Portal
            </p>
          </div>
        </div>

        {/* Clean Auth Form Card */}
        <div className="eleven-card p-8 bg-white border-[#e7e5e4] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#f0efed] pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#292524]" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0c0a09] font-mono">
                Hospital Authorization
              </h2>
            </div>
            <span className="text-[10px] bg-[#a7e5d3]/40 text-[#0c0a09] border border-[#a7e5d3] font-mono px-2 py-0.5 rounded-full font-bold">
              SSL 256-BIT
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-[#e8b8c4]/30 border border-[#e8b8c4] text-[#dc2626] text-xs flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Hospital Name Selector */}
            <div className="space-y-1.5">
              <label htmlFor="hospital-select" className="text-[#4e4e4e] font-semibold flex items-center justify-between">
                <span>Select Hospital Facility:</span>
                <span className="text-[10px] text-[#777169] font-mono">District-01 Network</span>
              </label>

              <select
                id="hospital-select"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-[#0c0a09] font-semibold cursor-pointer focus:outline-none focus:border-[#292524] focus:bg-white transition-all"
              >
                {presetHospitals.map(h => (
                  <option key={h.id} value={h.name}>
                    {h.name} ({h.type})
                  </option>
                ))}
                <option value="OTHER">Custom Hospital / Other Facility...</option>
              </select>
            </div>

            {/* Custom Hospital Input if OTHER selected */}
            {hospitalName === 'OTHER' && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label htmlFor="custom-hospital-input" className="text-[#4e4e4e] font-semibold">Custom Hospital Name:</label>
                <input
                  id="custom-hospital-input"
                  type="text"
                  placeholder="e.g. Apex Memorial Care"
                  value={customHospital}
                  onChange={(e) => setCustomHospital(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-[#0c0a09] font-semibold focus:outline-none focus:border-[#292524] focus:bg-white transition-all"
                />
              </div>
            )}

            {/* Hospital Passcode / Authorization Code */}
            <div className="space-y-1.5">
              <label htmlFor="hospital-code-input" className="text-[#4e4e4e] font-semibold flex items-center justify-between">
                <span>Hospital Authorization Passcode:</span>
                <span className="text-[10px] text-[#777169] font-mono">Secure Access Code</span>
              </label>

              <div className="relative">
                <input
                  id="hospital-code-input"
                  type="text"
                  placeholder="Enter passcode e.g. STJUDE-99"
                  value={hospitalCode}
                  onChange={(e) => setHospitalCode(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-[#0c0a09] font-mono tracking-wider font-bold uppercase focus:outline-none focus:border-[#292524] focus:bg-white transition-all"
                />
                <KeyRound className="w-4 h-4 text-[#777169] absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Role Desk Selector */}
            <div className="space-y-1.5">
              <label htmlFor="role-desk-select" className="text-[#4e4e4e] font-semibold">Authorization Desk Role:</label>
              <select
                id="role-desk-select"
                value={roleDesk}
                onChange={(e) => setRoleDesk(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-[#292524] cursor-pointer focus:outline-none focus:border-[#292524] focus:bg-white transition-all"
              >
                <option value="Emergency Referral Officer">Emergency Referral Officer (ED Desk)</option>
                <option value="Chief Medical Officer">Chief Medical Officer (CMO)</option>
                <option value="Capacity & Bed Manager">Capacity & Bed Manager</option>
                <option value="Ambulance Fleet Dispatcher">Ambulance Fleet Dispatcher</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full eleven-button eleven-button-primary py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
            >
              {loading ? (
                <span>Authenticating Hospital...</span>
              ) : (
                <>
                  <span>Enter Hospital Control System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Preset Selector */}
          <div className="border-t border-[#f0efed] pt-4 space-y-2">
            <span className="text-[11px] font-mono font-bold text-[#777169] uppercase tracking-wider block">
              Quick Demo Presets:
            </span>

            <div className="grid grid-cols-2 gap-2">
              {presetHospitals.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`p-2 rounded-xl border text-left text-[11px] font-mono transition-all ${
                    hospitalCode === p.code 
                      ? 'bg-[#292524] text-white border-[#292524]' 
                      : 'bg-[#fafafa] text-[#292524] border-[#e7e5e4] hover:bg-[#f0efed]'
                  }`}
                >
                  <div className="font-bold truncate">{p.name}</div>
                  <div className={`text-[9px] ${hospitalCode === p.code ? 'text-[#a8a29e]' : 'text-[#777169]'}`}>
                    Pass: {p.code}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-[11px] text-center text-[#777169] font-light">
          Authorized hospital personnel only. All access attempts are logged under immutable audit streams.
        </p>
      </div>
    </div>
  );
}
