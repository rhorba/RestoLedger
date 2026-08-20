import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CredentialsCipher } from './credentials-cipher';
import { GenericWebhookProvider } from './providers/generic-webhook.provider';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [CommonModule, LedgerModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CredentialsCipher, GenericWebhookProvider],
})
export class IntegrationsModule {}
