# AI-Assisted Agent Generation Template

Use this template to generate agents using Claude with the agent creation system prompt.

### Step 1: Describe Your Agent Need

Think about:
- What task should the agent handle?
- When should it be triggered?
- Should it be proactive or reactive?
- What are the key responsibilities?

### Step 2: Use the Generation Prompt

Send this to Claude (with the agent-creation-system-prompt loaded):

**Replace [YOUR DESCRIPTION] with your agent requirements.**

### Step 3: Claude Returns JSON

Claude will return:

### Step 4: Convert to Agent File

Create `agents/[identifier].md`:

## Example 1: Code Review Agent

**Your request:**

**Claude generates:**

**You create:**

File: `agents/code-quality-reviewer.md`

## Example 2: Test Generation Agent

**Your request:**

**Claude generates:**

**You create:** `agents/test-generator.md` with the structure above.

## Example 3: Documentation Agent

**Your request:**

**Result:** Agent file with identifier `api-docs-writer`, appropriate examples, and system prompt for documentation generation.

### Be Specific in Your Request

**Vague:**

**Specific:**

### Include Triggering Preferences

Tell Claude when the agent should activate:

## Validation After Generation

Always validate generated agents:

## Iterating on Generated Agents

If generated agent needs improvement:

1. Identify what's missing or wrong
2. Manually edit the agent file
3. Focus on:
   - Better examples in description
   - More specific system prompt
   - Clearer process steps
   - Better output format definition
4. Re-validate
5. Test again

## Advantages of AI-Assisted Generation

- **Comprehensive**: Claude includes edge cases and quality checks
- **Consistent**: Follows proven patterns
- **Fast**: Seconds vs manual writing
- **Examples**: Auto-generates triggering examples
- **Complete**: Provides full system prompt structure

## When to Edit Manually

Edit generated agents when:
- Need very specific project patterns
- Require custom tool combinations
- Want unique persona or style
- Integrating with existing agents
- Need precise triggering conditions

Start with generation, then refine manually for best results.
