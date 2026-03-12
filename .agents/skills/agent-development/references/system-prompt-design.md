# System Prompt Design Patterns

Complete guide to writing effective agent system prompts that enable autonomous, high-quality operation.

## Core Structure

Every agent system prompt should follow this proven structure:

## Pattern 1: Analysis Agents

For agents that analyze code, PRs, or documentation:

## Pattern 2: Generation Agents

For agents that create code, tests, or documentation:

## Pattern 3: Validation Agents

For agents that validate, check, or verify:

## Pattern 4: Orchestration Agents

For agents that coordinate multiple tools or steps:

### Tone and Voice

**Use second person (addressing the agent):**

### Clarity and Specificity

**Be specific, not vague:**

### Actionable Instructions

**Give concrete steps:**

### ❌ Vague Responsibilities

**Why bad:** Not specific enough to guide behavior.

### ❌ Missing Process Steps

**Why bad:** Agent doesn't know HOW to analyze.

### ❌ Undefined Output

**Why bad:** Agent doesn't know what format to use.

### Minimum Viable Agent

**~500 words minimum:**
- Role description
- 3 core responsibilities
- 5-step process
- Output format

### Standard Agent

**~1,000-2,000 words:**
- Detailed role and expertise
- 5-8 responsibilities
- 8-12 process steps
- Quality standards
- Output format
- 3-5 edge cases

### Comprehensive Agent

**~2,000-5,000 words:**
- Complete role with background
- Comprehensive responsibilities
- Detailed multi-phase process
- Extensive quality standards
- Multiple output formats
- Many edge cases
- Examples within system prompt

**Avoid > 10,000 words:** Too long, diminishing returns.

### Test Completeness

Can the agent handle these based on system prompt alone?

- [ ] Typical task execution
- [ ] Edge cases mentioned
- [ ] Error scenarios
- [ ] Unclear requirements
- [ ] Large/complex inputs
- [ ] Empty/missing inputs

### Test Clarity

Read the system prompt and ask:

- Can another developer understand what this agent does?
- Are process steps clear and actionable?
- Is output format unambiguous?
- Are quality standards measurable?

### Iterate Based on Results

After testing agent:
1. Identify where it struggled
2. Add missing guidance to system prompt
3. Clarify ambiguous instructions
4. Add process steps for edge cases
5. Re-test

## Conclusion

Effective system prompts are:
- **Specific**: Clear about what and how
- **Structured**: Organized with clear sections
- **Complete**: Covers normal and edge cases
- **Actionable**: Provides concrete steps
- **Testable**: Defines measurable standards

Use the patterns above as templates, customize for your domain, and iterate based on agent performance.
