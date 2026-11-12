import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: string;
  accountCode?: string;
  phone?: string;
  email?: string | null;
  status?: string;
  profileId: string | null;
  clanId?: string | null;
  profileLinks: { clanId: string; profileId: string }[];
  roles: { type: RoleType; clanId: string; branchId: string | null }[];
}

/**
 * Xác thực JWT, rồi LUÔN nạp lại tài khoản + vai trò từ DB (không tin vai trò trong token),
 * để khóa tài khoản / thu hồi quyền (FR-18) có hiệu lực ngay ở request kế tiếp (NFR-02).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException();
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException();
    }
    const acc = await this.prisma.account.findUnique({
      where: { id: sub },
      include: {
        profile: { select: { id: true } },
        accountProfileLinks: { select: { clanId: true, profileId: true } },
        roles: { where: { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] } },
      },
    });
    if (!acc || acc.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc không tồn tại');
    }

    const primaryLink = acc.accountProfileLinks[0];
    const primaryProfileId = acc.profile?.id ?? primaryLink?.profileId ?? null;
    const primaryClanId = primaryLink?.clanId ?? acc.roles[0]?.clanId ?? null;

    const user: AuthUser = {
      id: acc.id,
      accountCode: acc.accountCode,
      phone: acc.phone,
      email: acc.email,
      status: acc.status,
      profileId: primaryProfileId,
      clanId: primaryClanId,
      profileLinks: acc.accountProfileLinks.map((l) => ({ clanId: l.clanId, profileId: l.profileId })),
      roles: acc.roles.map((r) => ({ type: r.type, clanId: r.clanId, branchId: r.branchId })),
    };
    req.user = user;
    return true;
  }
}
