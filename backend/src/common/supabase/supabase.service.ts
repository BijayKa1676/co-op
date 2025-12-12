import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export interface SupabaseUser {
  id: string;
  email: string;
  role: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient;
  private readonly serviceClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured');
    }

    this.client = createClient(supabaseUrl, supabaseAnonKey);

    if (supabaseServiceKey) {
      this.serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      this.serviceClient = this.client;
    }

    this.logger.log('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getServiceClient(): SupabaseClient {
    return this.serviceClient;
  }

  async verifyToken(token: string): Promise<SupabaseUser | null> {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser(token);

    if (error || !user) {
      this.logger.debug(`Token verification failed: ${error?.message ?? 'No user'}`);
      return null;
    }

    return this.mapUser(user);
  }

  async getUserById(userId: string): Promise<SupabaseUser | null> {
    const {
      data: { user },
      error,
    } = await this.serviceClient.auth.admin.getUserById(userId);

    if (error || !user) {
      return null;
    }

    return this.mapUser(user);
  }

  private mapUser(user: User): SupabaseUser {
    return {
      id: user.id,
      email: user.email ?? '',
      role: (user.app_metadata?.role as string) ?? 'user',
      metadata: user.user_metadata ?? {},
    };
  }
}
