import { PromptTemplate, PromptTemplateRegistry } from '../../src/llm/prompt-template';

describe('PromptTemplate', () => {
  it('renders variables correctly', () => {
    const t = new PromptTemplate('test', 'Hello {{name}}, your task is {{task}}.');
    const rendered = t.render({ name: 'Alice', task: 'coding' });
    expect(rendered).toBe('Hello Alice, your task is coding.');
  });

  it('supports multiple versions', () => {
    const t = new PromptTemplate('versioned', 'v1: {{x}}', '1.0.0');
    t.addVersion('2.0.0', 'v2: {{x}}');
    expect(t.render({ x: 'hello' }, '1.0.0')).toBe('v1: hello');
    expect(t.render({ x: 'hello' }, '2.0.0')).toBe('v2: hello');
  });

  it('switches active version', () => {
    const t = new PromptTemplate('ver', 'old {{v}}', '1.0.0');
    t.addVersion('2.0.0', 'new {{v}}');
    t.setActiveVersion('2.0.0');
    expect(t.render({ v: 'x' })).toBe('new x');
  });

  it('throws on unknown version', () => {
    const t = new PromptTemplate('t', 'hello', '1.0.0');
    expect(() => t.render({}, '9.9.9')).toThrow();
  });
});

describe('PromptTemplateRegistry', () => {
  it('registers and retrieves templates', () => {
    const reg = new PromptTemplateRegistry();
    reg.register(new PromptTemplate('greet', 'Hi {{name}}'));
    expect(reg.render('greet', { name: 'Bob' })).toBe('Hi Bob');
  });

  it('throws for missing template', () => {
    const reg = new PromptTemplateRegistry();
    expect(() => reg.get('missing')).toThrow();
  });
});
