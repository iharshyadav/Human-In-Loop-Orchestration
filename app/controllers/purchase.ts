import { Request, Response } from 'express';
import {v4 as uuid} from "uuid"

interface PurchaseApprovalData {
  amount: number;
  item: string;
}

interface PurchaseRequestBody {
  type: 'purchase_approval';
  data: PurchaseApprovalData;
}

export const processPurchaseApproval = async (req: Request<{}, {}, PurchaseRequestBody>, res: Response) => {
  try {
    const { type, data } = req.body;

    if (type !== 'purchase_approval') {
      return res.status(400).json({
        error: 'Invalid request type',
        message: 'Expected type to be "purchase_approval"'
      });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        error: 'Missing data',
        message: 'Request must include data object'
      });
    }

    const { amount, item } = data;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a positive number'
      });
    }

    if (typeof item !== 'string' || item.trim() === '') {
      return res.status(400).json({
        error: 'Invalid item',
        message: 'Item must be a non-empty string'
      });
    }

    const uniqueID = uuid();

    return res.status(200).json({
      success: true,
      message: 'Purchase approval processed successfully',
      data: {
        id: uniqueID,
        amount,
        item
      }
    });

  } catch (error) {
    console.error('Purchase approval error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process purchase approval'
    });
  }
};