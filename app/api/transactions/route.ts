/**
 * API Route: /api/transactions
 * GET - List recent transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTransactionEvent } from '@/lib/api/stores';

function createResponse<T>(data: T) {
  return {
    data,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  // Generate mock transactions
  const transactions = Array.from({ length: Math.min(limit, 100) }, () => {
    const txn = generateTransactionEvent();
    // Add more realistic timestamps spread over the last hour
    return {
      ...txn,
      createdAt: new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString(),
    };
  });

  // Sort by creation time descending
  transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(createResponse(transactions));
}
