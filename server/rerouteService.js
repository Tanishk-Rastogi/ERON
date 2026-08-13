import { db } from './db.js';
import { matchHospitals } from './matchingEngine.js';
import { BedHoldService } from './bedHoldService.js';

/**
 * Auto-Reroute Engine: Detects mid-transit capacity loss and seamlessly reroutes patients.
 */
export class RerouteService {
  /**
   * Evaluates whether any active referrals targeting hospitalId need to be rerouted.
   * @param {string} hospitalId - The hospital whose capacity changed or dropped
   * @param {string} resourceType - The resource type that experienced capacity loss
   * @param {Function} broadcastFn - WebSocket broadcast callback
   */
  static triggerRerouteCheck(hospitalId, resourceType, broadcastFn) {
    // Find active referrals pointing to this hospital requiring this resource type
    const activeReferrals = db.referrals.filter(r => 
      (r.targetHospitalId === hospitalId || r.acceptedHospitalId === hospitalId) &&
      (r.status === 'IN_TRANSIT' || r.status === 'REQUEST_SENT' || r.status === 'ACCEPTED' || r.status === 'NOTIFIED') &&
      r.requiredResources.includes(resourceType)
    );

    if (activeReferrals.length === 0) {
      return [];
    }

    const reroutedResults = [];

    for (const ref of activeReferrals) {
      const result = this.executeReroute(ref.id, `Capacity for ${resourceType} at ${hospitalId} dropped to 0`, broadcastFn);
      reroutedResults.push(result);
    }

    return reroutedResults;
  }

  /**
   * Executes auto-reroute algorithm for a specific referral
   */
  static executeReroute(referralId, reason, broadcastFn) {
    const ref = db.referrals.find(r => r.id === referralId);
    if (!ref) return null;

    const oldHospitalId = ref.targetHospitalId;
    const oldHospital = db.hospitals.find(h => h.id === oldHospitalId);

    // 1. Set status to RE_ROUTING
    ref.status = 'RE_ROUTING';
    ref.updatedAt = new Date().toISOString();

    // Release any holds on old hospital
    BedHoldService.releaseHold(referralId);

    // Add Audit Event
    db.addReferralEvent(referralId, 'REROUTING_INITIATED', null, {
      fromHospitalId: oldHospitalId,
      fromHospitalName: oldHospital ? oldHospital.name : 'Target Hospital',
      reason
    });

    // Notify clients of rerouting status
    if (broadcastFn) {
      broadcastFn({
        type: 'REFERRAL_REROUTING',
        referralId,
        message: `Capacity lost at ${oldHospital ? oldHospital.name : 'Target Hospital'}. Re-routing patient...`,
        referral: db.enrichReferral(ref)
      });
    }

    // 2. Determine location for re-matching: ambulance current location preferred over origin hospital
    let searchLat = 12.9716;
    let searchLng = 77.5946;

    if (ref.ambulanceId) {
      const amb = db.ambulances.find(a => a.id === ref.ambulanceId);
      if (amb && amb.currentLat) {
        searchLat = amb.currentLat;
        searchLng = amb.currentLng;
      }
    } else {
      const originHosp = db.hospitals.find(h => h.id === ref.originHospitalId);
      if (originHosp) {
        searchLat = originHosp.lat;
        searchLng = originHosp.lng;
      }
    }

    // 3. Re-run matching pipeline excluding failed hospital
    const candidateMatches = matchHospitals({
      requiredCapabilities: ref.requiredCapabilities,
      requiredResources: ref.requiredResources,
      originLat: searchLat,
      originLng: searchLng,
      excludeHospitalId: oldHospitalId,
      priority: ref.priority
    });

    if (candidateMatches.length > 0) {
      // 4. Success — Found new best matching hospital!
      const newMatch = candidateMatches[0];
      const newHospital = db.hospitals.find(h => h.id === newMatch.hospitalId);

      ref.targetHospitalId = newMatch.hospitalId;
      ref.acceptedHospitalId = newMatch.hospitalId;
      ref.status = 'IN_TRANSIT';
      ref.reroutedCount = (ref.reroutedCount || 0) + 1;
      ref.updatedAt = new Date().toISOString();

      // Place soft hold on new hospital
      BedHoldService.placeHold(newMatch.hospitalId, ref.requiredResources, referralId);
      BedHoldService.confirmHold(referralId);

      // Log Audit Event
      db.addReferralEvent(referralId, 'REROUTED', null, {
        fromHospitalId: oldHospitalId,
        fromHospitalName: oldHospital ? oldHospital.name : 'Old Hospital',
        toHospitalId: newMatch.hospitalId,
        toHospitalName: newMatch.hospitalName,
        newEtaMinutes: newMatch.etaMinutes,
        reason
      });

      const updatedEnrichedRef = db.enrichReferral(ref);

      // Broadcast WebSocket events to all actors
      if (broadcastFn) {
        broadcastFn({
          type: 'REFERRAL_REROUTED',
          referralId,
          oldHospitalId,
          newHospitalId: newMatch.hospitalId,
          newHospitalName: newMatch.hospitalName,
          newEtaMinutes: newMatch.etaMinutes,
          message: `Rerouted successfully! New destination: ${newMatch.hospitalName} (ETA ${newMatch.etaMinutes}m)`,
          referral: updatedEnrichedRef
        });
      }

      return {
        success: true,
        escalated: false,
        oldHospitalName: oldHospital ? oldHospital.name : 'Previous Hospital',
        newHospitalName: newMatch.hospitalName,
        newEtaMinutes: newMatch.etaMinutes,
        referral: updatedEnrichedRef
      };
    } else {
      // 5. Escalation — No candidate hospital could be found in radius
      ref.status = 'RE_ROUTING_ESCALATED';
      ref.updatedAt = new Date().toISOString();

      db.addReferralEvent(referralId, 'REROUTE_ESCALATED', null, {
        fromHospitalId: oldHospitalId,
        reason: 'No alternative hospital available with required capabilities and capacity within district radius'
      });

      const updatedEnrichedRef = db.enrichReferral(ref);

      if (broadcastFn) {
        broadcastFn({
          type: 'REROUTE_ESCALATED',
          referralId,
          message: `ALERT: Re-routing failed for Referral #${ref.patientRefCode}. Escalated to District Control Room!`,
          referral: updatedEnrichedRef
        });
      }

      return {
        success: false,
        escalated: true,
        message: 'No candidate hospital available. Escalated to Control Room.',
        referral: updatedEnrichedRef
      };
    }
  }
}
