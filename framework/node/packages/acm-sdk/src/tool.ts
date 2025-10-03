// Abstract Tool class

export abstract class Tool<I = any, O = any> {
  abstract name(): string;
  abstract call(input: I, idemKey?: string): Promise<O>;
}
