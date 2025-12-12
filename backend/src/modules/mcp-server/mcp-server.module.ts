import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { AgentsModule } from '@/modules/agents/agents.module';
import { LlmModule } from '@/common/llm/llm.module';

/**
 * MCP Server Module
 *
 * Exposes Co-Op agents as MCP tools with:
 * - Mandatory LLM Council cross-critique
 * - A2A (Agent-to-Agent) communication with shuffle + critique
 * - Multi-agent queries with synthesis
 *
 * Tools: legal_analysis, finance_analysis, investor_search, competitor_analysis, multi_agent_query
 */
@Module({
  imports: [ConfigModule, AgentsModule, LlmModule],
  controllers: [McpServerController],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpServerModule {}
