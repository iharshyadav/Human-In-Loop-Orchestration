import express, { Request, Response } from 'express';
import { serve } from "inngest/express";
import { functions } from './inngest';
import { inngest } from './inngest/client';
import prisma from './database/db';
import approvalRouter from './routes/approval';
import usersRouter from './routes/users';
import workflowRouter from './routes/workflow';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use('/api/approval', approvalRouter);
app.use('/api/users', usersRouter);
app.use('/api/workflow', workflowRouter);

// Human approval response endpoint
app.post('/api/approval/respond', async (req: Request, res: Response) => {
    try {
        const { humanTaskId, decision, comment, approvedBy } = req.body;
        
        if (!humanTaskId || !decision) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'humanTaskId and decision are required'
            });
        }
        
        if (!['approve', 'reject'].includes(decision)) {
            return res.status(400).json({
                error: 'Invalid decision',
                message: 'Decision must be either "approve" or "reject"'
            });
        }
        
        const humanTask = await prisma.humanTask.findUnique({
            where: { id: humanTaskId },
            include: { workflow: true }
        });
        
        if (!humanTask) {
            return res.status(404).json({
                error: 'Human task not found',
                message: 'The specified human task does not exist'
            });
        }
        
        if (humanTask.status !== 'pending') {
            return res.status(400).json({
                error: 'Task already processed',
                message: `Task status is already ${humanTask.status}`
            });
        }
        
        await inngest.send({
            name: 'human.approval.response',
            data: {
                humanTaskId,
                workflowId: humanTask.workflowId,
                decision,
                comment: comment || '',
                approvedBy: approvedBy || 'anonymous',
                timestamp: new Date().toISOString()
            }
        });
        
        res.status(200).json({
            success: true,
            message: 'Approval response processed successfully',
            data: {
                humanTaskId,
                decision,
                processedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Approval response error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process approval response'
        });
    }
});

// Get pending human tasks
app.get('/api/approval/tasks', async (req: Request, res: Response) => {
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
                        context: true,
                        createdAt: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        res.status(200).json({
            success: true,
            data: pendingTasks,
            count: pendingTasks.length
        });
        
    } catch (error) {
        console.error('Get pending tasks error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve pending tasks'
        });
    }
});

// Trigger approval workflow endpoint
app.post('/api/workflow/trigger', async (req: Request, res: Response) => {
    try {
        const result = await inngest.send({
            name: 'system.request.approval',
            data: {
                requestId: `req_${Date.now()}`,
                triggeredAt: new Date().toISOString(),
                source: 'api'
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

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, harsh!');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;