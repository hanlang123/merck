import { ToolRegistry } from '../../src/tools/registry';
import { EchoTool } from '../../src/tools/base';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let echo: EchoTool;

  beforeEach(() => {
    registry = new ToolRegistry();
    echo = new EchoTool();
  });

  it('registers and lists tools', () => {
    registry.register(echo);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]!.name).toBe('echo');
  });

  it('reports has() correctly', () => {
    expect(registry.has('echo')).toBe(false);
    registry.register(echo);
    expect(registry.has('echo')).toBe(true);
  });

  it('calls a registered tool successfully', async () => {
    registry.register(echo);
    const result = await registry.call('echo', { message: 'hello' });
    expect(result.success).toBe(true);
    expect((result.data as { echo: string }).echo).toBe('hello');
  });

  it('returns error for unknown tool', async () => {
    const result = await registry.call('unknown', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown tool/);
  });

  it('enforces permissions', async () => {
    const restrictedTool = new EchoTool();
    // Monkey-patch required permissions
    Object.defineProperty(restrictedTool, 'requiredPermissions', {
      get: () => ['admin:access'],
    });
    registry.register(restrictedTool);
    const result = await registry.call('echo', { message: 'hi' }, []);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permission denied/);
  });

  it('unregisters tools', () => {
    registry.register(echo);
    registry.unregister('echo');
    expect(registry.has('echo')).toBe(false);
  });
});
