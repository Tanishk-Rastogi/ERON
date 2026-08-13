import { encryptPacket } from './packetEncryption.js';

// In-Memory Relational Data Store with atomic methods

class Database {
  constructor() {
    this.hospitals = [];
    this.capabilities = [];
    this.resources = [];
    this.bedUnits = [];
    this.ambulances = [];
    this.referrals = [];
    this.referralEvents = [];
    this.referralPackets = [];
    this.users = [];
    this.smsLogs = [];
    this.threads = [];
    this.messages = [];

    this.seed();
  }

  seed() {
    // 1. Seed Hospitals
    this.hospitals = [
      {
        id: 'hosp-a',
        name: 'District Hospital Central (Hospital A)',
        type: 'DISTRICT',
        lat: 12.9716,
        lng: 77.5946,
        address: 'MG Road, Central Zone, City',
        districtCode: 'DIST-01',
        contactPhone: '+91-98765-00101',
        dataSourceTier: 'MANUAL',
        lastCapacityUpdateAt: new Date(Date.now() - 2 * 60000).toISOString(),
        isActive: true
      },
      {
        id: 'hosp-b',
        name: 'City Super Specialty Hospital (Hospital B)',
        type: 'TERTIARY',
        lat: 12.9352,
        lng: 77.6245,
        address: 'Koramangala 4th Block, South Zone',
        districtCode: 'DIST-01',
        contactPhone: '+91-98765-00102',
        dataSourceTier: 'MANUAL',
        lastCapacityUpdateAt: new Date(Date.now() - 1 * 60000).toISOString(),
        isActive: true
      },
      {
        id: 'hosp-c',
        name: 'Apex Trauma & Neurosurgery Institute (Hospital C)',
        type: 'TERTIARY',
        lat: 12.9900,
        lng: 77.5700,
        address: 'Malleshwaram West, North Zone',
        districtCode: 'DIST-01',
        contactPhone: '+91-98765-00103',
        dataSourceTier: 'HIMS_API',
        lastCapacityUpdateAt: new Date(Date.now() - 5 * 60000).toISOString(),
        isActive: true
      },
      {
        id: 'hosp-d',
        name: 'St. Jude Peripheral General (Hospital D)',
        type: 'PERIPHERAL',
        lat: 12.9100,
        lng: 77.6500,
        address: 'HSR Layout Sector 2, Outer East',
        districtCode: 'DIST-01',
        contactPhone: '+91-98765-00104',
        dataSourceTier: 'MANUAL',
        lastCapacityUpdateAt: new Date(Date.now() - 35 * 60000).toISOString(), // Stale nudge!
        isActive: true
      }
    ];

    // 2. Hospital Capabilities
    this.capabilities = [
      // Hosp A (District - basic)
      { id: 'cap-1', hospitalId: 'hosp-a', capability: 'GENERAL_CARE', specialistOnCall: true, specialistName: 'Dr. Ramesh Kumar' },
      { id: 'cap-2', hospitalId: 'hosp-a', capability: 'EMERGENCY_TRIAGE', specialistOnCall: true, specialistName: 'Dr. Priya Sharma' },
      
      // Hosp B (City Super Specialty - Neuro, Cardio, ICU)
      { id: 'cap-3', hospitalId: 'hosp-b', capability: 'ICU', specialistOnCall: true, specialistName: 'Dr. Vikram Sethi (Intensivist)' },
      { id: 'cap-4', hospitalId: 'hosp-b', capability: 'VENTILATOR', specialistOnCall: true, specialistName: 'Dr. Vikram Sethi' },
      { id: 'cap-5', hospitalId: 'hosp-b', capability: 'NEUROSURGERY', specialistOnCall: true, specialistName: 'Dr. Anita Roy (Neurosurgeon)' },
      { id: 'cap-6', hospitalId: 'hosp-b', capability: 'CT_SCAN', specialistOnCall: true, specialistName: 'Radiology On-Call' },
      { id: 'cap-7', hospitalId: 'hosp-b', capability: 'CARDIOLOGY', specialistOnCall: false, specialistName: null },

      // Hosp C (Apex Trauma - High capacity Neuro & Trauma)
      { id: 'cap-8', hospitalId: 'hosp-c', capability: 'ICU', specialistOnCall: true, specialistName: 'Dr. Sunita Rao (Chief Intensivist)' },
      { id: 'cap-9', hospitalId: 'hosp-c', capability: 'VENTILATOR', specialistOnCall: true, specialistName: 'Dr. Sunita Rao' },
      { id: 'cap-10', hospitalId: 'hosp-c', capability: 'NEUROSURGERY', specialistOnCall: true, specialistName: 'Dr. Rajiv Menon (Lead Neurosurgeon)' },
      { id: 'cap-11', hospitalId: 'hosp-c', capability: 'CT_SCAN', specialistOnCall: true, specialistName: 'CT Specialist Desk' },
      { id: 'cap-12', hospitalId: 'hosp-c', capability: 'TRAUMA_OT', specialistOnCall: true, specialistName: 'Trauma Team A' },

      // Hosp D (Peripheral)
      { id: 'cap-13', hospitalId: 'hosp-d', capability: 'GENERAL_CARE', specialistOnCall: true, specialistName: 'Duty CMO' },
      { id: 'cap-14', hospitalId: 'hosp-d', capability: 'CT_SCAN', specialistOnCall: false, specialistName: null }
    ];

    // 3. Live Capacity Pools (Resource summary)
    this.resources = [
      // Hosp A
      { id: 'res-a-general', hospitalId: 'hosp-a', resourceType: 'GENERAL_BED', totalCapacity: 30, availableCount: 5, updatedAt: new Date().toISOString() },
      { id: 'res-a-icu', hospitalId: 'hosp-a', resourceType: 'ICU_BED', totalCapacity: 4, availableCount: 0, updatedAt: new Date().toISOString() },

      // Hosp B
      { id: 'res-b-icu', hospitalId: 'hosp-b', resourceType: 'ICU_BED', totalCapacity: 15, availableCount: 3, updatedAt: new Date().toISOString() },
      { id: 'res-b-vent', hospitalId: 'hosp-b', resourceType: 'VENTILATOR', totalCapacity: 8, availableCount: 2, updatedAt: new Date().toISOString() },
      { id: 'res-b-ct', hospitalId: 'hosp-b', resourceType: 'CT_SCAN', totalCapacity: 2, availableCount: 1, updatedAt: new Date().toISOString() },
      { id: 'res-b-general', hospitalId: 'hosp-b', resourceType: 'GENERAL_BED', totalCapacity: 50, availableCount: 12, updatedAt: new Date().toISOString() },

      // Hosp C
      { id: 'res-c-icu', hospitalId: 'hosp-c', resourceType: 'ICU_BED', totalCapacity: 25, availableCount: 8, updatedAt: new Date().toISOString() },
      { id: 'res-c-vent', hospitalId: 'hosp-c', resourceType: 'VENTILATOR', totalCapacity: 12, availableCount: 5, updatedAt: new Date().toISOString() },
      { id: 'res-c-ct', hospitalId: 'hosp-c', resourceType: 'CT_SCAN', totalCapacity: 3, availableCount: 2, updatedAt: new Date().toISOString() },
      { id: 'res-c-general', hospitalId: 'hosp-c', resourceType: 'GENERAL_BED', totalCapacity: 60, availableCount: 22, updatedAt: new Date().toISOString() },

      // Hosp D
      { id: 'res-d-general', hospitalId: 'hosp-d', resourceType: 'GENERAL_BED', totalCapacity: 20, availableCount: 8, updatedAt: new Date().toISOString() },
      { id: 'res-d-ct', hospitalId: 'hosp-d', resourceType: 'CT_SCAN', totalCapacity: 1, availableCount: 0, updatedAt: new Date().toISOString() }
    ];

    // 4. Individual Bed Units (State Machine Units)
    this.createBedUnitsForHospital('hosp-b', 'ICU_BED', 3);
    this.createBedUnitsForHospital('hosp-b', 'VENTILATOR', 2);
    this.createBedUnitsForHospital('hosp-c', 'ICU_BED', 8);
    this.createBedUnitsForHospital('hosp-c', 'VENTILATOR', 5);

    // 5. Ambulances
    this.ambulances = [
      {
        id: 'amb-101',
        hospitalId: 'hosp-a',
        type: 'ALS',
        status: 'DISPATCHED',
        currentLat: 12.9550,
        currentLng: 77.6100,
        driverName: 'Suresh Kumar',
        driverPhone: '+91-99887-11223',
        lastPingAt: new Date().toISOString()
      },
      {
        id: 'amb-102',
        hospitalId: 'hosp-b',
        type: 'VENTILATOR_EQUIPPED',
        status: 'IDLE',
        currentLat: 12.9352,
        currentLng: 77.6245,
        driverName: 'Mohammed Ali',
        driverPhone: '+91-99887-44556',
        lastPingAt: new Date().toISOString()
      },
      {
        id: 'amb-103',
        hospitalId: 'hosp-c',
        type: 'BLS',
        status: 'IDLE',
        currentLat: 12.9900,
        currentLng: 77.5700,
        driverName: 'Vijay Singh',
        driverPhone: '+91-99887-77889',
        lastPingAt: new Date().toISOString()
      }
    ];

    // 6. Users & Roles
    this.users = [
      { id: 'user-doc-1', name: 'Dr. Ramesh Kumar', role: 'DUTY_DOCTOR', hospitalId: 'hosp-a', phone: '9876543210' },
      { id: 'user-staff-1', name: 'Nurse Anjali Verma', role: 'REFERRAL_DESK', hospitalId: 'hosp-a', phone: '9876543211' },
      { id: 'user-admin-b', name: 'Bed Desk B - Rajesh', role: 'BED_ADMISSION_DESK', hospitalId: 'hosp-b', phone: '9876543212' },
      { id: 'user-admin-c', name: 'Bed Desk C - Lakshmi', role: 'BED_ADMISSION_DESK', hospitalId: 'hosp-c', phone: '9876543213' },
      { id: 'user-disp-1', name: 'Control Dispatcher Imran', role: 'AMBULANCE_DISPATCHER', hospitalId: 'hosp-a', phone: '9876543214' },
      { id: 'user-auth-1', name: 'District Officer Dr. Mehta', role: 'AUTHORITY_ADMIN', hospitalId: null, phone: '9876543215' }
    ];

    // 7. Seed Initial Active Referral
    const refId = 'ref-1001';
    this.referrals = [
      {
        id: refId,
        patientRefCode: 'PAT-2026-8941',
        originHospitalId: 'hosp-a',
        targetHospitalId: 'hosp-b',
        createdByStaffId: 'user-staff-1',
        requirementSummary: 'Acute Traumatic Brain Injury — Requires ICU + Neurosurgery + Ventilator + CT Scan',
        requiredCapabilities: ['NEUROSURGERY', 'CT_SCAN'],
        requiredResources: ['ICU_BED', 'VENTILATOR'],
        priority: 'CRITICAL',
        status: 'IN_TRANSIT', // Currently en-route to Hosp B! Perfect for live reroute testing
        matchedHospitalIds: ['hosp-b', 'hosp-c'],
        acceptedHospitalId: 'hosp-b',
        ambulanceId: 'amb-101',
        reroutedCount: 0,
        createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 60000).toISOString()
      }
    ];

    // 8. Referral Audit Log Events
    this.referralEvents = [
      {
        id: 'evt-1',
        referralId: refId,
        eventType: 'CREATED',
        actorStaffId: 'user-staff-1',
        metadata: { note: 'Requirement entered by Emergency Nurse Coordinator' },
        timestamp: new Date(Date.now() - 12 * 60000).toISOString()
      },
      {
        id: 'evt-2',
        referralId: refId,
        eventType: 'MATCHED',
        actorStaffId: null,
        metadata: { rankedHospitals: ['hosp-b', 'hosp-c'], topMatchScore: 0.94 },
        timestamp: new Date(Date.now() - 11.5 * 60000).toISOString()
      },
      {
        id: 'evt-3',
        referralId: refId,
        eventType: 'REQUEST_SENT',
        actorStaffId: 'user-staff-1',
        metadata: { targetHospital: 'hosp-b', heldResource: 'ICU_BED' },
        timestamp: new Date(Date.now() - 11 * 60000).toISOString()
      },
      {
        id: 'evt-4',
        referralId: refId,
        eventType: 'ACCEPTED',
        actorStaffId: 'user-admin-b',
        metadata: { confirmedBy: 'Bed Desk B - Rajesh', bedReserved: true },
        timestamp: new Date(Date.now() - 8 * 60000).toISOString()
      },
      {
        id: 'evt-5',
        referralId: refId,
        eventType: 'DISPATCHED',
        actorStaffId: 'user-disp-1',
        metadata: { ambulanceId: 'amb-101', driver: 'Suresh Kumar' },
        timestamp: new Date(Date.now() - 5 * 60000).toISOString()
      }
    ];

    // 9. Encrypted Clinical Packet for ref-1001
    const packetData = {
      patientName: 'Karan Sharma',
      patientAge: 42,
      patientSex: 'MALE',
      clinicalSummary: 'Patient sustained severe head trauma in RTA. GCS 8/15. E4V1M3. Left pupil dilated.',
      vitals: { bp: '140/90', hr: 110, spo2: 94, rr: 24, temp: '98.6 F', gcs: 8 },
      diagnosisSuspected: 'Acute Subdural Hematoma with Midline Shift',
      treatmentGiven: 'IV Mannitol 100ml, Intubated on manual bag, Cervical collar applied',
      medications: ['Mannitol', 'Inj. Ceftriaxone 1g', 'Inj. TT'],
      allergies: ['Penicillin'],
      investigations: [
        { type: 'CT_BRAIN', result: 'Hyperdense crescentic lesion along left parieto-temporal region', fileUrl: 's3://eron-packets/scans/ct-8941.pdf' }
      ],
      reasonForReferral: 'No neurosurgeon available at District Hospital A',
      referringDoctorName: 'Dr. Ramesh Kumar (CMO)'
    };

    const encrypted = encryptPacket(packetData);
    this.referralPackets.push({
      id: 'pkt-1',
      referralId: refId,
      ...encrypted
    });

    // 10. Seed Communication Threads & Messages
    this.threads = [
      {
        id: 'thread-ref-1001',
        type: 'REFERRAL_CHANNEL',
        referralId: refId,
        patientRefCode: 'PAT-2026-8941',
        title: 'Referral #PAT-2026-8941 (City Central → St. Jude)',
        originHospitalId: 'hosp-a',
        targetHospitalId: 'hosp-b',
        priority: 'CRITICAL',
        unreadCounts: { 'user-admin-b': 1, 'user-staff-1': 0 },
        lastMessageText: 'ALS Ambulance AMB-101 dispatched. ETA 14 mins.',
        lastMessageAt: new Date(Date.now() - 5 * 60000).toISOString(),
        createdAt: new Date(Date.now() - 12 * 60000).toISOString()
      },
      {
        id: 'thread-hosp-a-hosp-b',
        type: 'HOSPITAL_DIRECT',
        title: 'Direct Channel: Hosp A ↔ Hosp B',
        originHospitalId: 'hosp-a',
        targetHospitalId: 'hosp-b',
        priority: 'URGENT',
        unreadCounts: {},
        lastMessageText: 'ICU Bed Availability query confirmed',
        lastMessageAt: new Date(Date.now() - 30 * 60000).toISOString(),
        createdAt: new Date(Date.now() - 60 * 60000).toISOString()
      },
      {
        id: 'thread-control-broadcast',
        type: 'CONTROL_BROADCAST',
        title: 'District-01 Control Room Emergency Broadcast',
        originHospitalId: 'hosp-a',
        targetHospitalId: null,
        priority: 'CRITICAL',
        unreadCounts: {},
        lastMessageText: 'ALERT: Severe traffic bottleneck on MG Road corridor',
        lastMessageAt: new Date(Date.now() - 45 * 60000).toISOString(),
        createdAt: new Date(Date.now() - 120 * 60000).toISOString()
      }
    ];

    this.messages = [
      {
        id: 'msg-1',
        threadId: 'thread-ref-1001',
        referralId: refId,
        senderId: 'user-staff-1',
        senderName: 'Nurse Anjali Verma',
        senderRole: 'Duty Nurse',
        senderHospitalId: 'hosp-a',
        text: 'CRITICAL: Patient Karan Sharma (42M) with severe head trauma. GCS 8/15. Requires ICU bed + Neurosurgery + Ventilator.',
        priority: 'CRITICAL',
        messageType: 'REFERRAL_REQUEST',
        hasAttachment: true,
        attachmentPacketId: 'pkt-1',
        status: 'READ',
        createdAt: new Date(Date.now() - 10 * 60000).toISOString()
      },
      {
        id: 'msg-2',
        threadId: 'thread-ref-1001',
        referralId: refId,
        senderId: 'user-admin-b',
        senderName: 'Bed Desk B - Rajesh',
        senderRole: 'Receiving Bed Desk',
        senderHospitalId: 'hosp-b',
        text: 'ICU Bed #101 reserved at St. Jude Trauma Center. Bed hold confirmed.',
        priority: 'CRITICAL',
        messageType: 'BED_HOLD_CONFIRMED',
        hasAttachment: false,
        status: 'READ',
        createdAt: new Date(Date.now() - 8 * 60000).toISOString()
      },
      {
        id: 'msg-3',
        threadId: 'thread-ref-1001',
        referralId: refId,
        senderId: 'user-disp-1',
        senderName: 'Suresh Kumar (Driver)',
        senderRole: 'Ambulance Driver',
        senderHospitalId: 'hosp-a',
        text: 'ALS Ambulance AMB-101 dispatched. ETA 14 mins to St. Jude Trauma Center.',
        priority: 'URGENT',
        messageType: 'DISPATCH_UPDATE',
        hasAttachment: false,
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 5 * 60000).toISOString()
      }
    ];
  }

  createBedUnitsForHospital(hospitalId, resourceType, count) {
    for (let i = 1; i <= count; i++) {
      this.bedUnits.push({
        id: `unit-${hospitalId}-${resourceType.toLowerCase()}-${i}`,
        hospitalId,
        resourceType,
        unitNumber: `${resourceType.substring(0, 3)}-${100 + i}`,
        status: 'AVAILABLE', // AVAILABLE, TEMPORARILY_HELD, HOSPITAL_CONFIRMED, RESERVED, PATIENT_ARRIVED, OCCUPIED
        heldForReferralId: null,
        holdExpiresAt: null,
        statusUpdatedAt: new Date().toISOString()
      });
    }
  }

  // --- Helper Queries & Mutators ---

  getHospitals() {
    return this.hospitals.map(h => {
      const caps = this.capabilities.filter(c => c.hospitalId === h.id);
      const res = this.resources.filter(r => r.hospitalId === h.id);
      return { ...h, capabilities: caps, resources: res };
    });
  }

  getHospitalById(id) {
    const h = this.hospitals.find(item => item.id === id);
    if (!h) return null;
    const caps = this.capabilities.filter(c => c.hospitalId === h.id);
    const res = this.resources.filter(r => r.hospitalId === h.id);
    return { ...h, capabilities: caps, resources: res };
  }

  updateHospitalCapacity(hospitalId, resourceType, delta, staffId = 'system') {
    const res = this.resources.find(r => r.hospitalId === hospitalId && r.resourceType === resourceType);
    if (!res) return null;

    res.availableCount = Math.max(0, res.availableCount + delta);
    res.updatedAt = new Date().toISOString();

    const hosp = this.hospitals.find(h => h.id === hospitalId);
    if (hosp) {
      hosp.lastCapacityUpdateAt = new Date().toISOString();
    }

    return res;
  }

  setHospitalCapacity(hospitalId, resourceType, exactCount, staffId = 'system') {
    const res = this.resources.find(r => r.hospitalId === hospitalId && r.resourceType === resourceType);
    if (!res) return null;

    res.availableCount = Math.max(0, exactCount);
    res.updatedAt = new Date().toISOString();

    const hosp = this.hospitals.find(h => h.id === hospitalId);
    if (hosp) {
      hosp.lastCapacityUpdateAt = new Date().toISOString();
    }

    return res;
  }

  getReferrals() {
    return this.referrals.map(r => this.enrichReferral(r));
  }

  getReferralById(id) {
    const ref = this.referrals.find(r => r.id === id);
    return ref ? this.enrichReferral(ref) : null;
  }

  enrichReferral(ref) {
    const origin = this.hospitals.find(h => h.id === ref.originHospitalId);
    const target = this.hospitals.find(h => h.id === ref.targetHospitalId);
    const ambulance = this.ambulances.find(a => a.id === ref.ambulanceId);
    const events = this.referralEvents.filter(e => e.referralId === ref.id).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      ...ref,
      originHospitalName: origin ? origin.name : 'Unknown',
      targetHospitalName: target ? target.name : 'Unassigned',
      targetHospitalType: target ? target.type : null,
      ambulance: ambulance || null,
      events
    };
  }

  addReferralEvent(referralId, eventType, actorStaffId, metadata = {}) {
    const event = {
      id: `evt-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      referralId,
      eventType,
      actorStaffId,
      metadata,
      timestamp: new Date().toISOString()
    };
    this.referralEvents.push(event);
    return event;
  }

  getPacketForReferral(referralId) {
    return this.referralPackets.find(p => p.referralId === referralId);
  }

  getThreads() {
    return this.threads;
  }

  getMessages(threadId) {
    if (!threadId) return this.messages;
    return this.messages.filter(m => m.threadId === threadId);
  }

  addMessage(msgData) {
    const newMsg = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      threadId: msgData.threadId || 'thread-ref-1001',
      referralId: msgData.referralId || 'ref-1001',
      senderId: msgData.senderId || 'user-staff-1',
      senderName: msgData.senderName || 'Duty Staff',
      senderRole: msgData.senderRole || 'Duty Nurse',
      senderHospitalId: msgData.senderHospitalId || 'hosp-a',
      text: msgData.text || '',
      priority: msgData.priority || 'URGENT',
      messageType: msgData.messageType || 'REGULAR',
      hasAttachment: !!msgData.attachmentPacketId,
      attachmentPacketId: msgData.attachmentPacketId || null,
      status: 'DELIVERED',
      createdAt: new Date().toISOString()
    };

    this.messages.push(newMsg);

    // Update parent thread metadata
    const thread = this.threads.find(t => t.id === newMsg.threadId);
    if (thread) {
      thread.lastMessageText = newMsg.text;
      thread.lastMessageAt = newMsg.createdAt;
    } else {
      // Auto-create thread if missing
      this.threads.push({
        id: newMsg.threadId,
        type: 'REFERRAL_CHANNEL',
        referralId: newMsg.referralId,
        title: `Thread ${newMsg.threadId}`,
        priority: newMsg.priority,
        unreadCounts: {},
        lastMessageText: newMsg.text,
        lastMessageAt: newMsg.createdAt,
        createdAt: new Date().toISOString()
      });
    }

    return newMsg;
  }

  markMessagesRead(threadId, userId) {
    let updatedCount = 0;
    this.messages.forEach(m => {
      if (m.threadId === threadId && m.status !== 'READ') {
        m.status = 'READ';
        updatedCount++;
      }
    });

    const thread = this.threads.find(t => t.id === threadId);
    if (thread && thread.unreadCounts && userId) {
      thread.unreadCounts[userId] = 0;
    }

    return { success: true, threadId, updatedCount };
  }
}

export const db = new Database();
