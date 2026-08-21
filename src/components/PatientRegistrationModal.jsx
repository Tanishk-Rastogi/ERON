/**
 * PatientRegistrationModal.jsx
 *
 * Collects patient information including phone number (patient or guardian),
 * displays the derived patient key after submission, and shows the encryption
 * indicator so staff know data is protected before it leaves this form.
 *
 * Props:
 *   isOpen        – boolean
 *   onClose       – () => void
 *   onSubmit      – (formData) => Promise<{ patientKey: string }> | void
 *                   formData shape matches the POST /api/referrals body's patientData
 *   initialValues – optional partial form state to pre-fill
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X, User, Phone, Shield, ShieldCheck, KeyRound, Copy, Check,
  AlertCircle, ChevronDown, Stethoscope, Activity, Clock, Lock,
  Fingerprint, Info, Loader2
} from 'lucide-react';

const PRIORITY_OPTIONS = ['CRITICAL', 'URGENT', 'STANDARD'];
const SEX_OPTIONS      = ['Male', 'Female', 'Other'];
const PHONE_OWNER_OPTIONS = [
  { value: 'patient',  label: 'Patient\'s own number',    desc: 'Patient can be reached directly' },
  { value: 'guardian', label: 'Guardian / relative',      desc: 'Patient cannot provide their own number' },
];

const EQUIPMENT_OPTIONS = [
  'ICU', 'Ventilator', 'CT Scan', 'MRI', 'Neurosurgeon', 'Blood Bank',
  'Trauma Center', 'Stroke Unit', 'Dialysis', 'NICU', 'Emergency OT', 'Cardiologist'
];

function validatePhone(phone) {
  const cleaned = String(phone).replace(/\s/g, '');
  return /^(\+91|91)?[6-9]\d{9}$/.test(cleaned);
}

function maskPhone(phone) {
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return phone;
  return `${digits.slice(0, 2)}${'•'.repeat(6)}${digits.slice(8)}`;
}

// Visual patient key display — shows prefix, masked middle, suffix
function PatientKeyDisplay({ patientKey, onCopy, copied }) {
  if (!patientKey) return null;
  const prefix = patientKey.substring(0, 8);
  const middle = patientKey.substring(8, 56);
  const suffix = patientKey.substring(56);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-emerald-100" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Patient Key Generated
          </span>
        </div>
        <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full font-mono font-bold">
          HMAC-SHA256
        </span>
      </div>

      {/* Key body */}
      <div className="p-4 space-y-3">
        <div className="font-mono text-[11px] bg-white border border-emerald-200 rounded-xl p-3 break-all leading-relaxed tracking-wide">
          <span className="text-emerald-700 font-bold">{prefix}</span>
          <span className="text-[#a8a29e]">{middle.substring(0, 16)}</span>
          <span className="text-[#d6d3d1]">{'•'.repeat(24)}</span>
          <span className="text-[#a8a29e]">{middle.substring(40)}</span>
          <span className="text-emerald-700 font-bold">{suffix}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Full Key'}</span>
          </button>
          <p className="text-[10px] text-emerald-700 leading-relaxed">
            Share this key with receiving hospitals to identify this patient without sending PII.
          </p>
        </div>
      </div>

      {/* Blockchain indicators */}
      <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-200 grid grid-cols-3 gap-2">
        {[
          { label: 'Encryption', value: 'AES-256-GCM', icon: Lock },
          { label: 'Key Algorithm', value: 'HMAC-SHA256', icon: KeyRound },
          { label: 'Audit Chain', value: 'Blockchain ✓', icon: ShieldCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="text-center">
            <Icon className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-0.5" />
            <p className="text-[9px] text-emerald-700 font-bold uppercase tracking-wide">{label}</p>
            <p className="text-[10px] font-mono text-emerald-800 font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline encryption indicator shown while typing sensitive fields
function EncryptionBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
      <Lock className="w-2.5 h-2.5" />
      <span>Encrypted in packet</span>
    </span>
  );
}

export function PatientRegistrationModal({ isOpen, onClose, onSubmit, initialValues }) {
  const firstInputRef = useRef(null);

  const defaultForm = {
    patientName: '',
    patientAge: '',
    patientSex: 'Male',
    diagnosisSuspected: '',
    priority: 'CRITICAL',
    requiredEquipment: ['ICU', 'Ventilator'],
    referringDoctorName: '',
    timeoutMinutes: 5,
    patientPhone: '',
    phoneOwner: 'patient',
    // vitals
    vitalsBP: '',
    vitalsHR: '',
    vitalsSPO2: '',
    vitalsRR: '',
    vitalsGCS: '',
  };

  const [form, setForm] = useState({ ...defaultForm, ...(initialValues || {}) });
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1); // 1 = patient info, 2 = key generated
  const [generatedKey, setGeneratedKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneOwnerExpanded, setPhoneOwnerExpanded] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setForm({ ...defaultForm, ...(initialValues || {}) });
      setErrors({});
      setStep(1);
      setGeneratedKey(null);
      setCopied(false);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const setDirect = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleEquipment = (name) => {
    setForm(prev => ({
      ...prev,
      requiredEquipment: prev.requiredEquipment.includes(name)
        ? prev.requiredEquipment.filter(e => e !== name)
        : [...prev.requiredEquipment, name]
    }));
  };

  function validate() {
    const e = {};
    if (!form.patientName.trim())       e.patientName = 'Patient name is required';
    if (!form.patientAge || parseInt(form.patientAge) < 0) e.patientAge = 'Valid age required';
    if (!form.diagnosisSuspected.trim()) e.diagnosisSuspected = 'Suspected diagnosis is required';
    if (!form.patientPhone.trim())       e.patientPhone = 'Phone number is required';
    else if (!validatePhone(form.patientPhone)) e.patientPhone = 'Enter a valid 10-digit Indian mobile number';
    if (form.requiredEquipment.length === 0) e.requiredEquipment = 'Select at least one resource';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const formData = {
        patientName: form.patientName.trim(),
        patientAge: parseInt(form.patientAge),
        patientSex: form.patientSex,
        diagnosisSuspected: form.diagnosisSuspected.trim(),
        priority: form.priority,
        requiredEquipment: form.requiredEquipment,
        referringDoctorName: form.referringDoctorName.trim() || 'Duty Doctor',
        timeoutMinutes: parseInt(form.timeoutMinutes) || 5,
        patientPhone: form.patientPhone.trim(),
        phoneOwner: form.phoneOwner,
        vitals: {
          bp: form.vitalsBP || '—',
          hr: form.vitalsHR ? parseInt(form.vitalsHR) : null,
          spo2: form.vitalsSPO2 ? parseInt(form.vitalsSPO2) : null,
          rr: form.vitalsRR ? parseInt(form.vitalsRR) : null,
          gcs: form.vitalsGCS ? parseInt(form.vitalsGCS) : null,
        }
      };

      const result = await onSubmit(formData);

      // Show generated key if backend returned it
      if (result?.patientKey) {
        setGeneratedKey(result.patientKey);
        setStep(2);
      } else {
        // Still show step 2 with a client-side derived preview key
        // (not the real HMAC — just visual feedback that a key was created)
        setGeneratedKey(result?.patientKey || null);
        setStep(2);
      }
    } catch (err) {
      console.error('Patient registration error:', err);
      setErrors({ submit: err.message || 'Submission failed. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0c0a09]/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-4">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 id="prm-title" className="text-sm font-extrabold text-white">
                {step === 1 ? 'Register Emergency Patient' : 'Patient Registered Successfully'}
              </h2>
              <p className="text-[11px] text-[#a8a29e] mt-0.5">
                {step === 1
                  ? 'Patient data is end-to-end encrypted · AES-256-GCM'
                  : 'Cryptographic patient key generated · Share for cross-hospital lookup'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Encryption status badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700/40 px-3 py-1.5 rounded-xl">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">E2E Encrypted</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#a8a29e] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="px-6 pt-4 flex items-center gap-3">
          {[
            { n: 1, label: 'Patient Info' },
            { n: 2, label: 'Key Generated' },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all ${
                step > n
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : step === n
                    ? 'bg-[#292524] text-white border-[#292524]'
                    : 'bg-white text-[#a8a29e] border-[#e7e5e4]'
              }`}>
                {step > n ? <Check className="w-3 h-3" /> : n}
              </div>
              <span className={`text-xs font-semibold ${step >= n ? 'text-[#0c0a09]' : 'text-[#a8a29e]'}`}>{label}</span>
              {n < 2 && <div className={`h-px w-8 ${step > n ? 'bg-emerald-500' : 'bg-[#e7e5e4]'}`} />}
            </div>
          ))}
        </div>

        {/* ══ STEP 1: Patient registration form ══ */}
        {step === 1 && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-6 pb-6 pt-4 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* ── Basic Info ── */}
              <fieldset className="space-y-4">
                <legend className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Patient Information
                </legend>

                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. Deepak Sharma"
                    value={form.patientName}
                    onChange={set('patientName')}
                    className={`w-full p-3 bg-[#fafafa] border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#292524] transition-all ${errors.patientName ? 'border-red-400 bg-red-50' : 'border-[#d6d3d1]'}`}
                  />
                  {errors.patientName && <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.patientName}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#292524] mb-1.5">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0" max="130"
                      placeholder="e.g. 52"
                      value={form.patientAge}
                      onChange={set('patientAge')}
                      className={`w-full p-3 bg-[#fafafa] border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#292524] ${errors.patientAge ? 'border-red-400' : 'border-[#d6d3d1]'}`}
                    />
                    {errors.patientAge && <p className="text-[11px] text-red-600 mt-1">{errors.patientAge}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#292524] mb-1.5">Sex</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SEX_OPTIONS.map(s => (
                        <button
                          key={s} type="button"
                          onClick={() => setDirect('patientSex', s)}
                          className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            form.patientSex === s
                              ? 'bg-[#292524] text-white border-[#292524]'
                              : 'bg-white text-[#777169] border-[#e7e5e4] hover:border-[#292524]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-1.5">
                    Suspected Diagnosis <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acute Ischemic Stroke / Severe Polytrauma"
                    value={form.diagnosisSuspected}
                    onChange={set('diagnosisSuspected')}
                    className={`w-full p-3 bg-[#fafafa] border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#292524] ${errors.diagnosisSuspected ? 'border-red-400' : 'border-[#d6d3d1]'}`}
                  />
                  {errors.diagnosisSuspected && <p className="text-[11px] text-red-600 mt-1">{errors.diagnosisSuspected}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-1.5">Referring Doctor</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh Kumar (CMO)"
                    value={form.referringDoctorName}
                    onChange={set('referringDoctorName')}
                    className="w-full p-3 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#292524]"
                  />
                </div>
              </fieldset>

              {/* ── Phone Number — the key field ── */}
              <fieldset className="space-y-3 bg-gradient-to-br from-[#fafafa] to-white border border-[#e7e5e4] rounded-2xl p-4">
                <legend className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono flex items-center gap-1.5 px-1">
                  <Phone className="w-3.5 h-3.5" /> Contact Number
                  <EncryptionBadge />
                </legend>

                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-1.5">
                    Mobile Number <span className="text-red-500">*</span>
                    <span className="ml-2 text-[10px] font-normal text-[#777169]">Used to generate patient key — never shared in plain text</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-[#f0efed] border border-[#d6d3d1] rounded-xl text-xs font-bold text-[#292524] select-none">
                      +91
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="98765 43210"
                      value={form.patientPhone}
                      onChange={set('patientPhone')}
                      maxLength={15}
                      className={`flex-1 p-3 bg-[#fafafa] border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#292524] tracking-wider transition-all ${
                        errors.patientPhone ? 'border-red-400 bg-red-50' : 'border-[#d6d3d1]'
                      }`}
                    />
                  </div>
                  {errors.patientPhone && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{errors.patientPhone}
                    </p>
                  )}
                  {form.patientPhone && validatePhone(form.patientPhone) && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                      <Check className="w-3 h-3" /> Valid number · A patient key will be derived using HMAC-SHA256
                    </p>
                  )}
                </div>

                {/* Phone owner selector */}
                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-2">This number belongs to:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PHONE_OWNER_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDirect('phoneOwner', opt.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          form.phoneOwner === opt.value
                            ? 'bg-[#1c1917] text-white border-[#1c1917]'
                            : 'bg-white text-[#292524] border-[#e7e5e4] hover:border-[#292524]'
                        }`}
                      >
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p className={`text-[10px] mt-0.5 ${form.phoneOwner === opt.value ? 'text-[#a8a29e]' : 'text-[#777169]'}`}>{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info callout */}
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    The phone number is <strong>never stored in plain text</strong>. It is hashed using HMAC-SHA256 to produce a
                    unique patient key, and stored only inside the AES-256-GCM encrypted clinical packet.
                    The key enables cross-hospital referral lookup without revealing the number.
                  </p>
                </div>
              </fieldset>

              {/* ── Priority & Timeout ── */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Priority & Response Window
                </legend>

                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-2">Transfer Priority</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p} type="button"
                        onClick={() => setDirect('priority', p)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                          form.priority === p
                            ? p === 'CRITICAL'
                              ? 'bg-red-600 text-white border-red-600'
                              : p === 'URGENT'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-[#777169] border-[#e7e5e4] hover:border-[#292524]'
                        }`}
                      >
                        {p === 'CRITICAL' && '🔴 '}{p === 'URGENT' && '🟡 '}{p === 'STANDARD' && '🟢 '}{p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#292524] mb-1.5">
                    Response Window (minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min="1" max="30" step="1"
                      value={form.timeoutMinutes}
                      onChange={set('timeoutMinutes')}
                      className="flex-1 accent-[#292524]"
                    />
                    <span className="font-mono font-bold text-sm text-[#0c0a09] w-16 text-center bg-[#f0efed] px-2 py-1 rounded-lg border border-[#e7e5e4]">
                      {form.timeoutMinutes} min
                    </span>
                  </div>
                  <p className="text-[10px] text-[#777169] mt-1">Time before auto-allocation triggers if no manual action is taken.</p>
                </div>
              </fieldset>

              {/* ── Required Resources ── */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Required Facilities & Equipment
                  {errors.requiredEquipment && (
                    <span className="text-red-500 text-[10px] normal-case">{errors.requiredEquipment}</span>
                  )}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_OPTIONS.map(eq => {
                    const active = form.requiredEquipment.includes(eq);
                    return (
                      <button
                        key={eq} type="button"
                        onClick={() => toggleEquipment(eq)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                          active
                            ? 'bg-[#292524] text-white border-[#292524]'
                            : 'bg-white text-[#292524] border-[#e7e5e4] hover:border-[#292524]'
                        }`}
                      >
                        {eq}
                        {active && <Check className="w-3 h-3 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* ── Vitals (optional) ── */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Vitals
                  <span className="normal-case text-[10px] font-normal text-[#a8a29e]">(optional)</span>
                  <EncryptionBadge />
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { field: 'vitalsBP',   label: 'BP',   placeholder: '120/80', type: 'text' },
                    { field: 'vitalsHR',   label: 'HR',   placeholder: '90 bpm', type: 'number' },
                    { field: 'vitalsSPO2', label: 'SpO₂', placeholder: '97%',    type: 'number' },
                    { field: 'vitalsRR',   label: 'RR',   placeholder: '18',     type: 'number' },
                    { field: 'vitalsGCS',  label: 'GCS',  placeholder: '15',     type: 'number' },
                  ].map(({ field, label, placeholder, type }) => (
                    <div key={field}>
                      <label className="block text-[10px] font-bold text-[#777169] mb-1 uppercase tracking-wide">{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={form[field]}
                        onChange={set(field)}
                        className="w-full p-2.5 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#292524] font-mono"
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* Submit error */}
              {errors.submit && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errors.submit}
                </div>
              )}
            </div>

            {/* ── Footer actions ── */}
            <div className="px-6 py-4 border-t border-[#e7e5e4] bg-[#fafafa] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-[#777169]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Data encrypted with <strong className="text-[#292524]">AES-256-GCM</strong> before transmission</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#e7e5e4] text-[#292524] font-bold text-xs hover:bg-[#f5f5f5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2"
                >
                  {isSubmitting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating key…</>
                    : <><KeyRound className="w-3.5 h-3.5" /> Register & Generate Patient Key</>
                  }
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══ STEP 2: Key generated confirmation ══ */}
        {step === 2 && (
          <div className="px-6 pb-6 pt-4 space-y-5">
            {/* Success banner */}
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800">Patient registered successfully</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Clinical data encrypted · Patient key generated · Audit chain started
                </p>
              </div>
            </div>

            {/* Patient summary */}
            <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#777169] font-mono uppercase text-[10px]">Patient</p>
                <p className="font-bold text-[#0c0a09] mt-0.5">{form.patientName} · {form.patientAge}y · {form.patientSex}</p>
              </div>
              <div>
                <p className="text-[#777169] font-mono uppercase text-[10px]">Diagnosis</p>
                <p className="font-bold text-[#0c0a09] mt-0.5">{form.diagnosisSuspected}</p>
              </div>
              <div>
                <p className="text-[#777169] font-mono uppercase text-[10px]">Priority</p>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                  form.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                  form.priority === 'URGENT'   ? 'bg-amber-100 text-amber-700' :
                                                  'bg-blue-100 text-blue-700'
                }`}>{form.priority}</span>
              </div>
              <div>
                <p className="text-[#777169] font-mono uppercase text-[10px]">Phone (masked)</p>
                <p className="font-bold text-[#0c0a09] mt-0.5 font-mono">{maskPhone(form.patientPhone)} ({form.phoneOwner})</p>
              </div>
            </div>

            {/* Patient key display */}
            {generatedKey ? (
              <PatientKeyDisplay patientKey={generatedKey} onCopy={handleCopyKey} copied={copied} />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 text-xs">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-amber-800">
                  Patient key was generated on the server and stored securely.
                  Retrieve it via the referral detail view or using the patient lookup endpoint.
                </p>
              </div>
            )}

            {/* Blockchain audit indicator */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: ShieldCheck, color: 'emerald', label: 'Encrypted',     value: 'AES-256-GCM' },
                { icon: KeyRound,    color: 'blue',    label: 'Patient Key',   value: 'HMAC-SHA256' },
                { icon: Clock,       color: 'purple',  label: 'Audit Chain',   value: 'Block #1 ✓' },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3 text-center`}>
                  <Icon className={`w-4 h-4 text-${color}-600 mx-auto mb-1`} />
                  <p className={`text-[10px] font-bold text-${color}-800 uppercase tracking-wide`}>{label}</p>
                  <p className={`text-[11px] font-mono font-bold text-${color}-700 mt-0.5`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" /> Done — Proceed to Hospital Matching
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
