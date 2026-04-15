import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: { name: string };
};
export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  return _client;
}

function convertImagePart(part: ImageContent): Anthropic.ImageBlockParam {
  const url = part.image_url.url;
  if (url.startsWith("data:")) {
    const [header, data] = url.split(",");
    const mediaType = header.split(":")[1].split(";")[0] as Anthropic.Base64ImageSource["media_type"];
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  }
  return { type: "image", source: { type: "url", url } };
}

function convertMessages(messages: Message[]): {
  system?: string;
  messages: Anthropic.MessageParam[];
} {
  let system: string | undefined;
  const converted: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    const parts = Array.isArray(msg.content) ? msg.content : [msg.content];

    if (msg.role === "system") {
      system = parts
        .map(p => (typeof p === "string" ? p : (p as TextContent).text))
        .join("\n");
      continue;
    }

    if (msg.role === "tool" || msg.role === "function") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "",
            content: parts.map(p => (typeof p === "string" ? p : JSON.stringify(p))).join("\n"),
          },
        ],
      });
      continue;
    }

    const blocks: Anthropic.ContentBlockParam[] = [];
    for (const part of parts) {
      if (typeof part === "string") {
        blocks.push({ type: "text", text: part });
      } else if (part.type === "text") {
        blocks.push({ type: "text", text: (part as TextContent).text });
      } else if (part.type === "image_url") {
        blocks.push(convertImagePart(part as ImageContent));
      }
      // FileContent (audio/video) not supported by Anthropic — skip
    }

    converted.push({
      role: msg.role as "user" | "assistant",
      content: blocks.length === 1 && blocks[0].type === "text"
        ? (blocks[0] as Anthropic.TextBlockParam).text
        : blocks,
    });
  }

  return { system, messages: converted };
}

function convertTools(tools: Tool[]): Anthropic.Tool[] {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: (t.function.parameters ?? {
      type: "object",
      properties: {},
    }) as Anthropic.Tool["input_schema"],
  }));
}

function convertToolChoice(
  choice: ToolChoice | undefined
): Anthropic.MessageCreateParams["tool_choice"] {
  if (!choice) return undefined;
  if (typeof choice === "string") {
    if (choice === "none") return { type: "none" };
    if (choice === "required") return { type: "any" };
    return { type: "auto" };
  }
  const name =
    (choice as ToolChoiceByName).name ??
    (choice as ToolChoiceExplicit).function?.name;
  if (name) return { type: "tool", name };
  return { type: "auto" };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const { messages, tools, toolChoice, tool_choice, maxTokens, max_tokens } = params;

  const client = getClient();
  const { system, messages: anthropicMessages } = convertMessages(messages);

  const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens ?? max_tokens ?? 8096,
    messages: anthropicMessages,
  };

  if (system) requestParams.system = system;

  if (tools && tools.length > 0) {
    requestParams.tools = convertTools(tools);
    const choice = toolChoice ?? tool_choice;
    const converted = convertToolChoice(choice);
    if (converted) requestParams.tool_choice = converted;
  }

  const response = await client.messages.create(requestParams);

  const textContent = response.content
    .filter(b => b.type === "text")
    .map(b => (b as Anthropic.TextBlock).text)
    .join("");

  const toolCalls: ToolCall[] = response.content
    .filter(b => b.type === "tool_use")
    .map(b => {
      const block = b as Anthropic.ToolUseBlock;
      return {
        id: block.id,
        type: "function" as const,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      };
    });

  return {
    id: response.id,
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason:
          response.stop_reason === "end_turn"
            ? "stop"
            : response.stop_reason === "tool_use"
            ? "tool_calls"
            : response.stop_reason ?? null,
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
