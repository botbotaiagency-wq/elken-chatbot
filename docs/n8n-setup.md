# n8n Integration Setup Guide

Connect your n8n workflow to the Ask Ethan Digital chatbot webhook so that WhatsApp and Telegram messages are processed by the AI pipeline and responses are sent back to users automatically.

## Prerequisites

Before starting, you need:

1. **Deployed app URL** — your Vercel deployment URL (e.g. `https://your-app.vercel.app`)
2. **Bot ID** — the UUID of the Ask Ethan Digital bot (found in the dashboard URL when viewing the bot)
3. **API key** — generated from the dashboard under **Integrations** > **API Keys**

Your webhook URL will be:
```
https://your-app.vercel.app/api/chat/<BOT_ID>
```

---

## WhatsApp Setup

### Step 1: Create an n8n Workflow

1. Open n8n and click **New Workflow**
2. Add a **WhatsApp Business Cloud** trigger node (or your WhatsApp provider's trigger)
3. Configure the trigger to listen for incoming messages
4. Name the trigger node something like `WhatsApp Trigger`

### Step 2: Add an HTTP Request Node

1. Click **+** to add a new node after the trigger
2. Search for and select **HTTP Request**
3. Configure as follows:

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `https://your-app.vercel.app/api/chat/<BOT_ID>` |
| Authentication | None (API key is passed as a header) |
| Content Type | `JSON` |
| Response Format | `Text` (important — the endpoint streams text) |

### Step 3: Configure the X-API-Key Header

In the HTTP Request node:

1. Click **Add Header**
2. Name: `X-API-Key`
3. Value: your API key (e.g. `ethan_live_xxxxxxxxxxxxxxxx`)

### Step 4: Configure the Request Body

In the HTTP Request node, set the **Body** to:

```json
{
  "message": "{{ $json.message.text }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "whatsapp",
  "conversationId": "{{ $json.message.chat.id }}"
}
```

**Note:** `$json.message.text`, `$json.message.from.id`, and `$json.message.chat.id` are example n8n expressions for a WhatsApp Business Cloud trigger. Adjust these to match the actual output fields from your trigger node — use the **Input** panel in n8n to inspect the exact field names.

### Step 5: Handle the Streaming Response

The chatbot endpoint returns a streaming text response. In n8n:

1. The HTTP Request node will receive the full streamed text when the stream completes
2. The response body is the plain text of the bot's reply
3. Store the response in a variable: `{{ $json.body }}` or `{{ $json.data }}`

### Step 6: Send the Response Back to WhatsApp

1. Add a **WhatsApp Business Cloud** node (send message action)
2. Set the recipient to the sender's phone number from the trigger
3. Set the message body to the bot's response from Step 5

---

## Telegram Setup

### Step 1: Create an n8n Workflow

1. Open n8n and click **New Workflow**
2. Add a **Telegram Trigger** node
3. Configure the trigger to listen for incoming messages (`message` update type)
4. Name the trigger node `Telegram Trigger`

### Step 2: Add an HTTP Request Node

1. Click **+** to add a new node after the trigger
2. Search for and select **HTTP Request**
3. Configure as follows:

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `https://your-app.vercel.app/api/chat/<BOT_ID>` |
| Authentication | None |
| Content Type | `JSON` |
| Response Format | `Text` |

### Step 3: Configure the X-API-Key Header

1. Click **Add Header**
2. Name: `X-API-Key`
3. Value: your API key

### Step 4: Configure the Request Body

```json
{
  "message": "{{ $json.message.text }}",
  "userId": "{{ $json.message.from.id }}",
  "channel": "telegram",
  "conversationId": "{{ $json.message.chat.id }}"
}
```

**Note:** These are standard Telegram trigger output fields. The `$json.message.chat.id` is used as `conversationId` to maintain conversation state across messages from the same chat.

### Step 5: Handle the Response

Same as WhatsApp — the endpoint returns plain text. Capture it from the HTTP Request node output.

### Step 6: Send the Response Back to Telegram

1. Add a **Telegram** node (send message action)
2. Set **Chat ID** to `{{ $('Telegram Trigger').item.json.message.chat.id }}`
3. Set **Text** to the bot's response from Step 5

---

## Payload Reference

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `message` | string | The user's message text | `"What products help with fatigue?"` |
| `userId` | string | Unique ID of the sender | `"60123456789"` or `"123456789"` |
| `channel` | string | Messaging channel | `"whatsapp"` or `"telegram"` |
| `conversationId` | string | Chat/conversation ID for state continuity | `"60123456789"` or `"-100123456789"` |

**Required header:**

| Header | Value |
|--------|-------|
| `X-API-Key` | Your API key (e.g. `ethan_live_xxxxxxxxxxxxxxxx`) |
| `Content-Type` | `application/json` |

---

## Testing the Integration

Before going live, test with a direct curl call:

```bash
curl -X POST https://your-app.vercel.app/api/chat/<BOT_ID> \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ethan_live_xxxxxxxxxxxxxxxx" \
  -d '{"message":"Hi, what products do you have?","userId":"test-user-1","channel":"whatsapp","conversationId":"test-conv-1"}' \
  --no-buffer
```

You should receive a streamed text response from the bot.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` | Invalid or missing API key | Check the `X-API-Key` header value; regenerate the key from the dashboard if needed |
| `404 Not Found` | Wrong bot ID in the URL | Confirm the Bot ID from the dashboard URL — it is the UUID in `/dashboard/bots/<BOT_ID>` |
| Empty or no response | Streaming mode issue | Set HTTP Request node Response Format to `Text`; do not use `JSON` mode |
| `400 Bad Request` | Missing required fields | Ensure `message`, `userId`, and `channel` are all present in the body |
| Bot responds in wrong language | Language detection working as intended | The bot auto-detects language from the message content — send a message in the target language to verify |
| Booking flow not triggered | Feature flag not enabled | Confirm `feature_flags.booking_enabled = true` on the bot — run the seed script or set via dashboard |

---

## Notes

- **Conversation state** is maintained per `conversationId`. Use the chat's ID (not the user's ID) as `conversationId` so group chats are handled correctly.
- **Streaming**: The endpoint sends response chunks as they are generated. n8n's HTTP Request node will wait for the stream to complete before passing the full text to the next node — this is expected behaviour.
- **API key security**: Never expose the full API key in n8n UI screenshots or logs. The key is shown only once when generated; store it securely in n8n credentials.
