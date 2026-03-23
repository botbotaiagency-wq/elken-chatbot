# n8n Integration Setup Guide

This guide explains how to configure an n8n workflow to connect WhatsApp or Telegram to the Elken chatbot endpoint. n8n acts as the bridge: it receives incoming messages from the messaging channel and forwards them to the chat API, then sends the AI response back to the user.

---

## Section 1: Prerequisites

Before configuring n8n, ensure you have the following:

- **n8n instance** — self-hosted (Docker or npm) or [n8n.cloud](https://n8n.cloud) account, running and accessible
- **Messaging account** — one of:
  - WhatsApp Business API account via [360dialog](https://www.360dialog.com/), [Twilio](https://www.twilio.com/), or official [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
  - Telegram Bot Token from [@BotFather](https://t.me/botfather)
- **API key** — generated from the admin dashboard:
  1. Go to **Dashboard > Bots > Ask Ethan Digital**
  2. Click the **Keys** tab
  3. Click **Generate Key**
  4. Copy the full key (shown only once, format: `ethan_live_xxxxxxxxxxxxxxxx`)

Note the following values before proceeding:

| Value | Where to find it |
|-------|-----------------|
| Webhook URL | `https://your-vercel-url/api/chat/6176aa27-ce33-4dbc-b478-407414f86cac` |
| API Key | Copied from admin dashboard Keys tab |
| Bot ID | `6176aa27-ce33-4dbc-b478-407414f86cac` |

Replace `your-vercel-url` with your actual Vercel deployment URL (e.g., `https://elken-chatbot.vercel.app`).

---

## Section 2: WhatsApp Workflow Setup

### Step-by-step

1. **Create a new workflow** in n8n (click **New Workflow** from the n8n dashboard).

2. **Add a WhatsApp Trigger node** (or a **Webhook** node if using a third-party WhatsApp provider such as 360dialog or Twilio):
   - This node receives incoming WhatsApp messages
   - Configure it with your WhatsApp Business API credentials
   - Set the trigger to fire on incoming messages

3. **Add an HTTP Request node** connected to the trigger:
   - **Method:** `POST`
   - **URL:** `https://your-vercel-url/api/chat/6176aa27-ce33-4dbc-b478-407414f86cac`
   - **Authentication:** None (API key is passed as a header)
   - **Headers:** Add the following two headers:
     - `X-API-Key` → `ethan_live_xxxxxxxxxxxxxxxx` (paste your actual API key)
     - `Content-Type` → `application/json`
   - **Body Content Type:** JSON
   - **Body (JSON):**
     ```json
     {
       "message": "{{ $json.message.text }}",
       "userId": "{{ $json.message.from.id }}",
       "channel": "whatsapp",
       "conversationId": "{{ $json.message.chat.id }}"
     }
     ```
   - **Note:** The expression paths (`$json.message.text`, `$json.message.from.id`, `$json.message.chat.id`) must match your WhatsApp trigger node's output schema. The field names in the JSON body (`message`, `userId`, `channel`, `conversationId`) must remain exactly as shown — the chat endpoint expects these exact keys.

4. **Add a WhatsApp Send Message node** (or equivalent send node for your provider) connected to the HTTP Request node output:
   - **Recipient:** `{{ $json.message.from.id }}` (from the trigger node)
   - **Message:** `{{ $node["HTTP Request"].json.body }}` (the response body from the chat endpoint)
   - This sends the AI-generated reply back to the user's WhatsApp

5. **Save and activate** the workflow (toggle the Active switch in the top-right corner).

---

## Section 3: Telegram Workflow Setup

The Telegram setup follows the same structure as WhatsApp, with the following differences:

1. **Trigger:** Use the **Telegram Trigger** node — configure it with your Telegram Bot Token from @BotFather, set to listen for `message` updates.

2. **HTTP Request node:** Same configuration as WhatsApp, but with `"channel": "telegram"` in the body:
   ```json
   {
     "message": "{{ $json.message.text }}",
     "userId": "{{ $json.message.from.id }}",
     "channel": "telegram",
     "conversationId": "{{ $json.message.chat.id }}"
   }
   ```

3. **Send response:** Use the **Telegram Send Message** node:
   - **Chat ID:** `{{ $json.message.chat.id }}` (from the trigger node)
   - **Text:** `{{ $node["HTTP Request"].json.body }}`

4. **Save and activate** the workflow.

---

## Section 4: Handling Streaming Responses

The chat endpoint (`POST /api/chat/{botId}`) returns a **streaming response** using `text/event-stream` (Server-Sent Events).

**How n8n handles this:**
- n8n's HTTP Request node automatically waits for the stream to complete and collects the full response body
- No special streaming configuration is needed in n8n — the node returns the complete response text once the stream ends
- The full AI-generated reply is available in `$node["HTTP Request"].json.body` once the node completes

**If using n8n Cloud:**
- Long responses may approach the default execution timeout
- If timeouts occur, go to **Settings > Execution Timeout** and increase to 60 seconds or more

---

## Section 5: Testing the Workflow

1. In n8n, ensure the workflow is **active** (toggle on)
2. Send a test message from your WhatsApp or Telegram account to the bot number
3. In the n8n workflow view, click **Executions** to see recent runs
4. Open the latest execution and verify:
   - The **HTTP Request** node shows status `200` in its output
   - The HTTP Request node output contains the bot's response text in `.body`
5. Verify the response appears back in your WhatsApp or Telegram chat within 30 seconds

**Quick API test (without n8n):** Use the smoke test script to verify the endpoint is responding:

```bash
bash scripts/smoke-test.sh
```

This sends 9 test messages (3 intents × 3 languages) and reports PASS/FAIL for each.

---

## Section 6: Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| **HTTP 401** from the HTTP Request node | API key is invalid, revoked, or missing | Go to admin dashboard > Keys tab > generate a new key and update the `X-API-Key` header in the HTTP Request node |
| **HTTP 404** from the HTTP Request node | Bot ID in the URL is incorrect | Check the bot ID from the admin dashboard URL and update the webhook URL in the HTTP Request node |
| **Timeout / no response** | Vercel deployment is down or cold-starting | Test with `bash scripts/smoke-test.sh`; wait 30s and retry (cold starts can take 5-10s) |
| **Empty response body** | Bot has no knowledge base documents | Upload documents via admin dashboard > Documents tab; re-run the seed with `node scripts/seed-elken.mjs` |
| **Wrong language in response** | Message language not detected correctly | The bot auto-detects EN/BM/ZH — ensure the test message is clearly in one language |
| **Booking flow not triggered** | Booking feature flag disabled | Verify `feature_flags.booking_enabled = true` for the bot in the database |

---

*See also: `scripts/smoke-test.sh` for automated endpoint verification.*
*See also: `docs/manual-checklist.md` for manual end-to-end WhatsApp verification steps.*
