import { IsString, MinLength } from 'class-validator';

export class ReverseLedgerEntryDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
