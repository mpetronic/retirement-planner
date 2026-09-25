/**
 * WebAuthn / Passkey helper utilities for binary data encoding/decoding
 * and Cognito payload transformation.
 */

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface CognitoCredentialCreationOptions {
  challenge: string;
  rp: {
    id?: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  excludeCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransport[];
  }>;
  extensions?: AuthenticationExtensionsClientInputs;
}

export interface CognitoCredentialRequestOptions {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransport[];
  }>;
  extensions?: AuthenticationExtensionsClientInputs;
}

/**
 * Prepares raw JSON options from Cognito StartWebAuthnRegistration into
 * browser-compatible PublicKeyCredentialCreationOptions (decoding buffers).
 */
export function prepareCredentialCreationOptions(
  options: CognitoCredentialCreationOptions
): PublicKeyCredentialCreationOptions {
  const challenge = typeof options.challenge === 'string'
    ? base64UrlToBuffer(options.challenge)
    : (options.challenge as unknown as BufferSource);

  const userId = typeof options.user.id === 'string'
    ? base64UrlToBuffer(options.user.id)
    : (options.user.id as unknown as BufferSource);

  const excludeCredentials: PublicKeyCredentialDescriptor[] | undefined = options.excludeCredentials?.map(cred => ({
    type: cred.type,
    id: typeof cred.id === 'string' ? base64UrlToBuffer(cred.id) : (cred.id as unknown as BufferSource),
    ...(cred.transports ? { transports: cred.transports } : {}),
  }));

  const result: PublicKeyCredentialCreationOptions = {
    rp: options.rp,
    user: {
      ...options.user,
      id: userId,
    },
    challenge,
    pubKeyCredParams: options.pubKeyCredParams,
    ...(options.authenticatorSelection ? { authenticatorSelection: options.authenticatorSelection } : {}),
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.attestation ? { attestation: options.attestation } : {}),
    ...(excludeCredentials ? { excludeCredentials } : {}),
    ...(options.extensions ? { extensions: options.extensions } : {}),
  };

  return result;
}

/**
 * Prepares raw JSON options from Cognito InitiateAuth WEB_AUTHN challenge into
 * browser-compatible PublicKeyCredentialRequestOptions (decoding buffers).
 */
export function prepareCredentialRequestOptions(
  options: CognitoCredentialRequestOptions
): PublicKeyCredentialRequestOptions {
  const challenge = typeof options.challenge === 'string'
    ? base64UrlToBuffer(options.challenge)
    : (options.challenge as unknown as BufferSource);

  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = options.allowCredentials?.map(cred => ({
    type: cred.type,
    id: typeof cred.id === 'string' ? base64UrlToBuffer(cred.id) : (cred.id as unknown as BufferSource),
    ...(cred.transports ? { transports: cred.transports } : {}),
  }));

  const result: PublicKeyCredentialRequestOptions = {
    challenge,
    ...(options.rpId ? { rpId: options.rpId } : {}),
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.userVerification ? { userVerification: options.userVerification } : {}),
    ...(allowCredentials ? { allowCredentials } : {}),
    ...(options.extensions ? { extensions: options.extensions } : {}),
  };

  return result;
}

/**
 * Serializes PublicKeyCredential from navigator.credentials.create()
 * into Cognito-compatible RegistrationResponseJSON.
 */
export function serializeCreationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  const transports = typeof response.getTransports === 'function' ? response.getTransports() : undefined;
  const authenticatorAttachment = (credential as unknown as { authenticatorAttachment?: string }).authenticatorAttachment;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      ...(transports && transports.length > 0 ? { transports } : {}),
    },
    ...(authenticatorAttachment ? { authenticatorAttachment } : {}),
  };
}

/**
 * Serializes PublicKeyCredential from navigator.credentials.get()
 * into Cognito-compatible AuthenticationAssertionResponseJSON.
 */
export function serializeAssertionCredential(assertion: PublicKeyCredential) {
  const response = assertion.response as AuthenticatorAssertionResponse;
  const authenticatorAttachment = (assertion as unknown as { authenticatorAttachment?: string }).authenticatorAttachment;

  return {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      ...(response.userHandle ? { userHandle: bufferToBase64Url(response.userHandle) } : {}),
    },
    ...(authenticatorAttachment ? { authenticatorAttachment } : {}),
  };
}
