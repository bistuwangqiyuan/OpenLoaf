# Complete Agent Examples

Full, production-ready agent examples for common use cases. Use these as templates for your own agents.

## Example 1: Code Review Agent

**File:** `agents/code-reviewer.md`

## Example 2: Test Generator Agent

**File:** `agents/test-generator.md`

// Test suite for [module]

describe('[module name]', () => {
  // Test cases with descriptive names
  test('should [expected behavior] when [scenario]', () => {
    // Arrange
    // Act
    // Assert
  })

  // More tests...
})

## Example 3: Documentation Generator

**File:** `agents/docs-generator.md`

## Example 4: Security Analyzer

**File:** `agents/security-analyzer.md`

### Adapt to Your Domain

Take these templates and customize:
- Change domain expertise (e.g., "Python expert" vs "React expert")
- Adjust process steps for your specific workflow
- Modify output format to match your needs
- Add domain-specific quality standards
- Include technology-specific checks

### Adjust Tool Access

Restrict or expand based on agent needs:
- **Read-only agents**: `["Read", "Grep", "Glob"]`
- **Generator agents**: `["Read", "Write", "Grep"]`
- **Executor agents**: `["Read", "Write", "Bash", "Grep"]`
- **Full access**: Omit tools field

### Customize Colors

Choose colors that match agent purpose:
- **Blue**: Analysis, review, investigation
- **Cyan**: Documentation, information
- **Green**: Generation, creation, success-oriented
- **Yellow**: Validation, warnings, caution
- **Red**: Security, critical analysis, errors
- **Magenta**: Refactoring, transformation, creative

## Using These Templates

1. Copy template that matches your use case
2. Replace placeholders with your specifics
3. Customize process steps for your domain
4. Adjust examples to your triggering scenarios
5. Validate with `scripts/validate-agent.sh`
6. Test triggering with real scenarios
7. Iterate based on agent performance

These templates provide battle-tested starting points. Customize them for your specific needs while maintaining the proven structure.
