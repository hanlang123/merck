import { Sandbox, SandboxedCodeTool } from '../../src/tools/sandbox';
import { ToolRegistry } from '../../src/tools/registry';

describe('Sandbox', () => {
  it('evaluates a simple expression', () => {
    const sb = new Sandbox();
    const result = sb.run('return 1 + 2;');
    expect(result.result).toBe(3);
    expect(result.logs).toEqual([]);
    expect(result.executionMs).toBeGreaterThanOrEqual(0);
  });

  it('captures console.log output', () => {
    const sb = new Sandbox();
    const result = sb.run('console.log("hello", "world"); return true;');
    expect(result.logs).toEqual(['hello world']);
    expect(result.result).toBe(true);
  });

  it('captures console.warn and console.error output', () => {
    const sb = new Sandbox();
    const result = sb.run('console.warn("w"); console.error("e");');
    expect(result.logs).toContain('[WARN] w');
    expect(result.logs).toContain('[ERROR] e');
  });

  it('supports Math, JSON, and basic builtins', () => {
    const sb = new Sandbox();
    const r1 = sb.run('return Math.max(3, 7);');
    expect(r1.result).toBe(7);

    const r2 = sb.run('return JSON.stringify({ a: 1 });');
    expect(r2.result).toBe('{"a":1}');

    const r3 = sb.run('return parseInt("42");');
    expect(r3.result).toBe(42);
  });

  it('accepts extra context variables', () => {
    const sb = new Sandbox({ context: { myValue: 99 } });
    const result = sb.run('return myValue * 2;');
    expect(result.result).toBe(198);
  });

  it('throws on syntax errors', () => {
    const sb = new Sandbox();
    expect(() => sb.run('return {')).toThrow();
  });

  it('throws on runtime errors', () => {
    const sb = new Sandbox();
    expect(() => sb.run('throw new Error("boom");')).toThrow('boom');
  });

  it('enforces the timeout', () => {
    const sb = new Sandbox({ timeoutMs: 50 });
    expect(() => sb.run('while (true) {}')).toThrow();
  });

  it('blocks access to require', () => {
    const sb = new Sandbox();
    expect(() => sb.run('return require("fs");')).toThrow();
  });

  it('blocks access to process', () => {
    const sb = new Sandbox();
    expect(() => sb.run('return process.env;')).toThrow();
  });
});

describe('SandboxedCodeTool', () => {
  let registry: ToolRegistry;
  let tool: SandboxedCodeTool;

  beforeEach(() => {
    registry = new ToolRegistry();
    tool = new SandboxedCodeTool();
    registry.register(tool);
  });

  it('has the correct definition', () => {
    expect(tool.definition.name).toBe('sandboxed_code');
    expect(tool.requiredPermissions).toContain('sandbox:execute');
  });

  it('executes code and returns result via registry with permission', async () => {
    const result = await registry.call(
      'sandboxed_code',
      { code: 'return 6 * 7;' },
      ['sandbox:execute'],
    );
    expect(result.success).toBe(true);
    const data = result.data as { result: number; logs: string[] };
    expect(data.result).toBe(42);
  });

  it('is denied without sandbox:execute permission', async () => {
    const result = await registry.call('sandboxed_code', { code: 'return 1;' }, []);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permission denied/);
  });

  it('caps timeoutMs at 5000', async () => {
    const result = await registry.call(
      'sandboxed_code',
      { code: 'return 1;', timeoutMs: 99999 },
      ['sandbox:execute'],
    );
    // Should succeed; cap is transparent to caller
    expect(result.success).toBe(true);
  });

  it('returns error on runtime exception', async () => {
    const result = await registry.call(
      'sandboxed_code',
      { code: 'throw new Error("fail");' },
      ['sandbox:execute'],
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
  });
});
