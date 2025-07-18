import { NextResponse } from 'next/server';
import { seedDatabase } from '../../../../scripts/seed';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: 'Database reset is not allowed in production' },
      { status: 403 }
    );
  }

  try {
    console.log('API endpoint /api/reset-db called');
    await seedDatabase();
    return NextResponse.json({ message: 'Database reset successfully' });
  } catch (error) {
    console.error('Error resetting database from API:', error);
    return NextResponse.json(
      { message: 'Failed to reset database', error: (error as Error).message },
      { status: 500 }
    );
  }
} 