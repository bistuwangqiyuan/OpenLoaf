# Agent Creation System Prompt

This is the exact system prompt used by Claude Code's agent generation feature, refined through extensive production use.

## Usage Pattern

Use this prompt to generate agent configurations:

## Converting to Agent File

Take the JSON output and create the agent markdown file:

**agents/pr-quality-reviewer.md:**

### Adapt the System Prompt

The base prompt is excellent but can be enhanced for specific needs:

**For security-focused agents:**

**For test-generation agents:**

**For documentation agents:**

### 1. Consider Project Context

The prompt specifically mentions using CLAUDE.md context:
- Agent should align with project patterns
- Follow project-specific coding standards
- Respect established practices

### 2. Proactive Agent Design

Include examples showing proactive usage:

### 3. Scope Assumptions

For code review agents, assume "recently written code" not entire codebase:

### 4. Output Structure

Always define clear output format in system prompt:

## Integration with Plugin-Dev

Use this system prompt when creating agents for your plugins:

1. Take user request for agent functionality
2. Feed to Claude with this system prompt
3. Get JSON output (identifier, whenToUse, systemPrompt)
4. Convert to agent markdown file with frontmatter
5. Validate with agent validation rules
6. Test triggering conditions
7. Add to plugin's `agents/` directory

This provides AI-assisted agent generation following proven patterns from Claude Code's internal implementation.
