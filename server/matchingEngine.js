import { db } from './db.js';

/**
 * Calculates Haversine distance in KM between two geographic coordinates
 */
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

/**
 * Estimates traffic-adjusted ETA in minutes based on distance and priority
 */
function estimateEtaMinutes(distanceKm, priority = 'URGENT') {
  // Speed model: Ambulance in urban corridor ~ 35 km/h average with siren
  const speedKmH = priority === 'CRITICAL' ? 42 : 35;
  const hours = distanceKm / speedKmH;
  const baseMinutes = Math.round(hours * 60);
  return Math.max(3, baseMinutes + 2); // add baseline 2 min dispatch overhead
}

/**
 * Match and rank candidate hospitals based on PRD §3 & TRD §6 specifications
 * 
 * @param {Object} params
 * @param {string[]} params.requiredCapabilities - e.g. ['NEUROSURGERY', 'CT_SCAN']
 * @param {string[]} params.requiredResources - e.g. ['ICU_BED', 'VENTILATOR']
 * @param {number} params.originLat - latitude of origin (hospital or ambulance location)
 * @param {number} params.originLng - longitude of origin
 * @param {string} [params.excludeHospitalId] - hospital ID to exclude (e.g. for re-routing)
 * @param {string} [params.priority='URGENT'] - 'CRITICAL', 'URGENT', or 'STABLE'
 * @returns {Array<Object>} Ranked hospital candidates with detailed score breakdowns
 */
export function matchHospitals({
  requiredCapabilities = [],
  requiredResources = [],
  originLat,
  originLng,
  excludeHospitalId = null,
  priority = 'URGENT'
}) {
  const allHospitals = db.getHospitals();

  const candidates = [];

  for (const hosp of allHospitals) {
    if (!hosp.isActive) continue;
    if (excludeHospitalId && hosp.id === excludeHospitalId) continue;

    // 1. FILTER — Capability Check
    const hospCaps = hosp.capabilities.map(c => c.capability);
    const hasAllCapabilities = requiredCapabilities.every(reqCap => hospCaps.includes(reqCap));

    if (!hasAllCapabilities && requiredCapabilities.length > 0) {
      continue; // Must satisfy all clinical capabilities
    }

    // 2. FILTER — Capacity Availability Check
    let hasAllResources = true;
    let totalHeadroomSum = 0;
    let resourceCount = 0;

    for (const reqRes of requiredResources) {
      const resPool = hosp.resources.find(r => r.resourceType === reqRes);
      if (!resPool || resPool.availableCount <= 0) {
        hasAllResources = false;
        break;
      }
      totalHeadroomSum += (resPool.availableCount / (resPool.totalCapacity || 1));
      resourceCount++;
    }

    if (!hasAllResources && requiredResources.length > 0) {
      continue; // Must have current live capacity > 0
    }

    // Calculate Distance & ETA
    const distKm = getHaversineDistanceKm(originLat, originLng, hosp.lat, hosp.lng);
    const etaMinutes = estimateEtaMinutes(distKm, priority);

    // Calculate Scoring Factors
    const capabilityScore = hasAllCapabilities ? 1.0 : 0.5;
    const capacityHeadroomScore = resourceCount > 0 ? (totalHeadroomSum / resourceCount) : 0.5;
    
    // Normalized ETA score (closer = higher score, max distance baseline 40km)
    const normalizedEtaScore = Math.max(0, 1 - (distKm / 40));

    // Specialist on Call Bonus
    const hasSpecialist = hosp.capabilities.some(c => 
      requiredCapabilities.includes(c.capability) && c.specialistOnCall
    );
    const specialistBonus = hasSpecialist ? 1.0 : 0.0;

    // Weights: w1=0.4 (capability), w2=0.15 (headroom), w3=0.35 (ETA), w4=0.10 (specialist)
    const finalScore = (
      (0.40 * capabilityScore) +
      (0.15 * capacityHeadroomScore) +
      (0.35 * normalizedEtaScore) +
      (0.10 * specialistBonus)
    );

    candidates.push({
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      type: hosp.type,
      lat: hosp.lat,
      lng: hosp.lng,
      address: hosp.address,
      contactPhone: hosp.contactPhone,
      distanceKm: parseFloat(distKm.toFixed(1)),
      etaMinutes,
      score: parseFloat(finalScore.toFixed(3)),
      headroomRatio: parseFloat(capacityHeadroomScore.toFixed(2)),
      hasSpecialistOnCall: hasSpecialist,
      availableResources: hosp.resources.map(r => ({
        type: r.resourceType,
        available: r.availableCount,
        total: r.totalCapacity
      }))
    });
  }

  // Sort descending by calculated match score
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}
