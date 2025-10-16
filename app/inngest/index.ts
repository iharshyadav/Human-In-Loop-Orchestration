import { processPurchaseApproval } from "../controllers/purchase";
import prisma from "../database/db";
import { inngest } from "./client";

interface CreateWorkflowResult {
  statusCode: number | null;
  response: any; 
  workflowId: string;
  humanTaskId: string;
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

      const workflowStarted = await prisma.workflow.create({
        data : {
          name : "Purchase Approval Flow",
          status : "running",
          currentStep : "first_step",
          context: JSON.parse(JSON.stringify(responseData?.data || {})),
          lastEventId : "null",
          version: 1
        }
      })

      const humanTaskStageOne = await prisma.humanTask.create({
        data: {
          workflowId: createWorkFlow.workflowId,
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
      
      return {
        statusCode,
        response: responseData,
        workflowId: workflowStarted.id,
        humanTaskId : humanTaskStageOne.id
      };
    });

    console.log('Purchase workflow created:', createWorkFlow);
    
    if (createWorkFlow.statusCode !== 200) {
      throw new Error(`Purchase creation failed: ${createWorkFlow.response.message}`);
    }
    
    const purchaseData = createWorkFlow.response.data;
    
    // if (!purchaseData.requiresApproval) {
    //   await step.run("auto_approve_purchase", async () => {
        console.log(`Purchase ${purchaseData.id} auto-approved (amount: $${purchaseData.amount})`);
    //     return {
    //       purchaseId: purchaseData.id,
    //       status: 'approved',
    //       reason: 'Below approval threshold'
    //     };
    //   });
    //   return;
    // }

    const approval = await step.waitForEvent("human.approval.response", {
      event: "app/onboarding.completed",
      timeout: "50s",
      match: "data.userId",
    });

    if (approval && approval.data.status === "approved") {
      await step.run("execute_purchase", async () => {
        console.log(`Purchase ${purchaseData.id} approved and executed`);
        return {
          purchaseId: purchaseData.id,
          status: 'executed',
          approvedBy: approval.data.approvedBy,
          executedAt: new Date().toISOString()
        };
      });
    } else {
      await step.run("cancel_purchase", async () => {
        console.log(`Purchase ${purchaseData.id} rejected or timed out`);
        return {
          purchaseId: purchaseData.id,
          status: 'cancelled',
          reason: approval ? 'rejected' : 'timeout'
        };
      });
    }
  }
);

export const functions = [approvalWorkflow];
