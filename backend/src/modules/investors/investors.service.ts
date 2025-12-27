import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, or, ilike, desc, asc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { investors } from '@/database/schema/investors.schema';
import {
  CreateInvestorDto,
  UpdateInvestorDto,
  InvestorResponseDto,
  InvestorQueryDto,
} from './dto/investor.dto';

@Injectable()
export class InvestorsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateInvestorDto): Promise<InvestorResponseDto> {
    const [investor] = await this.db
      .insert(investors)
      .values({
        name: dto.name,
        description: dto.description,
        website: dto.website,
        stage: dto.stage,
        sectors: dto.sectors,
        checkSizeMin: dto.checkSizeMin,
        checkSizeMax: dto.checkSizeMax,
        location: dto.location,
        regions: dto.regions,
        contactEmail: dto.contactEmail,
        linkedinUrl: dto.linkedinUrl,
        twitterUrl: dto.twitterUrl,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
      })
      .returning();

    return this.toResponseDto(investor);
  }

  async findAll(query: InvestorQueryDto): Promise<InvestorResponseDto[]> {
    const conditions = [eq(investors.isActive, true)];

    if (query.stage) {
      conditions.push(eq(investors.stage, query.stage));
    }

    if (query.featuredOnly) {
      conditions.push(eq(investors.isFeatured, true));
    }

    if (query.search) {
      // Escape ILIKE special characters to prevent SQL pattern injection
      const escapedSearch = this.escapeIlikePattern(query.search);
      conditions.push(
        or(
          ilike(investors.name, `%${escapedSearch}%`),
          ilike(investors.description, `%${escapedSearch}%`),
          ilike(investors.location, `%${escapedSearch}%`),
        )!,
      );
    }

    if (query.sector) {
      // Escape ILIKE special characters
      const escapedSector = this.escapeIlikePattern(query.sector);
      conditions.push(ilike(investors.sectors, `%${escapedSector}%`));
    }

    if (query.region) {
      // Escape ILIKE special characters
      const escapedRegion = this.escapeIlikePattern(query.region);
      conditions.push(ilike(investors.regions, `%${escapedRegion}%`));
    }

    const results = await this.db
      .select()
      .from(investors)
      .where(and(...conditions))
      .orderBy(desc(investors.isFeatured), asc(investors.name));

    return results.map((inv) => this.toResponseDto(inv));
  }

  /**
   * Escape ILIKE special characters to prevent SQL pattern injection
   */
  private escapeIlikePattern(input: string): string {
    return input
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent signs
      .replace(/_/g, '\\_');   // Escape underscores
  }

  async findAllAdmin(): Promise<InvestorResponseDto[]> {
    const results = await this.db
      .select()
      .from(investors)
      .orderBy(desc(investors.createdAt));

    return results.map((inv) => this.toResponseDto(inv));
  }

  async findOne(id: string): Promise<InvestorResponseDto> {
    const [investor] = await this.db.select().from(investors).where(eq(investors.id, id));

    if (!investor) {
      throw new NotFoundException('Investor not found');
    }

    return this.toResponseDto(investor);
  }

  async update(id: string, dto: UpdateInvestorDto): Promise<InvestorResponseDto> {
    const [existing] = await this.db.select().from(investors).where(eq(investors.id, id));

    if (!existing) {
      throw new NotFoundException('Investor not found');
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.stage !== undefined) updateData.stage = dto.stage;
    if (dto.sectors !== undefined) updateData.sectors = dto.sectors;
    if (dto.checkSizeMin !== undefined) updateData.checkSizeMin = dto.checkSizeMin;
    if (dto.checkSizeMax !== undefined) updateData.checkSizeMax = dto.checkSizeMax;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.regions !== undefined) updateData.regions = dto.regions;
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail;
    if (dto.linkedinUrl !== undefined) updateData.linkedinUrl = dto.linkedinUrl;
    if (dto.twitterUrl !== undefined) updateData.twitterUrl = dto.twitterUrl;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isFeatured !== undefined) updateData.isFeatured = dto.isFeatured;

    const [updated] = await this.db
      .update(investors)
      .set(updateData)
      .where(eq(investors.id, id))
      .returning();

    return this.toResponseDto(updated);
  }

  async delete(id: string): Promise<void> {
    const [existing] = await this.db.select().from(investors).where(eq(investors.id, id));

    if (!existing) {
      throw new NotFoundException('Investor not found');
    }

    await this.db.delete(investors).where(eq(investors.id, id));
  }

  async getStats(): Promise<{
    total: number;
    byStage: { stage: string; count: number }[];
    bySector: { sector: string; count: number }[];
  }> {
    const all = await this.db.select().from(investors).where(eq(investors.isActive, true));

    const byStage = new Map<string, number>();
    const bySector = new Map<string, number>();

    for (const inv of all) {
      byStage.set(inv.stage, (byStage.get(inv.stage) ?? 0) + 1);
      
      // Parse comma-separated sectors
      const sectors = inv.sectors?.split(',').map(s => s.trim()).filter(Boolean) || [];
      for (const sector of sectors) {
        bySector.set(sector, (bySector.get(sector) ?? 0) + 1);
      }
    }

    return {
      total: all.length,
      byStage: Array.from(byStage.entries()).map(([stage, count]) => ({ stage, count })),
      bySector: Array.from(bySector.entries())
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  private toResponseDto(investor: typeof investors.$inferSelect): InvestorResponseDto {
    return {
      id: investor.id,
      name: investor.name,
      description: investor.description,
      website: investor.website,
      logoUrl: investor.logoUrl,
      stage: investor.stage as InvestorResponseDto['stage'],
      sectors: investor.sectors,
      checkSizeMin: investor.checkSizeMin,
      checkSizeMax: investor.checkSizeMax,
      location: investor.location,
      regions: investor.regions,
      contactEmail: investor.contactEmail,
      linkedinUrl: investor.linkedinUrl,
      twitterUrl: investor.twitterUrl,
      isActive: investor.isActive,
      isFeatured: investor.isFeatured,
      createdAt: investor.createdAt.toISOString(),
      updatedAt: investor.updatedAt.toISOString(),
    };
  }
}
