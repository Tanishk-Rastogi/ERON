import React, { useState } from 'react';
import { LogoIcon } from './LogoIcon';
import { KeyRound, ArrowRight, AlertCircle } from 'lucide-react';

export function AuthPage({ onLoginSuccess }) {
  const [hospitalName, setHospitalName] = useState('St. Jude Trauma Center');
  const [hospitalCode, setHospitalCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const finalHospitalName = hospitalName.trim();

    if (!finalHospitalName) {
      setError('Please enter a valid hospital name.');
      return;
    }

    const finalCode = hospitalCode.trim() || 'HOSP-PASS';

    setLoading(true);

    setTimeout(() => {
      const authData = {
        hospitalName: finalHospitalName,
        hospitalCode: finalCode,
        roleDesk: 'Emergency Referral Officer',
        loginTime: new Date().toISOString()
      };

      localStorage.setItem('eron_auth_session', JSON.stringify(authData));
      setLoading(false);
      onLoginSuccess(authData);
    }, 300);
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
            <h1 className="text-2xl font-light tracking-tight text-[#0c0a09]">ERON</h1>
            <p className="text-xs text-[#777169] mt-1 font-light">
              Hospital Access Portal
            </p>
          </div>
        </div>

        {/* Clean Auth Form Card */}
        <div className="eleven-card p-8 bg-white border-[#e7e5e4] shadow-sm space-y-6">
          {error && (
            <div className="p-3 rounded-2xl bg-[#e8b8c4]/30 border border-[#e8b8c4] text-[#dc2626] text-xs flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Hospital Name Input Block */}
            <div className="space-y-1.5">
              <label htmlFor="hospital-name-input" className="text-[#4e4e4e] font-semibold block">
                Hospital Name:
              </label>
              <input
                id="hospital-name-input"
                type="text"
                placeholder="Enter hospital name (e.g. St. Jude Trauma Center)"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-[#0c0a09] font-semibold focus:outline-none focus:border-[#292524] focus:bg-white transition-all"
              />
            </div>

            {/* Hospital Passcode / Authorization Code */}
            <div className="space-y-1.5">
              <label htmlFor="hospital-code-input" className="text-[#4e4e4e] font-semibold block">
                Hospital Authorization Passcode:
              </label>

              <div className="relative">
                <input
                  id="hospital-code-input"
                  type="text"
                  placeholder="Enter hospital passcode"
                  value={hospitalCode}
                  onChange={(e) => setHospitalCode(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-[#292524] font-medium focus:outline-none focus:border-[#292524] focus:bg-white transition-all"
                />
                <KeyRound className="w-4 h-4 text-[#777169] absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full eleven-button eleven-button-primary py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
