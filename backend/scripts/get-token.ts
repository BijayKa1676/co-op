/**
 * Quick script to get a Supabase access token for testing
 * 
 * Usage:
 *   npx ts-node scripts/get-token.ts
 * 
 * Reads SUPABASE_URL and SUPABASE_ANON_KEY from .env file
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=["']?([^"'\n]*)["']?$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function main() {
  console.log('\n🔐 Supabase Token Generator\n');

  // Get Supabase credentials from .env
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
    rl.close();
    process.exit(1);
  }

  console.log('Using Supabase URL:', supabaseUrl);
  console.log('');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\nChoose action:');
  console.log('1. Sign up (new user)');
  console.log('2. Sign in (existing user)');
  const action = await question('Enter 1 or 2: ');

  const email = process.env.EMAIL || await question('Email: ');
  const password = process.env.PASSWORD || await question('Password: ');

  if (action === '1') {
    // Sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('\n❌ Sign up failed:', error.message);
      rl.close();
      process.exit(1);
    }

    if (data.session) {
      console.log('\n✅ Sign up successful!\n');
      console.log('Access Token (copy this to test.http):');
      console.log('─'.repeat(50));
      console.log(data.session.access_token);
      console.log('─'.repeat(50));
      console.log('\nUser ID:', data.user?.id);
      console.log('Email:', data.user?.email);
    } else {
      console.log('\n📧 Check your email for confirmation link');
      console.log('After confirming, run this script again with option 2 to sign in');
    }
  } else {
    // Sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('\n❌ Sign in failed:', error.message);
      rl.close();
      process.exit(1);
    }

    console.log('\n✅ Sign in successful!\n');
    console.log('Access Token (copy this to test.http):');
    console.log('─'.repeat(50));
    console.log(data.session.access_token);
    console.log('─'.repeat(50));
    console.log('\nUser ID:', data.user?.id);
    console.log('Email:', data.user?.email);
    console.log('\nToken expires:', new Date(data.session.expires_at! * 1000).toLocaleString());
  }

  rl.close();
}

main().catch(console.error);
