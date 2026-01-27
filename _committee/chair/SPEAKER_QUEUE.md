# 📋 SPEAKER QUEUE

> ⚠️ This file is updated in real-time during sessions.

---

## Current Status

```yaml
session_active: false
current_speaker: null
queue: []
```

---

## Queue Management

### Adding to Queue
Members signal desire to speak. Chair adds them:
```yaml
queue:
  - id: "MAS-001"
    topic: "Orchestration approach"
    priority: normal
  - id: "SKEP-004"
    topic: "Complexity concerns"
    priority: high  # Skeptics often elevated
```

### Priority Levels
- `urgent` — Immediate (Chair, Human, Point of Order)
- `high` — Skeptics challenging, blockers
- `normal` — Standard contributions
- `low` — Tangential, can wait

### Advancing Queue
When current speaker yields:
1. Chair announces next speaker
2. Move first queue item to current
3. Remove from queue

---

*Queue managed by Chair with Clerk support*
