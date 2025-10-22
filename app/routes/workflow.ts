import express from 'express';
import { getWorkflowHistory, getLatestWorkflowVersion } from '../utils/workflowVersioning';
import prisma from '../database/db';
import { inngest } from '../inngest/client';

const router = express.Router();

// GET /api/workflow/history/:workflowGroupId - Get full workflow history
router.get('/history/:workflowGroupId', async (req, res) => {
  try {
    const { workflowGroupId } = req.params;

    const history = await getWorkflowHistory(workflowGroupId);

    if (!history || history.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      workflowGroupId,
      totalVersions: history.length,
      history: history.map(wf => ({
        id: wf.id,
        version: wf.version,
        status: wf.status,
        currentStep: wf.currentStep,
        isLatest: wf.isLatest,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        context: wf.context,
        eventsCount: wf.events.length,
        tasksCount: wf.humanTasks.length
      }))
    });

  } catch (error) {
    console.error('Error fetching workflow history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/workflow/latest/:workflowGroupId - Get latest version of workflow
router.get('/latest/:workflowGroupId', async (req, res) => {
  try {
    const { workflowGroupId } = req.params;

    const workflow = await getLatestWorkflowVersion(workflowGroupId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        workflowGroupId: workflow.workflowGroupId,
        version: workflow.version,
        name: workflow.name,
        status: workflow.status,
        currentStep: workflow.currentStep,
        context: workflow.context,
        isLatest: workflow.isLatest,
        previousVersionId: workflow.previousVersionId,
        createdBy: workflow.createdBy,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        events: workflow.events,
        humanTasks: workflow.humanTasks,
        compensations: workflow.compensations
      }
    });

  } catch (error) {
    console.error('Error fetching latest workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest workflow',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/workflow/:workflowId - Get specific workflow version
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        events: true,
        humanTasks: true,
        compensations: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow version not found'
      });
    }

    res.json({
      success: true,
      workflow
    });

  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/workflow - Get all workflows (latest versions only)
router.get('/', async (req, res) => {
  try {
    const { status, latestOnly } = req.query;

    const workflows = await prisma.workflow.findMany({
      where: {
        ...(status && { status: status as string }),
        ...(latestOnly !== 'false' && { isLatest: true })
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        humanTasks: {
          where: {
            status: 'pending'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      count: workflows.length,
      workflows: workflows.map(wf => ({
        id: wf.id,
        workflowGroupId: wf.workflowGroupId,
        version: wf.version,
        name: wf.name,
        status: wf.status,
        currentStep: wf.currentStep,
        isLatest: wf.isLatest,
        createdBy: wf.createdBy,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        pendingTasks: wf.humanTasks.length
      }))
    });

  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/workflow/trigger - Trigger a new approval workflow
router.post('/trigger', async (req, res) => {
  try {
    const {
      workflowName,
      type,
      purchaseData,
      assignee,
      assigneeId,
      stepId,
      uiSchema,
      channel,
      expiresAt,
      createdById
    } = req.body;

    if (!purchaseData) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'purchaseData is required'
      });
    }

    const result = await inngest.send({
      name: 'system.request.approval',
      data: {
        requestId: `req_${Date.now()}`,
        triggeredAt: new Date().toISOString(),
        source: 'api',
        workflowName,
        type,
        purchaseData,
        assignee,
        assigneeId,
        stepId,
        uiSchema,
        channel,
        expiresAt,
        createdById
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Approval workflow triggered successfully',
      data: {
        eventId: result.ids,
        triggeredAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Workflow trigger error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to trigger workflow'
    });
  }
});

export default router;
