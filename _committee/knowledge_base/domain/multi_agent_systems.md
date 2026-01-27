# Multi-Agent Systems Knowledge Base

## Overview

Multi-agent systems (MAS) involve multiple autonomous agents working together to solve problems that are difficult for a single agent. In the context of LLM-based systems, agents are typically specialized components with defined roles.

## Key Concepts

### Agent Definition
An agent is an autonomous entity that:
- Has a defined role/purpose
- Can perceive its environment (inputs)
- Can act upon its environment (outputs, tool calls)
- May have memory of past interactions

### Orchestration Patterns

1. **Sequential/Pipeline**
   - Agents execute in order
   - Output of one becomes input of next
   - Simple, predictable flow

2. **Parallel/Fan-out**
   - Multiple agents work simultaneously
   - Results are aggregated
   - Good for independent tasks

3. **Conditional/Branching**
   - Flow depends on intermediate results
   - Different paths for different conditions
   - More complex but flexible

4. **Hierarchical**
   - Manager agents coordinate worker agents
   - Good for complex, decomposable tasks

## Framework Options

### LangGraph
- Graph-based orchestration
- Explicit state management
- Conditional edges
- Best for: Deterministic workflows with clear state

### CrewAI
- Natural language agent definitions
- Role-based collaboration
- Built-in delegation
- Best for: Team-like agent interactions

### AutoGen
- Conversation-based coordination
- Dynamic agent selection
- Code execution capabilities
- Best for: Exploratory, research-oriented tasks

## Our Architecture Decision

For invoice processing, we chose **LangGraph** because:
1. Workflow is deterministic (known steps)
2. State management is critical (validation results)
3. Conditional routing needed (valid vs invalid)
4. Debugging requires explicit flow visibility

## Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [CrewAI Documentation](https://docs.crewai.com/)
- [AutoGen Documentation](https://microsoft.github.io/autogen/)

---

*Maintained by Committee knowledge base*
