import { Module, Global } from '@nestjs/common';
import { GroqProvider } from './providers/groq.provider';
import { GoogleProvider } from './providers/google.provider';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import { LlmRouterService } from './llm-router.service';
import { LlmCouncilService } from './llm-council.service';

@Global()
@Module({
  providers: [
    GroqProvider,
    GoogleProvider,
    HuggingFaceProvider,
    LlmRouterService,
    LlmCouncilService,
  ],
  exports: [
    GroqProvider,
    GoogleProvider,
    HuggingFaceProvider,
    LlmRouterService,
    LlmCouncilService,
  ],
})
export class LlmModule {}
