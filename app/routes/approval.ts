import express from 'express';
import prisma from '../database/db';
import { inngest } from '../inngest/client';

const router = express.Router();

router.get('/pending', async (req, res) => {
  try {
    const pendingTasks = await prisma.humanTask.findMany({
      where: {
        status: 'pending'
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
            currentStep: true,
            context: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const tasksWithUI = pendingTasks.map(task => ({
      taskId: task.id,
      workflowId: task.workflowId,
      stepId: task.stepId,
      assignee: task.assignee,
      status: task.status,
      channel: task.channel,
      createdAt: task.createdAt,
      expiresAt: task.expiresAt,
      workflow: task.workflow,
      uiSchema: task.uiSchema, 
      metadata: {
        workflowName: task.workflow?.name,
        workflowContext: task.workflow?.context
      }
    }));

    res.json({
      success: true,
      count: tasksWithUI.length,
      tasks: tasksWithUI
    });

  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/approval/:taskId - Get specific approval task
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.humanTask.findUnique({
      where: { id: taskId },
      include: {
        workflow: true
      }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Approval task not found'
      });
    }

    res.json({
      success: true,
      task: {
        taskId: task.id,
        workflowId: task.workflowId,
        stepId: task.stepId,
        assignee: task.assignee,
        status: task.status,
        channel: task.channel,
        createdAt: task.createdAt,
        expiresAt: task.expiresAt,
        uiSchema: task.uiSchema,
        currentResponse: task.response,
        workflow: task.workflow
      }
    });

  } catch (error) {
    console.error('Error fetching approval task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/approval/:taskId/submit - Submit approval decision
router.post('/:taskId/submit', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, comment, approvedBy } = req.body;

    if (!status || !['approve', 'reject'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approve" or "reject"'
      });
    }

    const task = await prisma.humanTask.findUnique({
      where: { id: taskId },
      include: { workflow: true }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Approval task not found'
      });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Task is already ${task.status}. Cannot modify.`
      });
    }

    const updatedTask = await prisma.humanTask.update({
      where: { id: taskId },
      data: {
        status: status === 'approve' ? 'approved' : 'rejected',
        response: {
          status,
          comment: comment || '',
          approvedBy: approvedBy || 'unknown',
          timestamp: new Date().toISOString()
        }
      }
    });

    await inngest.send({
      name: `human.approval.${taskId}`,
      data: {
        taskId: taskId,
        workflowId: task.workflowId,
        status,
        comment: comment || '',
        approvedBy: approvedBy || 'unknown',
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: `Approval ${status === 'approve' ? 'approved' : 'rejected'} successfully`,
      task: {
        taskId: updatedTask.id,
        workflowId: updatedTask.workflowId,
        status: updatedTask.status,
        response: updatedTask.response
      }
    });

  } catch (error) {
    console.error('Error submitting approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit approval',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/approval/workflow/:workflowId/tasks - Get all tasks for a specific workflow
router.get('/workflow/:workflowId/tasks', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const tasks = await prisma.humanTask.findMany({
      where: { workflowId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
            currentStep: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({
      success: true,
      workflowId,
      count: tasks.length,
      tasks: tasks.map(task => ({
        taskId: task.id,
        stepId: task.stepId,
        assignee: task.assignee,
        status: task.status,
        uiSchema: task.uiSchema,
        response: task.response,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching workflow tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow tasks',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;