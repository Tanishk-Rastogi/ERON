import { db } from './db.js';

/**
 * Service managing Bed State Machine transitions and atomic resource holds.
 * States: AVAILABLE -> TEMPORARILY_HELD -> HOSPITAL_CONFIRMED -> RESERVED -> PATIENT_ARRIVED -> OCCUPIED
 */
export class BedHoldService {
  /**
   * Places an atomic soft-hold on a bed unit for a referral request.
   * @param {string} hospitalId 
   * @param {string[]} requiredResources 
   * @param {string} referralId 
   * @returns {Object} { success: boolean, heldUnits: Array, message: string }
   */
  static placeHold(hospitalId, requiredResources, referralId) {
    // 1. Lock check & resource availability validation
    for (const resType of requiredResources) {
      const resPool = db.resources.find(r => r.hospitalId === hospitalId && r.resourceType === resType);
      if (!resPool || resPool.availableCount <= 0) {
        return {
          success: false,
          message: `Resource pool ${resType} at ${hospitalId} has 0 available capacity.`
        };
      }
    }

    const heldUnits = [];
    const holdExpiresAt = new Date(Date.now() + 5 * 60000).toISOString(); // 5 min TTL

    // 2. Transition units to TEMPORARILY_HELD
    for (const resType of requiredResources) {
      // Find an available unit or create/assign a tracked hold unit
      let unit = db.bedUnits.find(u => 
        u.hospitalId === hospitalId && 
        u.resourceType === resType && 
        u.status === 'AVAILABLE'
      );

      if (!unit) {
        // If unit objects aren't pre-populated, create a tracked unit dynamically
        unit = {
          id: `unit-${hospitalId}-${resType.toLowerCase()}-${Date.now()}`,
          hospitalId,
          resourceType: resType,
          unitNumber: `${resType.substring(0,3)}-HELD`,
          status: 'AVAILABLE',
          heldForReferralId: null,
          holdExpiresAt: null,
          statusUpdatedAt: new Date().toISOString()
        };
        db.bedUnits.push(unit);
      }

      unit.status = 'TEMPORARILY_HELD';
      unit.heldForReferralId = referralId;
      unit.holdExpiresAt = holdExpiresAt;
      unit.statusUpdatedAt = new Date().toISOString();

      heldUnits.push(unit);
    }

    return {
      success: true,
      holdExpiresAt,
      heldUnits,
      message: `Soft hold placed on ${requiredResources.join(', ')} at hospital ${hospitalId}`
    };
  }

  /**
   * Transition held unit to HOSPITAL_CONFIRMED / RESERVED when hospital accepts
   */
  static confirmHold(referralId) {
    const units = db.bedUnits.filter(u => u.heldForReferralId === referralId);
    units.forEach(u => {
      u.status = 'HOSPITAL_CONFIRMED';
      u.statusUpdatedAt = new Date().toISOString();
    });
    return units;
  }

  /**
   * Release hold or reservation back to AVAILABLE (e.g. on cancellation or reroute away)
   */
  static releaseHold(referralId) {
    const units = db.bedUnits.filter(u => u.heldForReferralId === referralId);
    units.forEach(u => {
      u.status = 'AVAILABLE';
      u.heldForReferralId = null;
      u.holdExpiresAt = null;
      u.statusUpdatedAt = new Date().toISOString();
    });
    return units;
  }
}
