const { newDb } = require('pg-mem');

const db = newDb();
// pg-mem doesn't support all postgres syntax (like json_agg perfectly), 
// but we will do our best to mock a pool that behaves correctly or mock specific tables.
// Actually, since this is a heavy postgres schema, we might need some custom interceptors.

// Let's create a mocked pool object.
class MockPool {
  constructor() {
    this.pg = db.adapters.createPg();
    this.pool = new this.pg.Pool();
  }
  
  query(text, params) {
    // pg-mem might not support json_agg properly. We might need to handle it.
    return this.pool.query(text, params);
  }
  
  async connect() {
    return this.pool.connect();
  }
  
  on() {}
}

const pool = new MockPool();

// Run migrations on startup (in-memory)
async function initDb() {
  await db.public.none(`
    CREATE TABLE hospitals (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      location_lat DOUBLE PRECISION NOT NULL,
      location_lng DOUBLE PRECISION NOT NULL,
      capabilities TEXT[] NOT NULL DEFAULT '{}',
      contact_info VARCHAR(255),
      tier INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER REFERENCES hospitals(id),
      role VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    );

    CREATE TABLE beds_capacity (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
      bed_type VARCHAR(50) NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 0,
      last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE referrals (
      id SERIAL PRIMARY KEY,
      patient_ref_id VARCHAR(255) NOT NULL,
      patient_key VARCHAR(64),
      sending_hospital_id INTEGER REFERENCES hospitals(id) NOT NULL,
      receiving_hospital_id INTEGER REFERENCES hospitals(id),
      required_capabilities TEXT[] NOT NULL DEFAULT '{}',
      status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
      timeout_seconds INTEGER NOT NULL DEFAULT 300,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP,
      patient_data JSONB,
      rejection_reason TEXT
    );

    CREATE TABLE referral_status_log (
      id SERIAL PRIMARY KEY,
      referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
      from_status VARCHAR(50),
      to_status VARCHAR(50) NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_id INTEGER REFERENCES users(id),
      prev_hash VARCHAR(64),
      event_hash VARCHAR(64)
    );

    CREATE TABLE bed_status_log (
      id SERIAL PRIMARY KEY,
      bed_capacity_id INTEGER REFERENCES beds_capacity(id) ON DELETE CASCADE,
      from_status VARCHAR(50),
      to_status VARCHAR(50) NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE clinical_packets (
      id SERIAL PRIMARY KEY,
      referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
      encrypted_payload TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE specialist_availability (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
      specialist_type VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE referral_events (
      id SERIAL PRIMARY KEY,
      referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      actor VARCHAR(255),
      payload JSONB,
      event_hash VARCHAR(64) NOT NULL,
      prev_hash VARCHAR(64),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE referral_ranking_log (
      id SERIAL PRIMARY KEY,
      referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
      ranking_model_version VARCHAR(50),
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
      rank_position INTEGER,
      match_score DOUBLE PRECISION,
      features JSONB,
      was_accepted BOOLEAN DEFAULT false,
      was_rejected BOOLEAN DEFAULT false,
      time_to_decision_sec INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE packets (
      id SERIAL PRIMARY KEY,
      referral_id INTEGER REFERENCES referrals(id) ON DELETE CASCADE,
      encrypted_data TEXT NOT NULL,
      iv VARCHAR(32) NOT NULL,
      auth_tag VARCHAR(32),
      salt VARCHAR(32),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// intercept query to handle unsupported syntax like JSON_AGG
const originalQuery = pool.query.bind(pool);
pool.query = async function(text, params) {
  if (!this.initialized) {
    await initDb();
    this.initialized = true;
  }
  
  if (text.includes('json_agg(')) {
    // pg-mem doesn't support json_agg and json_build_object fully. 
    // We will do this manually for the hospitals query.
    if (text.includes('SELECT h.*')) {
      const hResult = await originalQuery(`SELECT * FROM hospitals`, []);
      const bResult = await originalQuery(`SELECT * FROM beds_capacity`, []);
      
      const rows = hResult.rows.map(h => {
        h.resources = bResult.rows.filter(b => b.hospital_id === h.id).map(b => ({
          type: b.bed_type,
          total: b.total,
          available: b.available,
          last_updated_at: b.last_updated_at
        }));
        return h;
      });
      
      // If there's a where clause:
      if (text.includes('WHERE h.id = $1')) {
        const id = params[0];
        return { rows: rows.filter(r => r.id == id) };
      }
      return { rows };
    }
  }

  // Rewrite standard ILIKE if pg-mem has issues, but it should support it
  // Return original query result
  return originalQuery(text, params);
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
