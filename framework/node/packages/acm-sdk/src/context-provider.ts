import type { Nucleus } from './nucleus.js';
import type { RunContext, InternalContextScope } from './types.js';
import type { Tool } from './tool.js';

export type ContextRetrievalArtifact = {
  type: string;
  content: any;
  promote?: boolean;
  provenance?: {
    tool?: string;
    rationale?: string;
    [key: string]: any;
  };
};

export type ContextRetrievalResult =
  | ContextRetrievalArtifact
  | ContextRetrievalArtifact[]
  | null
  | undefined;

export type ContextRetrievalTool = Tool<any, ContextRetrievalResult>;

export type ContextRetrievalBindingOptions = {
  match?: (directive: string) => boolean;
  buildInput?: (
    directive: string,
    context: {
      runContext?: RunContext;
      nucleus?: Nucleus;
    }
  ) => any;
  autoPromote?: boolean;
  maxArtifacts?: number;
  describe?: string;
};

type Binding = {
  tool: ContextRetrievalTool;
  match: (directive: string) => boolean;
  buildInput: (
    directive: string,
    context: {
      runContext?: RunContext;
      nucleus?: Nucleus;
    }
  ) => any;
  autoPromote: boolean;
  maxArtifacts: number;
  describe?: string;
};

export class ExternalContextProviderAdapter {
  private bindings: Binding[] = [];

  register(tool: ContextRetrievalTool, options?: ContextRetrievalBindingOptions): void {
    const match: Binding['match'] =
      options?.match ??
      ((directive: string) =>
        directive.startsWith(`${tool.name()}:`) || directive.startsWith(`${tool.name()}::`));

    const buildInput: Binding['buildInput'] =
      options?.buildInput ?? ((directive: string) => {
        const separatorIndex = directive.indexOf(':');
        const payload = separatorIndex >= 0 ? directive.slice(separatorIndex + 1) : undefined;
        return {
          directive,
          payload,
        };
      });

    this.bindings.push({
      tool,
      match,
      buildInput,
      autoPromote: options?.autoPromote ?? true,
      maxArtifacts: options?.maxArtifacts ?? 16,
      describe: options?.describe,
    });
  }

  async fulfill(request: {
    directives: string[];
    scope: InternalContextScope;
    runContext?: RunContext;
    nucleus?: Nucleus;
  }): Promise<void> {
    const { directives, scope, runContext, nucleus } = request;

    const unresolved: string[] = [];

    for (const directive of directives) {
      const binding = this.bindings.find(entry => entry.match(directive));
      if (!binding) {
        unresolved.push(directive);
        continue;
      }

      const input = binding.buildInput(directive, { runContext, nucleus });
      const result = await binding.tool.call(input);
      if (!result) {
        continue;
      }

      const artifacts = Array.isArray(result) ? result : [result];
      if (artifacts.length > binding.maxArtifacts) {
        throw new Error(
          `Tool ${binding.tool.name()} returned ${artifacts.length} artifacts for directive ${directive}, exceeding limit ${binding.maxArtifacts}`
        );
      }

      for (const artifact of artifacts) {
        if (!artifact || typeof artifact.type !== 'string') {
          throw new Error(
            `Tool ${binding.tool.name()} returned an invalid artifact for directive ${directive}`
          );
        }

        const provenance = artifact.provenance ?? {
          tool: binding.tool.name(),
        };

        const artifactId = scope.addArtifact(artifact.type, artifact.content, provenance);
        if (artifact.promote ?? binding.autoPromote) {
          await scope.promote(artifactId);
        }
      }
    }

    if (unresolved.length > 0) {
      throw new Error(
        `No context retrieval tool registered for directives: ${unresolved.join(', ')}`
      );
    }
  }
}
