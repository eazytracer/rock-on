---
title: Realtime "Hello World" Test Plan
created: 2025-10-30T21:23
status: Ready to Execute
purpose: Isolate and validate Supabase Realtime postgres_changes functionality
---

# Realtime "Hello World" Test Plan

## Purpose

Create a simple, isolated test to validate that Supabase Realtime `postgres_changes` subscriptions work with local Supabase, before attempting to fix the main application.

## Test Strategy

1. Create simple test table with REPLICA IDENTITY FULL
2. Add to supabase_realtime publication
3. Create HTML page with:
   - Button to add messages
   - Stream to display incoming realtime events
4. Test with manual SQL inserts as backup

---

## Step 1: Create Test Table (SQL)

```bash
# Run this to create the test infrastructure
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres << 'EOF'

-- Create simple test table
CREATE TABLE IF NOT EXISTS public.test_realtime (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL: Set replica identity to FULL
ALTER TABLE public.test_realtime REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_realtime;

-- Create simple RLS policy (allow all for testing)
ALTER TABLE public.test_realtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for testing"
ON public.test_realtime
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert test message
INSERT INTO public.test_realtime (message) VALUES ('Hello from setup!');

-- Verify everything
SELECT 'Table created:' as step, count(*) as rows FROM public.test_realtime;
SELECT 'In publication:' as step, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'test_realtime';
SELECT 'Replica identity:' as step,
  CASE relreplident
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'f' THEN 'FULL'
  END as setting
FROM pg_class WHERE relname = 'test_realtime';

EOF
```

**Expected Output:**
```
      step        | rows
------------------+------
 Table created:   |    1

      step       | tablename
-----------------+-----------------
 In publication: | test_realtime

       step        | setting
-------------------+--------
 Replica identity: | FULL
```

---

## Step 2: Get Supabase Credentials

```bash
# Get your anon key and URL
echo "Supabase URL: http://127.0.0.1:54321"
echo "Anon Key:"
grep VITE_SUPABASE_ANON_KEY .env | cut -d'=' -f2
```

---

## Step 3: Create Test HTML Page

```bash
cat > /tmp/realtime-test.html << 'HTMLEOF'
<!DOCTYPE html>
<html>
<head>
  <title>Realtime Test - Hello World</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    body {
      font-family: monospace;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
    }
    #status {
      padding: 10px;
      margin: 10px 0;
      border-radius: 5px;
      font-weight: bold;
    }
    .connected { background: #d4edda; color: #155724; }
    .disconnected { background: #f8d7da; color: #721c24; }
    .connecting { background: #fff3cd; color: #856404; }
    #messages {
      border: 1px solid #ccc;
      padding: 10px;
      margin: 10px 0;
      height: 300px;
      overflow-y: auto;
      background: #f8f9fa;
    }
    .message {
      padding: 5px;
      margin: 5px 0;
      border-left: 3px solid #007bff;
      background: white;
    }
    .message.insert { border-left-color: #28a745; }
    .message.update { border-left-color: #ffc107; }
    .message.delete { border-left-color: #dc3545; }
    button {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      margin: 5px;
    }
    input {
      padding: 10px;
      font-size: 16px;
      width: 300px;
    }
  </style>
</head>
<body>
  <h1>🧪 Realtime "Hello World" Test</h1>

  <div id="status" class="connecting">⏳ Connecting...</div>

  <h2>Send Message</h2>
  <input type="text" id="messageInput" placeholder="Enter message..." />
  <button onclick="sendMessage()">📤 Send Message</button>
  <button onclick="clearMessages()">🗑️ Clear Display</button>

  <h2>Realtime Stream (listening for postgres_changes)</h2>
  <div id="messages"></div>

  <h2>Debug Info</h2>
  <div id="debug" style="font-size: 12px; color: #666;"></div>

  <script>
    // REPLACE THESE WITH YOUR ACTUAL VALUES
    const SUPABASE_URL = 'http://127.0.0.1:54321'
    const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE'

    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const messagesDiv = document.getElementById('messages')
    const statusDiv = document.getElementById('status')
    const debugDiv = document.getElementById('debug')

    let messageCount = 0

    function updateStatus(status, message) {
      statusDiv.className = status
      statusDiv.textContent = message
      addDebug(`Status: ${message}`)
    }

    function addDebug(message) {
      const timestamp = new Date().toLocaleTimeString()
      debugDiv.innerHTML += `<div>[${timestamp}] ${message}</div>`
      debugDiv.scrollTop = debugDiv.scrollHeight
    }

    function addMessage(type, data) {
      messageCount++
      const timestamp = new Date().toLocaleTimeString()
      const msg = document.createElement('div')
      msg.className = `message ${type.toLowerCase()}`
      msg.innerHTML = `
        <strong>#${messageCount} [${type}]</strong> ${timestamp}<br>
        <code>${JSON.stringify(data, null, 2)}</code>
      `
      messagesDiv.appendChild(msg)
      messagesDiv.scrollTop = messagesDiv.scrollHeight
    }

    function clearMessages() {
      messagesDiv.innerHTML = ''
      messageCount = 0
    }

    async function sendMessage() {
      const input = document.getElementById('messageInput')
      const message = input.value.trim()

      if (!message) {
        alert('Please enter a message')
        return
      }

      try {
        addDebug(`Sending message: "${message}"`)
        const { data, error } = await supabase
          .from('test_realtime')
          .insert({ message })
          .select()

        if (error) {
          addDebug(`❌ Error: ${error.message}`)
          alert('Error: ' + error.message)
        } else {
          addDebug(`✅ Sent successfully`)
          input.value = ''
        }
      } catch (err) {
        addDebug(`❌ Exception: ${err.message}`)
        alert('Exception: ' + err.message)
      }
    }

    // Set up realtime subscription
    addDebug('Setting up realtime subscription...')
    updateStatus('connecting', '⏳ Connecting to Realtime...')

    const channel = supabase
      .channel('test-hello-world')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'test_realtime'
      }, (payload) => {
        addDebug(`📡 Received ${payload.eventType} event`)
        addMessage(payload.eventType, payload.new || payload.old)
      })
      .subscribe((status, err) => {
        addDebug(`Subscription status: ${status}`)

        if (err) {
          addDebug(`❌ Subscription error: ${JSON.stringify(err)}`)
          updateStatus('disconnected', '❌ Connection Failed')
          console.error('Subscription error:', err)
        } else if (status === 'SUBSCRIBED') {
          addDebug('✅ Successfully subscribed!')
          updateStatus('connected', '✅ Connected & Listening')
        } else if (status === 'CHANNEL_ERROR') {
          addDebug('❌ Channel error - check Realtime is enabled')
          updateStatus('disconnected', '❌ Channel Error')
        } else if (status === 'TIMED_OUT') {
          addDebug('⏱️ Subscription timed out')
          updateStatus('disconnected', '⏱️ Timed Out')
        } else if (status === 'CLOSED') {
          addDebug('🔌 Connection closed')
          updateStatus('disconnected', '🔌 Disconnected')
        }
      })

    // Allow Enter key to send
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage()
    })

    addDebug('Page loaded. Waiting for connection...')
  </script>
</body>
</html>
HTMLEOF

echo "✅ Created /tmp/realtime-test.html"
echo ""
echo "📝 Next: Edit the file and replace PASTE_YOUR_ANON_KEY_HERE with your actual key"
```

---

## Step 4: Update HTML with Your Anon Key

```bash
# Get your anon key
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d'=' -f2)

# Auto-replace in the HTML file
sed -i "s/PASTE_YOUR_ANON_KEY_HERE/$ANON_KEY/" /tmp/realtime-test.html

echo "✅ Anon key inserted into HTML file"
```

---

## Step 5: Open Test Page

```bash
# Option 1: Open in default browser
open /tmp/realtime-test.html

# Option 2: View path
echo "Open this file in your browser:"
echo "file:///tmp/realtime-test.html"
```

---

## Step 6: Manual Test via SQL (while watching HTML page)

Open another terminal and run:

```bash
# Insert messages via SQL while watching the HTML page
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres << 'EOF'

-- Insert test message #1
INSERT INTO test_realtime (message) VALUES ('Test message from SQL!');

-- Wait 2 seconds
SELECT pg_sleep(2);

-- Insert test message #2
INSERT INTO test_realtime (message) VALUES ('Another message!');

-- Wait 2 seconds
SELECT pg_sleep(2);

-- Update a message
UPDATE test_realtime SET message = 'Updated message!' WHERE id = 1;

-- Wait 2 seconds
SELECT pg_sleep(2);

-- Delete a message
DELETE FROM test_realtime WHERE id = 1;

-- Show all messages
SELECT * FROM test_realtime ORDER BY created_at DESC;

EOF
```

**Expected in HTML page:**
- 🟢 "Connected & Listening" status
- Messages appear in real-time as they're inserted
- No delay (< 1 second)

---

## Alternative: Auto-Insert Script (Cron-style)

Create a script that inserts messages every 5 seconds:

```bash
cat > /tmp/auto-insert.sh << 'SHEOF'
#!/bin/bash
# Auto-insert messages every 5 seconds

echo "🔄 Starting auto-insert (Ctrl+C to stop)..."

counter=1
while true; do
  timestamp=$(date +"%H:%M:%S")
  message="Auto message #$counter at $timestamp"

  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
    -c "INSERT INTO test_realtime (message) VALUES ('$message');" \
    -q

  echo "✅ Inserted: $message"
  counter=$((counter + 1))
  sleep 5
done
SHEOF

chmod +x /tmp/auto-insert.sh

echo "✅ Created /tmp/auto-insert.sh"
echo "Run it with: /tmp/auto-insert.sh"
```

---

## Success Criteria

### ✅ Working (Realtime is functional)
- HTML page shows "✅ Connected & Listening"
- Messages inserted via SQL appear in HTML within 1 second
- All event types work (INSERT, UPDATE, DELETE)
- Debug log shows "📡 Received INSERT event"

### ❌ Not Working (Configuration issue)
- HTML page shows "❌ Connection Failed" or "❌ Channel Error"
- No messages appear when inserting via SQL
- Subscription status is not "SUBSCRIBED"
- Empty error objects in debug log

---

## Troubleshooting

### Issue: "Connection Failed" or empty error

**Try:**
1. Check REPLICA IDENTITY is FULL:
   ```bash
   psql $DATABASE_URL -c "SELECT relname, relreplident FROM pg_class WHERE relname = 'test_realtime';"
   # Should show: f (FULL)
   ```

2. Check table is in publication:
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM pg_publication_tables WHERE tablename = 'test_realtime';"
   # Should return 1 row
   ```

3. Check anon key is correct:
   ```bash
   grep VITE_SUPABASE_ANON_KEY .env
   ```

4. Check Realtime logs:
   ```bash
   docker logs supabase_realtime_rock-on -f
   # Should show subscription attempts
   ```

### Issue: "Channel Error"

This usually means the table isn't in the publication or Realtime isn't enabled.

**Fix:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE test_realtime;
```

### Issue: Subscription works but no events

This means REPLICA IDENTITY might be DEFAULT instead of FULL.

**Fix:**
```sql
ALTER TABLE test_realtime REPLICA IDENTITY FULL;
-- Restart Supabase
supabase stop && supabase start
```

---

## Cleanup (After Testing)

```bash
# Remove test table
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres << 'EOF'
DROP TABLE IF EXISTS test_realtime CASCADE;
EOF

# Remove test files
rm /tmp/realtime-test.html
rm /tmp/auto-insert.sh
```

---

## Next Steps After Validation

### If Test WORKS ✅

Apply same configuration to main tables:

```sql
-- Set REPLICA IDENTITY FULL on main tables
ALTER TABLE songs REPLICA IDENTITY FULL;
ALTER TABLE setlists REPLICA IDENTITY FULL;
ALTER TABLE shows REPLICA IDENTITY FULL;
ALTER TABLE practice_sessions REPLICA IDENTITY FULL;

-- Restart Supabase
-- supabase stop && supabase start

-- Test main app
```

### If Test FAILS ❌

The issue is with local Supabase Realtime configuration, not your app. Options:

1. Upgrade Supabase CLI: `npm update -g supabase`
2. Check Supabase GitHub issues for local postgres_changes
3. Deploy to Supabase Cloud (guaranteed to work)

---

## Quick Copy-Paste Workflow

```bash
# 1. Create test table
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
CREATE TABLE IF NOT EXISTS test_realtime (id BIGSERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE test_realtime REPLICA IDENTITY FULL;
ALTER TABLE test_realtime ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_allow_all ON test_realtime FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE test_realtime;
SELECT 'Setup complete!' as status;"

# 2. Get anon key
grep VITE_SUPABASE_ANON_KEY .env

# 3. Open test HTML (use commands from Step 3-5 above)

# 4. Test with SQL insert
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "INSERT INTO test_realtime (message) VALUES ('Hello Realtime!');"

# 5. Watch HTML page for incoming message
```

---

**Created:** 2025-10-30T21:23
**Status:** Ready to Execute
**Time Estimate:** 10 minutes
**Purpose:** Validate Realtime works before fixing main app
