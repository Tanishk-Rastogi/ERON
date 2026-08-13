require('dotenv').config();
const { pool } = require('./config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear tables
    await client.query('TRUNCATE TABLE hospitals, users, beds_capacity, referrals, ambulances CASCADE');
    
    console.log('Seeding hospitals...');
    const h1 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('City General Hospital', 28.7041, 77.1025, '{"ICU", "Ventilator", "Trauma"}', 1) RETURNING id
    `);
    const h2 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('Metro Heart Institute', 28.5355, 77.2410, '{"Cardiac", "ICU"}', 2) RETURNING id
    `);
    const h3 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('SafeCare Clinic', 28.6139, 77.2090, '{"Basic", "Maternity"}', 3) RETURNING id
    `);
    const h4 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('Lifeline Trauma Center', 28.5562, 77.1000, '{"Trauma", "Burn"}', 1) RETURNING id
    `);
    const h5 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('Northwest General', 28.7000, 77.1500, '{"ICU", "Neurology"}', 2) RETURNING id
    `);
    const h6 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('Eastside Medical', 28.6300, 77.3000, '{"Pediatric", "ICU"}', 2) RETURNING id
    `);
    const h7 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('South Point Hospital', 28.5000, 77.2000, '{"Orthopedic"}', 3) RETURNING id
    `);
    const h8 = await client.query(`
      INSERT INTO hospitals (name, location_lat, location_lng, capabilities, tier) 
      VALUES ('Central Government Hospital', 28.6200, 77.2100, '{"ICU", "Trauma", "Cardiac", "Neurology", "Burn"}', 1) RETURNING id
    `);

    const hospitalIds = [h1, h2, h3, h4, h5, h6, h7, h8].map(res => res.rows[0].id);

    console.log('Seeding users...');
    const pass = await bcrypt.hash('password123', 10);
    await client.query(`
      INSERT INTO users (hospital_id, role, name, phone, password_hash) VALUES 
      ($1, 'referral_staff', 'Alice Sender', '1111111111', $2),
      ($3, 'receiving_hospital_desk', 'Bob Receiver', '2222222222', $2),
      (NULL, 'ambulance_dispatcher', 'Charlie Dispatch', '3333333333', $2),
      (NULL, 'control_room_admin', 'Admin Dan', '4444444444', $2)
    `, [hospitalIds[0], pass, hospitalIds[1]]);

    console.log('Seeding beds...');
    for (const id of hospitalIds) {
      await client.query(`
        INSERT INTO beds_capacity (hospital_id, bed_type, total, available) VALUES 
        ($1, 'ICU', 20, 5),
        ($1, 'General', 100, 20),
        ($1, 'Ventilator', 10, 2)
      `, [id]);
    }
    
    // Explicitly set Metro Heart Institute (h2) bed count to 1 for the demo re-routing test
    await client.query(`UPDATE beds_capacity SET available = 1 WHERE hospital_id = $1 AND bed_type = 'ICU'`, [hospitalIds[1]]);

    console.log('Seeding ambulances...');
    await client.query(`
      INSERT INTO ambulances (type, status, current_lat, current_lng) VALUES 
      ('BLS', 'AVAILABLE', 28.7041, 77.1025),
      ('ALS', 'AVAILABLE', 28.5355, 77.2410),
      ('Ventilator', 'AVAILABLE', 28.6139, 77.2090),
      ('BLS', 'AVAILABLE', 28.5562, 77.1000),
      ('ALS', 'AVAILABLE', 28.7000, 77.1500)
    `);

    // Pre-position referral exactly at "ambulance in transit, Hospital B confirmed" (Module 6 Demo requirement)
    // Sending: h1 (City General), Receiving: h2 (Metro Heart)
    const refRes = await client.query(`
      INSERT INTO referrals (patient_ref_id, sending_hospital_id, receiving_hospital_id, required_capabilities, status) 
      VALUES ('PT-DEMO-001', $1, $2, '{"ICU"}', 'HOSPITAL_CONFIRMED') RETURNING id
    `, [hospitalIds[0], hospitalIds[1]]);
    const refId = refRes.rows[0].id;
    
    await client.query(`
      INSERT INTO referral_status_log (referral_id, from_status, to_status)
      VALUES ($1, 'CREATED', 'HOSPITAL_CONFIRMED')
    `, [refId]);

    // Update bed status to RESERVED
    const bedRes = await client.query(`
      SELECT id FROM beds_capacity WHERE hospital_id = $1 AND bed_type = 'ICU' LIMIT 1
    `, [hospitalIds[1]]);
    if (bedRes.rows.length > 0) {
        await client.query(`
          INSERT INTO bed_status_log (bed_capacity_id, from_status, to_status)
          VALUES ($1, 'AVAILABLE', 'RESERVED')
        `, [bedRes.rows[0].id]);
        await client.query(`UPDATE beds_capacity SET available = available - 1 WHERE id = $1`, [bedRes.rows[0].id]);
    }
    
    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    pool.end();
  }
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
