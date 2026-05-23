import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import {
  findSupportedChatModel,
  type SupportedChatModel,
  type SupportedChatModelId,
  type SupportedProvider,
} from "@knightcode/shared";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

const openrouter = createOpenRouter({
  headers: {
    "HTTP-Referer": "https://github.com/Raghav1428/knightcode",
    "X-Title": "KnightCode CLI",
  },
});

type AnthropicModelId = Extract<
  SupportedChatModel,
  { provider: "anthropic" }
>["id"];
type OpenAIModelId = Extract<SupportedChatModel, { provider: "openai" }>["id"];
type OpenRouterModelId = Extract<
  SupportedChatModel,
  { provider: "openrouter" }
>["id"];

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportedProvider;
  modelId: SupportedChatModelId;
  providerOptions?: ProviderOptions;
};

const ANTHROPIC_PROVIDER_OPTIONS: Partial<
  Record<AnthropicModelId, ProviderOptions>
> = {
  "claude-opus-4-6": {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: 10000,
      },
    },
  },
  "claude-sonnet-4-6": {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: 10000,
      },
    },
  },
};

const OPENAI_PROVIDER_OPTIONS: Partial<Record<OpenAIModelId, ProviderOptions>> =
  {
    "gpt-5.4": {
      openai: {
        reasoningEffort: "high",
      },
    },
    "gpt-5.4-mini": {
      openai: {
        reasoningEffort: "medium",
      },
    },
  };

const OPENROUTER_PROVIDER_OPTIONS: Partial<
  Record<OpenRouterModelId, ProviderOptions>
> = {
  "baidu/cobuddy:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  "poolside/laguna-xs.2:free": {
    openrouter: {
      reasoning: {
        effort: "medium",
      },
    },
  },
  "poolside/laguna-m.1:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  "deepseek/deepseek-v4-flash:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  "arcee-ai/trinity-large-thinking:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  "nvidia/nemotron-3-super-120b-a12b:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  "openai/gpt-oss-120b:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  "z-ai/glm-4.5-air:free": {
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
};

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
}

function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
  return {
    model: anthropic(modelId),
    provider: "anthropic",
    modelId,
    providerOptions: ANTHROPIC_PROVIDER_OPTIONS[modelId],
  };
}

function resolveOpenAIModel(modelId: OpenAIModelId): ResolvedModel {
  return {
    model: openai(modelId),
    provider: "openai",
    modelId,
    providerOptions: OPENAI_PROVIDER_OPTIONS[modelId],
  };
}

function resolveOpenRouterModel(modelId: OpenRouterModelId): ResolvedModel {
  return {
    model: openrouter.chat(modelId),
    provider: "openrouter",
    modelId,
    providerOptions: OPENROUTER_PROVIDER_OPTIONS[modelId],
  };
}

function resolveSupportedChatModel(model: SupportedChatModel): ResolvedModel {
  const provider = model.provider;

  switch (provider) {
    case "anthropic":
      return resolveAnthropicModel(model.id);
    case "openai":
      return resolveOpenAIModel(model.id);
    case "openrouter":
      return resolveOpenRouterModel(model.id);
    default:
      return assertUnsupportedProvider(provider);
  }
}

export function isSupportedChatModel(
  modelId: string,
): modelId is SupportedChatModelId {
  return findSupportedChatModel(modelId) != null;
}

export function resolveChatModel(modelId: string): ResolvedModel {
  const model = findSupportedChatModel(modelId);
  if (!model) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  return resolveSupportedChatModel(model);
}
