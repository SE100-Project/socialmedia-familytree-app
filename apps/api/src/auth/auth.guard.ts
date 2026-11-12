import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: string;
  profileId: string | null;
  roles: { type: 'CLAN_HEAD' | 'BRANCH_HEAD' | 'TECH_SUPPORT'; clanId: string; branchId: string | null }[];
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
        roles: { where: { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] } },
      },
    });
    if (!acc || acc.status !== 'ACTIVE') throw new UnauthorizedException();
    const user: AuthUser = {
      id: acc.id,
      profileId: acc.profile?.id ?? null,
      roles: acc.roles.map((r) => ({ type: r.type, clanId: r.clanId, branchId: r.branchId })),
    };
    req.user = user;
    return true;
  }
}
