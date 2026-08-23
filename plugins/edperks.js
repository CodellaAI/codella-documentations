module.exports = {
    name: 'EdPerks',
    description: 'EdPerks stamps a rolled "perk" onto a player\'s main tool — a pickaxe, sword, rod, whatever the active provider owns — granting stat boosts at a rolled level. Its API is provider-based: any plugin can register a PerkProvider so EdPerks knows how to find that plugin\'s tool, which stats it supports, and what to do when a perk lands, plus read/write perks on items and drive the roll and ticket economy directly.',
    pluginId: 'EdPerks',
    systemDownloadURL: `
        https://raw.githubusercontent.com/CodellaAI/codella-documentations/main/lib/EdPerks-API.jar
    `,
    dependencies: `
        Java 21
    `,
    mavenIntegration: `
        <repositories>
            // SYSTEM DEPENDENCY NO REPOSITORY
        </repositories>
        <dependencies>
            <dependency>
                <groupId>es.edwardbelt</groupId>
                <artifactId>edperks-api</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>\${basedir}/lib/EdPerks-API.jar</systemPath>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * EdPerks — es.edwardbelt.edperks.iapi
         *
         * The concept:
         *   A PERK is a named bonus (an id + display name) rolled at a LEVEL, carrying a map of
         *   stat boosts. It lives as NBT on ONE item: the player's "tool".
         *
         *   Which item counts as the tool depends on the active PERK PROVIDER. EdPerks ships
         *   providers for its sibling plugins, and any plugin can register its own so its tool
         *   participates in the same perk system.
         *
         * So there are two ways to use this API:
         *   1. As a CONSUMER — read/write perks and tickets on players (a crate, a quest reward).
         *   2. As a PROVIDER — teach EdPerks about your plugin's tool and stats.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [EdPerks]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import es.edwardbelt.edperks.iapi.EdPerksAPI;

        EdPerksAPI api = EdPerksAPI.getInstance();   // null until EdPerks has enabled
        \`\`\`

        EdPerksAPI:
        void registerProvider(PerkProvider provider)       // safe to call from another plugin's onEnable
        List<PerkProvider> getProviders()
        PerkProvider getActiveProvider(Player player)      // the provider managing the tool they are
                                                           // currently HOLDING, or null if none
        AppliedPerk getPerk(ItemStack tool)                // the perk on an item, or null
        ItemStack setPerk(ItemStack tool, String perkId, int level)   // returns the stamped item
        ItemStack clearPerk(ItemStack tool)                // returns the cleaned item
        AppliedPerk roll(Player player)                    // rolls and applies a perk to their held
                                                           // tool (honours pity); null if it couldn't
        int getTickets(UUID playerId)
        void addTickets(UUID playerId, int amount)         // negative to take
        int getTotalRolls(UUID playerId)
        static EdPerksAPI getInstance(); static void setInstance(EdPerksAPI)
        // The singleton is published at the END of EdPerks' onEnable, so fetch it from your own
        // onEnable with depend: [EdPerks], or from a delayed task.

        ============================================================================
        AppliedPerk — a perk sitting on an item
        ============================================================================
        AppliedPerk(String perkId, String displayName, int level, Map<String, Double> boosts)
        String getPerkId(); String getDisplayName(); int getLevel()
        Map<String, Double> getBoosts()                    // stat key -> boost value
        double boost(String statKey)                       // 0 when the perk doesn't grant that stat

        \`\`\`java
        AppliedPerk perk = api.getPerk(player.getInventory().getItemInMainHand());
        if (perk != null) {
            double extraTokens = perk.boost("tokens");     // 0.25 = +25%, by your own convention
            player.sendMessage("Perk: " + perk.getDisplayName() + " lvl " + perk.getLevel());
        }
        \`\`\`

        ============================================================================
        USING IT AS A CONSUMER
        ============================================================================
        --- Give a perk from a crate/quest reward ---
        \`\`\`java
        ItemStack tool = player.getInventory().getItemInMainHand();
        ItemStack stamped = api.setPerk(tool, "fortunate", 3);
        player.getInventory().setItemInMainHand(stamped);   // setPerk RETURNS the item — set it back
        \`\`\`

        --- Hand out roll tickets ---
        \`\`\`java
        api.addTickets(player.getUniqueId(), 5);
        int left = api.getTickets(player.getUniqueId());
        \`\`\`

        --- Trigger a roll ---
        \`\`\`java
        AppliedPerk rolled = api.roll(player);              // null if they had no ticket / no tool
        if (rolled != null) player.sendMessage("You rolled " + rolled.getDisplayName() + "!");
        \`\`\`

        --- Apply the boost in your own logic ---
        \`\`\`java
        AppliedPerk perk = api.getPerk(api.getActiveProvider(player).getTool(player));
        double multiplier = 1 + (perk == null ? 0 : perk.boost("damage"));
        \`\`\`

        ============================================================================
        WRITING A PROVIDER — teaching EdPerks about YOUR tool
        ============================================================================
        PerkProvider (es.edwardbelt.edperks.iapi.provider):
        String id()                                        // a stable provider id, e.g. "myplugin"
        boolean isAvailable()                              // false = this provider is inactive right now
        ItemStack getTool(Player player)                   // the item perks live on; null if they have none
        boolean isTool(ItemStack item)
        void setTool(Player player, ItemStack item)        // write the (re-stamped) item back
        List<BoostStat> supportedStats()                   // which stat keys your tool understands
        void onPerkApplied(Player player, AppliedPerk perk)
        void onPerkCleared(Player player)
        default void updateTool(Player player)             // re-render lore after a change
        default String perkSlot(ItemStack item)
        default void openReturnMenu(Player player)         // where to send the player after the roll GUI
        default boolean charge(Player player, String currency, BigDecimal amount)  // pay for a roll

        BoostStat (es.edwardbelt.edperks.iapi.provider):
        BoostStat(String key, String displayName)
        BoostStat(String key, String displayName, boolean inverted)
        String getKey()          // the stable id used in perk configs and NBT, e.g. "damage"
        String getDisplayName()  // the human label used in perk lore, e.g. "Damage"
        boolean isInverted()     // higher values are WORSE for the player (e.g. a millisecond
                                 // attack-speed reduction). Informational for hosts/UI only —
                                 // EdPerks always stores the raw value.

        {IMPORTANT} A perk boost whose key is not in the active provider's supportedStats() simply
        contributes NOTHING on that host — it is not an error. That is deliberate: it lets one perk
        catalogue serve several different host plugins (EdDungeons, EdTools, a prison pickaxe…),
        each picking up only the stats it understands.

        \`\`\`java
        public class MyToolProvider implements PerkProvider {

            @Override public String id() { return "myplugin"; }
            @Override public boolean isAvailable() { return true; }

            @Override public ItemStack getTool(Player player) {
                return MyPlugin.get().getToolOf(player);            // your own lookup
            }
            @Override public boolean isTool(ItemStack item) {
                return MyPlugin.get().isMyTool(item);
            }
            @Override public void setTool(Player player, ItemStack item) {
                MyPlugin.get().storeTool(player, item);
            }

            @Override public List<BoostStat> supportedStats() {
                return List.of(
                        new BoostStat("damage",   "&cDamage"),
                        new BoostStat("speed",    "&bSpeed"),
                        new BoostStat("cooldown", "&7Cooldown", true)   // lower is better
                );
            }

            @Override public void onPerkApplied(Player player, AppliedPerk perk) {
                MyPlugin.get().recalculateStats(player);
                updateTool(player);
            }

            @Override public void onPerkCleared(Player player) {
                MyPlugin.get().recalculateStats(player);
            }

            @Override public boolean charge(Player player, String currency, BigDecimal amount) {
                return MyEconomy.take(player.getUniqueId(), currency, amount);   // false = can't afford
            }
        }

        // In onEnable, after EdPerks has enabled:
        EdPerksAPI.getInstance().registerProvider(new MyToolProvider());
        \`\`\`

        {IMPORTANT} \`supportedStats()\` defines the vocabulary. EdPerks only ever rolls stat keys a
        provider declares, and the same key is what \`AppliedPerk#boost(key)\` reads back — so the
        keys in your perk configs, your supportedStats list, and your \`boost(...)\` lookups must all
        match exactly.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - EdPerksAPI.getInstance() returns null until EdPerks has enabled. Grab it in your onEnable
          with \`depend: [EdPerks]\`, or from a delayed task.
        - setPerk/clearPerk RETURN a new ItemStack — they do not mutate in place. Always write the
          returned item back into the inventory or through your provider's setTool.
        - Register your provider in onEnable. Providers are consulted when a player opens the perk
          menu or rolls, so registering late means the first players see no tool.
        - isAvailable() lets a provider bow out dynamically (e.g. the feature is disabled in your
          config). Return false rather than unregistering.
        - Only ONE provider is active per player at a time — getActiveProvider(player) resolves it.
          Do not assume yours is the one that answered.
        - The boost VALUES are whatever your configs define; EdPerks does not impose a unit. The
          common convention is a fraction above 1 (0.25 = +25%). Pick one and use it consistently
          across configs and code.
        - If the perk lives on an item that another plugin rebuilds (a prison pickaxe, a custom
          sword), make sure that plugin preserves unknown NBT — otherwise a re-give silently wipes
          the perk.
    `
};
