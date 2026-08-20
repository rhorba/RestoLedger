import { IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { LedgerEntryType } from '../../../generated/prisma/enums';

// Reconciliation entries are produced by the reporting module, not posted directly — this
// endpoint only accepts the two entry types a human (owner/accountant/staff) actually posts.
const POSTABLE_TYPES = [LedgerEntryType.revenue, LedgerEntryType.expense] as const;

export class CreateLedgerEntryDto {
  @IsIn(POSTABLE_TYPES)
  entryType!: (typeof POSTABLE_TYPES)[number];

  // MAD, e.g. 42.50 — converted to amount_cents server-side (never trust a client-sent cents value).
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
