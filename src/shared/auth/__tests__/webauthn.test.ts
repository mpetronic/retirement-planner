import { describe, it, expect } from 'vitest';
import {
  bufferToBase64Url,
  base64UrlToBuffer,
  prepareCredentialCreationOptions,
  prepareCredentialRequestOptions,
  serializeCreationCredential,
  serializeAssertionCredential,
} from '../webauthn';

describe('WebAuthn helper utilities', () => {
  it('correctly encodes and decodes base64url strings', () => {
    const text = 'Hello World WebAuthn Test!';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const buffer = encoder.encode(text);

    const base64Url = bufferToBase64Url(buffer);
    expect(base64Url).not.toContain('+');
    expect(base64Url).not.toContain('/');
    expect(base64Url).not.toContain('=');

    const decodedBuffer = base64UrlToBuffer(base64Url);
    const restoredText = decoder.decode(decodedBuffer);
    expect(restoredText).toBe(text);
  });

  it('prepares PublicKeyCredentialCreationOptions with Uint8Array buffers', () => {
    const rawOptions = {
      challenge: 'Y2hhbGxlbmdlXzEyMw',
      rp: { id: 'localhost', name: 'Retirement Planner' },
      user: {
        id: 'dXNlcl85OQ',
        name: 'test@example.com',
        displayName: 'Test User',
      },
      pubKeyCredParams: [{ type: 'public-key' as const, alg: -7 }],
      excludeCredentials: [{ id: 'ZXhjbHVkZWRfaWQ', type: 'public-key' as const }],
    };

    const prepared = prepareCredentialCreationOptions(rawOptions);
    expect(prepared.challenge).toBeInstanceOf(Uint8Array);
    expect(prepared.user.id).toBeInstanceOf(Uint8Array);
    expect(prepared.excludeCredentials?.[0]?.id).toBeInstanceOf(Uint8Array);
  });

  it('prepares PublicKeyCredentialRequestOptions with Uint8Array buffers', () => {
    const rawOptions = {
      challenge: 'Y2hhbGxlbmdlXzEyMw',
      rpId: 'localhost',
      allowCredentials: [{ id: 'YWxsb3dlZF9pZA', type: 'public-key' as const }],
    };

    const prepared = prepareCredentialRequestOptions(rawOptions);
    expect(prepared.challenge).toBeInstanceOf(Uint8Array);
    expect(prepared.allowCredentials?.[0]?.id).toBeInstanceOf(Uint8Array);
  });

  it('serializes creation credential correctly', () => {
    const mockCredential = {
      id: 'cred_123',
      rawId: new Uint8Array([1, 2, 3, 4]),
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([5, 6, 7]),
        attestationObject: new Uint8Array([8, 9, 10]),
        getTransports: () => ['internal'],
      },
      authenticatorAttachment: 'platform',
    } as unknown as PublicKeyCredential;

    const serialized = serializeCreationCredential(mockCredential);
    expect(serialized.id).toBe('cred_123');
    expect(typeof serialized.rawId).toBe('string');
    expect(typeof serialized.response.clientDataJSON).toBe('string');
    expect(typeof serialized.response.attestationObject).toBe('string');
    expect(serialized.response.transports).toEqual(['internal']);
  });

  it('serializes assertion credential correctly', () => {
    const mockAssertion = {
      id: 'cred_123',
      rawId: new Uint8Array([1, 2, 3, 4]),
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([5, 6, 7]),
        authenticatorData: new Uint8Array([8, 9, 10]),
        signature: new Uint8Array([11, 12, 13]),
        userHandle: new Uint8Array([14, 15, 16]),
      },
      authenticatorAttachment: 'platform',
    } as unknown as PublicKeyCredential;

    const serialized = serializeAssertionCredential(mockAssertion);
    expect(serialized.id).toBe('cred_123');
    expect(typeof serialized.rawId).toBe('string');
    expect(typeof serialized.response.clientDataJSON).toBe('string');
    expect(typeof serialized.response.authenticatorData).toBe('string');
    expect(typeof serialized.response.signature).toBe('string');
    expect(typeof serialized.response.userHandle).toBe('string');
  });
});
