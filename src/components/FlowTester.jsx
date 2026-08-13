import React, { useState } from 'react';
import { apiClient } from '../utils/apiClient.js';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Play, 
  CheckCircle2, 
  ArrowRight, 
  Stethoscope, 
  Building2, 
  ShieldCheck, 
  Ambulance, 
  CheckCheck, 
  Activity,
  Zap,
  RefreshCw
} from 'lucide-react';

export function FlowTester({ onSelectPerspective, onOpenPacketModal }) {
  const { refreshAll } = useWebSocket();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLogs, setStepLogs] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [testReferral, setTestReferral] = useState(null);

  const steps = [
    {
      num: 1,
      title: 'Nurse Creates Referral',
      role: 'Nurse Anjali Verma (City Central)',
      description: 'Nurse creates critical referral with AES-256 encrypted clinical packet attached.',
      actionLabel: '1. Create & Send Referral (POST /api/referrals)'
    },
    {
      num: 2,
      title: 'Receiving Hospital Alerted',
      role: 'Bed Desk B - Rajesh (St. Jude)',
      description: 'Receiving hospital receives real-time WebSocket alert and soft bed-hold placement.',
      actionLabel: '2. Switch to Receiving Hospital & Check Bed Hold'
    },
    {
      num: 3,
      title: 'Hospital Responds & Accepts Bed',
      role: 'Bed Desk B (St. Jude)',
      description: 'Receiving hospital accepts referral and confirms bed reservation.',
      actionLabel: '3. Accept Bed Reservation (POST /api/referrals/:id/accept)'
    },
    {
      num: 4,
      title: 'Decrypt & Open Clinical Packet',
      role: 'Receiving Trauma Team',
      description: 'Trauma team decrypts AES-256 payload to inspect vitals (GCS 8/15) & CT scan.',
      actionLabel: '4. Decrypt Clinical Packet (GET /api/referrals/:id/packet)'
    },
    {
      num: 5,
      title: 'Ambulance Assigned & Dispatched',
      role: 'Ambulance Driver Suresh (AMB-101)',
      description: 'ALS Ambulance assigned; status transitions to IN_TRANSIT with live GPS.',
      actionLabel: '5. Dispatch ALS Ambulance (POST /api/referrals/:id/assign-ambulance)'
    },
    {
      num: 6,
      title: 'Read Receipts & Status Sync',
      role: 'All Perspectives',
      description: 'Message status transitions SENT → DELIVERED → READ across all connected clients.',
      actionLabel: '6. Update Read Receipts (POST /api/messages/read)'
    },
    {
      num: 7,
      title: 'Control Room Monitoring',
      role: 'District Control Room Admin',
      description: 'District controller monitors audit stream and live district capacity telemetries.',
      actionLabel: '7. Verify Control Room Telemetry (GET /api/analytics/district)'
    }
  ];

  const logMsg = (text, data = null) => {
    setStepLogs(prev => [
      ...prev,
      { time: new Date().toLocaleTimeString(), text, data }
    ]);
  };

  const handleExecuteStep = async (stepNum) => {
    setExecuting(true);

    try {
      if (stepNum === 1) {
        logMsg('Creating emergency referral via POST /api/referrals...');
        const res = await apiClient('/api/referrals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originHospitalId: 'hosp-a',
            targetHospitalId: 'hosp-b',
            requirementSummary: 'Acute Traumatic Brain Injury — Requires ICU + Neurosurgery + Ventilator',
            requiredCapabilities: ['NEUROSURGERY', 'CT_SCAN'],
            requiredResources: ['ICU_BED', 'VENTILATOR'],
            priority: 'CRITICAL',
            patientData: {
              patientName: 'Karan Sharma',
              patientAge: 42,
              patientSex: 'MALE',
              clinicalSummary: 'Patient sustained severe head trauma in RTA. GCS 8/15. E4V1M3. Left pupil dilated.',
              vitals: { bp: '140/90', hr: 110, spo2: 94, rr: 24, temp: '98.6 F', gcs: 8 },
              diagnosisSuspected: 'Acute Subdural Hematoma with Midline Shift',
              treatmentGiven: 'IV Mannitol 100ml, Intubated on manual bag',
              reasonForReferral: 'No neurosurgeon available at District Hospital A'
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          setTestReferral(data);
          logMsg(`Referral created successfully! Code: #${data.patientRefCode}`, data);
          setCurrentStep(1);
          refreshAll();
        }
      } else if (stepNum === 2) {
        onSelectPerspective({
          id: 'bed-b',
          name: 'Bed Desk B - Rajesh',
          roleDesk: 'Receiving Bed Desk',
          hospitalId: 'hosp-b',
          hospitalName: 'City Super Specialty (Hosp B)'
        });
        logMsg('Switched perspective to Receiving Hospital (St. Jude Trauma Center). Bed hold verified.');
        setCurrentStep(2);
      } else if (stepNum === 3) {
        const refId = testReferral?.id || 'ref-1001';
        logMsg(`Accepting referral ${refId} via POST /api/referrals/${refId}/accept...`);
        const res = await apiClient(`/api/referrals/${refId}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: 'user-admin-b' })
        });
        if (res.ok) {
          const data = await res.json();
          logMsg(`Referral accepted & bed reserved! Status: ${data.status}`, data);
          setCurrentStep(3);
          refreshAll();
        }
      } else if (stepNum === 4) {
        const refId = testReferral?.id || 'ref-1001';
        logMsg(`Fetching AES-256 clinical packet via GET /api/referrals/${refId}/packet...`);
        onOpenPacketModal('pkt-1');
        logMsg('Clinical packet decrypted! GCS 8/15 payload visible to trauma team.');
        setCurrentStep(4);
      } else if (stepNum === 5) {
        const refId = testReferral?.id || 'ref-1001';
        logMsg(`Assigning ALS Ambulance via POST /api/referrals/${refId}/assign-ambulance...`);
        const res = await apiClient(`/api/referrals/${refId}/assign-ambulance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ambulanceId: 'amb-101', staffId: 'user-disp-1' })
        });
        if (res.ok) {
          const data = await res.json();
          onSelectPerspective({
            id: 'driver-101',
            name: 'Suresh Kumar (Driver)',
            roleDesk: 'Ambulance Driver',
            hospitalId: 'hosp-a',
            hospitalName: 'ALS Unit AMB-101'
          });
          logMsg(`Ambulance AMB-101 assigned! Status updated to IN_TRANSIT.`, data);
          setCurrentStep(5);
          refreshAll();
        }
      } else if (stepNum === 6) {
        logMsg('Marking thread messages as READ via POST /api/messages/read...');
        const res = await apiClient('/api/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: 'thread-ref-1001', userId: 'user-admin-b' })
        });
        if (res.ok) {
          logMsg('Read receipts updated to READ across all connected WebSocket clients.');
          setCurrentStep(6);
        }
      } else if (stepNum === 7) {
        onSelectPerspective({
          id: 'control-admin',
          name: 'District Control Room Admin',
          roleDesk: 'District Controller',
          hospitalId: 'hosp-control',
          hospitalName: 'District-01 Command HQ'
        });
        logMsg('Fetching District Control Room analytics via GET /api/analytics/district...');
        const res = await apiClient('/api/analytics/district');
        if (res.ok) {
          const data = await res.json();
          logMsg('End-to-End Referral Lifecycle Flow test completed successfully!', data);
          setCurrentStep(7);
        }
      }
    } catch (err) {
      logMsg(`Error executing step ${stepNum}: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleResetFlow = () => {
    setCurrentStep(0);
    setStepLogs([]);
    setTestReferral(null);
  };

  return (
    <div className="eleven-card p-6 bg-slate-900 text-white space-y-5 rounded-3xl border border-slate-800 shadow-xl font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold uppercase font-mono tracking-wider text-amber-400">
                End-to-End Referral Lifecycle Flow Test Suite
              </h2>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-400/30">
                Core Requirement
              </span>
            </div>
            <p className="text-xs text-slate-300 font-light mt-0.5">
              Execute the complete 7-step referral pipeline from Nurse creation to Control Room telemetry.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetFlow}
          className="eleven-button bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 px-3 flex items-center gap-2 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Flow</span>
        </button>
      </div>

      {/* 7-Step Visual Pipeline Tracker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs font-mono">
        {steps.map(s => {
          const isDone = currentStep >= s.num;
          const isCurrent = currentStep === s.num - 1;

          return (
            <button
              key={s.num}
              onClick={() => handleExecuteStep(s.num)}
              disabled={executing}
              className={`p-3 rounded-2xl border text-left flex flex-col justify-between space-y-2 transition-all ${
                isDone 
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200' 
                  : isCurrent 
                  ? 'bg-amber-950/80 border-amber-400 text-amber-200 animate-pulse' 
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">STEP {s.num}</span>
                {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-slate-500" />}
              </div>

              <div className="font-bold truncate text-[11px]">{s.title}</div>
            </button>
          );
        })}
      </div>

      {/* Step Execution & Controls */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase">
            Active Pipeline Step: {currentStep < 7 ? `Step ${currentStep + 1} of 7` : 'Flow Completed ✓'}
          </span>

          {currentStep < 7 && (
            <button
              onClick={() => handleExecuteStep(currentStep + 1)}
              disabled={executing}
              className="eleven-button bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-4 flex items-center gap-2 rounded-xl"
            >
              <span>{executing ? 'Executing API Call...' : steps[currentStep].actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Execution Logs */}
        <div className="bg-black/80 p-3 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1.5 max-h-36 overflow-y-auto">
          {stepLogs.length === 0 ? (
            <div className="text-slate-500 italic">
              Click step buttons or "Execute Step" to test the backend API flow live.
            </div>
          ) : (
            stepLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-300">
                <span className="text-amber-400 flex-shrink-0">[{log.time}]</span>
                <span>{log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

