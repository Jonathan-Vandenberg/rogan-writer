import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCachedPlanningContext, setCachedPlanningContext, invalidatePlanningCache } from '@/lib/redis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

    const cached = await getCachedPlanningContext(bookId);
    
    if (!cached) {
      return NextResponse.json({ cached: false });
    }

    return NextResponse.json({
      cached: true,
      context: cached.context,
      contentHash: cached.contentHash,
      timestamp: cached.timestamp,
      age: Math.round((Date.now() - cached.timestamp) / 1000)
    });

  } catch (error) {
    console.error('Error getting planning cache:', error);
    return NextResponse.json({
      error: 'Failed to get cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    console.log('📥 API: Received cache SET request');
    const session = await auth();
    if (!session?.user?.id) {
      console.log('❌ API: Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body = await request.json();
    const { context, contentHash } = body;

    console.log('📥 API: bookId:', bookId, '| contentHash:', contentHash?.substring(0, 8), '| context length:', context?.length);

    if (!context || !contentHash) {
      console.log('❌ API: Missing context or contentHash');
      return NextResponse.json({ error: 'Missing context or contentHash' }, { status: 400 });
    }

    console.log('📥 API: Calling setCachedPlanningContext...');
    await setCachedPlanningContext(bookId, context, contentHash);
    console.log('✅ API: Cache SET successful');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error setting planning cache:', error);
    return NextResponse.json({
      error: 'Failed to set cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

    await invalidatePlanningCache(bookId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error invalidating planning cache:', error);
    return NextResponse.json({
      error: 'Failed to invalidate cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

