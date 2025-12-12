import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already registered');
    }

    const [user] = await this.db
      .insert(schema.users)
      .values({
        email: dto.email.toLowerCase(),
        name: dto.name,
      })
      .returning();

    return this.toResponse(user);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    const user = results[0];

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async findByEmail(email: string): Promise<schema.User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    return results[0] ?? null;
  }

  async findOrCreateFromSupabase(
    supabaseUserId: string,
    email: string,
    name: string,
  ): Promise<UserResponseDto> {
    const existing = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, supabaseUserId))
      .limit(1);

    if (existing.length > 0) {
      return this.toResponse(existing[0]);
    }

    const [user] = await this.db
      .insert(schema.users)
      .values({
        id: supabaseUserId,
        email: email.toLowerCase(),
        name,
      })
      .returning();

    return this.toResponse(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    if (dto.email) {
      const existing = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, dto.email.toLowerCase()))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    const updateData: Partial<{ email: string; name: string; avatarUrl: string; updatedAt: Date }> =
      {
        updatedAt: new Date(),
      };

    if (dto.email) {
      updateData.email = dto.email.toLowerCase();
    }

    if (dto.name) {
      updateData.name = dto.name;
    }

    const results = await this.db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, id))
      .returning();

    const user = results[0];

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async delete(id: string): Promise<void> {
    const results = await this.db.delete(schema.users).where(eq(schema.users.id, id)).returning();

    const user = results[0];

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private toResponse(user: schema.User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
