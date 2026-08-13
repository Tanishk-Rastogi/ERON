exports.up = (pgm) => {
  // Hospitals Table
  pgm.createTable('hospitals', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    location_lat: { type: 'double precision', notNull: true },
    location_lng: { type: 'double precision', notNull: true },
    capabilities: { type: 'text[]', notNull: true, default: '{}' },
    contact_info: { type: 'varchar(255)' },
    tier: { type: 'integer', notNull: true, default: 1 }
  });

  // Beds Capacity Table
  pgm.createTable('beds_capacity', {
    id: 'id',
    hospital_id: { type: 'integer', references: 'hospitals', onDelete: 'CASCADE' },
    bed_type: { type: 'varchar(50)', notNull: true },
    total: { type: 'integer', notNull: true, default: 0 },
    available: { type: 'integer', notNull: true, default: 0 },
    last_updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    last_updated_by: { type: 'integer' } // will reference users later
  });

  // Users Table
  pgm.createTable('users', {
    id: 'id',
    hospital_id: { type: 'integer', references: 'hospitals', onDelete: 'SET NULL' },
    role: { type: 'varchar(50)', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    phone: { type: 'varchar(50)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true }
  });

  // Add FK to beds_capacity now that users exist
  pgm.addConstraint('beds_capacity', 'fk_last_updated_by', {
    foreignKeys: {
      columns: 'last_updated_by',
      references: 'users(id)',
      onDelete: 'SET NULL'
    }
  });

  // Referrals Table
  pgm.createTable('referrals', {
    id: 'id',
    patient_ref_id: { type: 'varchar(255)', notNull: true },
    sending_hospital_id: { type: 'integer', references: 'hospitals', notNull: true },
    receiving_hospital_id: { type: 'integer', references: 'hospitals' },
    required_capabilities: { type: 'text[]', notNull: true, default: '{}' },
    status: { type: 'varchar(50)', notNull: true, default: 'CREATED' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    closed_at: { type: 'timestamp' }
  });

  // Referral Status Log
  pgm.createTable('referral_status_log', {
    id: 'id',
    referral_id: { type: 'integer', references: 'referrals', onDelete: 'CASCADE' },
    from_status: { type: 'varchar(50)' },
    to_status: { type: 'varchar(50)', notNull: true },
    timestamp: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actor_id: { type: 'integer', references: 'users' }
  });

  // Bed Status Log
  pgm.createTable('bed_status_log', {
    id: 'id',
    bed_capacity_id: { type: 'integer', references: 'beds_capacity', onDelete: 'CASCADE' },
    from_status: { type: 'varchar(50)' },
    to_status: { type: 'varchar(50)', notNull: true },
    timestamp: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    actor_id: { type: 'integer', references: 'users' }
  });

  // Clinical Packets Table
  pgm.createTable('clinical_packets', {
    id: 'id',
    referral_id: { type: 'integer', references: 'referrals', onDelete: 'CASCADE' },
    encrypted_payload: { type: 'text', notNull: true },
    created_by: { type: 'integer', references: 'users' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Ambulances Table
  pgm.createTable('ambulances', {
    id: 'id',
    hospital_id: { type: 'integer', references: 'hospitals' },
    fleet_id: { type: 'varchar(100)' },
    type: { type: 'varchar(50)', notNull: true }, // BLS/ALS/Ventilator
    status: { type: 'varchar(50)', notNull: true, default: 'AVAILABLE' },
    current_lat: { type: 'double precision' },
    current_lng: { type: 'double precision' }
  });

  // Ambulance Assignments Table
  pgm.createTable('ambulance_assignments', {
    id: 'id',
    ambulance_id: { type: 'integer', references: 'ambulances', onDelete: 'CASCADE' },
    referral_id: { type: 'integer', references: 'referrals', onDelete: 'CASCADE' },
    assigned_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    status: { type: 'varchar(50)', notNull: true, default: 'ASSIGNED' }
  });

  // SMS Fallback Log Table
  pgm.createTable('sms_fallback_log', {
    id: 'id',
    raw_sms: { type: 'text', notNull: true },
    parsed_requirement: { type: 'text' },
    response_sent: { type: 'text' },
    timestamp: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('sms_fallback_log');
  pgm.dropTable('ambulance_assignments');
  pgm.dropTable('ambulances');
  pgm.dropTable('clinical_packets');
  pgm.dropTable('bed_status_log');
  pgm.dropTable('referral_status_log');
  pgm.dropTable('referrals');
  pgm.dropTable('beds_capacity'); // cascades fk_last_updated_by
  pgm.dropTable('users');
  pgm.dropTable('hospitals');
};
