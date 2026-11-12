import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService (FR-46)', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('ghi nhật ký thành công ngoài transaction', async () => {
    mockPrisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' });

    await service.log({
      actorId: 'user-1',
      action: 'UPDATE_PROFILE',
      entityType: 'MEMBER_PROFILE',
      entityId: 'profile-1',
      before: { fullName: 'Nguyễn Văn A' },
      after: { fullName: 'Nguyễn Văn B' },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'UPDATE_PROFILE',
        entityType: 'MEMBER_PROFILE',
        entityId: 'profile-1',
        before: { fullName: 'Nguyễn Văn A' },
        after: { fullName: 'Nguyễn Văn B' },
      },
    });
  });

  it('ghi nhật ký sử dụng client transaction (tx) được truyền vào', async () => {
    const mockTx = {
      auditLog: {
        create: jest.fn().mockResolvedValueOnce({ id: 'audit-tx-1' }),
      },
    };

    await service.log({
      actorId: 'user-2',
      action: 'APPROVE_JOIN',
      entityType: 'JOIN_REQUEST',
      entityId: 'req-1',
      tx: mockTx as any,
    });

    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('QUY TẮC BẮT BUỘC: Không bao giờ ném lỗi nếu CSDL lỗi', async () => {
    mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('Database disk full'));

    // Hàm log phải không được throw exception
    await expect(
      service.log({
        actorId: 'user-1',
        action: 'DELETE_POST',
        entityType: 'POST',
        entityId: 'post-1',
      }),
    ).resolves.not.toThrow();
  });
});

