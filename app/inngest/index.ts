import { processPurchaseApproval } from "../controllers/purchase";
import prisma from "../database/db";
import { inngest } from "./client";
import { createWorkflowVersion, generateWorkflowGroupId } from "../utils/workflowVersioning";
import {v4 as uuid} from "uuid"

interface CreateWorkflowResult {
  statusCode: number | null;
  response: any; 
  workflowId: string;
  workflowGroupId: string;
  humanTaskId: string;
  eventLogId : string;
  statusId : string;
}

export const approvalWorkflow = inngest.createFunction(
  { id: "Human Approval Workflow" },
  { event: "system.request.approval" },
  async ({ event, step }) => {
    
    const createWorkFlow: CreateWorkflowResult = await step.run("workflow.started", async () => {
      let responseData: any;
      let statusCode: number | null = null;
      
      const mockReq = {
        body: {
          type: "purchase_approval",
          data: {
            amount: 1000,
            item: "AWS Credits",
          },
        },
      } as any;
      
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              responseData = data;
              return data;
            }
          };
        },
      } as any;
      
      await processPurchaseApproval(mockReq, mockRes);

      const statusId = uuid();

      const workflowGroupId = generateWorkflowGroupId();
      
      const workflowStarted = await prisma.workflow.create({
        data : {
          workflowGroupId,
          name : "Purchase Approval Flow",
          status : "running",
          currentStep : "first_step",
          context: JSON.parse(JSON.stringify(responseData?.data || {})),
          lastEventId : "null",
          version: 1,
          isLatest: true
        }
      });

      const humanTaskStageOne = await prisma.humanTask.create({
        data: {
          workflowId: workflowStarted.id,
          stepId: "finance_review_step",
          assignee: "Admin",
          uiSchema: {
            type: "form",
            fields: [
              { name: "comment", type: "text", label: "Add a note" },
              {
                name: "decision",
                type: "radio",
                options: ["approve", "reject"],
              },
            ],
          },
          response : {},
          status : "pending",
          channel : "all",
        },
      });

      const eventLogStageOne = await prisma.eventLog.create({
        data : {
          workflowId : workflowStarted.id,
          stepId : "finance_review_step",
          type : "workflow.started",
          data : {
            type: "form",
            fields: [
              { name: "comment", type: "text", label: "Add a note" },
              {
                name: "decision",
                type: "radio",
                options: ["approve", "reject"],
              },
            ],
          },
          actor : "system.bot",
        }
      })
      
      return {
        statusCode,
        response: responseData,
        workflowId: workflowStarted.id,
        workflowGroupId: workflowStarted.workflowGroupId,
        humanTaskId : humanTaskStageOne.id,
        eventLogId : eventLogStageOne.id,
        statusId : statusId
      };
    });

    console.log('Purchase workflow created:', createWorkFlow);
    
    if (createWorkFlow.statusCode !== 200) {
      throw new Error(`Purchase creation failed: ${createWorkFlow.response.message}`);
    }
    
    const purchaseData = createWorkFlow.response.data;

    const waitingWorkflow = await step.run("mark_waiting_approval", async () => {
      const previousWorkflow = await prisma.workflow.findUnique({
        where: { id: createWorkFlow.workflowId }
      });

      if (!previousWorkflow) throw new Error('Workflow not found');

      const newVersion = await createWorkflowVersion({
        workflowGroupId: previousWorkflow.workflowGroupId,
        name: previousWorkflow.name,
        status: "waiting_approval",
        currentStep: "finance_review_step",
        context: previousWorkflow.context,
        createdById: previousWorkflow.createdById || undefined,
        previousWorkflowId: previousWorkflow.id
      });

      console.log(`Workflow ${newVersion.workflowGroupId} v${newVersion.version} marked as waiting for approval`);
      return newVersion;
    });

    const approval = await step.waitForEvent(`human.approval.${createWorkFlow.humanTaskId}`, {
      event: `human.approval.${createWorkFlow.humanTaskId}`,
      timeout: "300s"
    });

    if (approval && approval.data.status === "approve") {
      await step.run("execute_purchase", async () => {
        console.log(`Purchase ${purchaseData.id} approved and executed`);
        
        await prisma.humanTask.update({
          where: { id: createWorkFlow.humanTaskId },
          data: {
            status: "approved",
            response: approval.data
          }
        });
        
        // Create new workflow version for approved state
        const approvedWorkflow = await createWorkflowVersion({
          workflowGroupId: createWorkFlow.workflowGroupId,
          name: "Purchase Approval Flow",
          status: "approved",
          currentStep: "purchase_execution",
          context: purchaseData,
          previousWorkflowId: waitingWorkflow.id
        });
        
        // Log the approval event
        await prisma.eventLog.create({
          data: {
            workflowId: approvedWorkflow.id,
            stepId: "purchase_execution",
            type: "purchase.approved",
            data: {
              decision: approval.data.decision,
              comment: approval.data.comment,
              approvedBy: approval.data.approvedBy || "unknown",
              purchaseId: purchaseData.id
            },
            actor: approval.data.approvedBy || "human.approver"
          }
        });
        
        console.log(`Workflow ${approvedWorkflow.workflowGroupId} v${approvedWorkflow.version} approved`);
        
        return {
          purchaseId: purchaseData.id,
          status: 'executed',
          approvedBy: approval.data.approvedBy || "unknown",
          comment: approval.data.comment,
          executedAt: new Date().toISOString()
        };
      });
    } else if (approval && approval.data.status === "reject") {
      await step.run("reject_purchase", async () => {
        console.log(`Purchase ${purchaseData.id} rejected`);
        
        // Update human task status
        await prisma.humanTask.update({
          where: { id: createWorkFlow.humanTaskId },
          data: {
            status: "rejected",
            response: approval.data
          }
        });
        
        // Create new workflow version for rejected state
        const rejectedWorkflow = await createWorkflowVersion({
          workflowGroupId: createWorkFlow.workflowGroupId,
          name: "Purchase Approval Flow",
          status: "rejected",
          currentStep: "purchase_rejected",
          context: purchaseData,
          previousWorkflowId: waitingWorkflow.id
        });
        
        await prisma.eventLog.create({
          data: {
            workflowId: rejectedWorkflow.id,
            stepId: "purchase_rejected",
            type: "purchase.rejected",
            data: {
              decision: approval.data.decision,
              comment: approval.data.comment,
              rejectedBy: approval.data.approvedBy || "unknown",
              purchaseId: purchaseData.id
            },
            actor: approval.data.approvedBy || "human.approver"
          }
        });
        
        console.log(`Workflow ${rejectedWorkflow.workflowGroupId} v${rejectedWorkflow.version} rejected`);
        
        return {
          purchaseId: purchaseData.id,
          status: 'rejected',
          rejectedBy: approval.data.approvedBy || "unknown",
          comment: approval.data.comment,
          rejectedAt: new Date().toISOString()
        };
      });
    } else {
      await step.run("timeout_purchase", async () => {
        console.log(`Purchase ${purchaseData.id} timed out`);
        
        // Update human task status for timeout
        await prisma.humanTask.update({
          where: { id: createWorkFlow.humanTaskId },
          data: {
            status: "timed_out"
          }
        });
        
        // Create new workflow version for timeout state
        const timedOutWorkflow = await createWorkflowVersion({
          workflowGroupId: createWorkFlow.workflowGroupId,
          name: "Purchase Approval Flow",
          status: "rejected",
          currentStep: "purchase_timeout",
          context: purchaseData,
          previousWorkflowId: waitingWorkflow.id
        });
        
        // Log the timeout event
        await prisma.eventLog.create({
          data: {
            workflowId: createWorkFlow.workflowId,
            stepId: "purchase_timeout",
            type: "purchase.timeout",
            data: {
              reason: "approval_timeout",
              purchaseId: purchaseData.id,
              timeoutDuration: "300s"
            },
            actor: "system.timeout"
          }
        });
        
        return {
          purchaseId: purchaseData.id,
          status: 'cancelled',
          reason: 'timeout',
          timeoutAt: new Date().toISOString()
        };
      });
    }
  }
);

export const functions = [approvalWorkflow];
