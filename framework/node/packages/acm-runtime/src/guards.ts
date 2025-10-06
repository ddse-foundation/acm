// Guard evaluator
import type { GuardExpr, Context } from '@ddse/acm-sdk';

export function evaluateGuard(
  expr: GuardExpr,
  context: {
    context: Context;
    outputs: Record<string, any>;
    policy: Record<string, any>;
  }
): boolean {
  try {
    // Simple expression evaluation
    // Support basic comparisons and logical operators
    const func = new Function('context', 'outputs', 'policy', `return ${expr};`);
    return func(context.context, context.outputs, context.policy);
  } catch (err) {
    console.error(`Guard evaluation failed: ${expr}`, err);
    return false;
  }
}
