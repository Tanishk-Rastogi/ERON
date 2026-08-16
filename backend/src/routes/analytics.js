const express = require('express');
const { query } = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/district
router.get('/district', auth(['control_room_admin']), async (req, res) => {
  try {
    const activeRes = await query(`SELECT count(*) as count FROM referrals WHERE status NOT IN ('COMPLETED', 'CANCELLED')`);
    const escalatedRes = await query(`SELECT count(*) as count FROM referrals WHERE status = 'RE_ROUTING_ESCALATED'`);
    
    // Simulate rerouted count based on status logs (for MVP, we assume RE_ROUTED status indicates reroute)
    const reroutedRes = await query(`SELECT count(DISTINCT referral_id) as count FROM referral_status_log WHERE to_status = 'RE_ROUTED'`);
    const totalRes = await query(`SELECT count(*) as count FROM referrals`);
    
    const activeCount = parseInt(activeRes.rows[0].count);
    const escalatedCount = parseInt(escalatedRes.rows[0].count);
    const reroutedCount = parseInt(reroutedRes.rows[0].count);
    const totalCount = parseInt(totalRes.rows[0].count) || 1;
    const rerouteRatePercent = Math.round((reroutedCount / totalCount) * 100);

    const resourceGaps = [
      { resource: 'ICU Beds', failedPercent: 42, text: '42% of district referrals encounter ICU capacity bottlenecks' },
      { resource: 'Ventilators', failedPercent: 28, text: '28% delay due to ventilator availability' }
    ];

    const hospRes = await query(`
      SELECT h.*, json_agg(json_build_object('type', b.bed_type, 'total', b.total, 'available', b.available, 'last_updated_at', b.last_updated_at)) as resources
      FROM hospitals h LEFT JOIN beds_capacity b ON h.id = b.hospital_id GROUP BY h.id
    `);

    const hospitalsSummary = hospRes.rows.map(h => {
      const icu = (h.resources || []).find(r => r.type === 'ICU');
      const vent = (h.resources || []).find(r => r.type === 'Ventilator');
      const lastUpdate = icu ? new Date(icu.last_updated_at) : new Date();
      return {
        id: h.id,
        name: h.name,
        lat: h.location_lat,
        lng: h.location_lng,
        icuAvailable: icu ? icu.available : 0,
        ventAvailable: vent ? vent.available : 0,
        isStale: (Date.now() - lastUpdate.getTime()) > 30 * 60000
      };
    });

    res.json({
      activeCount,
      reroutedCount,
      escalatedCount,
      rerouteRatePercent,
      resourceGaps,
      hospitalsSummary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/ranking-model
router.get('/ranking-model', auth(['control_room_admin']), async (req, res) => {
  try {
    const metricsRes = await query(`
      SELECT 
        ranking_model_version,
        COUNT(*) as total_predictions,
        SUM(CASE WHEN was_accepted = true THEN 1 ELSE 0 END) as accepted_count,
        SUM(CASE WHEN was_rejected = true THEN 1 ELSE 0 END) as rejected_count,
        AVG(time_to_decision_sec) as avg_decision_sec,
        AVG(match_score) as avg_match_score
      FROM referral_ranking_log
      GROUP BY ranking_model_version
    `);

    res.json({
      success: true,
      models: metricsRes.rows.map(r => ({
        version: r.ranking_model_version,
        total: parseInt(r.total_predictions),
        accepted: parseInt(r.accepted_count),
        rejected: parseInt(r.rejected_count),
        avgDecisionSec: Math.round(r.avg_decision_sec || 0),
        avgScore: parseFloat((r.avg_match_score || 0).toFixed(3)),
        precisionAt1: (parseInt(r.accepted_count) / (parseInt(r.total_predictions) || 1)).toFixed(2)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
