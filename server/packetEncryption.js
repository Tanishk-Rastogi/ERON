import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Master key (32 bytes) for demo envelope encryption
const MASTER_KEY = crypto.scryptSync('eron-master-secret-key-2026', 'salt-vitality-hub', 32);

/**
 * Encrypts a clinical handoff payload object using AES-256-GCM.
 * @param {Object} payload - Clinical data (vitals, diagnosis, summary, treatment, doctor)
 * @returns {Object} - Encrypted payload, iv, and authTag (hex strings)
 */
export function encryptPacket(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  
  const jsonStr = JSON.stringify(payload);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedPayload: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag,
    encryptedAt: new Date().toISOString()
  };
}

/**
 * Decrypts a clinical handoff payload using stored iv, authTag, and ciphertext.
 * @param {string} encryptedPayload 
 * @param {string} ivHex 
 * @param {string} authTagHex 
 * @returns {Object} Decrypted clinical payload
 */
export function decryptPacket(encryptedPayload, ivHex, authTagHex) {
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedPayload, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Packet Decryption Error:', error);
    throw new Error('Decryption failed or invalid authorization key');
  }
}
