import { ConfigModule } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  BranchesController,
  ClansController,
  ProfilesController,
  RelationshipsController,
} from './genealogy.controller';
import { GenealogyModule } from './genealogy.module';

describe('GenealogyModule & Swagger Contract', () => {
  it('khởi tạo đầy đủ controller/provider và sinh đặc tả Swagger hợp lệ cho UC-07, UC-08, UC-10', async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-secret-key';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuditModule,
        GenealogyModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    expect(moduleRef.get(ClansController)).toBeDefined();
    expect(moduleRef.get(BranchesController)).toBeDefined();
    expect(moduleRef.get(ProfilesController)).toBeDefined();
    expect(moduleRef.get(RelationshipsController)).toBeDefined();

    const config = new DocumentBuilder()
      .setTitle('Test API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);

    expect(doc.paths['/clans']?.post).toBeDefined();
    expect(doc.paths['/clans/current']?.get).toBeDefined();
    expect(doc.paths['/branches']?.get).toBeDefined();
    expect(doc.paths['/branches']?.post).toBeDefined();
    expect(doc.paths['/branches/{id}']?.patch).toBeDefined();
    expect(doc.paths['/profiles']?.get).toBeDefined();
    expect(doc.paths['/profiles']?.post).toBeDefined();
    expect(doc.paths['/profiles/{id}']?.get).toBeDefined();
    expect(doc.paths['/profiles/{id}']?.patch).toBeDefined();
    expect(doc.paths['/profiles/{id}']?.delete).toBeDefined();
    expect(doc.paths['/relationships']?.get).toBeDefined();
    expect(doc.paths['/relationships']?.post).toBeDefined();

    await app.close();
  });
});
