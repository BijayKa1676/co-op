import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * AES-256-GCM encryption service for sensitive data at rest.
 * Used for webhook secrets, API tokens, etc.
 * 
 * SECURITY: In production, ENCRYPTION_KEY is REQUIRED.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer | null;
  private readonly isConfigured: boolean;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (encryptionKey) {
      // Derive a 32-byte key from the provided key using SHA-256
      this.key = createHash('sha256').update(encryptionKey).digest();
      this.isConfigured = true;
      this.logger.log('Encryption service initialized with AES-256-GCM');
    } else {
      this.key = null;
      this.isConfigured = false;
      if (this.isProduction) {
        this.logger.error('CRITICAL: ENCRYPTION_KEY not set in production!');
      } else {
        this.logger.warn('ENCRYPTION_KEY not set - sensitive data will be stored in plaintext (dev mode only)');
      }
    }
  }

  onModuleInit(): void {
    // Fail fast in production if encryption is not configured
    if (this.isProduction && !this.isConfigured) {
      throw new Error('ENCRYPTION_KEY is required in production. Set a 32+ character secret key.');
    }
  }

  /**
   * Check if encryption is available
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Encrypt a string value.
   * Returns format: iv:authTag:ciphertext (all hex encoded)
   */
  encrypt(plaintext: string): string {
    if (!this.key) {
      // Return plaintext if encryption not configured (dev mode)
      return plaintext;
    }

    try {
      const iv = randomBytes(12); // 96-bit IV for GCM
      const cipher = createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt a string value.
   * Expects format: iv:authTag:ciphertext (all hex encoded)
   * 
   * SECURITY: In production, decryption failures throw errors to prevent
   * silent data corruption or key mismatch issues.
   */
  decrypt(ciphertext: string): string {
    // SECURITY: Never return plaintext in production without encryption
    if (!this.key) {
      if (this.isProduction) {
        throw new Error('Encryption not configured - cannot decrypt in production');
      }
      // Only allow plaintext fallback in development
      this.logger.warn('Encryption not configured - returning data as-is (dev mode only)');
      return ciphertext;
    }

    // Check if this looks like encrypted data (has the iv:authTag:ciphertext format)
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      // Not encrypted format - could be legacy plaintext data
      if (this.isProduction) {
        // In production, log warning but allow legacy data migration
        this.logger.warn('Unencrypted data found in production - consider migrating to encrypted format');
      }
      return ciphertext;
    }

    // Validate hex format before attempting decryption
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(authTagHex) || !/^[0-9a-f]+$/i.test(encryptedHex)) {
      this.logger.warn('Data appears to be in encrypted format but contains invalid hex');
      return ciphertext;
    }

    // Validate expected lengths (iv=24 hex chars, authTag=32 hex chars)
    if (ivHex.length !== 24 || authTagHex.length !== 32) {
      this.logger.warn('Data has invalid IV or authTag length');
      return ciphertext;
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      // Log decryption failures for security audit
      this.logger.error('Decryption failed - possible tampering, key change, or corrupted data');
      // SECURITY: Always throw in production to prevent silent failures
      if (this.isProduction) {
        throw new Error('Decryption failed - data may be corrupted or encryption key changed');
      }
      // In dev, throw to surface issues early
      throw new Error('Decryption failed - check encryption key and data format');
    }
  }

  /**
   * Check if a value appears to be encrypted
   */
  isEncrypted(value: string): boolean {
    const parts = value.split(':');
    if (parts.length !== 3) return false;

    // Check if parts look like hex strings of expected lengths
    const [iv, authTag] = parts;
    return iv.length === 24 && authTag.length === 32; // 12 bytes = 24 hex, 16 bytes = 32 hex
  }
}
