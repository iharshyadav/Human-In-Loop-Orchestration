# Human-in-the-Loop Workflow API Documentation

## Trigger Dynamic Approval Workflow

**Endpoint:** `POST /api/workflow/trigger`

**Description:** Triggers a new approval workflow with custom data, assignees, and UI configuration.

### Request Body

```json
{
  "workflowName": "Purchase Approval Flow",  // Optional, default: "Purchase Approval Flow"
  "type": "purchase_approval",                // Optional, default: "purchase_approval"
  "purchaseData": {                           // Required - Your purchase/request data
    "amount": 5000,
    "item": "AWS Credits",
    "description": "Cloud infrastructure costs",
    "requestedBy": "john.doe@company.com",
    "department": "Engineering"
  },
  "assignee": "finance@company.com",          // Optional, default: "Admin"
  "assigneeId": "user_id_from_database",      // Optional - User ID from your User model
  "stepId": "finance_review_step",            // Optional, default: "finance_review_step"
  "channel": "web",                           // Optional: "web" | "slack" | "email", default: "web"
  "expiresAt": "2025-10-25T12:00:00Z",       // Optional - ISO timestamp
  "createdById": "creator_user_id",           // Optional - User ID who created workflow
  "uiSchema": {                               // Optional - Custom UI schema for approval form
    "type": "form",
    "fields": [
      {
        "name": "comment",
        "type": "text",
        "label": "Add a note",
        "required": false
      },
      {
        "name": "decision",
        "type": "radio",
        "options": ["approve", "reject"],
        "required": true
      },
      {
        "name": "budget_allocation",
        "type": "select",
        "label": "Budget Category",
        "options": ["operations", "marketing", "development"]
      }
    ]
  }
}
```

### Response

```json
{
  "success": true,
  "message": "Approval workflow triggered successfully",
  "data": {
    "eventId": ["01JBXY..."],
    "triggeredAt": "2025-10-22T09:00:00.000Z"
  }
}
```

---

## Get Pending Approvals

**Endpoint:** `GET /api/approval/pending`

**Description:** Retrieves all pending approval tasks with their dynamic UI schemas.

### Response

```json
{
  "success": true,
  "count": 2,
  "tasks": [
    {
      "taskId": "68f7428f3c20cba37145d667",
      "workflowId": "68f7428f3c20cba37145d666",
      "stepId": "finance_review_step",
      "assignee": "finance@company.com",
      "status": "pending",
      "channel": "web",
      "createdAt": "2025-10-22T08:00:00.000Z",
      "expiresAt": "2025-10-25T12:00:00.000Z",
      "uiSchema": {
        "type": "form",
        "fields": [
          {
            "name": "comment",
            "type": "text",
            "label": "Add a note"
          },
          {
            "name": "decision",
            "type": "radio",
            "options": ["approve", "reject"]
          }
        ]
      },
      "workflow": {
        "id": "68f7428f3c20cba37145d666",
        "name": "Purchase Approval Flow",
        "status": "waiting_approval",
        "context": {
          "amount": 5000,
          "item": "AWS Credits"
        }
      },
      "metadata": {
        "workflowName": "Purchase Approval Flow",
        "workflowContext": {
          "amount": 5000,
          "item": "AWS Credits"
        }
      }
    }
  ]
}
```

---

## Submit Approval Decision

**Endpoint:** `POST /api/approval/:taskId/submit`

**Description:** Submit an approval or rejection decision for a pending task.

### Request Body

```json
{
  "status": "approve",  // Required: "approve" or "reject"
  "comment": "Budget approved for Q4",
  "approvedBy": "john.doe@company.com"
}
```

### Response

```json
{
  "success": true,
  "message": "Approval approved successfully",
  "task": {
    "taskId": "68f7428f3c20cba37145d667",
    "workflowId": "68f7428f3c20cba37145d666",
    "status": "approved",
    "response": {
      "status": "approve",
      "comment": "Budget approved for Q4",
      "approvedBy": "john.doe@company.com",
      "timestamp": "2025-10-22T09:30:00.000Z"
    }
  }
}
```

---

## Get Workflow History

**Endpoint:** `GET /api/workflow/history/:workflowGroupId`

**Description:** Retrieve complete version history of a workflow.

### Response

```json
{
  "success": true,
  "workflowGroupId": "wf_1729583425000_abc123",
  "totalVersions": 3,
  "history": [
    {
      "id": "68f7428f3c20cba37145d668",
      "version": 3,
      "status": "approved",
      "currentStep": "purchase_execution",
      "isLatest": true,
      "createdAt": "2025-10-22T09:30:00.000Z",
      "updatedAt": "2025-10-22T09:30:00.000Z",
      "context": { "amount": 5000, "item": "AWS Credits" },
      "eventsCount": 1,
      "tasksCount": 0
    },
    {
      "id": "68f7428f3c20cba37145d667",
      "version": 2,
      "status": "waiting_approval",
      "currentStep": "finance_review_step",
      "isLatest": false,
      "createdAt": "2025-10-22T09:00:00.000Z",
      "updatedAt": "2025-10-22T09:00:00.000Z",
      "context": { "amount": 5000, "item": "AWS Credits" },
      "eventsCount": 1,
      "tasksCount": 1
    },
    {
      "id": "68f7428f3c20cba37145d666",
      "version": 1,
      "status": "running",
      "currentStep": "first_step",
      "isLatest": false,
      "createdAt": "2025-10-22T08:59:00.000Z",
      "updatedAt": "2025-10-22T08:59:00.000Z",
      "context": { "amount": 5000, "item": "AWS Credits" },
      "eventsCount": 1,
      "tasksCount": 1
    }
  ]
}
```

---

## Example: Frontend Integration

### Trigger Workflow from Frontend

```javascript
// Example: Submit purchase approval request
const triggerApprovalWorkflow = async (purchaseData) => {
  const response = await fetch('http://localhost:3000/api/workflow/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowName: 'AWS Purchase Request',
      purchaseData: {
        amount: 5000,
        item: 'AWS Credits',
        description: 'Infrastructure costs for Q4',
        requestedBy: 'engineering@company.com'
      },
      assignee: 'finance@company.com',
      assigneeId: '68f7400000000000000001', // Optional User ID
      uiSchema: {
        type: 'form',
        fields: [
          { name: 'comment', type: 'text', label: 'Comments' },
          { name: 'decision', type: 'radio', options: ['approve', 'reject'] },
          { name: 'priority', type: 'select', options: ['low', 'medium', 'high'] }
        ]
      },
      channel: 'web',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    })
  });
  
  return await response.json();
};

// Example: Fetch pending approvals
const getPendingApprovals = async () => {
  const response = await fetch('http://localhost:3000/api/approval/pending');
  const data = await response.json();
  
  // Render dynamic UI based on uiSchema
  data.tasks.forEach(task => {
    renderApprovalForm(task.uiSchema, task.taskId);
  });
};

// Example: Submit approval
const submitApproval = async (taskId, status, comment) => {
  const response = await fetch(`http://localhost:3000/api/approval/${taskId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status, // 'approve' or 'reject'
      comment,
      approvedBy: 'john.doe@company.com'
    })
  });
  
  return await response.json();
};
```

---

## UI Schema Format

The `uiSchema` field allows you to define custom approval forms dynamically:

### Field Types

1. **Text Input**
```json
{
  "name": "comment",
  "type": "text",
  "label": "Add your comment",
  "required": false,
  "placeholder": "Enter text here"
}
```

2. **Radio Buttons**
```json
{
  "name": "decision",
  "type": "radio",
  "options": ["approve", "reject"],
  "required": true
}
```

3. **Select Dropdown**
```json
{
  "name": "priority",
  "type": "select",
  "label": "Priority Level",
  "options": ["low", "medium", "high", "urgent"]
}
```

4. **Checkbox**
```json
{
  "name": "terms_accepted",
  "type": "checkbox",
  "label": "I accept the terms"
}
```

5. **Number Input**
```json
{
  "name": "allocated_budget",
  "type": "number",
  "label": "Allocated Budget",
  "min": 0,
  "max": 100000
}
```

---

## Workflow States

- `running` - Initial state, workflow just created
- `waiting_approval` - Workflow paused, waiting for human decision
- `approved` - Request approved
- `rejected` - Request rejected/denied

Each state change creates a new workflow version for complete audit trail.
