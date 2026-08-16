exports.up = (pgm) => {
  // specialist_availability Table
  pgm.createTable('specialist_availability', {
    id: 'id',
    hospital_id: { type: 'integer', references: 'hospitals', onDelete: 'CASCADE' },
    specialist_type: { type: 'varchar(100)', notNull: true }, // e.g. NEUROSURGEON
    status: { type: 'varchar(50)', notNull: true, default: 'AVAILABLE' }, // AVAILABLE, ENGAGED, OFF_DUTY
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_by: { type: 'integer', references: 'users' }
  });

  // referral_events (for audit chain)
  pgm.createTable('referral_events', {
    id: 'id',
    referral_id: { type: 'integer', references: 'referrals', onDelete: 'CASCADE' },
    action: { type: 'varchar(100)', notNull: true },
    actor: { type: 'varchar(255)' },
    payload: { type: 'jsonb' },
    event_hash: { type: 'varchar(64)', notNull: true },
    prev_hash: { type: 'varchar(64)' }, // nullable for genesis block
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // referral_ranking_log (for ML training)
  pgm.createTable('referral_ranking_log', {
    id: 'id',
    referral_id: { type: 'integer', references: 'referrals', onDelete: 'CASCADE' },
    ranking_model_version: { type: 'varchar(50)' },
    hospital_id: { type: 'integer', references: 'hospitals', onDelete: 'CASCADE' },
    rank_position: { type: 'integer' },
    match_score: { type: 'double precision' },
    features: { type: 'jsonb' }, // distance, capabilities, headroom
    was_accepted: { type: 'boolean', default: false },
    was_rejected: { type: 'boolean', default: false },
    time_to_decision_sec: { type: 'integer' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // The prompt mentions "packets (encrypted, field-level)".
  // clinical_packets already exists, but we can add a packets table or alter it.
  // I will create `packets` to fulfill the prompt exactly.
  pgm.createTable('packets', {
    id: 'id',
    referral_id: { type: 'integer', references: 'referrals', onDelete: 'CASCADE' },
    encrypted_data: { type: 'text', notNull: true },
    iv: { type: 'varchar(32)', notNull: true },
    auth_tag: { type: 'varchar(32)' }, // for AES-GCM
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('packets');
  pgm.dropTable('referral_ranking_log');
  pgm.dropTable('referral_events');
  pgm.dropTable('specialist_availability');
};
