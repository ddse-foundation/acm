# Successful Runs of 5 Example Scenarios

## Scenario: Agent Coaching

```bash

node$ pnpm --filter @acm/examples demo --scenario coaching --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1

> @acm/examples@0.1.0 demo /mnt/backup1/home/manna/workspace/ml/ddse/ddse-composer/framework/node/packages/acm-examples
> node ./dist/bin/acm-demo.js "--scenario" "coaching" "--provider" "vllm" "--model" "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8" "--base-url" "http://localhost:8001/v1"


🎯 Scenario: Agent Coaching
   Key: coaching
   Description: Analyze a transcript for sentiment, generate coaching feedback, and log the coaching note.

📋 Planning...



Generated 1 plan.

📝 Planner plan summary (first plan):
{
  "id": "plan-a",
  "contextRef": "a7a6fc938af87d777cc724f4d919faae1db09ade6973a52b29eb563d2498101f",
  "tasks": [
    {
      "id": "task-coaching-analyze-transcript",
      "capability": "coaching.analyze_transcript",
      "hasInput": true,
      "inputPreview": {
        "transcriptId": "TRANS-5540"
      }
    },
    {
      "id": "task-coaching-generate-feedback",
      "capability": "coaching.generate_feedback",
      "hasInput": true,
      "inputPreview": {
        "transcriptId": "TRANS-5540"
      }
    },
    {
      "id": "task-coaching-log-note",
      "capability": "coaching.log_note",
      "hasInput": true,
      "inputPreview": {
        "transcriptId": "TRANS-5540"
      }
    }
  ]
}


✅ Plans generated: 1
Executing plan plan-a
Context Ref: a7a6fc938af87d777cc724f4d919faae1db09ade6973a52b29eb563d2498101f
Tasks:
  1. task-coaching-analyze-transcript -> coaching.analyze_transcript
  2. task-coaching-generate-feedback -> coaching.generate_feedback
  3. task-coaching-log-note -> coaching.log_note


[task-coaching-analyze-transcript] Task started
[task-coaching-analyze-transcript] ✓ Task completed
  Output: {
  "transcript": {
    "id": "TRANS-5540",
    "agentId": "AG-883",
    "customerSentiment": "NEGATIVE",
    "complianceFlags": [
      "DISCLOSURE_MISSED",
      "CALL_TAG_MISSING"
    ],
    "transcript": [
      "Agent: Thank you for calling Northwind Support, this is Priya.",
      "Customer: I've been waiting three days for someone to unblock my fulfillment feed.",
      "Agent: I can see the backlog and I'm escalating to our ops team right now.",
      "Customer: This is costing me money every hour.",
      "Agent: I completely understand how frustrating that is and I'm logging an urgent ticket.",
      "Agent: You'll get an update within the next two hours and I'll follow up personally.",
      "Customer: Please make sure someone actually reaches out this time.",
      "Agent: Absolutely, I'll send you confirmation as soon as I have it."
    ],
    "callDurationSeconds": 780,
    "followUpRequired": true
  },
  "sentimentScore": 0.25,
  "complianceScore": 0.6499999999999999,
  "complianceBreaches": [
    "DISCLOSURE_MISSED",
    "CALL_TAG_MISSING"
  ],
  "highlights": [
    "Customer requested follow-up action",
    "Empathy signal captured: \"Agent: I completely understand how frustrating that is and I'm logging an urgent ticket.\""
  ],
  "summary": "Agent: Thank you for calling Northwind Support, this is Priya. Customer: I've been waiting three days for someone to unblock my fulfillment feed. Agent: I can see the backlog and I'm escalating to our ops team right now. Customer: This is costing me money every hour. Agent: I completely understand how frustrating that is and I'm logging an urgent ticket. Agent: You'll get an update within the next two hours and I'll follow up personally."
}
💾 Checkpoint created: checkpoint-1759727769936-nxbw1r0 (1 tasks completed)

[task-coaching-generate-feedback] Task started
[task-coaching-generate-feedback] ✓ Task completed
  Output: {
  "transcriptId": "TRANS-5540",
  "feedbackSummary": "Overall sentiment scored at 25%. Compliance adherence at 65%.",
  "actionItems": [
    "Address compliance items: DISCLOSURE_MISSED, CALL_TAG_MISSING",
    "Practice empathy statements to de-escalate frustrated customers",
    "Acknowledge customer feelings before delivering resolution details"
  ],
  "escalationRequired": true
}
💾 Checkpoint created: checkpoint-1759727769939-gvqr0cz (2 tasks completed)

[task-coaching-log-note] Task started
[task-coaching-log-note] ✓ Task completed
  Output: {
  "logId": "coach-1759727769941",
  "agent": {
    "id": "AG-883",
    "name": "Priya Singh",
    "region": "AMER",
    "tenureMonths": 28,
    "managerEmail": "luis.mendez@northwind.example"
  },
  "stored": true,
  "escalationNotified": true,
  "timestamp": "2025-10-06T05:16:09.941Z"
}
💾 Checkpoint created: checkpoint-1759727769941-f5z4gjs (3 tasks completed)

============================================================
EXECUTION SUMMARY
============================================================
Total tasks: 3
Ledger entries: 25

Outputs:
  task-coaching-analyze-transcript: {
  "transcript": {
    "id": "TRANS-5540",
    "agentId": "AG-883",
    "customerSentiment": "NEGATIVE",
    "complianceFlags": [
      "DISCLOSURE_MISSED",
      "CALL_TAG_MISSING"
    ],
    "transcript": [
      "Agent: Thank you for calling Northwind Support, this is Priya.",
      "Customer: I've been waiting three days for someone to unblock my fulfillment feed.",
      "Agent: I can see the backlog and I'm escalating to our ops team right now.",
      "Customer: This is costing me money every hour.",
      "Agent: I completely understand how frustrating that is and I'm logging an urgent ticket.",
      "Agent: You'll get an update within the next two hours and I'll follow up personally.",
      "Customer: Please make sure someone actually reaches out this time.",
      "Agent: Absolutely, I'll send you confirmation as soon as I have it."
    ],
    "callDurationSeconds": 780,
    "followUpRequired": true
  },
  "sentimentScore": 0.25,
  "complianceScore": 0.6499999999999999,
  "complianceBreaches": [
    "DISCLOSURE_MISSED",
    "CALL_TAG_MISSING"
  ],
  "highlights": [
    "Customer requested follow-up action",
    "Empathy signal captured: \"Agent: I completely understand how frustrating that is and I'm logging an urgent ticket.\""
  ],
  "summary": "Agent: Thank you for calling Northwind Support, this is Priya. Customer: I've been waiting three days for someone to unblock my fulfillment feed. Agent: I can see the backlog and I'm escalating to our ops team right now. Customer: This is costing me money every hour. Agent: I completely understand how frustrating that is and I'm logging an urgent ticket. Agent: You'll get an update within the next two hours and I'll follow up personally."
}
  task-coaching-generate-feedback: {
  "transcriptId": "TRANS-5540",
  "feedbackSummary": "Overall sentiment scored at 25%. Compliance adherence at 65%.",
  "actionItems": [
    "Address compliance items: DISCLOSURE_MISSED, CALL_TAG_MISSING",
    "Practice empathy statements to de-escalate frustrated customers",
    "Acknowledge customer feelings before delivering resolution details"
  ],
  "escalationRequired": true
}
  task-coaching-log-note: {
  "logId": "coach-1759727769941",
  "agent": {
    "id": "AG-883",
    "name": "Priya Singh",
    "region": "AMER",
    "tenureMonths": 28,
    "managerEmail": "luis.mendez@northwind.example"
  },
  "stored": true,
  "escalationNotified": true,
  "timestamp": "2025-10-06T05:16:09.941Z"
}

✅ Demo completed successfully!
```

---

## Scenario: Invoice Reconciliation

```bash

node$ pnpm --filter @acm/examples demo --scenario invoices --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1

> @acm/examples@0.1.0 demo /mnt/backup1/home/manna/workspace/ml/ddse/ddse-composer/framework/node/packages/acm-examples
> node ./dist/bin/acm-demo.js "--scenario" "invoices" "--provider" "vllm" "--model" "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8" "--base-url" "http://localhost:8001/v1"


🎯 Scenario: Invoice Reconciliation
   Key: invoices
   Description: Compare invoice line-items against a purchase order and archive the findings report.

📋 Planning...



Generated 1 plan.

📝 Planner plan summary (first plan):
{
  "id": "plan-a",
  "contextRef": "aa8cf17d82b301702e74eeea2ab76046d8dc642a9e3b2e5c039f73518fdb49ef",
  "tasks": [
    {
      "id": "task-invoice-fetch",
      "capability": "invoice.fetch",
      "hasInput": true,
      "inputPreview": {
        "invoiceId": "INV-84721"
      }
    },
    {
      "id": "task-invoice-fetch-po",
      "capability": "invoice.fetch_purchase_order",
      "hasInput": true,
      "inputPreview": {
        "purchaseOrderId": "PO-99231"
      }
    },
    {
      "id": "task-invoice-compare-lines",
      "capability": "invoice.compare_line_items",
      "hasInput": false,
      "inputPreview": {}
    },
    {
      "id": "task-invoice-record-findings",
      "capability": "invoice.record_findings",
      "hasInput": false,
      "inputPreview": {}
    }
  ]
}


✅ Plans generated: 1
Executing plan plan-a
Context Ref: aa8cf17d82b301702e74eeea2ab76046d8dc642a9e3b2e5c039f73518fdb49ef
Tasks:
  1. task-invoice-fetch -> invoice.fetch
  2. task-invoice-fetch-po -> invoice.fetch_purchase_order
  3. task-invoice-compare-lines -> invoice.compare_line_items
  4. task-invoice-record-findings -> invoice.record_findings


[task-invoice-fetch] Task started
[task-invoice-fetch] ✓ Task completed
  Output: {
  "invoice": {
    "id": "INV-84721",
    "supplier": "Skyline Components",
    "total": 18450,
    "currency": "USD",
    "purchaseOrderId": "PO-99231",
    "receivedAt": "2025-09-29T14:12:00Z",
    "lines": [
      {
        "sku": "SRV-FW-EDGE",
        "description": "Edge firewall appliance",
        "quantity": 5,
        "unitPrice": 2500
      },
      {
        "sku": "SRV-SUP-24M",
        "description": "24 month premium support",
        "quantity": 5,
        "unitPrice": 190
      }
    ]
  }
}
💾 Checkpoint created: checkpoint-1759727264660-cz42aob (1 tasks completed)

[task-invoice-fetch-po] Task started
[task-invoice-fetch-po] ✓ Task completed
  Output: {
  "purchaseOrder": {
    "id": "PO-99231",
    "initiator": "Darius Patel",
    "department": "Network Engineering",
    "total": 18500,
    "currency": "USD",
    "status": "approved",
    "lines": [
      {
        "sku": "SRV-FW-EDGE",
        "description": "Edge firewall appliance",
        "quantity": 5,
        "unitPrice": 2500
      },
      {
        "sku": "SRV-SUP-24M",
        "description": "24 month premium support",
        "quantity": 5,
        "unitPrice": 200
      }
    ]
  }
}
💾 Checkpoint created: checkpoint-1759727264662-su7kz8g (2 tasks completed)

[task-invoice-compare-lines] Task started
[task-invoice-compare-lines] ✓ Task completed
  Output: {
  "discrepancies": [
    {
      "sku": "SRV-SUP-24M",
      "expectedQuantity": 5,
      "actualQuantity": 5,
      "expectedPrice": 200,
      "actualPrice": 190,
      "varianceAmount": -50
    }
  ],
  "variance": -50,
  "matchedLines": 1
}
💾 Checkpoint created: checkpoint-1759727264664-bbo5ziu (3 tasks completed)

[task-invoice-record-findings] Task started
[task-invoice-record-findings] ✓ Task completed
  Output: {
  "reportId": "recon-1759727264666",
  "status": "needs_remediation",
  "summary": "Invoice INV-84721 has 1 discrepancy(s)",
  "nextSteps": [
    "Open remediation ticket with procurement",
    "Notify accounts payable supervisor",
    "Schedule supplier follow-up call"
  ],
  "generatedAt": "2025-10-06T05:07:44.666Z"
}
💾 Checkpoint created: checkpoint-1759727264666-yhmp0fb (4 tasks completed)

============================================================
EXECUTION SUMMARY
============================================================
Total tasks: 4
Ledger entries: 32

Outputs:
  task-invoice-fetch: {
  "invoice": {
    "id": "INV-84721",
    "supplier": "Skyline Components",
    "total": 18450,
    "currency": "USD",
    "purchaseOrderId": "PO-99231",
    "receivedAt": "2025-09-29T14:12:00Z",
    "lines": [
      {
        "sku": "SRV-FW-EDGE",
        "description": "Edge firewall appliance",
        "quantity": 5,
        "unitPrice": 2500
      },
      {
        "sku": "SRV-SUP-24M",
        "description": "24 month premium support",
        "quantity": 5,
        "unitPrice": 190
      }
    ]
  }
}
  task-invoice-fetch-po: {
  "purchaseOrder": {
    "id": "PO-99231",
    "initiator": "Darius Patel",
    "department": "Network Engineering",
    "total": 18500,
    "currency": "USD",
    "status": "approved",
    "lines": [
      {
        "sku": "SRV-FW-EDGE",
        "description": "Edge firewall appliance",
        "quantity": 5,
        "unitPrice": 2500
      },
      {
        "sku": "SRV-SUP-24M",
        "description": "24 month premium support",
        "quantity": 5,
        "unitPrice": 200
      }
    ]
  }
}
  task-invoice-compare-lines: {
  "discrepancies": [
    {
      "sku": "SRV-SUP-24M",
      "expectedQuantity": 5,
      "actualQuantity": 5,
      "expectedPrice": 200,
      "actualPrice": 190,
      "varianceAmount": -50
    }
  ],
  "variance": -50,
  "matchedLines": 1
}
  task-invoice-record-findings: {
  "reportId": "recon-1759727264666",
  "status": "needs_remediation",
  "summary": "Invoice INV-84721 has 1 discrepancy(s)",
  "nextSteps": [
    "Open remediation ticket with procurement",
    "Notify accounts payable supervisor",
    "Schedule supplier follow-up call"
  ],
  "generatedAt": "2025-10-06T05:07:44.666Z"
}

✅ Demo completed successfully!

```

---

## Scenario: Incident Triage

```bash

node$ pnpm --filter @acm/examples demo --scenario incidents --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1

> @acm/examples@0.1.0 demo /mnt/backup1/home/manna/workspace/ml/ddse/ddse-composer/framework/node/packages/acm-examples
> node ./dist/bin/acm-demo.js "--scenario" "incidents" "--provider" "vllm" "--model" "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8" "--base-url" "http://localhost:8001/v1"


🎯 Scenario: Incident Triage
   Key: incidents
   Description: Classify a critical incident, route it to the correct queue, and escalate if required.

📋 Planning...



Generated 1 plan.

📝 Planner plan summary (first plan):
{
  "id": "plan-a",
  "contextRef": "142c26f1c50e5f00f2829cd10732a52e44345ec1b5e4804a338fca9d026ebf1e",
  "tasks": [
    {
      "id": "task-incident-fetch",
      "capability": "incident.fetch",
      "hasInput": true,
      "inputPreview": {
        "incidentId": "INC-2045"
      }
    },
    {
      "id": "task-incident-classify",
      "capability": "incident.classify_severity",
      "hasInput": true,
      "inputPreview": {
        "incidentId": "INC-2045"
      }
    },
    {
      "id": "task-incident-route",
      "capability": "incident.select_queue",
      "hasInput": true,
      "inputPreview": {
        "incidentId": "INC-2045"
      }
    },
    {
      "id": "task-incident-escalate",
      "capability": "incident.escalate",
      "hasInput": true,
      "inputPreview": {
        "incidentId": "INC-2045"
      }
    }
  ]
}


✅ Plans generated: 1
Executing plan plan-a
Context Ref: 142c26f1c50e5f00f2829cd10732a52e44345ec1b5e4804a338fca9d026ebf1e
Tasks:
  1. task-incident-fetch -> incident.fetch
  2. task-incident-classify -> incident.classify_severity
  3. task-incident-route -> incident.select_queue
  4. task-incident-escalate -> incident.escalate


[task-incident-fetch] Task started
[task-incident-fetch] ✓ Task completed
  Output: {
  "incident": {
    "id": "INC-2045",
    "service": "checkout-api",
    "reportedAt": "2025-10-05T03:22:00Z",
    "customerImpact": "MAJOR",
    "category": "OUTAGE",
    "signalScore": 0.91,
    "declaredSeverity": "CRITICAL",
    "vipCustomer": true
  }
}
💾 Checkpoint created: checkpoint-1759726839432-kehm6hw (1 tasks completed)

[task-incident-classify] Task started
[task-incident-classify] ✓ Task completed
  Output: {
  "severity": "CRITICAL",
  "score": 120.91,
  "rationale": [
    "Declared severity CRITICAL provides base score 80",
    "Major customer impact adds 30 points",
    "Signal score contribution: 0.91",
    "VIP customer flag adds 10 points",
    "Composite score 120.91 maps to severity CRITICAL"
  ]
}
💾 Checkpoint created: checkpoint-1759726839434-3vwkk9m (2 tasks completed)

[task-incident-route] Task started
[task-incident-route] ✓ Task completed
  Output: {
  "queue": "incident-bridge",
  "rule": {
    "id": "ROUTE-CHECKOUT-CRITICAL",
    "service": "checkout-api",
    "category": "OUTAGE",
    "minSeverity": "HIGH",
    "queue": "incident-bridge",
    "escalatesTo": "director-oncall@northwind.example",
    "notes": "Critical checkout outages route directly to the incident bridge."
  },
  "escalationRequired": true,
  "rationale": [
    "Matched routing rule ROUTE-CHECKOUT-CRITICAL for service checkout-api category OUTAGE",
    "Escalation target defined: director-oncall@northwind.example",
    "Routing notes: Critical checkout outages route directly to the incident bridge."
  ]
}
💾 Checkpoint created: checkpoint-1759726839436-m4fjyyo (3 tasks completed)

[task-incident-escalate] Task started
[task-incident-escalate] ✓ Task completed
  Output: {
  "escalated": true,
  "ticketId": "esc-1759726839438",
  "target": "director-oncall@northwind.example",
  "reason": "Matched routing rule ROUTE-CHECKOUT-CRITICAL for service checkout-api category OUTAGE Escalation target defined: director-oncall@northwind.example Routing notes: Critical checkout outages route directly to the incident bridge.",
  "timestamp": "2025-10-06T05:00:39.438Z"
}
💾 Checkpoint created: checkpoint-1759726839438-o9jkgnf (4 tasks completed)

============================================================
EXECUTION SUMMARY
============================================================
Total tasks: 4
Ledger entries: 32

Outputs:
  task-incident-fetch: {
  "incident": {
    "id": "INC-2045",
    "service": "checkout-api",
    "reportedAt": "2025-10-05T03:22:00Z",
    "customerImpact": "MAJOR",
    "category": "OUTAGE",
    "signalScore": 0.91,
    "declaredSeverity": "CRITICAL",
    "vipCustomer": true
  }
}
  task-incident-classify: {
  "severity": "CRITICAL",
  "score": 120.91,
  "rationale": [
    "Declared severity CRITICAL provides base score 80",
    "Major customer impact adds 30 points",
    "Signal score contribution: 0.91",
    "VIP customer flag adds 10 points",
    "Composite score 120.91 maps to severity CRITICAL"
  ]
}
  task-incident-route: {
  "queue": "incident-bridge",
  "rule": {
    "id": "ROUTE-CHECKOUT-CRITICAL",
    "service": "checkout-api",
    "category": "OUTAGE",
    "minSeverity": "HIGH",
    "queue": "incident-bridge",
    "escalatesTo": "director-oncall@northwind.example",
    "notes": "Critical checkout outages route directly to the incident bridge."
  },
  "escalationRequired": true,
  "rationale": [
    "Matched routing rule ROUTE-CHECKOUT-CRITICAL for service checkout-api category OUTAGE",
    "Escalation target defined: director-oncall@northwind.example",
    "Routing notes: Critical checkout outages route directly to the incident bridge."
  ]
}
  task-incident-escalate: {
  "escalated": true,
  "ticketId": "esc-1759726839438",
  "target": "director-oncall@northwind.example",
  "reason": "Matched routing rule ROUTE-CHECKOUT-CRITICAL for service checkout-api category OUTAGE Escalation target defined: director-oncall@northwind.example Routing notes: Critical checkout outages route directly to the incident bridge.",
  "timestamp": "2025-10-06T05:00:39.438Z"
}

✅ Demo completed successfully!

```

---

## Scenario: Knowledge Acceleration

```bash

node$ pnpm --filter @acm/examples demo --scenario knowledge --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1

> @acm/examples@0.1.0 demo /mnt/backup1/home/manna/workspace/ml/ddse/ddse-composer/framework/node/packages/acm-examples
> node ./dist/bin/acm-demo.js "--scenario" "knowledge" "--provider" "vllm" "--model" "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8" "--base-url" "http://localhost:8001/v1"


🎯 Scenario: Knowledge Acceleration
   Key: knowledge
   Description: Retrieve and summarize knowledge for an urgent latency regression and produce follow-up actions.

📋 Planning...


Generated 1 plan.

📝 Planner plan summary (first plan):
{
  "id": "plan-a",
  "contextRef": "e977e7799eb2c2ff5ee2d4f6e437f352b1858a60632ceeb465d79585dd9733b6",
  "tasks": [
    {
      "id": "task-knowledge-search",
      "capability": "knowledge.search",
      "hasInput": true,
      "inputPreview": {
        "query": "latency regression mitigation guidance"
      }
    },
    {
      "id": "task-knowledge-summarize",
      "capability": "knowledge.summarize",
      "hasInput": true,
      "inputPreview": {
        "docId": "KB-003"
      }
    },
    {
      "id": "task-knowledge-followups",
      "capability": "knowledge.followups",
      "hasInput": true,
      "inputPreview": {
        "query": "latency regression mitigation guidance"
      }
    }
  ]
}


✅ Plans generated: 1
Executing plan plan-a
Context Ref: e977e7799eb2c2ff5ee2d4f6e437f352b1858a60632ceeb465d79585dd9733b6
Tasks:
  1. task-knowledge-search -> knowledge.search
  2. task-knowledge-summarize -> knowledge.summarize
  3. task-knowledge-followups -> knowledge.followups


[task-knowledge-search] Task started
[task-knowledge-search] ✓ Task completed
  Output: {
  "hits": [
    {
      "id": "KB-003",
      "title": "Stabilizing API latency regressions",
      "tags": [
        "incident",
        "performance",
        "api"
      ],
      "path": "docs/kb-003.md",
      "summary": "Checklist for diagnosing elevated API latency including caching, rollout, and alerting steps.",
      "score": 1
    }
  ]
}
💾 Checkpoint created: checkpoint-1759728757613-60qot6y (1 tasks completed)

[task-knowledge-summarize] Task started
[task-knowledge-summarize] ✓ Task completed
  Output: {
  "docId": "KB-003",
  "title": "Stabilizing API latency regressions",
  "summary": "# Stabilizing API latency regressions Monitoring detected elevated p95 latency across the public REST API. Follow this checklist: 1. Inspect deployment history for the impacted service and roll back if a canary exceeded SLOs.",
  "highlights": [
    "# Stabilizing API latency regressions",
    "Monitoring detected elevated p95 latency across the public REST API. Follow this checklist:",
    "1. Inspect deployment history for the impacted service and roll back if a canary exceeded SLOs."
  ],
  "followups": [
    "Log follow-up tasks in support queue"
  ]
}
💾 Checkpoint created: checkpoint-1759728757616-vh7pbha (2 tasks completed)

[task-knowledge-followups] Task started
[task-knowledge-followups] ✓ Task completed
  Output: {
  "docId": "KB-003",
  "suggestions": [
    {
      "action": "Log follow-up tasks in support queue",
      "owner": "support.enablement",
      "dueInHours": 8
    }
  ]
}
💾 Checkpoint created: checkpoint-1759728757618-90r11a8 (3 tasks completed)

============================================================
EXECUTION SUMMARY
============================================================
Total tasks: 3
Ledger entries: 25

Outputs:
  task-knowledge-search: {
  "hits": [
    {
      "id": "KB-003",
      "title": "Stabilizing API latency regressions",
      "tags": [
        "incident",
        "performance",
        "api"
      ],
      "path": "docs/kb-003.md",
      "summary": "Checklist for diagnosing elevated API latency including caching, rollout, and alerting steps.",
      "score": 1
    }
  ]
}
  task-knowledge-summarize: {
  "docId": "KB-003",
  "title": "Stabilizing API latency regressions",
  "summary": "# Stabilizing API latency regressions Monitoring detected elevated p95 latency across the public REST API. Follow this checklist: 1. Inspect deployment history for the impacted service and roll back if a canary exceeded SLOs.",
  "highlights": [
    "# Stabilizing API latency regressions",
    "Monitoring detected elevated p95 latency across the public REST API. Follow this checklist:",
    "1. Inspect deployment history for the impacted service and roll back if a canary exceeded SLOs."
  ],
  "followups": [
    "Log follow-up tasks in support queue"
  ]
}
  task-knowledge-followups: {
  "docId": "KB-003",
  "suggestions": [
    {
      "action": "Log follow-up tasks in support queue",
      "owner": "support.enablement",
      "dueInHours": 8
    }
  ]
}

✅ Demo completed successfully!

```

---

## Scenario: Entitlement Decisioning

```bash
node$ pnpm --filter @acm/examples demo --scenario entitlement --provider vllm --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --base-url http://localhost:8001/v1

> @acm/examples@0.1.0 demo /mnt/backup1/home/manna/workspace/ml/ddse/ddse-composer/framework/node/packages/acm-examples
> node ./dist/bin/acm-demo.js "--scenario" "entitlement" "--provider" "vllm" "--model" "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8" "--base-url" "http://localhost:8001/v1"


🎯 Scenario: Entitlement Decisioning
   Key: entitlement
   Description: Evaluate a premium benefit entitlement and notify the supervisor with the decision.

📋 Planning...



Generated 1 plan.

📝 Planner plan summary (first plan):
{
  "id": "plan-a",
  "contextRef": "94dcf9ec83c5b71661802beeb62380df7f7821395d0b24099649b71294540cf2",
  "tasks": [
    {
      "id": "task-entitlement-fetch-customer",
      "capability": "entitlement.fetch_customer_profile",
      "hasInput": true,
      "inputPreview": {
        "customerId": "CUST-104233"
      }
    },
    {
      "id": "task-entitlement-evaluate",
      "capability": "entitlement.evaluate",
      "hasInput": true,
      "inputPreview": {
        "customerId": "CUST-104233",
        "benefitCode": "BEN-ANALYTICS-LABS"
      }
    },
    {
      "id": "task-entitlement-notify-supervisor",
      "capability": "entitlement.notify_supervisor",
      "hasInput": true,
      "inputPreview": {
        "customerId": "CUST-104233",
        "benefitCode": "BEN-ANALYTICS-LABS"
      }
    }
  ]
}


✅ Plans generated: 1
Executing plan plan-a
Context Ref: 94dcf9ec83c5b71661802beeb62380df7f7821395d0b24099649b71294540cf2
Tasks:
  1. task-entitlement-fetch-customer -> entitlement.fetch_customer_profile
  2. task-entitlement-evaluate -> entitlement.evaluate
  3. task-entitlement-notify-supervisor -> entitlement.notify_supervisor


[task-entitlement-fetch-customer] Task started
[task-entitlement-fetch-customer] ✓ Task completed
  Output: {
  "customer": {
    "id": "CUST-104233",
    "name": "Sofia Anders",
    "tier": "PLATINUM",
    "accountAgeDays": 2190,
    "complianceFlags": [],
    "benefits": [
      "BEN-TRAVEL-PLUS",
      "BEN-PRIORITY-SUPPORT",
      "BEN-ANALYTICS-LABS"
    ],
    "supervisor": {
      "name": "Dylan Mistry",
      "email": "dylan.mistry@northwind.example"
    }
  }
}
💾 Checkpoint created: checkpoint-1759728938198-c0qb5u6 (1 tasks completed)

[task-entitlement-evaluate] Task started
[task-entitlement-evaluate] ✓ Task completed
  Output: {
  "decision": "allow",
  "policy": {
    "id": "POL-ANALYTICS-LABS",
    "benefitCode": "BEN-ANALYTICS-LABS",
    "description": "Early access to analytics beta features.",
    "requiredTier": "PLATINUM",
    "minAccountAgeDays": 1460,
    "requiresComplianceClearance": true,
    "slaMinutes": 120
  },
  "customer": {
    "id": "CUST-104233",
    "name": "Sofia Anders",
    "tier": "PLATINUM",
    "accountAgeDays": 2190,
    "complianceFlags": [],
    "benefits": [
      "BEN-TRAVEL-PLUS",
      "BEN-PRIORITY-SUPPORT",
      "BEN-ANALYTICS-LABS"
    ],
    "supervisor": {
      "name": "Dylan Mistry",
      "email": "dylan.mistry@northwind.example"
    }
  },
  "slaMinutes": 120,
  "rationale": [
    "Customer tier PLATINUM satisfies required tier PLATINUM",
    "Account age 2190 days exceeds minimum 1460 days",
    "No compliance holds found for customer",
    "Entitlement approved according to policy requirements"
  ],
  "violations": []
}
💾 Checkpoint created: checkpoint-1759728938201-6vlg38z (2 tasks completed)

[task-entitlement-notify-supervisor] Task started
[task-entitlement-notify-supervisor] ✓ Task completed
  Output: {
  "notified": true,
  "channel": "email",
  "supervisor": {
    "name": "Dylan Mistry",
    "email": "dylan.mistry@northwind.example"
  },
  "messageId": "notif-1759728938202",
  "timestamp": "2025-10-06T05:35:38.202Z"
}
💾 Checkpoint created: checkpoint-1759728938203-ybx0h0f (3 tasks completed)

============================================================
EXECUTION SUMMARY
============================================================
Total tasks: 3
Ledger entries: 25

Outputs:
  task-entitlement-fetch-customer: {
  "customer": {
    "id": "CUST-104233",
    "name": "Sofia Anders",
    "tier": "PLATINUM",
    "accountAgeDays": 2190,
    "complianceFlags": [],
    "benefits": [
      "BEN-TRAVEL-PLUS",
      "BEN-PRIORITY-SUPPORT",
      "BEN-ANALYTICS-LABS"
    ],
    "supervisor": {
      "name": "Dylan Mistry",
      "email": "dylan.mistry@northwind.example"
    }
  }
}
  task-entitlement-evaluate: {
  "decision": "allow",
  "policy": {
    "id": "POL-ANALYTICS-LABS",
    "benefitCode": "BEN-ANALYTICS-LABS",
    "description": "Early access to analytics beta features.",
    "requiredTier": "PLATINUM",
    "minAccountAgeDays": 1460,
    "requiresComplianceClearance": true,
    "slaMinutes": 120
  },
  "customer": {
    "id": "CUST-104233",
    "name": "Sofia Anders",
    "tier": "PLATINUM",
    "accountAgeDays": 2190,
    "complianceFlags": [],
    "benefits": [
      "BEN-TRAVEL-PLUS",
      "BEN-PRIORITY-SUPPORT",
      "BEN-ANALYTICS-LABS"
    ],
    "supervisor": {
      "name": "Dylan Mistry",
      "email": "dylan.mistry@northwind.example"
    }
  },
  "slaMinutes": 120,
  "rationale": [
    "Customer tier PLATINUM satisfies required tier PLATINUM",
    "Account age 2190 days exceeds minimum 1460 days",
    "No compliance holds found for customer",
    "Entitlement approved according to policy requirements"
  ],
  "violations": []
}
  task-entitlement-notify-supervisor: {
  "notified": true,
  "channel": "email",
  "supervisor": {
    "name": "Dylan Mistry",
    "email": "dylan.mistry@northwind.example"
  },
  "messageId": "notif-1759728938202",
  "timestamp": "2025-10-06T05:35:38.202Z"
}

✅ Demo completed successfully!

```
