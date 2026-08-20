import { IsEmail, IsIn } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';

// An owner can only grant accountant/staff via this endpoint — never owner or firm_admin
// (privilege escalation guard; matches security-restoledger.md §4 role model).
const ASSIGNABLE_ROLES = [Role.accountant, Role.staff] as const;

export class AddMembershipDto {
  @IsEmail()
  email!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: (typeof ASSIGNABLE_ROLES)[number];
}
