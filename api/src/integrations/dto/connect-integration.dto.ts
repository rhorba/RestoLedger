import { IsIn, IsObject } from 'class-validator';

const SUPPORTED_PROVIDERS = ['generic-webhook'] as const;

export class ConnectIntegrationDto {
  @IsIn(SUPPORTED_PROVIDERS)
  provider!: (typeof SUPPORTED_PROVIDERS)[number];

  // Provider-specific — e.g. { apiKey, webhookSecret }. Never returned in any API response
  // after this point (encrypted at rest, decrypted only for webhook verification / REST pull).
  @IsObject()
  credentials!: Record<string, string>;
}
