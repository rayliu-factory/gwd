# Remote Questions

Remote questions let GWD ask for your input via Slack, Discord, or Telegram when running in headless auto mode. When GWD needs a decision, it posts the question to your configured channel and polls for a response.

## Setup

### Discord

```
/gwd remote discord
```

The wizard prompts for your bot token, validates it, lets you pick a server and channel, sends a test message, and saves the config.

**Bot requirements:**
- A bot application with a token from the [Discord Developer Portal](https://discord.com/developers/applications)
- Bot invited to the server with: Send Messages, Read Message History, Add Reactions, View Channel
- `DISCORD_BOT_TOKEN` environment variable set

### Slack

```
/gwd remote slack
```

**Bot requirements:**
- A Slack app with a bot token (`xoxb-...`) from [Slack API](https://api.slack.com/apps)
- Bot invited to the target channel
- Scopes: `chat:write`, `reactions:read`, `reactions:write`, `channels:read`, `groups:read`, `channels:history`, `groups:history`

### Telegram

```
/gwd remote telegram
```

**Bot requirements:**
- A bot token from [@BotFather](https://t.me/BotFather)
- Bot added to the target group chat
- `TELEGRAM_BOT_TOKEN` environment variable set

## Configuration

```yaml
remote_questions:
  channel: discord          # or slack or telegram
  channel_id: "1234567890123456789"
  timeout_minutes: 5        # 1-30, default 5
  poll_interval_seconds: 5  # 2-30, default 5
```

## How It Works

1. GWD encounters a decision point during auto mode
2. The question is posted to your channel as a rich message
3. GWD polls for a response at the configured interval
4. You respond by:
   - **Reacting** with a number emoji (1️⃣, 2️⃣, etc.) for single-question prompts
   - **Replying** with a number, comma-separated numbers, or free text
5. GWD picks up the response and continues
6. A ✅ reaction confirms receipt

### Response Formats

**Single question:** React with a number emoji, reply with a number, or reply with free text.

**Multiple questions:** Reply with semicolons (`1;2;custom text`) or newlines (one answer per line).

### Timeouts

If no response arrives within `timeout_minutes`, GWD continues with a timeout result — typically making a conservative default choice.

## Commands

| Command | Description |
|---------|-------------|
| `/gwd remote` | Show menu and current status |
| `/gwd remote slack` | Set up Slack |
| `/gwd remote discord` | Set up Discord |
| `/gwd remote telegram` | Set up Telegram |
| `/gwd remote status` | Show current config |
| `/gwd remote disconnect` | Remove configuration |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Remote auth failed" | Verify bot token is correct and not expired |
| "Could not send to channel" | Check bot has Send Messages permission; invite bot to channel |
| No response detected | Make sure you're replying to the prompt message, not posting a new one |
