import express from 'express';
import { db } from './db.js';
import { matchHospitals } from './matchingEngine.js';
import { BedHoldService } from './bedHoldService.js';
import { RerouteService } from './rerouteService.js';
import { decryptPacket } from './packetEncryption.js';

export function createApiRouter(broadcastFn) {
  const router = express.Router();

  // 1. GET /api/hospitals — Fetch all hospitals with live capacity & capabilities
  router.get('/hospitals', (req, res) => {
    const hospitals = db.getHospitals();
    res.json(hospitals);
  });

  // 2. GET /api/hospitals/:id — Fetch single hospital
  router.get('/hospitals/:id', (req, res) => {
    const hospital = db.getHospitalById(req.params.id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    res.json(hospital);
  });

  // 3. POST /api/hospitals/:id/capacity — Adjust capacity (+/- counter or exact)
  router.post('/hospitals/:id/capacity', (req, res) => {
    const { resourceType, delta, exactCount, staffId } = req.body;
    const hospitalId = req.params.id;

    let updatedResource;
    if (exactCount !== undefined) {
      updatedResource = db.setHospitalCapacity(hospitalId, resourceType, exactCount, staffId);
    } else if (delta !== undefined) {
      updatedResource = db.updateHospitalCapacity(hospitalId, resourceType, delta, staffId);
    } else {
      return res.status(400).json({ error: 'Must provide delta or exactCount' });
    }

    if (!updatedResource) {
      return res.status(404).json({ error: 'Resource type or hospital not found' });
    }

    const hospital = db.getHospitalById(hospitalId);

    // Broadcast capacity update over WebSocket
    if (broadcastFn) {
      broadcastFn({
        type: 'CAPACITY_UPDATED',
        hospitalId,
        hospitalName: hospital ? hospital.name : hospitalId,
        resourceType,
        availableCount: updatedResource.availableCount,
        totalCapacity: updatedResource.totalCapacity,
        updatedAt: updatedResource.updatedAt
      });
    }

    // Trigger auto-reroute check if capacity dropped to 0!
    if (updatedResource.availableCount === 0) {
      RerouteService.triggerRerouteCheck(hospitalId, resourceType, broadcastFn);
    }

    res.json({
      success: true,
      hospitalId,
      resource: updatedResource
    });
  });

  // 4. POST /api/referrals/match — Calculate ranked candidates before creation
  router.post('/referrals/match', (req, res) => {
    const { requiredCapabilities, requiredResources, originHospitalId, priority } = req.body;
    
    const originHosp = db.getHospitalById(originHospitalId);
    const originLat = originHosp ? originHosp.lat : 12.9716;
    const originLng = originHosp ? originHosp.lng : 77.5946;

    const matches = matchHospitals({
      requiredCapabilities: requiredCapabilities || [],
      requiredResources: requiredResources || [],
      originLat,
      originLng,
      priority: priority || 'URGENT'
    });

    res.json({ matches });
  });

  // 5. POST /api/referrals — Create referral and notify target hospital
  router.post('/referrals', (req, res) => {
    const {
      originHospitalId,
      targetHospitalId,
      requirementSummary,
      requiredCapabilities,
      requiredResources,
      priority,
      createdByStaffId,
      patientData // Packet content
    } = req.body;

    const refId = `ref-${Date.now()}`;
    const patientRefCode = `PAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReferral = {
      id: refId,
      patientRefCode,
      originHospitalId,
      targetHospitalId: targetHospitalId || null,
      acceptedHospitalId: targetHospitalId || null,
      createdByStaffId: createdByStaffId || 'user-staff-1',
      requirementSummary,
      requiredCapabilities: requiredCapabilities || [],
      requiredResources: requiredResources || [],
      priority: priority || 'URGENT',
      status: targetHospitalId ? 'REQUEST_SENT' : 'PENDING_MATCH',
      matchedHospitalIds: targetHospitalId ? [targetHospitalId] : [],
      ambulanceId: null,
      reroutedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.referrals.push(newReferral);

    // Add Audit Event
    db.addReferralEvent(refId, 'CREATED', createdByStaffId, {
      requirementSummary,
      priority
    });

    // If target hospital specified, place soft-hold and fire notification
    if (targetHospitalId && requiredResources && requiredResources.length > 0) {
      BedHoldService.placeHold(targetHospitalId, requiredResources, refId);
      db.addReferralEvent(refId, 'REQUEST_SENT', createdByStaffId, { targetHospitalId });
    }

    // Encrypt clinical packet if provided
    if (patientData) {
      const encrypted = packetEncryption(patientData);
      db.referralPackets.push({
        id: `pkt-${Date.now()}`,
        referralId: refId,
        ...encrypted
      });
    }

    const enriched = db.getReferralById(refId);

    if (broadcastFn) {
      broadcastFn({
        type: 'REFERRAL_CREATED',
        referral: enriched,
        message: `New emergency referral created for ${patientRefCode}`
      });
    }

    res.status(201).json(enriched);
  });

  // Helper for inline packet encryption if not imported
  function packetEncryption(data) {
    const { encryptPacket } = require('./packetEncryption.js');
    return encryptPacket(data);
  }

  // 6. GET /api/referrals — List referrals
  router.get('/referrals', (req, res) => {
    res.json(db.getReferrals());
  });

  // 7. GET /api/referrals/:id — Single referral
  router.get('/referrals/:id', (req, res) => {
    const ref = db.getReferralById(req.params.id);
    if (!ref) return res.status(404).json({ error: 'Referral not found' });
    res.json(ref);
  });

  // 8. POST /api/referrals/:id/accept — Receiving hospital accepts/confirms
  router.post('/referrals/:id/accept', (req, res) => {
    const ref = db.referrals.find(r => r.id === req.params.id);
    if (!ref) return res.status(404).json({ error: 'Referral not found' });

    ref.status = 'ACCEPTED';
    ref.acceptedHospitalId = ref.targetHospitalId;
    ref.updatedAt = new Date().toISOString();

    BedHoldService.confirmHold(ref.id);
    db.addReferralEvent(ref.id, 'ACCEPTED', req.body.staffId, { note: 'Confirmed bed reservation' });

    const enriched = db.getReferralById(ref.id);

    if (broadcastFn) {
      broadcastFn({
        type: 'REFERRAL_ACCEPTED',
        referral: enriched,
        message: `Referral #${ref.patientRefCode} accepted by receiving hospital!`
      });
    }

    res.json(enriched);
  });

  // 9. POST /api/referrals/:id/assign-ambulance — Assign ambulance & set status to IN_TRANSIT
  router.post('/referrals/:id/assign-ambulance', (req, res) => {
    const { ambulanceId } = req.body;
    const ref = db.referrals.find(r => r.id === req.params.id);
    if (!ref) return res.status(404).json({ error: 'Referral not found' });

    ref.ambulanceId = ambulanceId;
    ref.status = 'IN_TRANSIT';
    ref.updatedAt = new Date().toISOString();

    const amb = db.ambulances.find(a => a.id === ambulanceId);
    if (amb) {
      amb.status = 'EN_ROUTE_TO_HOSPITAL';
    }

    db.addReferralEvent(ref.id, 'DISPATCHED', req.body.staffId, {
      ambulanceId,
      driverName: amb ? amb.driverName : 'Assigned Driver'
    });

    const enriched = db.getReferralById(ref.id);

    if (broadcastFn) {
      broadcastFn({
        type: 'AMBULANCE_DISPATCHED',
        referral: enriched,
        ambulance: amb,
        message: `Ambulance assigned for Referral #${ref.patientRefCode}. En route to hospital.`
      });
    }

    res.json(enriched);
  });

  // 10. POST /api/referrals/:id/handover — Complete physical handoff
  router.post('/referrals/:id/handover', (req, res) => {
    const ref = db.referrals.find(r => r.id === req.params.id);
    if (!ref) return res.status(404).json({ error: 'Referral not found' });

    ref.status = 'COMPLETED';
    ref.updatedAt = new Date().toISOString();

    if (ref.ambulanceId) {
      const amb = db.ambulances.find(a => a.id === ref.ambulanceId);
      if (amb) amb.status = 'IDLE';
    }

    db.addReferralEvent(ref.id, 'HANDED_OVER', req.body.staffId, { note: 'Physical clinical handoff complete' });

    const enriched = db.getReferralById(ref.id);

    if (broadcastFn) {
      broadcastFn({
        type: 'REFERRAL_COMPLETED',
        referral: enriched,
        message: `Referral #${ref.patientRefCode} handoff completed!`
      });
    }

    res.json(enriched);
  });

  // 11. GET /api/referrals/:id/packet — Fetch decrypted clinical handoff packet
  router.get('/referrals/:id/packet', (req, res) => {
    const packetRecord = db.getPacketForReferral(req.params.id);
    if (!packetRecord) {
      return res.status(404).json({ error: 'No clinical packet found for this referral' });
    }

    try {
      const decrypted = decryptPacket(
        packetRecord.encryptedPayload,
        packetRecord.iv,
        packetRecord.authTag
      );
      res.json({
        id: packetRecord.id,
        referralId: packetRecord.referralId,
        decryptedPayload: decrypted,
        isDecrypted: true,
        decryptedAt: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to decrypt clinical packet' });
    }
  });

  // 12. POST /api/referrals/simulate-capacity-loss — DEMO CENTERPIECE TRIGGER!
  router.post('/referrals/simulate-capacity-loss', (req, res) => {
    const { referralId } = req.body;
    const targetRefId = referralId || (db.referrals[0] ? db.referrals[0].id : null);

    if (!targetRefId) {
      return res.status(400).json({ error: 'No active referral found for simulation' });
    }

    const ref = db.referrals.find(r => r.id === targetRefId);
    if (!ref) return res.status(404).json({ error: 'Referral not found' });

    const targetHospId = ref.targetHospitalId;
    const resType = ref.requiredResources[0] || 'ICU_BED';

    // Zero out the capacity at target hospital
    db.setHospitalCapacity(targetHospId, resType, 0, 'DEMO_TRIGGER');

    // Trigger explicit auto-reroute
    const rerouteResult = RerouteService.executeReroute(
      targetRefId,
      `DEMO SIMULATION: Target hospital ${targetHospId} lost all ${resType} capacity mid-transit`,
      broadcastFn
    );

    res.json({
      success: true,
      simulationMessage: `Capacity for ${resType} at hospital ${targetHospId} set to 0 mid-transit!`,
      rerouteResult
    });
  });

  // 13. POST /api/sms/webhook — SMS Short-Code Fallback Parser Sandbox
  router.post('/sms/webhook', (req, res) => {
    const { fromPhone, body } = req.body;
    const rawText = (body || '').trim().toUpperCase();

    // Parse e.g. "CT 500 URGENT" or "ICU 500 CRITICAL"
    const parts = rawText.split(/\s+/);
    const reqKey = parts[0] || 'ICU';
    const locCode = parts[1] || '500';
    const priority = parts[2] || 'URGENT';

    let capabilityMap = {
      'CT': 'CT_SCAN',
      'ICU': 'ICU',
      'VENT': 'VENTILATOR',
      'NEURO': 'NEUROSURGERY'
    };
    let resourceMap = {
      'CT': 'CT_SCAN',
      'ICU': 'ICU_BED',
      'VENT': 'VENTILATOR'
    };

    const cap = capabilityMap[reqKey] || 'ICU';
    const resType = resourceMap[reqKey] || 'ICU_BED';

    const matches = matchHospitals({
      requiredCapabilities: [cap],
      requiredResources: [resType],
      originLat: 12.9716,
      originLng: 77.5946,
      priority
    });

    let replyText = '';
    if (matches.length > 0) {
      const top2 = matches.slice(0, 2).map(m => `${m.hospitalName.substring(0, 12)}(${m.distanceKm}km)-Avail`).join(' ');
      replyText = `${reqKey}: ${top2}. Open app to refer or call 1923.`;
    } else {
      replyText = `No immediate ${reqKey} capacity in 25km. Escalated to District Control Room.`;
    }

    db.smsLogs.push({
      id: `sms-${Date.now()}`,
      fromPhone: fromPhone || '+91-9876543210',
      rawText,
      replyText,
      createdAt: new Date().toISOString()
    });

    res.json({
      fromPhone,
      rawText,
      replyText,
      matches: matches.slice(0, 3)
    });
  });

  // 14. GET /api/analytics/district — Control Room Aggregate Dashboard Data
  router.get('/analytics/district', (req, res) => {
    const referrals = db.getReferrals();
    const active = referrals.filter(r => !['COMPLETED', 'CANCELLED'].includes(r.status));
    const rerouted = referrals.filter(r => (r.reroutedCount || 0) > 0);
    const escalated = referrals.filter(r => r.status === 'RE_ROUTING_ESCALATED');

    const totalReferrals = referrals.length || 1;
    const rerouteRate = Math.round((rerouted.length / totalReferrals) * 100);

    const resourceGaps = [
      { resource: 'ICU Beds', failedPercent: 42, text: '42% of district referrals encounter ICU capacity bottlenecks' },
      { resource: 'Ventilators', failedPercent: 28, text: '28% delay due to ventilator availability' },
      { resource: 'Neurosurgery Specialist', failedPercent: 18, text: '18% lack specialist on-call coverage' }
    ];

    res.json({
      activeCount: active.length,
      reroutedCount: rerouted.length,
      escalatedCount: escalated.length,
      rerouteRatePercent: rerouteRate,
      resourceGaps,
      hospitalsSummary: db.getHospitals().map(h => ({
        id: h.id,
        name: h.name,
        type: h.type,
        lat: h.lat,
        lng: h.lng,
        icuAvailable: (h.resources.find(r => r.resourceType === 'ICU_BED') || {}).availableCount || 0,
        ventAvailable: (h.resources.find(r => r.resourceType === 'VENTILATOR') || {}).availableCount || 0,
        isStale: (Date.now() - new Date(h.lastCapacityUpdateAt).getTime()) > 30 * 60000
      }))
    });
  });

  return router;
}
