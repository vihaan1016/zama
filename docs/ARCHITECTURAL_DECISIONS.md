# Architectural Decision Records (ADR)

This document records the key architectural decisions made during the FBA DEX design process, including the rationale, alternatives considered, and trade-offs.

---

## ADR-001: Multi-Block Clearing Architecture

**Status**: ✅ Accepted

**Context**: 
Computing encrypted sorting/matching over arbitrary N orders exceeds single-block gas limits on FHEVM.

**Decision**: 
Implement checkpoint-based multi-transaction clearing where state persists on-chain between keeper-orchestrated steps.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| Single-block clearing with fixed N=8 | Simple, synchronous | Not scalable, limited to toy demo | ❌ Too limited |
| FHE coprocessor (off-chain) | High throughput | Requires trust in coprocessor, centralization | ❌ Against decentralization goals |
| Layer 2 with higher gas limits | Better performance | Adds complexity, L2 not mature | ⏸️ Future consideration |
| **Multi-block checkpoint-based** | **Scales to arbitrary N, trustless** | **Longer latency, keeper dependency** | ✅ **Chosen** |

**Consequences**:
- ✅ Can scale to 500+ orders per batch
- ✅ Fully on-chain and trustless
- ⚠️ Clearing takes multiple blocks (5-10 minutes)
- ⚠️ Requires robust keeper infrastructure

---

## ADR-002: Tick-Based Price Discovery

**Status**: ✅ Accepted

**Context**: 
Encrypted sorting of continuous prices is O(N log N) and gas-prohibitive. Need cheaper price discovery mechanism.

**Decision**: 
Use discrete price grid (ticks) and count aggregate volumes at each tick instead of sorting.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| Full encrypted sorting | Maximum price precision | O(N log N) gas, likely infeasible | ❌ Too expensive |
| Binary search for clearing price | O(log K) where K=ticks | Still requires sorted order book | ❌ Doesn't solve root issue |
| **Tick-based aggregation** | **O(N × K), predictable gas** | **Reduced price precision** | ✅ **Chosen** |
| Single price point (Dutch auction) | Very cheap | Poor price discovery | ❌ UX too limited |

**Configuration Chosen**:
- 1000 ticks
- Range: $0.01 to $100
- Tick spacing: $0.099

**Consequences**:
- ✅ Predictable gas: ~5M per 100 orders
- ✅ Parallelizable (different tick ranges)
- ⚠️ Price precision limited to ~$0.10
- ✅ Acceptable for MVP, can increase ticks later

---

## ADR-003: All-or-Nothing Fills (Phase 1)

**Status**: ✅ Accepted (with future enhancement planned)

**Context**: 
At the clearing price, buy and sell volumes may not match exactly. Need to decide how to handle partial fills.

**Decision**: 
Phase 1 implements all-or-nothing fills. Orders either fill completely or not at all.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **All-or-nothing** | **Simple, no encrypted division** | **Less capital efficient** | ✅ **Phase 1** |
| Pro-rata partial fills | More capital efficient | Requires complex encrypted division | ⏸️ Phase 2 |
| Random selection at clearing price | Fair, simple | Still need encrypted randomness | ❌ Not deterministic |
| Time priority at clearing price | Incentivizes early submission | Defeats sealed-bid property | ❌ Against privacy goal |

**Consequences**:
- ✅ Simpler implementation, lower gas
- ✅ Clear UX: "filled" or "not filled"
- ⚠️ Some orders won't fill even at clearing price
- ✅ Designed to support Phase 2 upgrade

**Migration Path to Phase 2**:
```solidity
// Phase 2: Add pro-rata logic
euint64 filledAmount = TFHE.div(
    TFHE.mul(order.encSize, availableVolume),
    totalVolumeAtPrice
);
```

---

## ADR-004: Keeper-Driven Batch Lifecycle

**Status**: ✅ Accepted

**Context**: 
Batch transitions (close, clear, settle) need to be triggered reliably at the right times.

**Decision**: 
Off-chain keeper bot monitors and triggers state transitions. Keeper is permissioned but actions are verifiable.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Permissioned keeper** | **Simple, reliable, single point of control** | **Centralization, single point of failure** | ✅ **Chosen** |
| Anyone can trigger (open keeper) | Fully decentralized | Race conditions, griefing risk | ❌ Coordination problem |
| Automated (block number triggers) | No keeper needed | Inflexible, can't handle failures | ❌ Not robust |
| Chainlink Automation | Decentralized, reliable | Extra cost, dependency | ⏸️ Future option |
| Multiple keepers (leader election) | Redundancy | Complex coordination | ⏸️ Phase 2 |

**Consequences**:
- ✅ Simple and reliable for MVP
- ⚠️ Single point of failure (mitigated by monitoring)
- ⚠️ Centralization (but actions verifiable on-chain)
- ✅ Can upgrade to decentralized keeper set later

**Decentralization Roadmap**:
1. Phase 1: Single keeper (MVP)
2. Phase 2: Multiple keepers with leader election
3. Phase 3: Open keeper network with incentives

---

## ADR-005: ERC-7984 for Confidential Tokens

**Status**: ✅ Accepted

**Context**: 
Need to handle encrypted token balances and transfers for collateral and settlement.

**Decision**: 
Use ERC-7984 (Confidential Token Standard) for base and quote tokens.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **ERC-7984 (Confidential)** | **Privacy-preserving, standard** | **New standard, limited tooling** | ✅ **Chosen** |
| Standard ERC-20 | Mature ecosystem | No privacy, defeats sealed-bid goal | ❌ Wrong primitive |
| Custom token with FHE | Full control | Reinventing wheel, audit risk | ❌ Don't roll your own |
| ZK token (Aztec-style) | Strong privacy | Not composable with FHE | ❌ Different cryptography |

**Consequences**:
- ✅ Native FHE support for balances
- ✅ Standard interface (composability)
- ⚠️ Ecosystem still maturing
- ✅ Can easily integrate with other FHE protocols

---

## ADR-006: Next.js for Frontend

**Status**: ✅ Accepted

**Context**: 
Need modern, performant frontend for user interactions with FHE operations.

**Decision**: 
Use Next.js 14 with App Router for frontend framework.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Next.js 14** | **SSR/SSG, great DX, mature** | **Vendor lock-in (Vercel)** | ✅ **Chosen** |
| Plain React (CRA/Vite) | Simple, no framework | No SSR, worse SEO | ❌ Missing features |
| SvelteKit | Smaller bundle, fast | Smaller ecosystem | ❌ Less mature tooling |
| Remix | Data-focused, modern | Newer, less adoption | ❌ Riskier choice |

**Consequences**:
- ✅ Excellent performance (SSR + streaming)
- ✅ Great developer experience
- ✅ Easy deployment (Vercel)
- ⚠️ Potential vendor lock-in (mitigated by Next.js being OSS)

---

## ADR-007: TypeScript Throughout

**Status**: ✅ Accepted

**Context**: 
Need type safety for complex FHE operations and multi-component system.

**Decision**: 
Use TypeScript for all code: keeper bot, frontend, tests, scripts.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **TypeScript** | **Type safety, better DX, catches bugs early** | **Compilation step, learning curve** | ✅ **Chosen** |
| JavaScript | No compilation, faster iteration | No type safety, more runtime errors | ❌ Too risky |
| Python (for keeper) | Good libraries, familiar | Less integration with ecosystem | ❌ Worse fit |

**Consequences**:
- ✅ Catch bugs at compile time
- ✅ Better IDE support and refactoring
- ✅ Self-documenting code (types as docs)
- ⚠️ Slight overhead in development setup

---

## ADR-008: Prometheus + Grafana for Monitoring

**Status**: ✅ Accepted

**Context**: 
Need comprehensive monitoring of keeper bot, contract interactions, and system health.

**Decision**: 
Use Prometheus for metrics collection and Grafana for visualization.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Prometheus + Grafana** | **Industry standard, powerful, self-hosted** | **Requires setup** | ✅ **Chosen** |
| DataDog | Managed, easy | Expensive, vendor lock-in | ❌ Costly for startup |
| CloudWatch (AWS) | Integrated with AWS | AWS lock-in, limited | ❌ Not portable |
| Simple logging | Easy to set up | No visualization, hard to analyze | ❌ Insufficient |

**Consequences**:
- ✅ Complete observability
- ✅ Can self-host or use managed
- ✅ Rich alerting capabilities
- ⚠️ Requires operational knowledge

---

## ADR-009: Docker for Deployment

**Status**: ✅ Accepted

**Context**: 
Need consistent, reproducible deployment environment for keeper and supporting services.

**Decision**: 
Use Docker and Docker Compose for containerization and orchestration.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Docker + Docker Compose** | **Standard, reproducible, portable** | **Some complexity** | ✅ **Chosen** |
| Kubernetes | Scalable, powerful | Overkill for MVP, complex | ⏸️ Phase 3 |
| Systemd services | Simple, native | Not portable, harder to replicate | ❌ Not reproducible |
| Bare metal | No overhead | Hard to replicate, brittle | ❌ Not maintainable |

**Consequences**:
- ✅ Consistent env (dev/test/prod)
- ✅ Easy to scale horizontally later
- ✅ Simple deployment with `docker-compose up`
- ⚠️ Requires Docker knowledge

---

## ADR-010: Hardhat for Smart Contract Development

**Status**: ✅ Accepted

**Context**: 
Need development framework for Solidity contracts with FHE support.

**Decision**: 
Use Hardhat with fhevm plugin for contract development and testing.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Hardhat** | **Excellent DX, plugin ecosystem, TS support** | **Slower than Foundry** | ✅ **Chosen** |
| Foundry | Faster tests, Solidity-native | No official FHE support yet | ❌ Lacks FHE tooling |
| Remix | Browser-based, easy | Not suitable for complex projects | ❌ Too limited |
| Truffle | Mature | Declining community, slower | ❌ Less momentum |

**Consequences**:
- ✅ Great TypeScript integration
- ✅ FHE plugin available from Zama
- ✅ Rich plugin ecosystem
- ⚠️ Slower test execution vs Foundry

---

## ADR-011: PostgreSQL for Keeper Database

**Status**: ✅ Accepted

**Context**: 
Keeper needs to store analytics, job queues, and operational data (not order data, which is on-chain).

**Decision**: 
Use PostgreSQL for keeper's operational database.

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **PostgreSQL** | **Reliable, full-featured, widely supported** | **Heavier than needed** | ✅ **Chosen** |
| SQLite | Simple, embedded | Not for production multi-process | ❌ Not scalable |
| Redis | Fast, simple | Not durable, limited queries | ❌ Wrong primitive |
| MongoDB | Flexible schema | Overkill, less reliable | ❌ Not needed |
| No database (stateless) | Simplest | Can't track history, no analytics | ❌ Missing features |

**Consequences**:
- ✅ Reliable and battle-tested
- ✅ Good for analytics queries
- ✅ Easy backups and replication
- ⚠️ Slight operational overhead

---

## ADR-012: Phased Launch Strategy

**Status**: ✅ Accepted

**Context**: 
Full-featured DEX is complex. Need to balance speed-to-market with completeness.

**Decision**: 
Launch in phases with progressively more features and scale.

**Phase Breakdown**:

| Phase | Features | Timeline | Risk |
|-------|----------|----------|------|
| **Phase 1 (MVP)** | Fixed batch size, single market, all-or-nothing fills | Week 1-4 | Low |
| **Phase 2 (Beta)** | Dynamic batches, partial fills, multiple markets | Week 5-8 | Medium |
| **Phase 3 (Production)** | Order cancellation, advanced orders, mobile app | Week 9-12 | Medium |
| **Phase 4 (Scale)** | L2 deployment, cross-chain, governance | Month 4+ | High |

**Alternatives Considered**:

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Phased rollout** | **Lower risk, faster to market** | **Delayed full feature set** | ✅ **Chosen** |
| Build everything first | Complete on launch | Very long time to market, high risk | ❌ Too risky |
| MVP only (no roadmap) | Fastest | No growth path | ❌ Not ambitious enough |

**Consequences**:
- ✅ Get to market faster (4 weeks vs 12+)
- ✅ Learn from users early
- ✅ Lower initial risk
- ⚠️ Need clear communication of roadmap

---

## Summary Table: All Decisions

| ADR | Decision | Status | Risk Level | Phase |
|-----|----------|--------|------------|-------|
| 001 | Multi-block clearing | ✅ Accepted | Medium | MVP |
| 002 | Tick-based pricing | ✅ Accepted | Low | MVP |
| 003 | All-or-nothing fills | ✅ Accepted | Low | MVP → upgrade in Phase 2 |
| 004 | Keeper-driven lifecycle | ✅ Accepted | Medium | MVP → decentralize Phase 3 |
| 005 | ERC-7984 tokens | ✅ Accepted | Low | MVP |
| 006 | Next.js frontend | ✅ Accepted | Low | MVP |
| 007 | TypeScript | ✅ Accepted | Low | MVP |
| 008 | Prometheus monitoring | ✅ Accepted | Low | MVP |
| 009 | Docker deployment | ✅ Accepted | Low | MVP |
| 010 | Hardhat framework | ✅ Accepted | Low | MVP |
| 011 | PostgreSQL database | ✅ Accepted | Low | MVP |
| 012 | Phased launch | ✅ Accepted | Low | Strategy |

---

## Decision Review Process

**When to Revisit**:
- After each phase completion
- If assumptions prove incorrect
- If better alternatives emerge
- If significant blocker encountered

**Review Criteria**:
- Does this still align with goals?
- Are trade-offs still acceptable?
- Has the ecosystem changed?
- What have we learned?

---

## Change Log

| Date | ADR | Change | Reason |
|------|-----|--------|--------|
| 2026-07-05 | All | Initial decisions | Project inception |
| TBD | 004 | Consider multi-keeper | After Phase 1 success |
| TBD | 003 | Implement partial fills | Phase 2 |

---

**For implementation details of these decisions, see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).**
