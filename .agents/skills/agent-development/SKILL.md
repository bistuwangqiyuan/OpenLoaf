---
name: Agent Development
description: This skill should be used when the user asks to "create an agent", "add an agent", "write a subagent", "agent frontmatter", "when to use description", "agent examples", "agent tools", "agent colors", "autonomous agent", or needs guidance on agent structure, system prompts, triggering conditions, or agent development best practices for Claude Code plugins.
version: 0.1.0
---

## Overview

Agents are autonomous subprocesses that handle complex, multi-step tasks independently. Understanding agent structure, triggering conditions, and system prompt design enables creating powerful autonomous capabilities.

**Key concepts:**
- Agents are FOR autonomous work, commands are FOR user-initiated actions
- Markdown file format with YAML frontmatter
- Triggering via description field with examples
- System prompt defines agent behavior
- Model and color customization

### name (required)

Agent identifier used for namespacing and invocation.

**Format:** lowercase, numbers, hyphens only
**Length:** 3-50 characters
**Pattern:** Must start and end with alphanumeric

**Good examples:**
- `code-reviewer`
- `test-generator`
- `api-docs-writer`
- `security-analyzer`

**Bad examples:**
- `helper` (too generic)
- `-agent-` (starts/ends with hyphen)
- `my_agent` (underscores not allowed)
- `ag` (too short, < 3 chars)

### description (required)

Defines when Claude should trigger this agent. **This is the most critical field.**

**Must include:**
1. Triggering conditions ("Use this agent when...")
2. Multiple `<example>` blocks showing usage
3. Context, user request, and assistant response in each example
4. `<commentary>` explaining why agent triggers

**Format:**

**Best practices:**
- Include 2-4 concrete examples
- Show proactive and reactive triggering
- Cover different phrasings of same intent
- Explain reasoning in commentary
- Be specific about when NOT to use the agent

### model (required)

Which model the agent should use.

**Options:**
- `inherit` - Use same model as parent (recommended)
- `sonnet` - Claude Sonnet (balanced)
- `opus` - Claude Opus (most capable, expensive)
- `haiku` - Claude Haiku (fast, cheap)

**Recommendation:** Use `inherit` unless agent needs specific model capabilities.

### color (required)

Visual identifier for agent in UI.

**Options:** `blue`, `cyan`, `green`, `yellow`, `magenta`, `red`

**Guidelines:**
- Choose distinct colors for different agents in same plugin
- Use consistent colors for similar agent types
- Blue/cyan: Analysis, review
- Green: Success-oriented tasks
- Yellow: Caution, validation
- Red: Critical, security
- Magenta: Creative, generation

### tools (optional)

Restrict agent to specific tools.

**Format:** Array of tool names

**Default:** If omitted, agent has access to all tools

**Best practice:** Limit tools to minimum needed (principle of least privilege)

**Common tool sets:**
- Read-only analysis: `["Read", "Grep", "Glob"]`
- Code generation: `["Read", "Write", "Grep"]`
- Testing: `["Read", "Bash", "Grep"]`
- Full access: Omit field or use `["*"]`

## System Prompt Design

The markdown body becomes the agent's system prompt. Write in second person, addressing the agent directly.

### Structure

**Standard template:**

### Best Practices

✅ **DO:**
- Write in second person ("You are...", "You will...")
- Be specific about responsibilities
- Provide step-by-step process
- Define output format
- Include quality standards
- Address edge cases
- Keep under 10,000 characters

❌ **DON'T:**
- Write in first person ("I am...", "I will...")
- Be vague or generic
- Omit process steps
- Leave output format undefined
- Skip quality guidance
- Ignore error cases

### Method 1: AI-Assisted Generation

Use this prompt pattern (extracted from Claude Code):

Then convert to agent file format with frontmatter.

See `examples/agent-creation-prompt.md` for complete template.

### Method 2: Manual Creation

1. Choose agent identifier (3-50 chars, lowercase, hyphens)
2. Write description with examples
3. Select model (usually `inherit`)
4. Choose color for visual identification
5. Define tools (if restricting access)
6. Write system prompt with structure above
7. Save as `agents/agent-name.md`

### Identifier Validation

**Rules:**
- 3-50 characters
- Lowercase letters, numbers, hyphens only
- Must start and end with alphanumeric
- No underscores, spaces, or special characters

### Description Validation

**Length:** 10-5,000 characters
**Must include:** Triggering conditions and examples
**Best:** 200-1,000 characters with 2-4 examples

### System Prompt Validation

**Length:** 20-10,000 characters
**Best:** 500-3,000 characters
**Structure:** Clear responsibilities, process, output format

### Plugin Agents Directory

All `.md` files in `agents/` are auto-discovered.

### Namespacing

Agents are namespaced automatically:
- Single plugin: `agent-name`
- With subdirectories: `plugin:subdir:agent-name`

### Test Triggering

Create test scenarios to verify agent triggers correctly:

1. Write agent with specific triggering examples
2. Use similar phrasing to examples in test
3. Check Claude loads the agent
4. Verify agent provides expected functionality

### Test System Prompt

Ensure system prompt is complete:

1. Give agent typical task
2. Check it follows process steps
3. Verify output format is correct
4. Test edge cases mentioned in prompt
5. Confirm quality standards are met

### Frontmatter Fields Summary

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| name | Yes | lowercase-hyphens | code-reviewer |
| description | Yes | Text + examples | Use when... <example>... |
| model | Yes | inherit/sonnet/opus/haiku | inherit |
| color | Yes | Color name | blue |
| tools | No | Array of tool names | ["Read", "Grep"] |

### Best Practices

**DO:**
- ✅ Include 2-4 concrete examples in description
- ✅ Write specific triggering conditions
- ✅ Use `inherit` for model unless specific need
- ✅ Choose appropriate tools (least privilege)
- ✅ Write clear, structured system prompts
- ✅ Test agent triggering thoroughly

**DON'T:**
- ❌ Use generic descriptions without examples
- ❌ Omit triggering conditions
- ❌ Give all agents same color
- ❌ Grant unnecessary tool access
- ❌ Write vague system prompts
- ❌ Skip testing

### Reference Files

For detailed guidance, consult:

- **`references/system-prompt-design.md`** - Complete system prompt patterns
- **`references/triggering-examples.md`** - Example formats and best practices
- **`references/agent-creation-system-prompt.md`** - The exact prompt from Claude Code

### Example Files

Working examples in `examples/`:

- **`agent-creation-prompt.md`** - AI-assisted agent generation template
- **`complete-agent-examples.md`** - Full agent examples for different use cases

### Utility Scripts

Development tools in `scripts/`:

- **`validate-agent.sh`** - Validate agent file structure
- **`test-agent-trigger.sh`** - Test if agent triggers correctly

## Implementation Workflow

To create an agent for a plugin:

1. Define agent purpose and triggering conditions
2. Choose creation method (AI-assisted or manual)
3. Create `agents/agent-name.md` file
4. Write frontmatter with all required fields
5. Write system prompt following best practices
6. Include 2-4 triggering examples in description
7. Validate with `scripts/validate-agent.sh`
8. Test triggering with real scenarios
9. Document agent in plugin README

Focus on clear triggering conditions and comprehensive system prompts for autonomous operation.
