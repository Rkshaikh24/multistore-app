import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import ws from 'ws';

config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    realtime: {
      transport: ws,
    },
  }
);

export default supabase;