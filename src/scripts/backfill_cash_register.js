import { supabase } from '../api/supabaseClient.js';
import { format, subYears } from 'date-fns';

async function backfill() {
  const startDate = format(subYears(new Date(), 1), 'yyyy-MM-dd'); // Backfill last 1 year
  const endDate = format(new Date(), 'yyyy-MM-dd');

  console.log(`Starting backfill from ${startDate} to ${endDate}...`);

  try {
    const { data, error } = await supabase.rpc('backfill_cash_register_data', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error during backfill:', error);
      process.exit(1);
    }

    console.log('Backfill completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

backfill();
