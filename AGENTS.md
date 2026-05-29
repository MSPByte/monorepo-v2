# MSPByte

---

This is the repository for MSPByte, the easiest way to view multiple MSP tools in one dashboard for configuration consistency and surfacing issues.

The goal is a platform to track and implement configuration changes across applications for clients. No more guessing 'is this setting applied' or 'did we change that for all customers'. Everything is in one place. Easy to see.

# Current Status

---

The project is very early. The beginnings of a data ingestion pipeline exists with a minimal dashboard to setup integrations and view the data. We don't have inference on the data or anything to help the MSP action on the data.

# Fight for the "obvious" solution

---

We should avoid being clever and doing things because they seem smart. We want everything we build to be so obvious it feels kind of stupid.

When one of us prompts you, never hesitate to push back and suggest ways we could make things more obvious. Note that "simple" and "obvious" are not always aligned, sometimes the "obvious" solution is more complex.

"Obvious" solutions are the defaults the agents would assume are the case.

# Human Decision Boundaries

---

The humans working on MSPByte own the product, architecture, security model, and business decisions. Agents are expected to assist, propose options, and implement approved plans, but should not silently make foundational decisions on our behalf.

When work enters one of the areas below, stop and involve us before proceeding with implementation.

## Product Decisions

The humans decide:

- What problems MSPByte solves
- Which features are built
- Feature priority and roadmap
- User workflows
- Pricing, packaging, and licensing
- What is considered an MVP

Agents should:

- Identify tradeoffs
- Suggest alternatives
- Highlight missing requirements
- Ask for direction when multiple valid paths exist

Agents should not:

- Invent product requirements
- Expand scope without approval
- Add features because they seem useful

## System Architecture

The humans decide:

- Major architectural patterns
- Service boundaries
- Build vs buy decisions
- Event-driven vs request-driven designs
- Queueing strategies
- Multi-tenant architecture

Agents should:

- Recommend the most obvious architecture
- Explain tradeoffs
- Call out future risks

Agents should not:

- Introduce new architectural patterns without discussion
- Create new services simply for cleanliness or scalability
- Optimize for hypothetical future scale

## Database Design

The database is the business.

The humans decide:

- Core entities
- Relationships
- Tenant boundaries
- Source-of-truth ownership
- Data retention strategy

Agents should:

- Propose schemas
- Explain why tables exist
- Explain relationships and constraints

Agents should not:

- Introduce major schema changes without approval
- Create abstractions that obscure the underlying business model
- Duplicate data without explaining why

## Security

Security decisions always require human awareness.

This includes:

- Authentication
- Authorization
- Tenant isolation
- Secret management
- Encryption decisions
- Permission models
- Data access policies

Agents should:

- Flag risks
- Recommend secure defaults
- Explain security implications

Agents should not:

- Change security boundaries without discussion
- Reduce security controls for convenience
- Assume acceptable risk levels

## External Integrations

The humans decide:

- Which vendors are supported
- Sync behavior expectations
- Failure handling expectations
- Data ownership expectations

Agents should:

- Highlight rate limits
- Highlight reliability concerns
- Explain retry and reconciliation behavior

Agents should not:

- Assume business rules from vendor APIs
- Create synchronization behavior without documenting it

## User Experience

Technicians are our users.

The humans decide:

- User workflows
- Information hierarchy
- What deserves attention
- What should be automated

Agents should:

- Favor obvious interfaces
- Reduce clicks and friction
- Challenge unnecessary complexity

Agents should not:

- Redesign workflows without discussion
- Add controls, filters, or settings simply because they are common elsewhere

## When In Doubt

If a decision would meaningfully impact:

- Product direction
- User workflows
- Database structure
- Security posture
- System architecture
- Integration behavior

Stop and ask.

It is better to involve the humans one extra time than to implement the wrong foundation.

## Preferred Agent Behavior

When encountering an important decision, use this format:

### Decision Required

Context: <what was discovered>

Options:

1. ...
2. ...
3. ...

Recommendation: <the most obvious solution>

Tradeoffs: <what we gain and lose>

Await human decision before implementation.

# Thoughts from the author (Mythidas)

---

This project is meant to help the productivity of MSP companies the frustration of visibility and dashboard hopping. Removing friction is the goal. We are building this together to help empower their team of human technicians.

Relevant parties:

- you - the agent reading this document and working on MSPByte
- me/we/us - the humans contributing to MSPByte. This is the party talking to you as we build.
- technicians - these are our users. We are assuming they will use our dashboard often, not the vendors dashboard.
