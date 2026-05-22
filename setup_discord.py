import discord
import asyncio
import json

# ============================================================
# PASTE YOUR INFO HERE
# ============================================================
DISCORD_TOKEN = "PASTE_YOUR_BOT_TOKEN_HERE"
GUILD_ID = 1503287290175422625  # PASTE YOUR SERVER ID HERE (no quotes)
# ============================================================

# Full channel structure
STRUCTURE = [
    {
        "category": "📌 INFORMATION",
        "channels": ["welcome", "agent-status", "changelog"]
    },
    {
        "category": "🚨 CRITICAL ALERTS",
        "channels": ["build-failures", "vero-blocked", "margin-alerts", "account-alerts"]
    },
    {
        "category": "📦 PIPELINE ACTIVITY",
        "channels": ["research-updates", "listing-created", "price-updates", "stock-alerts"]
    },
    {
        "category": "💰 FINANCE & PERFORMANCE",
        "channels": ["daily-summary", "order-fulfilled", "finance-reconciliation", "performance-scores"]
    },
    {
        "category": "🔧 DEVELOPMENT",
        "channels": ["cline-updates", "hermes-tasks", "hermes-findings", "build-monitor"]
    },
    {
        "category": "🐛 DEBUG",
        "channels": ["debug-research", "debug-matching", "debug-listing", "debug-fulfillment"]
    },
    {
        "category": "📊 STRATEGY & INTELLIGENCE",
        "channels": ["competitor-analysis", "seo-reports", "inventory-health", "warmup-tracker"]
    },
    {
        "category": "💬 OPERATOR COMMANDS",
        "channels": ["hermes-commands", "cline-commands"]
    }
]

class SetupBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.webhooks = {}

    async def on_ready(self):
        print(f"✅ Bot connected as {self.user}")
        guild = self.get_guild(GUILD_ID)

        if not guild:
            print("❌ Server not found. Check your GUILD_ID.")
            await self.close()
            return

        print(f"📋 Setting up server: {guild.name}")

        # ============================================================
        # STEP 1: DELETE ALL EXISTING CHANNELS AND CATEGORIES
        # ============================================================
        print("\n🗑️  Deleting existing channels...")
        for channel in guild.channels:
            try:
                await channel.delete()
                print(f"  🗑️  Deleted: #{channel.name}")
                await asyncio.sleep(0.3)
            except Exception as e:
                print(f"  ⚠️  Could not delete #{channel.name}: {e}")

        print("\n✅ All old channels deleted. Building clean structure...")

        # ============================================================
        # STEP 2: CREATE NEW CLEAN STRUCTURE
        # ============================================================
        for section in STRUCTURE:
            # Create category
            category = await guild.create_category(section["category"])
            print(f"\n📁 Created category: {section['category']}")

            for channel_name in section["channels"]:
                # Create text channel
                channel = await guild.create_text_channel(
                    channel_name,
                    category=category
                )
                print(f"  ✅ Created: #{channel_name}")

                # Create webhook
                webhook = await channel.create_webhook(name=f"Syndrax-{channel_name}")
                self.webhooks[channel_name] = webhook.url
                print(f"  🔗 Webhook ready: #{channel_name}")

                await asyncio.sleep(0.5)

        # ============================================================
        # STEP 3: SAVE WEBHOOK URLS TO FILE
        # ============================================================
        output = {
            "webhooks": self.webhooks,
            "note": "Copy these URLs into your webhooks.config.ts file"
        }

        with open("discord_webhooks.json", "w") as f:
            json.dump(output, f, indent=2)

        print("\n" + "="*50)
        print("✅ SETUP COMPLETE!")
        print("="*50)
        print(f"✅ {sum(len(s['channels']) for s in STRUCTURE)} channels created")
        print(f"✅ {len(self.webhooks)} webhooks created")
        print("✅ Webhook URLs saved to: discord_webhooks.json")
        print("\nNext step: Copy webhook URLs from discord_webhooks.json")
        print("into C:\\hermes-workspace\\syndrax-sync\\src\\config\\webhooks.config.ts")
        print("="*50)

        await self.close()

async def main():
    print("="*50)
    print("Syndrax Sync — Discord Server Setup")
    print("="*50)

    if DISCORD_TOKEN == "PASTE_YOUR_BOT_TOKEN_HERE":
        print("❌ ERROR: Please paste your Discord Bot Token in the script")
        return

    if GUILD_ID == 1234567890:
        print("❌ ERROR: Please paste your Discord Server ID in the script")
        return

    print("⚠️  WARNING: This will DELETE all existing channels and rebuild from scratch.")
    confirm = input("Type YES to continue: ")
    if confirm.strip().upper() != "YES":
        print("❌ Cancelled.")
        return

    client = SetupBot()

    try:
        await client.start(DISCORD_TOKEN)
    except discord.LoginFailure:
        print("❌ Invalid bot token. Check your DISCORD_TOKEN.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())