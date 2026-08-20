import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { IntegrationStatus } from '../../generated/prisma/enums';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { CredentialsCipher } from './credentials-cipher';
import { GenericWebhookProvider } from './providers/generic-webhook.provider';
import { PosProviderAdapter } from './pos-provider-adapter.interface';

// $queryRaw returns raw column names (snake_case), not Prisma's camelCase model mapping.
interface IntegrationConnectionRow {
  id: string;
  tenant_id: string;
  provider: string;
  encrypted_credentials: Buffer;
  status: string;
}

@Injectable()
export class IntegrationsService {
  private readonly providers: Map<string, PosProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: CredentialsCipher,
    private readonly ledger: LedgerService,
    genericWebhookProvider: GenericWebhookProvider,
  ) {
    // Swapping/adding a real POS vendor means registering a new adapter here — nothing else
    // in this service changes (ADR-4).
    this.providers = new Map([
      [genericWebhookProvider.providerName, genericWebhookProvider],
    ]);
  }

  async connect(tenantId: string, dto: ConnectIntegrationDto) {
    // Prisma's Bytes field wants a plain Uint8Array<ArrayBuffer>; Node's Buffer type is
    // technically Uint8Array<ArrayBufferLike> (includes SharedArrayBuffer), so TS rejects the
    // Buffer our cipher returns without this narrowing copy.
    const encryptedCredentials = new Uint8Array(
      this.cipher.encrypt(dto.credentials),
    );

    const connection = await this.prisma.withTenant(tenantId, (tx) =>
      tx.integrationConnection.upsert({
        where: { tenantId_provider: { tenantId, provider: dto.provider } },
        create: {
          tenantId,
          provider: dto.provider,
          encryptedCredentials,
          status: IntegrationStatus.active,
        },
        update: { encryptedCredentials, status: IntegrationStatus.active },
      }),
    );

    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
    };
  }

  /**
   * No tenant context in the URL by design — the webhook's own signature (verified against
   * this specific connection's secret) IS the authorization, and the unguessable connectionId
   * scopes it to exactly one tenant before any payload content is trusted.
   */
  async handleWebhook(
    connectionId: string,
    providerName: string,
    rawBody: string,
    signatureHeader: string | undefined,
  ) {
    const adapter = this.providers.get(providerName);
    if (!adapter) throw new NotFoundException('Unknown provider');

    // Not tenant-scoped yet — we don't know the tenant until this call tells us, so a normal
    // withTenant/RLS-protected query can't run here at all (RLS would just return zero rows
    // regardless of the WHERE clause). See migration 20260820214000 for why this specific,
    // narrow SECURITY DEFINER function is the correct exception, not a shortcut around RLS.
    const rows = await this.prisma.$queryRaw<IntegrationConnectionRow[]>`
      SELECT * FROM lookup_integration_connection_for_webhook(${connectionId}::uuid, ${providerName})
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Unknown or inactive connection');

    const credentials = this.cipher.decrypt(row.encrypted_credentials);
    const secret = credentials.webhookSecret;
    if (
      !secret ||
      !adapter.verifyWebhookSignature(rawBody, signatureHeader, secret)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const transactions = adapter.parseWebhookPayload(rawBody);
    let processed = 0;
    for (const t of transactions) {
      await this.ledger.createFromIntegration(
        row.tenant_id,
        row.id,
        {
          entryType: t.entryType,
          amount: t.amount,
          description: t.description,
          occurredAt: t.occurredAt,
        },
        t.externalId,
      );
      processed++;
    }
    return { processed };
  }
}
