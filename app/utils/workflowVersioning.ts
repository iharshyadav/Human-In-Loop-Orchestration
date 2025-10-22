import prisma from '../database/db';

interface CreateWorkflowVersionParams {
  workflowGroupId: string;
  name: string;
  status: string;
  currentStep: string;
  context: any;
  createdById?: string;
  previousWorkflowId?: string;
}

export async function createWorkflowVersion(params: CreateWorkflowVersionParams) {
  const { workflowGroupId, previousWorkflowId, ...workflowData } = params;

  let version = 1;
  let previousVersion = null;

  if (previousWorkflowId) {
    previousVersion = await prisma.workflow.findUnique({
      where: { id: previousWorkflowId }
    });

    if (!previousVersion) {
      throw new Error(`Previous workflow version ${previousWorkflowId} not found`);
    }

    version = previousVersion.version + 1;

    await prisma.workflow.update({
      where: { id: previousWorkflowId },
      data: { isLatest: false }
    });
  }

  const newWorkflow = await prisma.workflow.create({
    data: {
      workflowGroupId,
      ...workflowData,
      version,
      isLatest: true,
      previousVersionId: previousWorkflowId || null
    }
  });

  console.log(`Created workflow version ${version} for group ${workflowGroupId}`);
  
  return newWorkflow;
}

export async function getWorkflowHistory(workflowGroupId: string) {
  return await prisma.workflow.findMany({
    where: { workflowGroupId },
    orderBy: { version: 'desc' },
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
}


export async function getLatestWorkflowVersion(workflowGroupId: string) {
  return await prisma.workflow.findFirst({
    where: {
      workflowGroupId,
      isLatest: true
    },
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
}

export function generateWorkflowGroupId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}