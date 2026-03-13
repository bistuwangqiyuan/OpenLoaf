# Agent Triggering Examples: Best Practices

Complete guide to writing effective `<example>` blocks in agent descriptions for reliable triggering.

## Example Block Format

The standard format for triggering examples:

### Context

**Purpose:** Set the scene - what happened before the user's message

**Good contexts:**

**Bad contexts:**

### User Message

**Purpose:** Show the exact phrasing that should trigger the agent

**Good user messages:**

**Vary the phrasing:**
Include multiple examples with different phrasings for the same intent:

### Assistant Response (Before Triggering)

**Purpose:** Show what Claude says before launching the agent

**Good responses:**

**Proactive example:**

### Commentary

**Purpose:** Explain the reasoning - WHY this agent should trigger

**Good commentary:**

**Include decision logic:**

### Assistant Response (Triggering)

**Purpose:** Show how Claude invokes the agent

**Standard pattern:**

**Examples:**

### Type 1: Explicit Request

User directly asks for what the agent does:

### Type 2: Proactive Triggering

Agent triggers after relevant work without explicit request:

### Type 3: Implicit Request

User implies need without stating it directly:

### Type 4: Tool Usage Pattern

Agent triggers based on prior tool usage:

### ❌ Missing Context

**Why bad:** No context about what led to this request.

### ❌ No Commentary

**Why bad:** Doesn't explain WHY agent triggers.

### ❌ Agent Responds Directly

**Why bad:** Shows agent's output, not triggering.

### Minimum: 2 Examples

Cover at least:
1. Explicit request
2. One variation or proactive trigger

### Recommended: 3-4 Examples

Cover:
1. Explicit request (direct ask)
2. Implicit request (user implies need)
3. Proactive trigger (after relevant work)
4. Edge case or specific scenario

### Maximum: 6 Examples

More than 6 makes description too long. Focus on most important scenarios.

### Agent Not Triggering

**Check:**
1. Examples include relevant keywords from user message
2. Context matches actual usage scenarios
3. Commentary explains triggering logic clearly
4. Assistant shows use of Agent tool in examples

**Fix:**
Add more examples covering different phrasings.

### Agent Triggers Too Often

**Check:**
1. Examples are too broad or generic
2. Triggering conditions overlap with other agents
3. Commentary doesn't distinguish when NOT to use

**Fix:**
Make examples more specific, add negative examples.

### Agent Triggers in Wrong Scenarios

**Check:**
1. Examples don't match actual intended use
2. Commentary suggests inappropriate triggering

**Fix:**
Revise examples to show only correct triggering scenarios.

## Best Practices Summary

✅ **DO:**
- Include 2-4 concrete, specific examples
- Show both explicit and proactive triggering
- Provide clear context for each example
- Explain reasoning in commentary
- Vary user message phrasing
- Show Claude using Agent tool

❌ **DON'T:**
- Use generic, vague examples
- Omit context or commentary
- Show only one type of triggering
- Skip the agent invocation step
- Make examples too similar
- Forget to explain why agent triggers

## Conclusion

Well-crafted examples are crucial for reliable agent triggering. Invest time in creating diverse, specific examples that clearly demonstrate when and why the agent should be used.
