import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { McpService } from './mcp.service';
import { RegisterServerDto, CallToolDto } from './dto';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { McpServerConfig, McpToolDefinition, McpToolResult } from './types/mcp.types';
import { RateLimit, RateLimitPresets } from '@/common/decorators/rate-limit.decorator';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('servers')
  @UseGuards(AdminGuard)
  @RateLimit({ limit: 10, ttl: 60, keyPrefix: 'mcp:register' }) // 10 registrations per minute
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register an MCP server (admin only)' })
  @ApiResponse({ status: 201, description: 'Server registered' })
  async registerServer(@Body() dto: RegisterServerDto): Promise<ApiResponseDto<null>> {
    await this.mcpService.registerServer(dto);
    return ApiResponseDto.message('MCP server registered');
  }

  @Delete('servers/:id')
  @UseGuards(AdminGuard)
  @RateLimit({ limit: 10, ttl: 60, keyPrefix: 'mcp:unregister' }) // 10 unregistrations per minute
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unregister an MCP server (admin only)' })
  @ApiResponse({ status: 200, description: 'Server unregistered' })
  async unregisterServer(@Param('id') id: string): Promise<ApiResponseDto<null>> {
    await this.mcpService.unregisterServer(id);
    return ApiResponseDto.message('MCP server unregistered');
  }

  @Get('servers')
  @UseGuards(AuthGuard, UserThrottleGuard)
  @RateLimit(RateLimitPresets.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all MCP servers' })
  @ApiResponse({ status: 200, description: 'Servers list' })
  listServers(): ApiResponseDto<McpServerConfig[]> {
    const servers = this.mcpService.listServers();
    return ApiResponseDto.success(servers);
  }

  @Get('servers/:id/tools')
  @UseGuards(AuthGuard, UserThrottleGuard)
  @RateLimit(RateLimitPresets.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tools from an MCP server' })
  @ApiResponse({ status: 200, description: 'Tools list' })
  async getServerTools(@Param('id') id: string): Promise<ApiResponseDto<McpToolDefinition[]>> {
    const tools = await this.mcpService.getServerTools(id);
    return ApiResponseDto.success(tools);
  }

  @Post('servers/:id/discover')
  @UseGuards(AdminGuard)
  @RateLimit({ limit: 10, ttl: 60, keyPrefix: 'mcp:discover' }) // 10 discoveries per minute
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Discover tools from an MCP server (admin only)' })
  @ApiResponse({ status: 200, description: 'Tools discovered' })
  async discoverTools(@Param('id') id: string): Promise<ApiResponseDto<McpToolDefinition[]>> {
    const tools = await this.mcpService.discoverTools(id);
    return ApiResponseDto.success(tools, 'Tools discovered');
  }

  @Get('tools')
  @UseGuards(AuthGuard, UserThrottleGuard)
  @RateLimit(RateLimitPresets.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all available tools from all servers' })
  @ApiResponse({ status: 200, description: 'All tools' })
  async listAllTools(): Promise<ApiResponseDto<{ serverId: string; tools: McpToolDefinition[] }[]>> {
    const tools = await this.mcpService.listAllTools();
    return ApiResponseDto.success(tools);
  }

  @Post('execute')
  @UseGuards(AuthGuard, UserThrottleGuard)
  @RateLimit({ limit: 30, ttl: 60, keyPrefix: 'mcp:execute' }) // 30 tool executions per minute
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute an MCP tool' })
  @ApiResponse({ status: 200, description: 'Tool executed' })
  async callTool(@Body() dto: CallToolDto): Promise<ApiResponseDto<McpToolResult>> {
    const result = await this.mcpService.callTool(dto.serverId, {
      name: dto.toolName,
      arguments: dto.arguments,
    });
    return ApiResponseDto.success(result);
  }
}
